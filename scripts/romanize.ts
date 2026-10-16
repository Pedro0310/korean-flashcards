// Revised Romanization of Korean, for the romanization line on a card.
//
// Romanization follows pronunciation, not spelling (종로 is "Jongno"), so this
// works from the dictionary's pronunciation of the word when there is one.
// The one sound change the system does not write is tensing (학교 is said
// 학꾜 but written "hakgyo"), so that is undone by comparing with the spelling.

const INITIALS = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h']
const VOWELS = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i']
// A final consonant is pronounced as one of seven sounds, whatever its spelling.
const FINALS = ['', 'k', 'k', 'k', 'n', 'n', 'n', 't', 'l', 'k', 'm', 'l', 'l', 'l', 'p', 'l', 'm', 'p', 'p', 't', 't', 'ng', 't', 't', 'k', 't', 'p', 't']

// Tense initial -> its plain counterpart (ㄲ→ㄱ, ㄸ→ㄷ, ㅃ→ㅂ, ㅆ→ㅅ, ㅉ→ㅈ), by index into INITIALS.
const PLAIN_OF_TENSE: Record<number, number> = { 1: 0, 4: 3, 8: 7, 10: 9, 13: 12 }

const HANGUL_START = 0xac00
const HANGUL_END = 0xd7a3

interface Syllable {
  initial: number
  vowel: number
  final: number
}

function decompose(char: string): Syllable | null {
  const code = char.charCodeAt(0)
  if (code < HANGUL_START || code > HANGUL_END) return null
  const offset = code - HANGUL_START
  return { initial: Math.floor(offset / 588), vowel: Math.floor((offset % 588) / 28), final: offset % 28 }
}

const hangulOnly = (text: string) => [...text].filter((c) => decompose(c) !== null)

/**
 * @param word the word as spelled
 * @param pronunciation how the dictionary says it is pronounced (e.g. "학꾜"), if it differs from the spelling
 */
export function romanize(word: string, pronunciation?: string | null): string {
  // Only trust a pronunciation that lines up with the spelling syllable for syllable.
  const spoken = pronunciation ? hangulOnly(pronunciation) : []
  const usePronunciation = spoken.length > 0 && spoken.length === hangulOnly(word).length

  let out = ''
  let index = 0 // position among the Hangul syllables
  let previousFinal = 0
  for (const char of word) {
    const spelled = decompose(char)
    if (!spelled) {
      out += char
      previousFinal = 0
      continue
    }
    const said = usePronunciation ? decompose(spoken[index])! : spelled
    index++

    let initial = said.initial
    if (PLAIN_OF_TENSE[initial] === spelled.initial) initial = spelled.initial // tensing isn't written
    // ㄹ is "r" at the start of a syllable, but ㄹㄹ is "ll".
    out += initial === 5 && FINALS[previousFinal] === 'l' ? 'l' : INITIALS[initial]
    out += VOWELS[said.vowel] + FINALS[said.final]
    previousFinal = said.final
  }
  return out
}
