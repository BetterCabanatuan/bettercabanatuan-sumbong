-- The first Coordinators. Each is invited by email: an account that already
-- exists gets the role now, and the others get it the first time they sign in.
-- Add more people from /v/settings/users instead of here.

insert into public.volunteer_invitations (email, role_id)
select invitee, r.id
from unnest(array[
  'joshuagemvicente6@gmail.com',
  'bettercabanatuan@gmail.com',
  'jp.gabornes@gmail.com'
]) as invitee
cross join public.roles r
where r.name = 'Coordinator'
on conflict (email) do nothing;

with accepted as (
  delete from public.volunteer_invitations i
  using auth.users u
  where lower(u.email) = i.email
  returning u.id, i.email, i.role_id
)
insert into public.volunteers (user_id, display_name, role_id)
select id, split_part(email, '@', 1), role_id
from accepted
on conflict (user_id) do update set role_id = excluded.role_id, active = true;
