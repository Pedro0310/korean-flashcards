-- Row level security on every table, with no policies.
--
-- On Supabase, tables in the public schema are also reachable through its
-- automatic web API (the "Data API"), which this app doesn't use. With row
-- level security on and no policies saying who may see what, that API's
-- roles can't read or change any row. The app is unaffected: it connects as
-- the tables' owner, and row level security doesn't apply to the owner.
-- On a plain PostgreSQL server this changes nothing.

alter table users enable row level security;
alter table sessions enable row level security;
alter table decks enable row level security;
alter table words enable row level security;
alter table cards enable row level security;
alter table reviews enable row level security;
alter table deck_settings enable row level security;
alter table schema_migrations enable row level security;
