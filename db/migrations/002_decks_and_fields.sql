-- Decks, the extra word fields the card design shows, and review timing.

create table decks (
  id          integer generated always as identity primary key,
  user_id     integer not null references users (id) on delete cascade,
  name        text not null,
  -- Heading the deck sits under in the sidebar, e.g. 'TOPIK I' or 'King Sejong · Intermediate'
  group_name  text not null,
  sort_order  integer not null default 0,
  -- Daily limit on new (never reviewed) cards; reviews of known cards don't count
  new_per_day integer not null default 10 check (new_per_day between 1 and 100),
  created_at  timestamptz not null default now(),

  unique (user_id, group_name, name)
);

create index decks_user_sort_idx on decks (user_id, sort_order);

-- Every user starts with the same 16 decks. Called when a user is created
-- (server/auth.ts) and below for users that already exist. Safe to call again.
create function create_default_decks(p_user_id integer) returns void
language sql
as $$
  insert into decks (user_id, group_name, name, sort_order)
  values
    (p_user_id, 'TOPIK I',                     'Level 1',                         10),
    (p_user_id, 'TOPIK I',                     'Level 2',                         20),
    (p_user_id, 'TOPIK II',                    'Level 3',                         30),
    (p_user_id, 'TOPIK II',                    'Level 4',                         40),
    (p_user_id, 'TOPIK II',                    'Level 5',                         50),
    (p_user_id, 'TOPIK II',                    'Level 6',                         60),
    (p_user_id, 'King Sejong · Beginner',      'King Sejong Institute Korean 1',  70),
    (p_user_id, 'King Sejong · Beginner',      'King Sejong Institute Korean 2',  80),
    (p_user_id, 'King Sejong · Intermediate',  'King Sejong Institute Korean 3A', 90),
    (p_user_id, 'King Sejong · Intermediate',  'King Sejong Institute Korean 3B', 100),
    (p_user_id, 'King Sejong · Intermediate',  'King Sejong Institute Korean 4A', 110),
    (p_user_id, 'King Sejong · Intermediate',  'King Sejong Institute Korean 4B', 120),
    (p_user_id, 'King Sejong · Advanced',      'King Sejong Institute Korean 5A', 130),
    (p_user_id, 'King Sejong · Advanced',      'King Sejong Institute Korean 5B', 140),
    (p_user_id, 'King Sejong · Advanced',      'King Sejong Institute Korean 6A', 150),
    (p_user_id, 'King Sejong · Advanced',      'King Sejong Institute Korean 6B', 160)
  on conflict (user_id, group_name, name) do nothing;
$$;

select create_default_decks(id) from users;

-- Words: belong to a deck, and gain Hanja, word info and Spanish.
-- `meaning` stays the English meaning; the example translation is split by language.
alter table words
  add column deck_id        integer references decks (id) on delete cascade,
  add column hanja          text,
  add column part_of_speech text,
  add column meaning_es     text,
  add column example_es     text;

alter table words rename column example_translation to example_en;

-- Words that existed before decks go into TOPIK I · Level 1.
update words w
set deck_id = d.id
from decks d
where d.user_id = w.user_id and d.group_name = 'TOPIK I' and d.name = 'Level 1';

alter table words alter column deck_id set not null;

-- The same word can now appear in more than one deck, but only once per deck.
alter table words drop constraint words_user_id_korean_meaning_key;
alter table words add constraint words_deck_id_korean_meaning_key unique (deck_id, korean, meaning);

create index words_deck_due_idx on words (deck_id, due_at);

-- Time from showing the card to answering it, for "Time today" on the Stats screen.
alter table reviews add column duration_ms integer check (duration_ms >= 0);
