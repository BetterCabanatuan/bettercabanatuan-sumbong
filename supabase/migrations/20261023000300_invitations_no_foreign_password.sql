-- A password sign-up made while a Volunteer Invitation is pending no longer takes it.
--
-- 20261023000100 and 20261023000200 trusted any unconfirmed account created at or after
-- the invitation. Public sign-up is on, so someone could register the invited address
-- with a password in that window (before the invitation email creates its account, or
-- after that email failed to send); the owner's click on a sign-in email then confirmed
-- it and gave the role to an account whose password someone else knows. Now a first
-- confirmation, and a repeat invitation, only trust an account made by the invitation
-- email (invited_at is set) or one with no password, as a /login sign-in makes. The
-- created_at check stays.

create or replace function public.accept_volunteer_invitation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.volunteer_invitations;
  first_confirmation boolean := tg_op = 'UPDATE' and old.email_confirmed_at is null;
  -- Nobody but the address's owner can sign in to an account made by the invitation
  -- email or by a passwordless sign-in. A password, though, may have been chosen by
  -- whoever registered the address.
  no_foreign_password boolean := new.invited_at is not null or coalesce(new.encrypted_password, '') = '';
begin
  -- The trigger only runs for confirmed accounts. On an update, act only when the
  -- address has just been confirmed or has just changed (a confirmed email change).
  if tg_op = 'UPDATE' and old.email_confirmed_at is not null and old.email is not distinct from new.email then
    return new;
  end if;

  delete from public.volunteer_invitations i
  where i.email = lower(trim(new.email))
    and not (first_confirmation and (new.created_at < i.created_at or not no_foreign_password))
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

-- An unconfirmed account blocks a new invitation unless the pending invitation could
-- give it the role.
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
      and not (
        (u.invited_at is not null or coalesce(u.encrypted_password, '') = '')
        and exists (
          select 1 from public.volunteer_invitations i
          where i.email = invitee and u.created_at >= i.created_at
        )
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
