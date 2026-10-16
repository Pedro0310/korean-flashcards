# The database, for someone learning PostgreSQL

This app keeps everything that changes (accounts, progress, review history) and everything it
shows (decks, words, sentences) in a PostgreSQL database. This page explains what that is on
your computer, how to look inside it, and what each table is for.

## What PostgreSQL is, here

PostgreSQL ("Postgres") is a **database server**: a program that runs in the background, keeps
data in tables, and answers questions written in **SQL**. It is not a website and not something
you open in the browser. On this computer:

- It runs as a Windows service called `postgresql-x64-17`, started automatically with Windows.
  You can see it in the *Services* app.
- It listens on port **5432** of your own machine (`localhost`), so only programs on this
  computer can reach it.
- Its files live in `C:\Program Files\PostgreSQL\17\data`. Don't touch those directly; always
  go through Postgres.
- One server can hold several **databases**. This app uses one called `korean_flashcards`.

Nothing talks to Postgres directly from the browser. The chain is:

```
browser (React app)  ->  API server (server/index.ts)  ->  PostgreSQL
      fetch /api/...          runs SQL queries               stores the rows
```

The API server finds the database through `DATABASE_URL` in `.env`:

```
postgres://korean_app:PASSWORD@localhost:5432/korean_flashcards
           ^ user     ^ password ^ host   ^ port ^ database
```

`korean_app` is a database **user** (called a *role* in Postgres) made just for this app. It
owns the app's tables and can't do anything else on the server. There is also the
**superuser** `postgres`, which can do everything; its password is in `.env` as
`PG_SUPERUSER_PASSWORD`. Use it only for admin work like creating databases.

When the app is deployed, the only change is that `DATABASE_URL` points to a hosted Postgres
(Neon, Supabase, Render, ...) instead of `localhost`.

## Looking inside

### pgAdmin 4 (a desktop app with a visual interface)

It was installed along with PostgreSQL. Open it from the Start menu: **pgAdmin 4**.

1. First time only, connect it to the app's database. Right-click **Servers** > **Register** >
   **Server...**
   - *General* tab, Name: `korean-flashcards`
   - *Connection* tab: Host `localhost`, Port `5432`, Maintenance database
     `korean_flashcards`, Username `korean_app`, Password: the one in `DATABASE_URL`
     (between `korean_app:` and `@`). Tick *Save password*.
2. In the tree on the left: **korean-flashcards > Databases > korean_flashcards > Schemas >
   public > Tables**. That lists the app's tables.
3. To see rows: right-click a table > **View/Edit Data** > **First 100 Rows**.
4. To ask your own questions: select the database, then **Tools > Query Tool**, type SQL and
   press F5 (or the ▶ button).
5. For a picture of how the tables connect: right-click **korean_flashcards** > **ERD For
   Database**.

pgAdmin lets you edit cells directly. While learning, stick to looking; change data through
the app or with SQL you understand (see "Changing data safely").

### psql (the command line)

```
"C:\Program Files\PostgreSQL\17\bin\psql.exe" "postgres://korean_app:PASSWORD@localhost:5432/korean_flashcards"
```

