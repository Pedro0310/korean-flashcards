import type { Rating } from '../shared/types.ts'

// SM-2 style scheduler with four answer buttons, similar to Anki's.
// Pure: given a card's state, a rating and the current time, returns the next state.

export interface SrsState {
  /** Days between the last review and the next one. 0 while the card is still being learned. */
  intervalDays: number
  /** Multiplier applied to the interval on a successful review. */
  easeFactor: number
  /** Successful reviews in a row. 0 means new or just forgotten. */
  repetitions: number
  /** Times the card was forgotten after having been learned. */
  lapses: number
}

export interface Scheduled extends SrsState {
  dueAt: Date
}

export const INITIAL_STATE: SrsState = { intervalDays: 0, easeFactor: 2.5, repetitions: 0, lapses: 0 }

const MIN_EASE = 1.3
const MINUTE_MS = 60_000
const DAY_MS = 24 * 60 * MINUTE_MS

const AGAIN_DELAY_MIN = 1
const HARD_LEARNING_DELAY_MIN = 10
const GRADUATING_INTERVAL_DAYS = 1
const EASY_INTERVAL_DAYS = 4
const HARD_MULTIPLIER = 1.2
const EASY_BONUS = 1.3

export function schedule(state: SrsState, rating: Rating, now: Date = new Date()): Scheduled {
  const inMinutes = (m: number) => new Date(now.getTime() + m * MINUTE_MS)
  const inDays = (d: number) => new Date(now.getTime() + d * DAY_MS)
  const learning = state.repetitions === 0

  if (rating === 1) {
    return {
      intervalDays: 0,
      easeFactor: Math.max(MIN_EASE, state.easeFactor - 0.2),
      repetitions: 0,
      lapses: state.lapses + (learning ? 0 : 1),
      dueAt: inMinutes(AGAIN_DELAY_MIN),
    }
  }

  if (learning) {
    if (rating === 2) {
      return { ...state, intervalDays: 0, dueAt: inMinutes(HARD_LEARNING_DELAY_MIN) }
    }
    const intervalDays = rating === 4 ? EASY_INTERVAL_DAYS : GRADUATING_INTERVAL_DAYS
    return { ...state, intervalDays, repetitions: 1, dueAt: inDays(intervalDays) }
  }

  const prev = Math.max(1, state.intervalDays)
  // Each button always moves the card forward by at least a day, and a better
  // answer always gives a longer interval than a worse one, even when rounding
  // short intervals would make them equal.
  const hard = Math.max(prev + 1, Math.round(prev * HARD_MULTIPLIER))
  const good = Math.max(hard + 1, Math.round(prev * state.easeFactor))
  const easy = Math.max(good + 1, Math.round(prev * state.easeFactor * EASY_BONUS))

  let easeFactor = state.easeFactor
  let intervalDays: number
  if (rating === 2) {
    easeFactor = Math.max(MIN_EASE, easeFactor - 0.15)
    intervalDays = hard
  } else if (rating === 3) {
    intervalDays = good
  } else {
    easeFactor += 0.15
    intervalDays = easy
  }

  return {
    intervalDays,
    easeFactor,
    repetitions: state.repetitions + 1,
    lapses: state.lapses,
    dueAt: inDays(intervalDays),
  }
}

/**
 * A time until the next review, as shown on an answer button ("<1m", "10m",
 * "4d", "3mo") and as read out ("in 4 days").
 */
export function formatInterval(ms: number): { interval: string; spoken: string } {
  const unit = (n: number, short: string, long: string) => ({
    interval: `${n}${short}`,
    spoken: `in ${n} ${long}${n === 1 ? '' : 's'}`,
  })
  const minutes = Math.round(ms / MINUTE_MS)
  if (minutes <= 1) return { interval: '<1m', spoken: 'in under a minute' }
  if (minutes < 60) return unit(minutes, 'm', 'minute')
  const hours = Math.round(minutes / 60)
  if (hours < 24) return unit(hours, 'h', 'hour')
  const days = Math.round(hours / 24)
  if (days < 30) return unit(days, 'd', 'day')
  const months = Math.round(days / 30)
  if (months < 12) return unit(months, 'mo', 'month')
  return unit(Math.round((days / 365) * 10) / 10, 'y', 'year')
}