import { createHash, randomBytes } from 'node:crypto'
import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import { z } from 'zod'
import { sql } from './db.ts'
import { hashPassword, verifyPassword } from './passwords.ts'
import { rateLimit } from './rateLimit.ts'
import type { User } from '../shared/types.ts'

// Email and password sign-in, and guests, with server-side sessions.
//
// Signing in creates a row in `sessions` and gives the browser a random token
// in an httpOnly cookie (page scripts can't read it). Each request looks the
// token up to find the user. Only a SHA-256 of the token is stored, so the
// sessions table alone can't be used to sign in. Signing out deletes the row.

export type AppEnv = { Variables: { userId: number } }

const SESSION_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000
const production = process.env.NODE_ENV === 'production'
// The __Host- prefix makes the browser refuse the cookie unless it is Secure
// and set by this exact host, which only works over HTTPS.
const COOKIE = production ? '__Host-session' : 'session'

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

async function startSession(c: Parameters<typeof setCookie>[0], userId: number) {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_DAYS * DAY_MS)
  await sql`insert into sessions (id, user_id, expires_at) values (${hashToken(token)}, ${userId}, ${expiresAt})`
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    secure: production,
    // Not sent on requests started by other sites, which blocks cross-site request forgery.
    sameSite: 'Lax',
    path: '/',
    expires: expiresAt,
  })
}

/** The signed-in user, or a 401 for every route behind it. Sets c.get('userId'). */
export const currentUser = createMiddleware<AppEnv>(async (c, next) => {
  const token = getCookie(c, COOKIE)
  const [session] = token
    ? await sql<{ userId: number; expiresAt: Date }[]>`
        select user_id, expires_at from sessions where id = ${hashToken(token)} and expires_at > now()
      `
    : []
  if (!session) return c.json({ error: 'Please sign in.' }, 401)
  // Someone who keeps using the app stays signed in: past the halfway point, renew.
  if (session.expiresAt.getTime() - Date.now() < (SESSION_DAYS / 2) * DAY_MS) {
    const expiresAt = new Date(Date.now() + SESSION_DAYS * DAY_MS)
    await sql`update sessions set expires_at = ${expiresAt} where id = ${hashToken(token!)}`
    setCookie(c, COOKIE, token!, { httpOnly: true, secure: production, sameSite: 'Lax', path: '/', expires: expiresAt })
  }
  c.set('userId', session.userId)
  await next()
})

// ---------------------------------------------------------------- guessing limit

// After this many wrong passwords for one email, sign-in for it pauses until
// the window has passed. Kept in memory: enough for a single server process.
const MAX_FAILURES = 10
const WINDOW_MS = 15 * 60 * 1000
const failures = new Map<string, { count: number; since: number }>()

function blocked(email: string): boolean {
  const entry = failures.get(email)
  if (entry && Date.now() - entry.since > WINDOW_MS) failures.delete(email)
  return (failures.get(email)?.count ?? 0) >= MAX_FAILURES
}

function recordFailure(email: string) {
  const entry = failures.get(email) ?? { count: 0, since: Date.now() }
  entry.count++
  failures.set(email, entry)
}

// ---------------------------------------------------------------- routes

const credentials = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()).pipe(z.string().max(254)),
  password: z.string().max(200),
})

const newPassword = z.string().min(8, 'Use at least 8 characters for the password.').max(200)

// Compared against when the email is unknown, so a wrong email takes as long as a wrong password.
const dummyHash = hashPassword(randomBytes(16).toString('hex'))

const userColumns = sql`id, email, display_name, email is null as guest`

/** The session this browser's cookie points at, if it is still valid. */
async function sessionOf(c: Parameters<typeof getCookie>[0]) {
  const token = getCookie(c, COOKIE)
  if (!token) return null
  const [session] = await sql<{ id: string; userId: number; guest: boolean }[]>`
    select s.id, s.user_id, u.email is null as guest
    from sessions s join users u on u.id = s.user_id
    where s.id = ${hashToken(token)} and s.expires_at > now()
  `
  return session ?? null
}

const endSession = (sessionId: string) => sql`delete from sessions where id = ${sessionId}`

const isUniqueViolation = (err: unknown) => err instanceof sql.PostgresError && err.code === '23505'

// A guest whose sessions have all expired can never be reached again. The
// day of grace covers a guest created a moment ago whose session is being written.
const deleteAbandonedGuests = () => sql`
  delete from users u
  where u.email is null and u.created_at < now() - interval '1 day'
    and not exists (select 1 from sessions s where s.user_id = u.id and s.expires_at > now())
`

