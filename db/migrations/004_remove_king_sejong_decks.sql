-- The King Sejong Institute decks are dropped; only the level decks remain.

delete from decks where group_name like 'King Sejong%';

create or replace function create_default_decks(p_user_id integer) returns void
language sql
as $$
  insert into decks (user_id, group_name, name, sort_order)
  values
    (p_user_id, 'Beginner',     'Part 1', 1),
    (p_user_id, 'Beginner',     'Part 2', 2),
    (p_user_id, 'Intermediate', 'Part 1', 3),
    (p_user_id, 'Intermediate', 'Part 2', 4),
    (p_user_id, 'Intermediate', 'Part 3', 5),
    (p_user_id, 'Intermediate', 'Part 4', 6),
    (p_user_id, 'Advanced',     'Part 1', 7),
    (p_user_id, 'Advanced',     'Part 2', 8),
    (p_user_id, 'Advanced',     'Part 3', 9),
    (p_user_id, 'Advanced',     'Part 4', 10),
    (p_user_id, 'Advanced',     'Part 5', 11),
    (p_user_id, 'Advanced',     'Part 6', 12)
  on conflict (user_id, group_name, name) do nothing;
$$;
