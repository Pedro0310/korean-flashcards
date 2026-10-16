import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { sql } from '../server/db.ts'

// Loads data/vocabulary.json into the shared level decks, with the English and
// Spanish example translations from data/source/example-translations.tsv.
// Safe to run again after either file changes: words are matched by their
// key and updated in place, so everyone's progress on them is kept. Words no
// longer in the list are deleted, with everyone's progress on them.

interface VocabularyWord {
  key: string
  grade: 'A' | 'B' | 'C'
  korean: string
  meaning: string
  meaningEs: string | null
  hanja: string | null
  romanization: string
  partOfSpeech: string | null
  example: string | null
}

const GROUP_OF_GRADE = { A: 'Beginner', B: 'Intermediate', C: 'Advanced' } as const

// key -> translations of that word's example. A translation is only used while
// the example it was written for is still the word's example.
const translations = new Map<string, { example: string; en: string; es: string }>(
  (await readFile(join(import.meta.dirname, '../data/source/example-translations.tsv'), 'utf8'))
    .trim()
    .split('\n')
    .slice(1)
    .map((line) => {
      const [key, example, en, es] = line.split('\t')
      return [key, { example, en, es }]
    }),
)
const translationOf = (word: VocabularyWord) => {
  const t = translations.get(word.key)
  return t && t.example === word.example ? t : null
}

// Already in learning order: most frequent first within each grade. Only
// words whose example has been translated become cards.
const vocabulary: VocabularyWord[] = (
  JSON.parse(await readFile(join(import.meta.dirname, '../data/vocabulary.json'), 'utf8')) as VocabularyWord[]
).filter((word) => translationOf(word))

// The decks themselves are created by the migrations.
const decks = await sql<{ id: number; groupName: string }[]>`
  select id, group_name from decks where group_name in ${sql(Object.values(GROUP_OF_GRADE))} order by sort_order, id
`

const rows: Record<string, string | number | null>[] = []
for (const [grade, group] of Object.entries(GROUP_OF_GRADE)) {
  const words = vocabulary.filter((w) => w.grade === grade)
  const parts = decks.filter((d) => d.groupName === group)
  if (!parts.length) throw new Error(`there are no ${group} decks; run npm run db:migrate first`)
  // Equal parts, so the last deck of a level isn't a leftover handful.
  const size = Math.ceil(words.length / parts.length)
  words.forEach((word, i) => {
    rows.push({
      deckId: parts[Math.floor(i / size)].id,
      position: i + 1,
      sourceKey: word.key,
      korean: word.korean,
      meaning: word.meaning,
      meaningEs: word.meaningEs,
      hanja: word.hanja,
      romanization: word.romanization,
      partOfSpeech: word.partOfSpeech,
      example: word.example,
      exampleEn: translationOf(word)?.en ?? null,
      exampleEs: translationOf(word)?.es ?? null,
    })
  })
}

const removed = await sql.begin(async (tx) => {
  for (let i = 0; i < rows.length; i += 500) {
    await tx`
      insert into words ${tx(rows.slice(i, i + 500))}
      on conflict (source_key) do update set
        deck_id = excluded.deck_id,
        position = excluded.position,
        korean = excluded.korean,
        meaning = excluded.meaning,
        meaning_es = excluded.meaning_es,
        hanja = excluded.hanja,
        romanization = excluded.romanization,
        part_of_speech = excluded.part_of_speech,
        example = excluded.example,
        example_en = excluded.example_en,
        example_es = excluded.example_es
    `
  }
  return tx`delete from words where source_key <> all(${rows.map((r) => r.sourceKey as string)})`
})

console.log(`${rows.length} words in ${decks.length} decks, ${removed.count} removed`)
await sql.end()