export const authRoutes = new Hono<AppEnv>()

const MINUTE_MS = 60 * 1000
const guestLimit = rateLimit(20, 60 * MINUTE_MS)
const signupLimit = rateLimit(10, 60 * MINUTE_MS)
const loginLimit = rateLimit(30, 15 * MINUTE_MS, 'Too many attempts. Try again in 15 minutes.')

authRoutes.post('/guest', guestLimit, async (c) => {
  const current = await sessionOf(c)
  if (current) {
    const [user] = await sql<User[]>`select ${userColumns} from users where id = ${current.userId}`
    return c.json(user)
  }
  await deleteAbandonedGuests()
  const [user] = await sql<User[]>`insert into users (display_name) values ('Guest') returning ${userColumns}`
  await startSession(c, user.id)
  return c.json(user, 201)
})

// Creates an account. For a guest, the guest becomes the account and keeps its progress.
authRoutes.post('/signup', signupLimit, async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = credentials.safeParse(body)
  if (!parsed.success) return c.json({ error: 'Enter a valid email address.' }, 400)
  const password = newPassword.safeParse(body.password)
  if (!password.success) return c.json({ error: password.error.issues[0].message }, 400)
  const { email } = parsed.data
  const passwordHash = await hashPassword(password.data)
  const current = await sessionOf(c)

  let user: User | undefined
  try {
    ;[user] = current?.guest
      ? await sql<User[]>`
          update users set email = ${email}, display_name = ${email.split('@')[0]}, password_hash = ${passwordHash}
          where id = ${current.userId} and email is null
          returning ${userColumns}
        `
      : await sql<User[]>`
          insert into users (email, display_name, password_hash)
          values (${email}, ${email.split('@')[0]}, ${passwordHash})
          returning ${userColumns}
        `
  } catch (err) {
    if (isUniqueViolation(err)) return c.json({ error: 'An account with this email already exists. Sign in instead.' }, 409)
    throw err
  }
  if (!user) return c.json({ error: 'Something went wrong. Reload the page and try again.' }, 409)
  // A fresh session token whenever who you are changes.
  if (current) await endSession(current.id)
  await startSession(c, user.id)
  return c.json(user, 201)
})

// Signing in from guest mode leaves the guest behind; it is deleted once abandoned.
authRoutes.post('/login', loginLimit, async (c) => {
  const parsed = credentials.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'Enter your email and password.' }, 400)
  const { email, password } = parsed.data
  if (blocked(email)) return c.json({ error: 'Too many attempts. Try again in 15 minutes.' }, 429)

  const [user] = await sql<(User & { passwordHash: string | null })[]>`
    select ${userColumns}, password_hash from users where email = ${email}
  `
  const ok = await verifyPassword(password, user?.passwordHash ?? (await dummyHash))
  if (!user?.passwordHash || !ok) {
    recordFailure(email)
    return c.json({ error: 'Wrong email or password.' }, 401)
  }
  failures.delete(email)
  const current = await sessionOf(c)
  if (current) await endSession(current.id)
  await sql`delete from sessions where user_id = ${user.id} and expires_at <= now()`
  await startSession(c, user.id)
  const { passwordHash: _, ...publicUser } = user
  return c.json(publicUser)
})

authRoutes.post('/logout', async (c) => {
  const current = await sessionOf(c)
  if (current) await endSession(current.id)
  deleteCookie(c, COOKIE, { path: '/', secure: production })
  return c.body(null, 204)
})

authRoutes.get('/me', currentUser, async (c) => {
  const [user] = await sql<User[]>`select ${userColumns} from users where id = ${c.get('userId')}`
  return c.json(user)
})

// Deletes the signed-in account and, through the foreign keys, its sessions,
// cards, reviews and settings. An account must confirm with its password.
authRoutes.post('/delete-account', currentUser, loginLimit, async (c) => {
  const userId = c.get('userId')
  const [user] = await sql<{ passwordHash: string | null }[]>`select password_hash from users where id = ${userId}`
  if (user?.passwordHash) {
    const password = z.object({ password: z.string().max(200) }).safeParse(await c.req.json().catch(() => null))
    if (!password.success || !(await verifyPassword(password.data.password, user.passwordHash))) {
      return c.json({ error: 'Wrong password.' }, 403)
    }
  }
  await sql`delete from users where id = ${userId}`
  deleteCookie(c, COOKIE, { path: '/', secure: production })
  return c.body(null, 204)
})
