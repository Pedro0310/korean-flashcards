// Builds data/vocabulary.json, the word list the app's level decks are imported from.
//
//   npx tsx scripts/build-vocabulary.ts <folder with the dictionary XML files>
//
// Two sources from the National Institute of Korean Language are joined:
//   - data/source/learning-vocabulary-2003.tsv: 5,965 graded words with their
//     frequency rank. Decides which words are in, their level and their order.
//   - 한국어기초사전 (Korean Learners' Dictionary), full download in XML: the
//     content of each word (meanings, Hanja, pronunciation, example sentence).
//     Not kept in this repository (about 350 MB).
// data/source/manual-glosses.tsv fills the gaps: meanings written by hand for
// list words the dictionary lacks or only describes with a long definition.
// data/source/example-translations.tsv translates each card's example, and
// supplies the example itself where the dictionary has none.
// See data/README.md for licences.

import { createReadStream } from 'node:fs'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { romanize } from './romanize.ts'

const LIST = join(import.meta.dirname, '../data/source/learning-vocabulary-2003.tsv')
const GLOSSES = join(import.meta.dirname, '../data/source/manual-glosses.tsv')
const TRANSLATIONS = join(import.meta.dirname, '../data/source/example-translations.tsv')
const OUT = join(import.meta.dirname, '../data/vocabulary.json')
const xmlDir = process.argv[2]
if (!xmlDir) throw new Error('usage: tsx scripts/build-vocabulary.ts <folder with the dictionary XML files>')

// ---------------------------------------------------------------- the graded list

interface ListRow {
  rank: number | null
  word: string
  pos: string
  gloss: string
  grade: 'A' | 'B' | 'C'
}

const listRows: ListRow[] = (await readFile(LIST, 'utf8'))
  .trim()
  .split('\n')
  .slice(1)
  .map((line) => {
    const [rank, word, pos, gloss, grade] = line.split('\t')
    return { rank: rank ? Number(rank) : null, word, pos, gloss, grade: grade as ListRow['grade'] }
  })

// "가격03" -> "가격" (the number tells homographs apart in another dictionary); "도쿄(동경)" -> "도쿄".
const spellingOf = (word: string) => word.replace(/\d+$/, '').replace(/\(.*\)$/, '')

const wanted = new Set(listRows.map((row) => spellingOf(row.word)))

// ---------------------------------------------------------------- the dictionary

interface Sense {
  /** English and Spanish equivalents of the word. Empty for a few function words. */
  en: string
  es: string
  /** Definitions, e.g. "A pronoun used to indicate a person that one does not know." */
  enDefinition: string
  esDefinition: string
  examples: { type: string; text: string }[]
}

interface Entry {
  id: number
  word: string
  homonym: number
  pos: string
  level: string
  origin: string
  pronunciation: string
  senses: Sense[]
}

// Attribute values are escaped twice in the source (&amp;quot;).
const unescapeOnce = (s: string) =>
  s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
const unescape = (s: string) => unescapeOnce(unescapeOnce(s)).trim()

