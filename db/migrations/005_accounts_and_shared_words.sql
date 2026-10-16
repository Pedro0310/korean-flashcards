-- Accounts, and one shared copy of the decks and words.
--
-- Until now every user had a private copy of every deck and word, and a
-- word's spaced-repetition state was stored on the word itself. From here on:
--
--   decks, words    the same for everyone, filled by db/import-vocabulary.ts
--   cards           one user's progress on one word; the row appears at the first review
--   deck_settings   one user's daily new-card limit for one deck, when changed from 10
--   reviews         unchanged: every answer anyone gave
--   sessions        who is signed in, on which browser
--
-- Written when only the built-in local user existed, so that user's decks and
-- words become the shared ones.

do $$
begin
  if (select count(distinct user_id) from decks) > 1 then
    raise exception 'More than one user has decks; this migration expects only the local user.';
  end if;
end $$;

-- ------------------------------------------------------------------ progress

create table cards (
  user_id       integer not null references users (id) on delete cascade,
  word_id       integer not null references words (id) on delete cascade,
  due_at        timestamptz not null,
  interval_days double precision not null,
  ease_factor   double precision not null,
  repetitions   integer not null,
  lapses        integer not null,
  primary key (user_id, word_id)
);

create index cards_user_due_idx on cards (user_id, due_at);

-- Words that have been reviewed keep their progress as cards.
insert into cards (user_id, word_id, due_at, interval_days, ease_factor, repetitions, lapses)
select w.user_id, w.id, w.due_at, w.interval_days, w.ease_factor, w.repetitions, w.lapses
from words w
where exists (select 1 from reviews r where r.word_id = w.id);

create table deck_settings (
  user_id     integer not null references users (id) on delete cascade,
  deck_id     integer not null references decks (id) on delete cascade,
  new_per_day integer not null check (new_per_day between 1 and 100),
  primary key (user_id, deck_id)
);

insert into deck_settings (user_id, deck_id, new_per_day)
select user_id, id, new_per_day from decks where new_per_day <> 10;

-- ------------------------------------------------------------------ shared content

-- Words added by hand belonged to one person and have no place in shared decks.
delete from words where source_key is null;

-- Dropping a column also drops the indexes and constraints that use it.
alter table words
  drop column user_id,
  drop column notes,
  drop column due_at,
  drop column interval_days,
  drop column ease_factor,
  drop column repetitions,
  drop column lapses,
  alter column source_key set not null,
  alter column position set not null;

create unique index words_source_key_idx on words (source_key);
create index words_deck_position_idx on words (deck_id, position);

alter table decks
  drop column user_id,
  drop column new_per_day,
  add constraint decks_group_name_name_key unique (group_name, name);

drop function create_default_decks(integer);

-- A new database gets its decks here; this one already has them.
insert into decks (group_name, name, sort_order)
values
  ('Beginner',     'Part 1', 1),
  ('Beginner',     'Part 2', 2),
  ('Intermediate', 'Part 1', 3),
  ('Intermediate', 'Part 2', 4),
  ('Intermediate', 'Part 3', 5),
  ('Intermediate', 'Part 4', 6),
  ('Advanced',     'Part 1', 7),
  ('Advanced',     'Part 2', 8),
  ('Advanced',     'Part 3', 9),
  ('Advanced',     'Part 4', 10),
  ('Advanced',     'Part 5', 11),
  ('Advanced',     'Part 6', 12)
on conflict (group_name, name) do nothing;

-- ------------------------------------------------------------------ sign-in

-- Null for the old local user, who has no password and can't sign in.
alter table users add column password_hash text;

create table sessions (
  -- SHA-256 of the token kept in the browser's cookie, so someone who reads
  -- this table still can't use it to sign in.
  id         text primary key,
  user_id    integer not null references users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index sessions_user_idx on sessions (user_id);