Useful commands inside psql (the ones starting with `\` are psql's own, not SQL):

| Command | What it does |
|---|---|
| `\dt` | List tables |
| `\d words` | Show a table's columns, indexes and links to other tables |
| `select * from decks;` | Any SQL; end it with `;` |
| `\x` | Toggle one-column-per-line output, handy for wide rows |
| `\q` | Quit |

## The tables

```
users ──< sessions          one user, many signed-in browsers
  │
  ├──< cards >── words >── decks        a user's progress on a word; words belong to a deck
  ├──< reviews >── words                every answer the user gave
  └──< deck_settings >── decks          a user's daily limit for a deck

(──< means "one to many": one user has many cards)
```

**Shared by everyone** (the same rows for every user, loaded by `npm run db:import`):

| Table | One row is | Main columns |
|---|---|---|
| `decks` | a deck in the sidebar, e.g. Beginner · Part 1 | `group_name`, `name`, `sort_order` |
| `words` | a word on a card | `korean`, `meaning`, `meaning_es`, `hanja`, `romanization`, `part_of_speech`, `example`, `example_en`, `example_es`, `deck_id`, `position` (frequency order in the deck), `source_key` (its id in the dictionary) |

**Per user:**

| Table | One row is | Main columns |
|---|---|---|
| `users` | an account, or a guest (no `email`, no `password_hash`) | `email`, `password_hash` |
| `sessions` | one browser where someone is signed in | `user_id`, `expires_at` |
| `cards` | one user's progress on one word | `user_id`, `word_id`, `due_at`, `interval_days`, `ease_factor`, `repetitions`, `lapses` |
| `reviews` | one press of an answer button | `user_id`, `word_id`, `rating` (1 Again to 4 Easy), `reviewed_at`, `duration_ms` |
| `deck_settings` | a daily new-card limit someone changed | `user_id`, `deck_id`, `new_per_day` |

`schema_migrations` is bookkeeping: which migration files have run (see below).

Some ideas that show up in these tables:

- **Primary key**: the column that identifies a row, usually `id`. `cards` uses two columns
  together, `(user_id, word_id)`, because a user has at most one card per word.
- **Foreign key**: a column pointing at another table's row, like `cards.word_id` pointing at
  `words.id`. Postgres refuses a card for a word that doesn't exist.
- **on delete cascade**: deleting a user automatically deletes their cards, reviews, sessions
  and settings. Deleting a word deletes everyone's cards and reviews of it.
- **Unique**: no two users can have the same `email`; no two words the same `source_key`.
- **Index**: a lookup structure that makes a search fast, like the one on
  `cards (user_id, due_at)` for "which of my cards are due?". You don't query indexes
  directly; Postgres uses them on its own.
- **A new word has no card.** A `cards` row is created the first time you answer a word.
  "New words" are simply the words you have no card for. That's why a new account costs
  nothing: it starts with zero rows.
- **Passwords are never stored.** `password_hash` holds a scrambled version (scrypt) that
  can check a password but can't be turned back into it. Sessions are stored the same way:
  the browser's cookie holds a random token, and the table only holds a hash of it.

## What happens when you use the app

- **Create an account**: one row in `users`, one in `sessions`; the browser gets a cookie.
- **Continue as guest**: the same, but the `users` row has no email or password, so the
  cookie in that browser is the only way back to it. If the guest later creates an account,
  the email and password are filled into that same row, so all its `cards` and `reviews`
  stay. A guest whose sessions have all expired (30 days without opening the app) is deleted
  the next time someone starts guest mode, along with its progress.
- **Open a deck**: the server reads your `cards` that are due, plus the next new `words` in
  frequency order, up to your daily limit.
- **Press Good**: in one *transaction* (all or nothing), your row in `cards` is created or
  updated with the next due date, and a row is added to `reviews`.
- **Stats**: counted from `cards` and `reviews`.
- **Reset**: deletes your `cards` and `reviews` for that deck. Nobody else is affected.
- **Sign out**: deletes the row in `sessions`.

## Migrations: how the tables change

The files in `db/migrations/` describe the database's shape, in order: `001_init.sql` created
the first tables, and `005_accounts_and_shared_words.sql` added accounts and moved progress
into `cards`. `npm run db:migrate` runs every file that isn't listed in `schema_migrations`
yet, then records it there.

Rules: never edit a file that has already run; to change something, add a new numbered file.
That way your computer and a hosted database end up identical just by running the same command.

## Questions to try

Paste these into the pgAdmin Query Tool or psql. They only read; they change nothing.

```sql
-- How many words in each deck?
select d.group_name, d.name, count(*) as words
from decks d join words w on w.deck_id = d.id
group by d.id order by d.sort_order;

-- The first 10 words of Beginner · Part 1, in frequency order
select w.position, w.korean, w.meaning, w.example
from words w join decks d on d.id = w.deck_id
where d.group_name = 'Beginner' and d.name = 'Part 1'
order by w.position limit 10;

-- How many accounts and guests?
select count(email) as accounts, count(*) - count(email) as guests from users;

-- Who has an account, and how much have they studied? (guests show an empty email)
select u.email, u.created_at,
  (select count(*) from cards c where c.user_id = u.id) as cards,
  (select count(*) from reviews r where r.user_id = u.id) as reviews
from users u;

-- Your last 20 answers (change the email)
select r.reviewed_at, w.korean, r.rating
from reviews r join words w on w.id = r.word_id join users u on u.id = r.user_id
where u.email = 'you@example.com'
order by r.reviewed_at desc limit 20;
```

## Changing data safely

`update` and `delete` act immediately, and there is no undo. Two habits help:

1. Run the same `where` as a `select` first and check the rows it returns.
2. Wrap changes in a transaction so you can back out:

```sql
begin;
delete from users where email = 'someone@example.com';
-- look around; if something is wrong:
rollback;   -- nothing happened
-- if it's right:
commit;
```

## Backups

`pg_dump` copies a whole database into one file; `pg_restore` puts it back.

```
"C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" "<DATABASE_URL>" -Fc -f backup.dump
"C:\Program Files\PostgreSQL\17\bin\pg_restore.exe" --clean -d "<DATABASE_URL>" backup.dump
```

Hosted Postgres providers back up automatically; check how far back yours goes.
