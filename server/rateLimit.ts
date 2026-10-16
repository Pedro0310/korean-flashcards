import { getConnInfo } from '@hono/node-server/conninfo'
import type { Context } from 'hono'
import { createMiddleware } from 'hono/factory'

// Caps how many requests one IP address can make in a time window, so a
// script can't flood the API or create guest accounts by the thousand.
// Counts are kept in memory: fine for one server process, reset on restart.

// Behind a hosting provider's proxy every request arrives from the proxy, and
// the visitor's address is in X-Forwarded-For. Only trust that header when
// TRUST_PROXY is set: without a proxy in front, anyone could fake it.
const trustProxy = Boolean(process.env.TRUST_PROXY)

export function clientIp(c: Context): string {
  if (trustProxy) {
    // The proxy appends the address it saw; earlier entries come from the client and can be made up.
    const forwarded = c.req.header('x-forwarded-for')?.split(',').at(-1)?.trim()
    if (forwarded) return forwarded
  }
  return getConnInfo(c).remote.address ?? 'unknown'
}

interface Window {
  count: number
  resetAt: number
}

const limiters: Map<string, Window>[] = []

// Forget windows that have ended, so memory doesn't grow with every visitor.
setInterval(() => {
  const now = Date.now()
  for (const windows of limiters) for (const [ip, w] of windows) if (w.resetAt <= now) windows.delete(ip)
}, 60_000).unref()

/** At most `limit` requests per IP every `windowMs`; the rest get a 429. */
export function rateLimit(limit: number, windowMs: number, message = 'Too many requests. Try again in a few minutes.') {
  const windows = new Map<string, Window>()
  limiters.push(windows)
  return createMiddleware(async (c, next) => {
    const ip = clientIp(c)
    const now = Date.now()
    let w = windows.get(ip)
    if (!w || w.resetAt <= now) {
      w = { count: 0, resetAt: now + windowMs }
      windows.set(ip, w)
    }
    w.count++
    if (w.count > limit) {
      c.header('Retry-After', String(Math.ceil((w.resetAt - now) / 1000)))
      return c.json({ error: message }, 429)
    }
    await next()
  })
}
