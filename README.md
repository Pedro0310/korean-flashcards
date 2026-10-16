# Korean Flashcards

A Korean vocabulary tracker with spaced repetition. React + Tailwind front end, a small Hono API, PostgreSQL.
https://korean-flashcards-yk5n.onrender.com/

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
