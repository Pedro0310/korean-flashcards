import { useEffect, useRef, useState, type ReactNode } from 'react'
import { api, errorMessage, type StatsDeck } from '../api.ts'
import { useAppContext } from '../components/Layout.tsx'
import Heatmap from '../components/stats/Heatmap.tsx'
import RetentionChart from '../components/stats/RetentionChart.tsx'
import { deckLabel, deckShortName, formatCount, groupDecks, groupMeta } from '../decks.ts'
import type { Deck, Heatmap as HeatmapData, Stats as StatsData } from '../../shared/types.ts'

const GOAL_MIN = 1
const GOAL_MAX = 100
const GOAL_PRESETS = [5, 10, 20, 30]

const panelClass = 'flex flex-col gap-3 rounded-panel bg-panel px-5 py-[18px] shadow-panel'
const headingClass = 'text-xs font-extrabold tracking-[0.12em] text-body'
const yearButtonClass = 'flex size-11 cursor-pointer items-center justify-center rounded-lg bg-chip'

const plural = (n: number, word: string) => `${formatCount(n)} ${word}${n === 1 ? '' : 's'}`

const formatDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

function daysFromNow(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return formatDate(d)
}

function DeckPicker({ decks, selected, onPick }: { decks: Deck[]; selected: StatsDeck; onPick: (deck: StatsDeck) => void }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => root.current?.contains(e.target as Node) || setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const current = decks.find((d) => d.id === selected)
  const words = current ? current.wordCount : decks.reduce((sum, d) => sum + d.wordCount, 0)

  const option = (value: StatsDeck, label: string, count: number) => {
    const on = value === selected
    return (
      <button
        key={value}
        type="button"
        role="option"
        aria-selected={on}
        onClick={() => {
          onPick(value)
          setOpen(false)
        }}
        className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 text-left text-[15px] ${on ? 'bg-row font-extrabold' : 'font-medium'}`}
      >
        <span>{label}</span>
        <span className="flex items-center gap-2 text-[13px] font-medium text-muted tabular-nums">
          {count ? formatCount(count) : '—'}
          <span aria-hidden="true" className="w-4">
            {on ? '✓' : ''}
          </span>
        </span>
      </button>
    )
  }

  return (
    <div ref={root} className="relative z-5">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex h-[52px] w-full cursor-pointer items-center gap-2.5 rounded-xl border-[1.5px] border-line bg-panel pr-3.5 pl-4 text-left shadow-panel"
      >
        <span className="text-xs font-extrabold tracking-[0.12em] text-muted">DECK</span>
        <span className="truncate text-base font-extrabold">{current ? deckLabel(current) : 'All decks'}</span>
        <span className="shrink-0 text-[13px] text-muted tabular-nums">{words ? `${formatCount(words)} words` : 'no words yet'}</span>
        <svg
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`ml-auto shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="Choose a deck"
          className="absolute top-[58px] right-0 left-0 flex max-h-[min(520px,70vh)] flex-col gap-0.5 overflow-y-auto rounded-xl border border-line bg-panel p-1.5 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.35)]"
        >
          {option('all', 'All decks', decks.reduce((sum, d) => sum + d.wordCount, 0))}
          {groupDecks(decks).map((group) => {
            const meta = groupMeta(group.name)
            const title = meta.title
            return (
              <div key={group.name} role="group" className="contents">
                <div className="px-3 pt-2.5 pb-1 text-[11px] font-extrabold tracking-[0.12em] text-muted uppercase">
                  {meta.sub ? `${title} · ${meta.sub}` : title}
                </div>
                {group.decks.map((d) => option(d.id, d.name, d.wordCount))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Legend({ color, label, value }: { color: string; label: string; value: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span aria-hidden="true" className="size-2.5 flex-none rounded-[3px]" style={{ background: color }} />
      <span className="text-body">{label}</span>
      <span className="ml-auto font-bold tabular-nums">{value}</span>
    </div>
  )
}

export default function Stats() {
  const { decks, deck: reviewDeck, refreshDecks } = useAppContext()
  // Starts on the deck being reviewed; null until decks have loaded.
  const [picked, setPicked] = useState<StatsDeck | null>(null)
  const selected: StatsDeck | null = picked ?? reviewDeck?.id ?? null
  const deck = decks.find((d) => d.id === selected) ?? null

  const [year, setYear] = useState(() => new Date().getFullYear())
  const [stats, setStats] = useState<StatsData | null>(null)
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Bumped to reload everything after a reset.
  const [version, setVersion] = useState(0)

  // A daily goal the user just changed, shown at once while it is being saved.
  const [goal, setGoal] = useState<{ deckId: number; value: number } | null>(null)
  const saveTimer = useRef<number | undefined>(undefined)

  const [confirming, setConfirming] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetMessage, setResetMessage] = useState('')
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (selected === null) return
    let stale = false
    api.stats(selected).then(
      (s) => stale || setStats(s),
      (err) => stale || setError(errorMessage(err)),
    )
    return () => {
      stale = true
    }
  }, [selected, version])

  useEffect(() => {
    if (selected === null) return
    let stale = false
    setHeatmap(null)
    api.heatmap(selected, year).then(
      (h) => stale || setHeatmap(h),
      (err) => stale || setError(errorMessage(err)),
    )
    return () => {
      stale = true
    }
  }, [selected, year, version])

  useEffect(() => {
    if (confirming) cancelRef.current?.focus()
  }, [confirming])

  if (selected === null) return null
  if (!stats) return error ? <p className="pt-20 text-center text-sm text-again-ink">{error}</p> : null

  const isAll = selected === 'all'
  const name = deck ? deckLabel(deck) : 'All decks'
  const shortName = deck ? deckShortName(deck) : 'every deck'
  const { total, cards } = stats
  const learned = total - cards.new
  const learnedPct = total ? ((learned / total) * 100).toFixed(1) : '0'

  const perDay = deck ? (goal?.deckId === deck.id ? goal.value : deck.newPerDay) : null

  const changeGoal = (value: number) => {
    if (!deck) return
    const next = Math.max(GOAL_MIN, Math.min(GOAL_MAX, value))
    const deckId = deck.id
    setGoal({ deckId, value: next })
    // Save once the tapping stops, so the stepper doesn't send a request per tap.
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      api.setNewPerDay(deckId, next).then(refreshDecks, (err) => setError(errorMessage(err)))
    }, 400)
  }

  // How long until every new word has been started.
  let finishLine: string
  if (total === 0) {
    finishLine = `Add words to ${isAll ? 'a deck' : shortName} to see how long it will take.`
  } else if (cards.new === 0) {
    finishLine = `You’ve learned every word in ${shortName}.`
  } else if (perDay !== null) {
    const days = Math.ceil(cards.new / perDay)
    finishLine = `If you do ${perDay} new ${perDay === 1 ? 'word' : 'words'} a day, you’ll finish ${shortName} in ${plural(days, 'day')} — around ${daysFromNow(days)}.`
  } else {
    // All decks: each one advances at its own daily goal, so the slowest decides.
    const days = Math.max(...decks.filter((d) => d.newCount > 0).map((d) => Math.ceil(d.newCount / d.newPerDay)))
    finishLine = `At each deck’s daily goal, you’ll finish every deck in ${plural(days, 'day')} — around ${daysFromNow(days)}.`
  }

  const cardCounts = [
    { label: 'New', n: cards.new, color: 'var(--color-card-new)' },
    { label: 'Learning', n: cards.learning, color: 'var(--color-card-learning)' },
    { label: 'Young', n: cards.young, color: 'var(--color-young)' },
    { label: 'Mature', n: cards.mature, color: 'var(--color-mature)' },
  ]

  const answersTotal = stats.answers.reduce((sum, n) => sum + n, 0)
  const answerButtons = ['Again', 'Hard', 'Good', 'Easy'].map((label, i) => ({
    label,
    pct: answersTotal ? Math.round((stats.answers[i] / answersTotal) * 100) : null,
    color: `var(--color-${label.toLowerCase()}-bar)`,
  }))

  const pick = (value: StatsDeck) => {
    setPicked(value)
    setConfirming(false)
    setResetMessage('')
    setError(null)
  }

  const reset = async () => {
    setResetting(true)
    try {
      await api.resetDeck(selected)
      setResetMessage(isAll ? 'All decks were reset.' : `${name} was reset.`)
      setConfirming(false)
      setVersion((v) => v + 1)
      refreshDecks()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 pb-2">
      <DeckPicker decks={decks} selected={selected} onPick={pick} />

      {error && <p className="text-center text-sm text-again-ink">{error}</p>}

      <section className={panelClass}>
        <div className="flex items-baseline justify-between gap-3">
          <div className="text-base font-bold">{name}</div>
          <div className="shrink-0 text-[15px] font-bold tabular-nums">
            <span className="text-[22px] font-extrabold">{formatCount(learned)}</span>
            <span className="text-muted"> / {formatCount(total)}</span>
          </div>
        </div>
        <div
          role="progressbar"
          aria-label={`Words learned in ${name}`}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={learned}
          className="h-3 overflow-hidden rounded-md bg-chip"
        >
          <div className="h-full rounded-md bg-accent" style={{ width: `${learnedPct}%` }} />
        </div>
        <div className="text-[13px] text-muted">
          {total ? `${learnedPct}% learned · ${plural(cards.new, 'word')} to go` : 'No words in this deck yet'}
        </div>
        <div className="mt-1 mb-0.5 border-t border-chip" />
        {perDay !== null ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-[15px] font-bold">New words per day</div>
              <div role="group" aria-label="New words per day" className="flex items-center gap-1 rounded-xl bg-chip p-1">
                <button
                  type="button"
                  aria-label="Fewer new words per day"
                  disabled={perDay <= GOAL_MIN}
                  onClick={() => changeGoal(perDay - 1)}
                  className="h-10 w-11 cursor-pointer rounded-[9px] bg-panel text-xl font-bold disabled:cursor-default disabled:opacity-40"
                >
                  −
                </button>
                <output aria-live="polite" className="min-w-11 text-center text-lg font-extrabold tabular-nums">
                  {perDay}
                </output>
                <button
                  type="button"
                  aria-label="More new words per day"
                  disabled={perDay >= GOAL_MAX}
                  onClick={() => changeGoal(perDay + 1)}
                  className="h-10 w-11 cursor-pointer rounded-[9px] bg-panel text-xl font-bold disabled:cursor-default disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {GOAL_PRESETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={perDay === n}
                  onClick={() => changeGoal(n)}
                  className={`min-h-11 cursor-pointer rounded-full border-[1.5px] px-3.5 text-[13px] ${
                    perDay === n ? 'border-accent bg-hint font-bold' : 'border-line font-medium'
                  }`}
                >
                  {n} a day
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="text-[13px] text-muted">New words per day is set for each deck. Choose a deck to change it.</div>
        )}
        <div className="flex items-start gap-2.5 rounded-[10px] bg-hint px-3.5 py-3 text-sm leading-normal">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-none text-accent">
            <rect x="3" y="4" width="18" height="17" rx="2" />
            <path d="M3 9h18M8 2v4M16 2v4" />
          </svg>
          <span>{finishLine}</span>
        </div>
      </section>

      <section className={panelClass}>
        <div className="flex items-center justify-between gap-2">
          <h2 className={headingClass}>REVIEWS</h2>
          <div role="group" aria-label="Choose year" className="flex gap-1">
            <button type="button" aria-label="Previous year" onClick={() => setYear(year - 1)} className={yearButtonClass}>
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button type="button" aria-label="Back to this year" onClick={() => setYear(new Date().getFullYear())} className={yearButtonClass}>
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
                <circle cx="12" cy="12" r="8" />
              </svg>
            </button>
            <button type="button" aria-label="Next year" onClick={() => setYear(year + 1)} className={yearButtonClass}>
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        </div>
        <Heatmap year={year} data={heatmap} />
        {stats.reviews === 0 && <div className="text-[13px] text-muted">No reviews in this deck yet</div>}
        <div className="grid grid-cols-3 gap-2.5 border-t border-chip pt-3">
          {[
            { label: 'Time today', value: plural(Math.round(stats.msToday / 60_000), 'minute') },
            { label: 'Longest streak', value: plural(stats.streak.longest, 'day') },
            { label: 'Current streak', value: plural(stats.streak.current, 'day') },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col gap-px">
              <span className="text-xs text-muted">{label}</span>
              <span className="text-[17px] font-extrabold text-stat-ink tabular-nums">{value}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={panelClass}>
        <h2 className={headingClass}>CARD RETENTION</h2>
        <RetentionChart retention={stats.retention} />
      </section>

      <section className={`${panelClass} gap-3.5`}>
        <div className="flex items-baseline justify-between">
          <h2 className={headingClass}>CARD COUNTS</h2>
          <div className="text-xs text-muted tabular-nums">{plural(total, 'card')}</div>
        </div>
        <div className={`flex h-4 gap-0.5 ${total === 0 ? 'rounded-sm bg-chip' : ''}`}>
          {cardCounts.map(({ label, n, color }) => (
            <div
              key={label}
              title={`${label}: ${formatCount(n)}${total ? ` (${Math.round((n / total) * 100)}%)` : ''}`}
              className="rounded-sm"
              style={{ flex: `${n} 1 0`, minWidth: n > 0 ? 4 : 0, background: color }}
            />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-x-5 gap-y-2">
          {cardCounts.map(({ label, n, color }) => (
            <Legend key={label} color={color} label={label} value={formatCount(n)} />
          ))}
        </div>
      </section>

      <section className={panelClass}>
        <h2 className={headingClass}>ANSWER BUTTONS</h2>
        {answerButtons.map(({ label, pct, color }) => (
          <div key={label} className="grid grid-cols-[56px_minmax(0,1fr)_44px] items-center gap-2.5 text-sm">
            <span className="text-body">{label}</span>
            <div className="h-2.5 rounded-full bg-chip">
              <div
                title={pct === null ? `${label}: no answers yet` : `${label}: ${pct}% of answers`}
                className="h-full rounded-full"
                style={{ width: `${pct ?? 0}%`, background: color }}
              />
            </div>
            <span className="text-right font-bold tabular-nums">{pct === null ? '—' : `${pct}%`}</span>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2.5">
        {confirming ? (
          <div role="alertdialog" aria-label={isAll ? 'Reset all decks' : `Reset ${shortName}`} className="flex flex-col gap-3 rounded-xl border-[1.5px] border-danger bg-panel p-4">
            <div className="text-base font-extrabold">{isAll ? 'Reset all decks?' : `Reset ${name}?`}</div>
            <div className="text-sm leading-normal text-body">
              This clears your progress, review history and stats for {plural(total, 'word')}
              {isAll ? ' across every deck' : ''}. The words stay in the deck as new cards. This can’t be undone.
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button ref={cancelRef} type="button" onClick={() => setConfirming(false)} className="min-h-11 cursor-pointer rounded-[10px] bg-chip px-[18px] text-[15px] font-bold">
                Cancel
              </button>
              <button type="button" disabled={resetting} onClick={reset} className="min-h-11 cursor-pointer rounded-[10px] bg-danger-fill px-[18px] text-[15px] font-bold text-white disabled:opacity-60">
                Reset
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setConfirming(true)
              setResetMessage('')
            }}
            className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-[1.5px] border-danger text-[15px] font-bold text-danger"
          >
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            {isAll ? 'Reset all decks' : `Reset ${shortName}`}
          </button>
        )}
        <div aria-live="polite" className="min-h-[18px] text-center text-[13px] text-muted">
          {resetMessage}
        </div>
      </section>
    </div>
  )
}
