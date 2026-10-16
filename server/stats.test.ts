import { describe, expect, it } from 'vitest'
import { percent, streaks } from './stats.ts'

describe('streaks', () => {
  it('is zero with no reviews', () => {
    expect(streaks([], '2026-10-11')).toEqual({ longest: 0, current: 0 })
  })

  it('counts a run that includes today', () => {
    expect(streaks(['2026-10-09', '2026-10-10', '2026-10-11'], '2026-10-11')).toEqual({ longest: 3, current: 3 })
  })

  it('keeps the current streak alive until the end of today', () => {
    expect(streaks(['2026-10-09', '2026-10-10'], '2026-10-11')).toEqual({ longest: 2, current: 2 })
  })

  it('drops the current streak after a missed day', () => {
    expect(streaks(['2026-10-07', '2026-10-08', '2026-10-09'], '2026-10-11')).toEqual({ longest: 3, current: 0 })
  })

  it('finds the longest run among several, across a month boundary', () => {
    const days = ['2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02', '2026-10-10', '2026-10-11']
    expect(streaks(days, '2026-10-11')).toEqual({ longest: 4, current: 2 })
  })
})

describe('percent', () => {
  it('rounds to a whole number and returns null for an empty total', () => {
    expect(percent(2, 3)).toBe(67)
    expect(percent(0, 5)).toBe(0)
    expect(percent(0, 0)).toBeNull()
  })
})
