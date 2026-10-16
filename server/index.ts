import { existsSync } from 'node:fs'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { z } from 'zod'
import { authRoutes, currentUser, type AppEnv } from './auth.ts'
import { sql } from './db.ts'
import { rateLimit } from './rateLimit.ts'
import { formatInterval, INITIAL_STATE, schedule } from './srs.ts'
import { percent, streaks } from './stats.ts'
import type { Heatmap, IntervalPreview, Rating, Stats } from '../shared/types.ts'

interface WordRow {
  id: number
  deckId: number
  korean: string
  meaning: string
  meaningEs: string | null
  hanja: string | null
  romanization: string | null
  partOfSpeech: string | null
  example: string | null
  exampleEn: string | null
  exampleEs: string | null
  dueAt: Date
  intervalDays: number
  easeFactor: number
  repetitions: number
  lapses: number
}

// A word as one user sees it: the shared content plus that user's progress,
// or the starting values if they have never reviewed it. Use with cardsOf().
const WORD_COLUMNS = sql`
  w.id, w.deck_id, w.korean, w.meaning, w.meaning_es, w.hanja, w.romanization, w.part_of_speech,
  w.example, w.example_en, w.example_es,
  coalesce(c.due_at, now()) as due_at,
  coalesce(c.interval_days, ${INITIAL_STATE.intervalDays}) as interval_days,
  coalesce(c.ease_factor, ${INITIAL_STATE.easeFactor}) as ease_factor,
  coalesce(c.repetitions, ${INITIAL_STATE.repetitions}) as repetitions,
  coalesce(c.lapses, ${INITIAL_STATE.lapses}) as lapses
`

// Every word (w) with this user's card (c) for it; c's columns are null for a new word.
const cardsOf = (userId: number) => sql`words w left join cards c on c.word_id = w.id and c.user_id = ${userId}`

const reviewInput = z.object({
  wordId: z.number().int().positive(),
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  durationMs: z.number().int().min(0).optional(),
})

const deckInput = z.object({ newPerDay: z.number().int().min(1).max(100) })

// Daily new-card limit when the user hasn't changed it.
const DEFAULT_NEW_PER_DAY = 10

const RATINGS: Rating[] = [1, 2, 3, 4]

// Cards reviewed at intervals shorter than this are "young", the rest "mature".
const MATURE_DAYS = 21

// A card left open in a background tab shouldn't count as an hour of study.
const MAX_ANSWER_MS = 60_000

const idParam = z.coerce.number().int().positive()

// "Today" follows the user's clock, which the client sends as ?tz=<IANA name>.
function timeZone(value: string | undefined): string {
  if (!value) return 'UTC'
  try {
    new Intl.DateTimeFormat('en', { timeZone: value })
    return value
  } catch {
    return 'UTC'
  }
}

// ?deck=<id> for one deck; ?deck=all (or nothing) for every deck, as null.
function deckScope(value: string | undefined): { deckId: number | null } | null {
  if (value === undefined || value === 'all') return { deckId: null }
  const id = idParam.safeParse(value)
  return id.success ? { deckId: id.data } : null
}

// The decks with this user's daily limit and counts; new_count is the words they never reviewed.
const selectDecks = (userId: number, deckId: number | null = null) => sql`
  select d.id, d.name, d.group_name, d.sort_order,
    coalesce(s.new_per_day, ${DEFAULT_NEW_PER_DAY}) as new_per_day,
    count(w.id)::int as word_count,
    count(w.id) filter (where c.word_id is null)::int as new_count
  from decks d
  left join deck_settings s on s.deck_id = d.id and s.user_id = ${userId}
  left join (${cardsOf(userId)}) on w.deck_id = d.id
  where ${deckId}::int is null or d.id = ${deckId}
  group by d.id, s.new_per_day
  order by d.sort_order, d.id
`

// Reviews per day (in the user's time zone), optionally for a single year.
const reviewsByDay = (userId: number, deckId: number | null, tz: string, year: number | null = null) => sql<
  { day: string; reviews: number; ms: number }[]
