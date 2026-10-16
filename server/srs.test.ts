import { describe, expect, it } from 'vitest'
import { formatInterval, INITIAL_STATE, schedule, type SrsState } from './srs.ts'

const now = new Date('2026-01-01T00:00:00Z')
const minutesFromNow = (d: Date) => (d.getTime() - now.getTime()) / 60_000
const daysFromNow = (d: Date) => minutesFromNow(d) / (60 * 24)

describe('schedule', () => {
  it('shows a new card again within minutes when answered Again or Hard', () => {
    const again = schedule(INITIAL_STATE, 1, now)
    expect(minutesFromNow(again.dueAt)).toBe(1)
    expect(again.repetitions).toBe(0)
    expect(again.lapses).toBe(0)

    const hard = schedule(INITIAL_STATE, 2, now)
    expect(minutesFromNow(hard.dueAt)).toBe(10)
    expect(hard.repetitions).toBe(0)
  })

  it('graduates a new card on Good (1 day) or Easy (4 days)', () => {
    const good = schedule(INITIAL_STATE, 3, now)
    expect(good).toMatchObject({ intervalDays: 1, repetitions: 1, easeFactor: 2.5 })
    expect(daysFromNow(good.dueAt)).toBe(1)

    const easy = schedule(INITIAL_STATE, 4, now)
    expect(easy.intervalDays).toBe(4)
    expect(daysFromNow(easy.dueAt)).toBe(4)
  })

  it('grows the interval by the ease factor on Good', () => {
    const state: SrsState = { intervalDays: 10, easeFactor: 2.5, repetitions: 3, lapses: 0 }
    const next = schedule(state, 3, now)
    expect(next.intervalDays).toBe(25)
    expect(next.easeFactor).toBe(2.5)
    expect(next.repetitions).toBe(4)
  })

  it('orders intervals Hard < Good < Easy and adjusts ease', () => {
    const state: SrsState = { intervalDays: 10, easeFactor: 2.5, repetitions: 3, lapses: 0 }
    const hard = schedule(state, 2, now)
    const good = schedule(state, 3, now)
    const easy = schedule(state, 4, now)
    expect(hard.intervalDays).toBeLessThan(good.intervalDays)
    expect(good.intervalDays).toBeLessThan(easy.intervalDays)
    expect(hard.easeFactor).toBeCloseTo(2.35)
    expect(easy.easeFactor).toBeCloseTo(2.65)
  })

  it('resets a learned card on Again and counts the lapse', () => {
    const state: SrsState = { intervalDays: 30, easeFactor: 2.5, repetitions: 5, lapses: 1 }
    const next = schedule(state, 1, now)
    expect(next).toMatchObject({ intervalDays: 0, repetitions: 0, lapses: 2 })
    expect(next.easeFactor).toBeCloseTo(2.3)
  })

  it('never lets ease drop below 1.3', () => {
    let state: SrsState = { intervalDays: 5, easeFactor: 1.35, repetitions: 2, lapses: 0 }
    state = schedule(state, 2, now)
    expect(state.easeFactor).toBe(1.3)
    expect(schedule(state, 1, now).easeFactor).toBe(1.3)
  })

  it('keeps Hard < Good < Easy even for a 1-day interval', () => {
    const state: SrsState = { intervalDays: 1, easeFactor: 2.5, repetitions: 1, lapses: 0 }
    expect([2, 3, 4].map((rating) => schedule(state, rating as 2 | 3 | 4, now).intervalDays)).toEqual([2, 3, 4])
  })

  it('always advances a review card by at least one day', () => {
    const state: SrsState = { intervalDays: 1, easeFactor: 1.3, repetitions: 1, lapses: 0 }
    expect(schedule(state, 2, now).intervalDays).toBe(2)
  })
})

describe('formatInterval', () => {
  const MIN = 60_000
  const DAY = 24 * 60 * MIN

  it.each([
    [1 * MIN, '<1m', 'in under a minute'],
    [10 * MIN, '10m', 'in 10 minutes'],
    [60 * MIN, '1h', 'in 1 hour'],
    [1 * DAY, '1d', 'in 1 day'],
    [4 * DAY, '4d', 'in 4 days'],
    [29 * DAY, '29d', 'in 29 days'],
    [90 * DAY, '3mo', 'in 3 months'],
    [365 * DAY, '1y', 'in 1 year'],
    [550 * DAY, '1.5y', 'in 1.5 years'],
  ])('%d ms -> %s', (ms, interval, spoken) => {
    expect(formatInterval(ms)).toEqual({ interval, spoken })
  })
})