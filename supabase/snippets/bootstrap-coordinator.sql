-- Run once in the Supabase SQL editor to make the first Coordinator.
-- 1. Sign in to the app once with this email (magic link) so the auth user exists.
-- 2. Replace the email below and run this.
insert into public.volunteers (user_id, display_name, role)
select id, split_part(email, '@', 1), 'coordinator'
from auth.users
where lower(email) = lower('you@example.org')
on conflict (user_id) do update set role = 'coordinator', active = true;
