-- Guests: people who use the app without an account. A guest is a user with
-- no email and no password, reachable only through the session cookie of the
-- browser that started it. Creating an account fills in the email and
-- password, so the guest's progress becomes the account's.

-- Unique still holds for the emails that exist; any number of rows may have none.
alter table users alter column email drop not null;

-- Finding guests whose sessions have all expired, to delete them.
create index users_guests_idx on users (created_at) where email is null;