const FEAT = /<feat att="([^"]+)"(?: val="([^"]*)")?\s*\/>/

/** Reads the dictionary files, keeping only entries spelled like a word on the list. */
async function readDictionary(dir: string): Promise<Map<string, Entry[]>> {
  const bySpelling = new Map<string, Entry[]>()
  const files = (await readdir(dir)).filter((f) => f.endsWith('.xml')).sort((a, b) => parseInt(a) - parseInt(b))
  if (!files.length) throw new Error(`no .xml files in ${dir}`)

  for (const file of files) {
    let entry: Entry | null = null
    let sense: Sense | null = null
    let block = '' // which element the current <feat> lines belong to
    let exampleType = ''
    let language = ''
    let unit = ''

    for await (const line of createInterface({ input: createReadStream(join(dir, file), 'utf8') })) {
      const text = line.trim()
      if (text.startsWith('<LexicalEntry')) {
        entry = { id: Number(/val="(\d+)"/.exec(text)?.[1]), word: '', homonym: 0, pos: '', level: '', origin: '', pronunciation: '', senses: [] }
        block = 'entry'
        unit = ''
      } else if (text === '</LexicalEntry>') {
        // The dictionary spaces some compounds the list writes solid (고속 도로), as phrases.
        const key = entry?.word.replace(/[\s^-]/g, '') ?? ''
        if (entry && (unit === '단어' || unit === '구') && wanted.has(key)) {
          bySpelling.set(key, [...(bySpelling.get(key) ?? []), entry])
        }
        entry = null
      } else if (!entry) {
        continue
      } else if (text.startsWith('<Sense ')) {
        sense = { en: '', es: '', enDefinition: '', esDefinition: '', examples: [] }
        entry.senses.push(sense)
        block = 'sense'
      } else if (text === '</Sense>') {
        sense = null
        block = 'entry'
      } else if (text.startsWith('<Lemma')) block = 'lemma'
      else if (text.startsWith('<WordForm')) block = 'wordform'
      else if (text.startsWith('<SenseExample')) block = 'example'
      else if (text.startsWith('<Equivalent')) block = 'equivalent'
      else if (text === '</Lemma>' || text === '</WordForm>') block = 'entry'
      else if (text === '</SenseExample>' || text === '</Equivalent>') block = 'sense'
      else if (text.startsWith('<feat')) {
        const match = FEAT.exec(text)
        if (!match) continue
        const [, att, raw = ''] = match
        const val = unescape(raw)
        if (block === 'entry') {
          if (att === 'homonym_number') entry.homonym = Number(val)
          else if (att === 'lexicalUnit') unit = val
          else if (att === 'partOfSpeech') entry.pos = val
          else if (att === 'vocabularyLevel') entry.level = val
          else if (att === 'origin') entry.origin = val
        } else if (block === 'lemma' && att === 'writtenForm') {
          entry.word = val
        } else if (block === 'wordform' && att === 'pronunciation' && !entry.pronunciation) {
          entry.pronunciation = val
        } else if (block === 'example' && sense) {
          if (att === 'type') exampleType = val
          else if (att === 'example') sense.examples.push({ type: exampleType, text: val })
        } else if (block === 'equivalent' && sense) {
          if (att === 'language') language = val
          else if (att === 'lemma' && language === '영어') sense.en = val
          else if (att === 'lemma' && language === '스페인어') sense.es = val
          else if (att === 'definition' && language === '영어') sense.enDefinition = val
          else if (att === 'definition' && language === '스페인어') sense.esDefinition = val
        }
      }
    }
    console.log(`read ${file}`)
  }
  return bySpelling
}

// ---------------------------------------------------------------- matching

// The list's part-of-speech letters -> the dictionary's names. Proper nouns
// (고) are plain nouns in the dictionary; 불 ("unanalysable") can be anything.
const POS_IN_DICTIONARY: Record<string, string[]> = {
  명: ['명사'],
  고: ['명사'],
  동: ['동사'],
  형: ['형용사'],
  부: ['부사'],
  관: ['관형사'],
  대: ['대명사'],
  수: ['수사'],
  감: ['감탄사'],
  의: ['의존 명사'],
  보: ['보조 동사', '보조 형용사'],
}

const POS_LABEL: Record<string, string> = {
  명사: 'noun',
  대명사: 'pronoun',
  수사: 'numeral',
  동사: 'verb',
  형용사: 'adjective',
  관형사: 'determiner',
  부사: 'adverb',
  감탄사: 'interjection',
  '의존 명사': 'bound noun',
  '보조 동사': 'auxiliary verb',
  '보조 형용사': 'auxiliary adjective',
  조사: 'particle',
  어미: 'ending',
  접사: 'affix',
}

const LEVEL_OF_GRADE = { A: '초급', B: '중급', C: '고급' }

const HANJA = /[㐀-䶿一-鿿豈-﫿]/
const hasHanja = (s: string) => HANJA.test(s)
// The list writes the Hanja of a word alone ("價格") or before a hint ("間. 서울과 부산 ~").
const hanjaOf = (gloss: string) => /^[㐀-䶿一-鿿豈-﫿]+/.exec(gloss)?.[0] ?? ''

type Confidence = 'sure' | 'likely' | 'guess'

/**
 * Picks the dictionary entry a list row means. Rows are narrowed by part of
 * speech, then by Hanja (the list gives it for Sino-Korean words and leaves it
 * blank for native ones), then by the learner level the dictionary assigns.
 */
function pick(row: ListRow, candidates: Entry[]): { entry: Entry; confidence: Confidence } | null {
  let pool = candidates.filter((e) => e.senses.some((s) => s.en || s.enDefinition))
  if (!pool.length) return null
  let confidence: Confidence = 'sure'

  const narrow = (test: (e: Entry) => boolean) => {
    const kept = pool.filter(test)
    if (kept.length) pool = kept
    return kept.length > 0
  }

  const names = POS_IN_DICTIONARY[row.pos]
  if (names && !narrow((e) => names.includes(e.pos))) confidence = 'guess'

  const hanja = hanjaOf(row.gloss)
  if (hanja) {
    if (!narrow((e) => e.origin.replace(/[^㐀-䶿一-鿿豈-﫿]/g, '') === hanja) && confidence === 'sure') confidence = 'likely'
  } else if (!row.gloss) {
    narrow((e) => !hasHanja(e.origin))
  }

  if (pool.length > 1) {
    // Still several homographs: nothing left to tell them apart for certain.
    confidence = confidence === 'guess' ? 'guess' : 'likely'
    narrow((e) => e.level === LEVEL_OF_GRADE[row.grade]) || narrow((e) => e.level !== '없음')
    if (pool.length > 1) confidence = 'guess'
  }
  pool.sort((a, b) => a.homonym - b.homonym)
  return { entry: pool[0], confidence }
}

// ---------------------------------------------------------------- output

interface Gloss {
  meaning: string
  meaningEs: string
  pronunciation: string
}

// Keyed by the list's word and part of speech, e.g. "그01\t대".
const glosses = new Map<string, Gloss>(
  (await readFile(GLOSSES, 'utf8'))
    .trim()
    .split('\n')
    .slice(1)
    .map((line) => {
      const [word, pos, meaning, meaningEs, pronunciation = ''] = line.split('\t')
      return [`${word}\t${pos}`, { meaning, meaningEs, pronunciation: pronunciation.trim() }]
    }),
)

// Card key -> example sentence written for this project, for words whose
// dictionary entry has none. They sit in the translations file with the rest.
const ownExamples = new Map<string, string>(
  (await readFile(TRANSLATIONS, 'utf8'))
    .trim()
    .split('\n')
    .slice(1)
    .map((line) => line.split('\t').slice(0, 2) as [string, string]),
)

const LIST_POS_LABEL: Record<string, string> = {
  명: 'noun',
  고: 'proper noun',
  동: 'verb',
  형: 'adjective',
  부: 'adverb',
  관: 'determiner',
  대: 'pronoun',
  수: 'numeral',
  감: 'interjection',
  의: 'bound noun',
  보: 'auxiliary verb',
}

const dictionary = await readDictionary(xmlDir)

// Most frequent first; words without a rank (mostly place names) go last in their level.
const ordered = [...listRows].sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity))