>`
  select to_char(day, 'YYYY-MM-DD') as day, count(*)::int as reviews, coalesce(sum(duration_ms), 0)::int as ms
  from (
    select (r.reviewed_at at time zone ${tz})::date as day, r.duration_ms
    from reviews r
    join words w on w.id = r.word_id
    where r.user_id = ${userId} and (${deckId}::int is null or w.deck_id = ${deckId})
  ) reviews_with_day
  where ${year}::int is null or extract(year from day) = ${year}
  group by day
  order by day
`

// Puts cards back to new: deletes the user's cards and review history.
const resetProgress = (userId: number, deckId: number | null) =>
  sql.begin(async (tx) => {
    const inDeck = tx`(${deckId}::int is null or w.deck_id = ${deckId})`
    await tx`delete from reviews r using words w where w.id = r.word_id and r.user_id = ${userId} and ${inDeck}`
    await tx`delete from cards c using words w where w.id = c.word_id and c.user_id = ${userId} and ${inDeck}`
  })

const deckExists = async (deckId: number) => (await sql`select 1 from decks where id = ${deckId}`).length > 0

const api = new Hono<AppEnv>()
// Generous for a person studying, low enough to stop a script hammering the server.
api.use(rateLimit(600, 60_000))
api.route('/auth', authRoutes)
// Everything below needs a signed-in user.
api.use(currentUser)

api.get('/decks', async (c) => c.json(await selectDecks(c.get('userId'))))

api.patch('/decks/:id', async (c) => {
  const id = idParam.safeParse(c.req.param('id'))
  const parsed = deckInput.safeParse(await c.req.json().catch(() => null))
  if (!id.success || !parsed.success) return c.json({ error: 'New words per day must be between 1 and 100.' }, 400)
  const userId = c.get('userId')
  if (!(await deckExists(id.data))) return c.json({ error: 'Deck not found.' }, 404)
  await sql`
    insert into deck_settings (user_id, deck_id, new_per_day)
    values (${userId}, ${id.data}, ${parsed.data.newPerDay})
    on conflict (user_id, deck_id) do update set new_per_day = excluded.new_per_day
  `
  const [deck] = await selectDecks(userId, id.data)
  return c.json(deck)
})

api.post('/decks/reset-all', async (c) => {
  await resetProgress(c.get('userId'), null)
  return c.body(null, 204)
})

api.post('/decks/:id/reset', async (c) => {
  const id = idParam.safeParse(c.req.param('id'))
  if (!id.success) return c.json({ error: 'Invalid deck.' }, 400)
  if (!(await deckExists(id.data))) return c.json({ error: 'Deck not found.' }, 404)
  await resetProgress(c.get('userId'), id.data)
  return c.body(null, 204)
})

// The session queue for a deck: every card that is due, then new cards up to
// what is left of the deck's daily limit.
api.get('/reviews/due', async (c) => {
  const deckId = idParam.safeParse(c.req.query('deck'))
  if (!deckId.success) return c.json({ error: 'Invalid deck.' }, 400)
  const userId = c.get('userId')
  const tz = timeZone(c.req.query('tz'))

  // new_today = cards of this deck whose very first review happened today.
  const [deck] = await sql<{ newPerDay: number; newToday: number }[]>`
    select coalesce(s.new_per_day, ${DEFAULT_NEW_PER_DAY}) as new_per_day,
      (
        select count(*)::int
        from (
          select min(r.reviewed_at) as first_at
          from reviews r
          join words w on w.id = r.word_id
          where w.deck_id = d.id and r.user_id = ${userId}
          group by r.word_id
        ) first_reviews
        where (first_at at time zone ${tz})::date = (now() at time zone ${tz})::date
      ) as new_today
    from decks d
    left join deck_settings s on s.deck_id = d.id and s.user_id = ${userId}
    where d.id = ${deckId.data}
  `
  if (!deck) return c.json({ error: 'Deck not found.' }, 404)
  const newLeft = Math.max(0, deck.newPerDay - deck.newToday)

  const [due, fresh] = await Promise.all([
    sql<WordRow[]>`
      select ${WORD_COLUMNS} from words w
      join cards c on c.word_id = w.id and c.user_id = ${userId}
      where w.deck_id = ${deckId.data} and c.due_at <= now()
      order by c.due_at, w.id
      limit 200
    `,
    sql<WordRow[]>`
      select ${WORD_COLUMNS} from ${cardsOf(userId)}
      where w.deck_id = ${deckId.data} and c.word_id is null
      order by w.position, w.id
      limit ${newLeft}
    `,
  ])
  return c.json([...due, ...fresh])
})

