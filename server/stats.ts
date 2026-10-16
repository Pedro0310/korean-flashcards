// Pure helpers for the Stats screen. Days are 'YYYY-MM-DD' strings in the user's time zone.

const dayNumber = (day: string) => Date.parse(`${day}T00:00:00Z`) / 86_400_000

/**
 * Study streaks from the days that had at least one review.
 * The current streak still counts if today has no reviews yet but yesterday did.
 */
export function streaks(days: string[], today: string): { longest: number; current: number } {
  const studied = new Set(days.map(dayNumber))
  let longest = 0
  for (const day of studied) {
    if (studied.has(day - 1)) continue // not the start of a run
    let length = 1
    while (studied.has(day + length)) length++
    longest = Math.max(longest, length)
  }

  let last = dayNumber(today)
  if (!studied.has(last)) last--
  let current = 0
  while (studied.has(last - current)) current++

  return { longest, current }
}

/** Whole-number percentage, or null when there is nothing to take a share of. */
export const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null)
