import type { Deck, Heatmap, IntervalPreview, Rating, Stats, User, Word } from '../shared/types.ts'

// Sent wherever the server needs to know what "today" means for this user.
const tz = encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)

/** Fired when the server says the session is gone (expired, or signed out elsewhere). */
export const SIGNED_OUT_EVENT = 'amgi:signed-out'

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    if (res.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event(SIGNED_OUT_EVENT))
    throw new ApiError(body?.error ?? `Request failed (${res.status})`, res.status)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

const send = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body) })

export const auth = {
  /** The signed-in user; fails with status 401 when nobody is. */
  me: () => request<User>('/auth/me'),
  /** Starts guest mode, or returns the current user if there is one. */
  guest: () => request<User>('/auth/guest', { method: 'POST' }),
  /** For a guest, turns the guest into the new account. */
  signUp: (email: string, password: string) => request<User>('/auth/signup', send({ email, password })),
  signIn: (email: string, password: string) => request<User>('/auth/login', send({ email, password })),
  signOut: () => request<void>('/auth/logout', { method: 'POST' }),
  /** Deletes the account and all its progress; an account confirms with its password. */
  deleteAccount: (password?: string) => request<void>('/auth/delete-account', send({ password })),
}

/** What the Stats screen covers: one deck's id, or every deck. */
export type StatsDeck = number | 'all'

export const api = {
  decks: () => request<Deck[]>('/decks'),
  setNewPerDay: (deckId: number, newPerDay: number) =>
    request<Deck>(`/decks/${deckId}`, { method: 'PATCH', body: JSON.stringify({ newPerDay }) }),
  /** Clears progress and review history for one deck, or for every deck. */
  resetDeck: (deck: StatsDeck) => request<void>(deck === 'all' ? '/decks/reset-all' : `/decks/${deck}/reset`, { method: 'POST' }),
  stats: (deck: StatsDeck) => request<Stats>(`/stats?deck=${deck}&tz=${tz}`),
  heatmap: (deck: StatsDeck, year: number) => request<Heatmap>(`/stats/heatmap?deck=${deck}&year=${year}&tz=${tz}`),
  dueWords: (deckId: number) => request<Word[]>(`/reviews/due?deck=${deckId}&tz=${tz}`),
  reviewPreview: (wordId: number) => request<IntervalPreview[]>(`/reviews/preview/${wordId}`),
  review: (wordId: number, rating: Rating, durationMs: number) =>
    request<Word>('/reviews', { method: 'POST', body: JSON.stringify({ wordId, rating, durationMs }) }),
}

export const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong.')