// What each answer button would do to this card right now.
api.get('/reviews/preview/:wordId', async (c) => {
  const id = idParam.safeParse(c.req.param('wordId'))
  if (!id.success) return c.json({ error: 'Invalid word.' }, 400)
  const [word] = await sql<WordRow[]>`
    select ${WORD_COLUMNS} from ${cardsOf(c.get('userId'))} where w.id = ${id.data}
  `
  if (!word) return c.json({ error: 'Word not found.' }, 404)
  const now = new Date()
  const preview: IntervalPreview[] = RATINGS.map((rating) => ({
    rating,
    ...formatInterval(schedule(word, rating, now).dueAt.getTime() - now.getTime()),
  }))
  return c.json(preview)
})

api.post('/reviews', async (c) => {
  const parsed = reviewInput.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'Invalid review.' }, 400)
  const { wordId, durationMs } = parsed.data
  const duration = durationMs === undefined ? null : Math.min(durationMs, MAX_ANSWER_MS)
  const rating: Rating = parsed.data.rating
  const userId = c.get('userId')

  const updated = await sql.begin(async (tx) => {
    // Locks this user's card row, if it has one, until the transaction ends,
    // so two answers sent at once can't both start from the same state.
    await tx`select 1 from cards where user_id = ${userId} and word_id = ${wordId} for update`
    const [word] = await tx<WordRow[]>`
      select ${WORD_COLUMNS} from ${cardsOf(userId)} where w.id = ${wordId}
    `
    if (!word) return null
    const next = schedule(word, rating)
    await tx`
      insert into cards (user_id, word_id, due_at, interval_days, ease_factor, repetitions, lapses)
      values (${userId}, ${wordId}, ${next.dueAt}, ${next.intervalDays}, ${next.easeFactor}, ${next.repetitions}, ${next.lapses})
      on conflict (user_id, word_id) do update set
        due_at = excluded.due_at,
        interval_days = excluded.interval_days,
        ease_factor = excluded.ease_factor,
        repetitions = excluded.repetitions,
        lapses = excluded.lapses
    `
    await tx`
      insert into reviews (user_id, word_id, rating, interval_before, interval_after, duration_ms)
      values (${userId}, ${wordId}, ${rating}, ${word.intervalDays}, ${next.intervalDays}, ${duration})
    `
    return { ...word, ...next }
  })

  return updated ? c.json(updated) : c.json({ error: 'Word not found.' }, 404)
})

