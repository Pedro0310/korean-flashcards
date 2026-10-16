import type { Deck } from '../shared/types.ts'

// How decks are named and grouped in the sidebar and on the Stats screen.

interface GroupMeta {
  title: string
  /** Korean level name shown next to the title. */
  sub: string

}

// Keyed by decks.group_name. Groups not listed here still show up, under their own name.
const GROUP_META: Record<string, GroupMeta> = {
  Beginner: { title: 'Beginner', sub: '초급' },
  Intermediate: { title: 'Intermediate', sub: '중급' },
  Advanced: { title: 'Advanced', sub: '고급' },

}

export const groupMeta = (groupName: string): GroupMeta => GROUP_META[groupName] ?? { title: groupName, sub: '' }

/** A deck's full name: "Beginner · Part 1". */
export const deckLabel = (deck: Deck) => `${deck.groupName} · ${deck.name}`

/** A short name that still says which deck it is, for sentences: "Beginner Part 1". */
export const deckShortName = (deck: Deck) => `${deck.groupName} ${deck.name}`

/** Decks collected under their group, keeping the order they arrive in (sort_order). */
export function groupDecks(decks: Deck[]): { name: string; decks: Deck[] }[] {
  const groups: { name: string; decks: Deck[] }[] = []
  for (const deck of decks) {
    const last = groups.at(-1)
    if (last?.name === deck.groupName) last.decks.push(deck)
    else groups.push({ name: deck.groupName, decks: [deck] })
  }
  return groups
}

export const formatCount = (n: number) => n.toLocaleString('en-US')
