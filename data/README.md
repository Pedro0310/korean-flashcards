# Vocabulary data

`vocabulary.json` is the word list behind the Beginner, Intermediate and Advanced decks.
`npm run db:import` loads it into the database.

## Sources

Both come from the National Institute of Korean Language (국립국어원).

| | What it gives | Licence |
|---|---|---|
| **한국어 학습용 어휘 목록** (2003), kept as `source/learning-vocabulary-2003.tsv` | Which 5,965 words are in, their grade (A, B, C) and their frequency rank | [KOGL Type 1](https://www.kogl.or.kr/info/licenseType1.do) (reuse with attribution) |
| **한국어기초사전**, Korean Learners' Dictionary, XML download | Meanings in English and Spanish, Hanja, pronunciation, example sentence | [CC BY-SA 2.0 KR](https://creativecommons.org/licenses/by-sa/2.0/kr/) |

`vocabulary.json` is derived from the dictionary, so it is shared under CC BY-SA 2.0 KR too.
An app that shows this data has to credit the institute; this one does at the foot of the sidebar.

Not from the institute:

- `source/manual-glosses.tsv`: meanings written for this project, for list words the dictionary
  lacks (mostly passives such as 만들어지다, and place names) or only defines at length.
- `source/example-translations.tsv`: English and Latin American Spanish translations of every
  card's example sentence, written for this project. For the 112 words whose dictionary entry
  has no example (interjections such as 네, passives, place names), the Korean sentence is
  written for this project too; the build uses it only when the dictionary has none.
- Romanization: generated from the dictionary's pronunciation by `scripts/romanize.ts`.

## How the two are joined

`scripts/build-vocabulary.ts` looks each list word up in the dictionary. Homographs are told
apart by part of speech, then by Hanja, then by the learner level the dictionary gives. Every
word records how sure that was in `match`:

- `sure`: only one entry fitted.
- `likely`: several fitted and level or Hanja decided.
- `guess`: several fitted and the first was taken. These are the ones to check by hand.
- `manual`: not in the dictionary; content from `manual-glosses.tsv`.

A card takes the first sense of its dictionary entry and that sense's shortest example sentence.

## Rebuilding

The dictionary XML (about 350 MB) is not kept here. Download it from
[krdict.korean.go.kr](https://krdict.korean.go.kr) ("사전 내려받기", XML), unzip it to a folder, then:

```
npx tsx scripts/build-vocabulary.ts <that folder>
npm run db:import
```

The current file was built from the dictionary as of 2019-08-02.
