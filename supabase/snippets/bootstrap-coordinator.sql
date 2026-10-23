-- Run in the Supabase SQL editor to make someone a Coordinator without the app,
-- for example to recover a project where nobody can manage roles any more.
-- Works whether or not they have signed in yet: an account with a confirmed email gets
-- the role now; otherwise it is applied once they confirm the address by signing in.
-- Replace the email below and run this.
insert into public.volunteer_invitations (email, role_id)
select lower('you@example.org'), id from public.roles where name = 'Coordinator'
on conflict (email) do update set role_id = excluded.role_id;

with accepted as (
  delete from public.volunteer_invitations i
  using auth.users u
  where lower(u.email) = i.email and u.email_confirmed_at is not null
  returning u.id, i.email, i.role_id
)
insert into public.volunteers (user_id, display_name, role_id)
select id, split_part(email, '@', 1), role_id from accepted
on conflict (user_id) do update set role_id = excluded.role_id, active = true;
