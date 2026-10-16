// Types shared by the API server and the React client.

/** 1 = Again, 2 = Hard, 3 = Good, 4 = Easy */
export type Rating = 1 | 2 | 3 | 4

/** What one answer button would do: when the card comes back. */
export interface IntervalPreview {
  rating: Rating
  /** Short form for the button, e.g. "<1m", "10m", "4d", "3mo". */
  interval: string
  /** Sentence form, e.g. "in 4 days". */
  spoken: string
}

export interface User {
  id: number
  /** null for a guest. */
  email: string | null
  displayName: string
  /** Using the app without an account: progress is reachable from this browser only. */
  guest: boolean
}

export interface Deck {
  id: number
  name: string
  /** Heading the deck sits under: "Beginner", "Intermediate" or "Advanced". */
  groupName: string
  sortOrder: number
  /** Daily limit on new (never reviewed) cards. */
  newPerDay: number
  wordCount: number
  /** Words in the deck that have never been reviewed. */
  newCount: number
}

export interface Stats {
  total: number
  /** New = never reviewed, Learning = reviewed but not graduated, Young = interval under 21 days, Mature = 21 or more. */
  cards: { new: number; learning: number; young: number; mature: number }
  /** Times each answer button was pressed, in order: Again, Hard, Good, Easy. */
  answers: number[]
  /** The last six months, oldest first. Percent of reviews passed; null for a month with none. */
  retention: { month: string; young: number | null; mature: number | null; all: number | null }[]
  /** All-time number of reviews. */
  reviews: number
  /** Time spent answering cards today. */
  msToday: number
  streak: { longest: number; current: number }
}

/** Reviews per day, keyed by 'YYYY-MM-DD'. Days without reviews are absent. */
export type Heatmap = Record<string, number>

export interface Word {
  id: number
  deckId: number
  korean: string
  /** English meaning. */
  meaning: string
  meaningEs: string | null
  hanja: string | null
  romanization: string | null
  /** Word info shown as a tag, e.g. "noun · slang". */
  partOfSpeech: string | null
  example: string | null
  exampleEn: string | null
  exampleEs: string | null
  /** Progress fields: for a word never reviewed, the starting values and dueAt now. */
  dueAt: string
  intervalDays: number
  easeFactor: number
  repetitions: number
  lapses: number
}

