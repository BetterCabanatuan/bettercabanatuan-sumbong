-- Inviting an address again (to resend the email or change the role) works while the
-- first invitation is still pending.
--
-- The invitation email creates an unconfirmed account for the address (Supabase's
-- invite link), so 20261023000100 refused every later invite_volunteer call for that
-- address with unconfirmed_account_exists. An unconfirmed account created at or after
-- the pending invitation is the one the invitation made, so it no longer blocks. An
-- account registered before any invitation is still refused.
--
-- A repeat invitation also keeps the pending invitation's created_at: the confirmation
-- trigger accepts an invitation only for accounts created at or after it (the header of
-- 20261023000100 says the reverse, but its code and tests are right), so moving
-- created_at past the account would make the account's confirmation skip it.

create or replace function public.invite_volunteer(p_email text, p_role_id uuid, p_display_name text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.require_permission('users.add');
  invitee text := lower(trim(p_email));
  display text := nullif(trim(p_display_name), '');
  existing uuid;
begin
  if invitee !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_email' using errcode = 'P0001';
  end if;
  if p_role_id is null then
    raise exception 'unknown_role' using errcode = 'P0001';
  end if;

  -- Someone may have registered the address (with a password) before the invitation.
  -- If its owner later confirmed that account by clicking the invitation email, the
  -- registrant could sign in to it with the role. Remove that account first.
  if exists (
    select 1 from auth.users u
    where lower(u.email) = invitee
      and u.email_confirmed_at is null
      and not exists (
        select 1 from public.volunteer_invitations i
        where i.email = invitee and u.created_at >= i.created_at
      )
  ) then
    raise exception 'unconfirmed_account_exists' using errcode = 'P0001',
      hint = 'Delete the unconfirmed account for this address in Supabase Auth, then invite again.';
  end if;

  select u.id into existing
  from auth.users u
  where lower(u.email) = invitee and u.email_confirmed_at is not null
  limit 1;
  if exists (select 1 from public.volunteers where user_id = existing and active) then
    perform public.require_permission('users.edit');
  end if;
  perform public.check_can_assign(actor, existing, p_role_id);

  if existing is not null then
    insert into public.volunteers as v (user_id, display_name, role_id, invited_by)
    values (existing, coalesce(display, split_part(invitee, '@', 1)), p_role_id, actor)
    on conflict (user_id) do update
      set role_id = excluded.role_id,
          active = true,
          display_name = coalesce(display, v.display_name);
    delete from public.volunteer_invitations where email = invitee;
    return true;
  end if;

  insert into public.volunteer_invitations (email, role_id, display_name, invited_by)
  values (invitee, p_role_id, display, actor)
  on conflict (email) do update
    set role_id = excluded.role_id,
        display_name = excluded.display_name,
        invited_by = excluded.invited_by;
  return false;
end;
$$;
