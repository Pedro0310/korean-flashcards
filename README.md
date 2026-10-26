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

## Built with

React and Tailwind for the front end, a small [Hono](https://hono.dev) API on Node, and PostgreSQL for the data. Written in TypeScript.

## Running it

```
npm install
npm run db:migrate   # create / update tables
npm run db:import    # load the level decks (about 5,900 words) from data/vocabulary.json
npm run dev          # app on http://localhost:5173, API on :3001
```

Needs a `.env` with `DATABASE_URL` (see `.env.example`). Open the app and create an account to start.

New to PostgreSQL? [docs/database.md](docs/database.md) explains the tables and how to look at them.

| Command | What it does |
|---|---|
| `npm run dev` | API and Vite dev server together, with reload |
| `npm run build` | Build the React app into `dist/` |
| `npm start` | Production mode: one server for the API and the built app |
| `npm run db:migrate` | Apply new files in `db/migrations/` |
| `npm run db:import` | Load or update the shared words from `data/vocabulary.json` |
| `npm test` | Unit tests (scheduler, stats, password hashing) |
| `npm run typecheck` | TypeScript check |

## Screens

- **Sign in** (shown when nobody is signed in): sign in or create an account with email and password, or continue as a guest. A guest's progress is kept on the server but reachable only from that browser; creating an account later keeps it.
- **Review** (`/`): the sticky-note card. Space or Enter shows the answer, keys 1 to 4 rate it. The menu button opens the sidebar with the decks and the display options.
- **Stats** (`/stats`): progress and daily goal per deck, a year of reviews, retention, card counts, answer buttons, reset.

## Layout

- `src/` React app (pages, components, `api.ts` fetch helpers, `settings.ts` and `theme.ts` for what is kept in localStorage)
- `src/index.css` design tokens for both themes
- `server/` API routes (`index.ts`), scheduler (`srs.ts`), stats helpers (`stats.ts`), sign-in and sessions (`auth.ts`, `passwords.ts`)
- `db/` SQL migrations, migration runner, vocabulary importer
- `data/` the vocabulary file, its sources and licences (see `data/README.md`)
- `scripts/` builds `data/vocabulary.json` from the word list and the dictionary
- `shared/` types used by both sides
- `design/` the design handoff the UI was built from (reference only, not served)

## Deploying

Any Node host plus any Postgres works. Set `DATABASE_URL`, `PORT`, `NODE_ENV=production` and, behind the host's proxy, `TRUST_PROXY=1` (see `.env.example`), then run `npm run build`, `npm run db:migrate`, `npm run db:import` and `npm start`.

The site must be served over HTTPS: in production the session cookie is marked Secure, and browsers only send it over HTTPS.

Requests are limited per IP address (`server/rateLimit.ts`), and sign-in pauses after 10 wrong passwords for one email. Not built yet, and worth having before opening sign-up to the public: password reset by email and email verification.
