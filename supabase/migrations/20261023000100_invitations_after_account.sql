-- Volunteer Invitations never go to an account that was registered, unconfirmed,
-- before the invitation existed.
--
-- 20261022000100 made invitations wait for a confirmed address, but an account
-- registered earlier with a password and never confirmed could still take one:
-- when the invited person clicked the invitation (or any sign-in) email, that click
-- confirmed the earlier account, and whoever registered it could then sign in with
-- its password and the role. Now inviting such an address is refused, and a first
-- confirmation only accepts invitations made after the account was created.
-- A confirmed account changing to the invited address still accepts, as before.

create or replace function public.accept_volunteer_invitation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.volunteer_invitations;
  first_confirmation boolean := tg_op = 'UPDATE' and old.email_confirmed_at is null;
begin
  -- The trigger only runs for confirmed accounts. On an update, act only when the
  -- address has just been confirmed or has just changed (a confirmed email change).
  if tg_op = 'UPDATE' and old.email_confirmed_at is not null and old.email is not distinct from new.email then
    return new;
  end if;

  delete from public.volunteer_invitations i
  where i.email = lower(trim(new.email))
    and not (first_confirmation and new.created_at < i.created_at)
  returning * into invitation;

  if found then
    insert into public.volunteers (user_id, display_name, role_id, invited_by)
    values (
      new.id,
      coalesce(invitation.display_name, split_part(new.email, '@', 1)),
      invitation.role_id,
      invitation.invited_by
    )
    on conflict (user_id) do update set role_id = excluded.role_id, active = true;
  end if;
  return new;
end;
$$;

-- Inviting an address that belongs to an unconfirmed account is refused.
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
    select 1 from auth.users u where lower(u.email) = invitee and u.email_confirmed_at is null
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
        invited_by = excluded.invited_by,
        created_at = now();
  return false;
end;
$$;

-- 20261019000300 gave the initial Coordinators' role to any existing account with
-- their address, confirmed or not. Take access away from any Volunteer whose account
-- is still unconfirmed; they get it back by being invited again once the address is
-- confirmed.
update public.volunteers v
set active = false
from auth.users u
where u.id = v.user_id and u.email_confirmed_at is null and v.active;
