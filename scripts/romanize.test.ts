import { describe, expect, it } from 'vitest'
import { romanize } from './romanize.ts'

describe('romanize', () => {
  it.each([
    ['안녕하세요', null, 'annyeonghaseyo'],
    ['사람', null, 'saram'],
    ['물', null, 'mul'],
    ['꽃', '꼳', 'kkot'],
    ['쓰다', null, 'sseuda'],
    // tensing is pronounced but not written
    ['학교', '학꾜', 'hakgyo'],
    ['있다', '읻따', 'itda'],
    ['먹다', '먹따', 'meokda'],
    ['없다', '업ː따', 'eopda'],
    ['읽다', '익따', 'ikda'],
    // a tense sound that is really in the spelling stays
    ['있어요', '이써요', 'isseoyo'],
    // linking, assimilation, palatalization and aspiration are written
    ['음악', '으막', 'eumak'],
    ['종로', '종노', 'jongno'],
    ['신라', '실라', 'silla'],
    ['같이', '가치', 'gachi'],
    ['좋다', '조ː타', 'jota'],
    ['한국말', '한ː궁말', 'hangungmal'],
  ])('%s (%s) -> %s', (word, pronunciation, expected) => {
    expect(romanize(word, pronunciation)).toBe(expected)
  })

  it('falls back to the spelling when the pronunciation does not line up', () => {
    expect(romanize('가게', '가ː게/가게')).toBe('gage')
  })

  it('keeps characters that are not Hangul', () => {
    expect(romanize('티셔츠 A')).toBe('tisyeocheu A')
  })
})
