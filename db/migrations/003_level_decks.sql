-- Level decks filled from the graded vocabulary list (data/vocabulary.json),
-- replacing the TOPIK decks, plus what importing that list needs on words.

alter table words
  -- Order of a word within its deck (most frequent first). Null for words added by hand.
  add column position   integer,
  -- Stable identity of an imported word, e.g. 'nikl:27733', so importing again
  -- updates the word instead of adding a copy. Null for words added by hand.
  add column source_key text;

create unique index words_user_source_key_idx on words (user_id, source_key) where source_key is not null;

-- A spelling can be two words with the same English gloss (가까이 as noun and
-- as adverb), so part of speech now counts towards what makes a card unique.
alter table words drop constraint words_deck_id_korean_meaning_key;
create unique index words_deck_card_idx on words (deck_id, korean, meaning, coalesce(part_of_speech, ''));

-- The TOPIK decks go, with the starter words that were in them and their reviews.
delete from decks where group_name in ('TOPIK I', 'TOPIK II');

-- Levels follow the list's grades: Beginner = A, Intermediate = B, Advanced = C.
-- Each level is split into parts of about 500 words by db/import-vocabulary.ts.
create or replace function create_default_decks(p_user_id integer) returns void
language sql
as $$
  insert into decks (user_id, group_name, name, sort_order)
  values
    (p_user_id, 'Beginner',                    'Part 1',                          1),
    (p_user_id, 'Beginner',                    'Part 2',                          2),
    (p_user_id, 'Intermediate',                'Part 1',                          3),
    (p_user_id, 'Intermediate',                'Part 2',                          4),
    (p_user_id, 'Intermediate',                'Part 3',                          5),
    (p_user_id, 'Intermediate',                'Part 4',                          6),
    (p_user_id, 'Advanced',                    'Part 1',                          7),
    (p_user_id, 'Advanced',                    'Part 2',                          8),
    (p_user_id, 'Advanced',                    'Part 3',                          9),
    (p_user_id, 'Advanced',                    'Part 4',                          10),
    (p_user_id, 'Advanced',                    'Part 5',                          11),
    (p_user_id, 'Advanced',                    'Part 6',                          12),
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