const words: Record<string, unknown>[] = []
const unmatched: string[] = []
// Left out until an example is written for them in example-translations.tsv.
const withoutExample: Record<string, unknown>[] = []
const definitions: string[] = []
const seenEntries = new Set<number>()
const seenCards = new Set<string>()
const tally: Record<string, number> = { sure: 0, likely: 0, guess: 0, manual: 0, duplicate: 0 }

for (const row of ordered) {
  const spelling = spellingOf(row.word)
  const gloss = glosses.get(`${row.word}\t${row.pos}`)
  const picked = pick(row, dictionary.get(spelling) ?? [])
  if (!picked && !gloss) {
    unmatched.push(row.word)
    continue
  }
  const entry = picked?.entry
  // Two list rows can land on one dictionary entry (the list splits some words further).
  if (entry && seenEntries.has(entry.id)) {
    tally.duplicate++
    continue
  }

  const sense = entry?.senses.find((s) => s.en || s.enDefinition)
  const pronunciation = gloss?.pronunciation || entry?.pronunciation.split(/[/,]/)[0]
  const romanization = romanize(spelling, pronunciation)

  // Where a word has no English equivalent, the dictionary puts its
  // romanization in that field. For a noun that is the usual English name
  // (불고기 "bulgogi", 부산 "Busan"); for a grammar word (수 "su", 않다 "anta")
  // it says nothing, so the definition is used instead.
  const isRomanized = (lemma: string) => [romanization, romanize(spelling)].includes(lemma.toLowerCase().replace(/[^a-z]/g, ''))
  let meaning = gloss?.meaning
  let meaningEs = gloss?.meaningEs
  if (!meaning && sense) {
    const real = sense.en && (entry?.pos === '명사' || !isRomanized(sense.en))
    meaning = real ? sense.en : sense.enDefinition || sense.en
    meaningEs = (real ? sense.es : '') || sense.esDefinition || sense.es
    if (!real) definitions.push(spelling)
  }

  const partOfSpeech = row.pos === '고' ? 'proper noun' : ((entry && POS_LABEL[entry.pos]) ?? LIST_POS_LABEL[row.pos] ?? null)
  // The app allows a word once per deck with the same meaning and part of speech.
  const card = `${row.grade}|${spelling}|${meaning}|${partOfSpeech}`
  if (seenCards.has(card)) {
    tally.duplicate++
    continue
  }
  seenCards.add(card)
  if (entry) seenEntries.add(entry.id)
  tally[picked ? picked.confidence : 'manual']++

  // The shortest full sentence reads best on a card; fall back to a phrase.
  const sentences = sense?.examples.filter((e) => e.type === '문장').sort((a, b) => a.text.length - b.text.length)
  const key = entry ? `nikl:${entry.id}` : `manual:${row.word}`
  const example =
    sentences?.[0]?.text ?? sense?.examples.find((e) => e.type === '구')?.text ?? ownExamples.get(key) ?? null
  // Every card shows an example sentence, so words without one are left out.
  if (!example) {
    withoutExample.push({ key, grade: row.grade, korean: spelling, partOfSpeech, meaning, meaningEs })
    continue
  }

  words.push({
    // Stable identity of the card, so a later import updates it instead of adding a copy.
    key,
    grade: row.grade,
    rank: row.rank,
    korean: spelling,
    meaning,
    meaningEs: meaningEs || null,
    hanja: entry && hasHanja(entry.origin) ? entry.origin.replace(/\s+/g, '') : hanjaOf(row.gloss) || null,
    romanization,
    partOfSpeech,
    example,
    match: picked ? picked.confidence : 'manual',
  })
}

// One word per line keeps the file diffable.
await writeFile(OUT, '[\n' + words.map((w) => JSON.stringify(w)).join(',\n') + '\n]\n')

console.log(`\n${words.length} words written to data/vocabulary.json`)
console.log(`  by grade: ${(['A', 'B', 'C'] as const).map((g) => `${g} ${words.filter((w) => w.grade === g).length}`).join(', ')}`)
console.log(`  match: ${tally.sure} sure, ${tally.likely} likely, ${tally.guess} guess, ${tally.manual} from manual-glosses.tsv only`)
console.log(`  skipped: ${tally.duplicate} already covered by another row, ${withoutExample.length} without an example, ${unmatched.length} not in the dictionary`)
console.log(`  without Spanish: ${words.filter((w) => !w.meaningEs).length}`)
if (unmatched.length) console.log(`  not found: ${unmatched.join(' ')}`)
console.log(`  meaning is the dictionary's definition (${definitions.length}): ${definitions.join(' ')}`)
if (withoutExample.length) {
  console.log(`  without an example (write one in example-translations.tsv to add them):`)
  for (const w of withoutExample) console.log(`    ${Object.values(w).join('\t')}`)
}