api.get('/stats', async (c) => {
  const scope = deckScope(c.req.query('deck'))
  if (!scope) return c.json({ error: 'Invalid deck.' }, 400)
  const { deckId } = scope
  const userId = c.get('userId')
  const tz = timeZone(c.req.query('tz'))
  const inScope = sql`r.user_id = ${userId} and (${deckId}::int is null or w.deck_id = ${deckId})`

  const [[cards], answerRows, retentionRows, days, [{ today }]] = await Promise.all([
    // New = never reviewed; Learning = reviewed but not (or no longer) graduated.
    sql<{ total: number; newCards: number; learning: number; young: number; mature: number }[]>`
      select
        count(*)::int as total,
        count(*) filter (where not reviewed)::int as new_cards,
        count(*) filter (where reviewed and repetitions = 0)::int as learning,
        count(*) filter (where repetitions > 0 and interval_days < ${MATURE_DAYS})::int as young,
        count(*) filter (where repetitions > 0 and interval_days >= ${MATURE_DAYS})::int as mature
      from (
        select c.repetitions, c.interval_days, c.word_id is not null as reviewed
        from ${cardsOf(userId)}
        where ${deckId}::int is null or w.deck_id = ${deckId}
      ) cards
    `,
    sql<{ rating: Rating; n: number }[]>`
      select r.rating, count(*)::int as n
      from reviews r
      join words w on w.id = r.word_id
      where ${inScope}
      group by r.rating
    `,
    // The last six calendar months. Like Anki, only reviews of cards that had
    // an interval of a day or more count towards retention.
    sql<{ month: string; youngN: number; youngPassed: number; matureN: number; maturePassed: number }[]>`
      with months as (
        select generate_series(
          date_trunc('month', now() at time zone ${tz}) - interval '5 months',
          date_trunc('month', now() at time zone ${tz}),
          interval '1 month'
        ) as month
      )
      select to_char(m.month, 'YYYY-MM') as month,
        count(rv.id) filter (where rv.interval_before < ${MATURE_DAYS})::int as young_n,
        count(rv.id) filter (where rv.interval_before < ${MATURE_DAYS} and rv.rating >= 2)::int as young_passed,
        count(rv.id) filter (where rv.interval_before >= ${MATURE_DAYS})::int as mature_n,
        count(rv.id) filter (where rv.interval_before >= ${MATURE_DAYS} and rv.rating >= 2)::int as mature_passed
      from months m
      left join (
        select r.id, r.rating, r.interval_before,
          date_trunc('month', r.reviewed_at at time zone ${tz}) as month
        from reviews r
        join words w on w.id = r.word_id
        where ${inScope} and r.interval_before >= 1
      ) rv on rv.month = m.month
      group by m.month
      order by m.month
    `,
    reviewsByDay(userId, deckId, tz),
    sql<{ today: string }[]>`select to_char((now() at time zone ${tz})::date, 'YYYY-MM-DD') as today`,
  ])

  const stats: Stats = {
    total: cards.total,
    cards: { new: cards.newCards, learning: cards.learning, young: cards.young, mature: cards.mature },
    answers: RATINGS.map((rating) => answerRows.find((row) => row.rating === rating)?.n ?? 0),
    retention: retentionRows.map((row) => ({
      month: row.month,
      young: percent(row.youngPassed, row.youngN),
      mature: percent(row.maturePassed, row.matureN),
      all: percent(row.youngPassed + row.maturePassed, row.youngN + row.matureN),
    })),
    reviews: days.reduce((sum, d) => sum + d.reviews, 0),
    msToday: days.find((d) => d.day === today)?.ms ?? 0,
    streak: streaks(
      days.map((d) => d.day),
      today,
    ),
  }
  return c.json(stats)
})

api.get('/stats/heatmap', async (c) => {
  const scope = deckScope(c.req.query('deck'))
  const year = z.coerce.number().int().min(1970).max(9999).safeParse(c.req.query('year'))
  if (!scope || !year.success) return c.json({ error: 'Invalid deck or year.' }, 400)
  const days = await reviewsByDay(c.get('userId'), scope.deckId, timeZone(c.req.query('tz')), year.data)
  const heatmap: Heatmap = Object.fromEntries(days.map((d) => [d.day, d.reviews]))
  return c.json(heatmap)
})

const app = new Hono()

app.route('/api', api)
app.all('/api/*', (c) => c.json({ error: 'Not found.' }, 404))

app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'Something went wrong.' }, 500)
})

// After `npm run build`, this server also serves the React app, so one
// process on one port is the whole deployment. In development Vite does it.
if (existsSync('./dist/index.html')) {
  app.use('*', serveStatic({ root: './dist' }))
  app.get('*', serveStatic({ path: './dist/index.html' }))
}

const port = Number(process.env.PORT ?? 3001)
serve({ fetch: app.fetch, port }, () => {
  console.log(`API listening on http://localhost:${port}`)
})
