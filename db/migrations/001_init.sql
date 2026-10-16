create table users (
  id           integer generated always as identity primary key,
  email        text not null unique,
  display_name text not null,
  created_at   timestamptz not null default now()
);

create table words (
  id                  integer generated always as identity primary key,
  user_id             integer not null references users (id) on delete cascade,
  korean              text not null,
  meaning             text not null,
  romanization        text,
  example             text,
  example_translation text,
  notes               text,
  created_at          timestamptz not null default now(),

  -- Spaced-repetition state (see server/srs.ts)
  due_at              timestamptz not null default now(),
  interval_days       double precision not null default 0,
  ease_factor         double precision not null default 2.5,
  repetitions         integer not null default 0,
  lapses              integer not null default 0,

  unique (user_id, korean, meaning)
);

create index words_user_due_idx on words (user_id, due_at);

create table reviews (
  id              integer generated always as identity primary key,
  user_id         integer not null references users (id) on delete cascade,
  word_id         integer not null references words (id) on delete cascade,
  rating          smallint not null check (rating between 1 and 4),
  reviewed_at     timestamptz not null default now(),
  interval_before double precision not null,
  interval_after  double precision not null
);

create index reviews_user_reviewed_idx on reviews (user_id, reviewed_at);
