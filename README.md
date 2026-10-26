# Korean Flashcards (암기)

A web app for learning Korean vocabulary with flashcards. It shows you a word, you try to remember it, and the app decides when to show it again: words you find hard come back soon, words you know well come back later. This is called spaced repetition, the same idea Anki uses.

Try it: https://korean-flashcards-yk5n.onrender.com/

## What you can do with it

- **Study about 5,900 Korean words**, split into three levels: Beginner (초급), Intermediate (중급) and Advanced (고급). Each level is divided into parts of about 500 words, ordered from the most common words to the least common.
- **Review with flashcards.** Each card shows the Korean word. Flip it (Space or Enter) to see the meaning in English and Spanish, the Hanja, the romanization, the part of speech and an example sentence with its translation.
- **Rate each answer** with keys 1 to 4 (Again, Hard, Good, Easy). The app uses your rating to schedule the next review.
- **Choose what the card shows**: turn Hanja, romanization, word info, English or Spanish on or off, switch between light and dark mode.
- **Follow your progress** on the Stats screen: progress and daily goal per deck, a calendar of a year of reviews, how much you remember (retention), card counts and which buttons you press most. You can also reset a deck.
- **Use an account or not**: sign up with email and password to keep your progress on any device, or continue as a guest. If a guest creates an account later, their progress is kept.

## Where the words come from

All the vocabulary comes from the **National Institute of Korean Language (국립국어원)**, the official body for the Korean language in South Korea. Two of its resources were combined:

1. **한국어 학습용 어휘 목록 (Korean learning vocabulary list, 2003).** A list of 5,965 words chosen for learners of Korean. It decides which words are in the app, their level (grade A, B or C becomes Beginner, Intermediate or Advanced) and their order (how frequent each word is). Licence: [KOGL Type 1](https://www.kogl.or.kr/info/licenseType1.do), free to reuse with attribution.
2. **한국어기초사전 (Korean Learners' Dictionary)**, downloaded in XML from [krdict.korean.go.kr](https://krdict.korean.go.kr). It gives each word its English and Spanish meaning, Hanja, pronunciation and example sentence. Licence: [CC BY-SA 2.0 KR](https://creativecommons.org/licenses/by-sa/2.0/kr/).

A script (`scripts/build-vocabulary.ts`) looks up every word of the list in the dictionary and saves the result in `data/vocabulary.json`. A few things were added for this project:

- Meanings written by hand for words the dictionary doesn't have (mostly passive verbs and place names).
- English and Latin American Spanish translations of every example sentence.
- Romanization, generated automatically from the dictionary's pronunciation.

Because the word data comes from the dictionary, `data/vocabulary.json` is shared under CC BY-SA 2.0 KR, and the app credits the institute at the bottom of the sidebar. More detail, including how to rebuild the file, is in [data/README.md](data/README.md).
