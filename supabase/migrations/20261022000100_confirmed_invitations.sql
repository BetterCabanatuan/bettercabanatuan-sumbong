-- Volunteer Invitations apply only to an account whose email address is confirmed.
--
-- Before this, the invitation applied as soon as an auth.users row with the invited
-- email was created. Anyone who registered that address first (a password sign-up
-- through the public Auth API, which a project without "Confirm email" accepts at
-- once) got the invited role, including the initial Coordinators' addresses that are
-- in this repository. Confirming the address proves its owner clicked the email.

create or replace function public.accept_volunteer_invitation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.volunteer_invitations;
begin
  -- The trigger only runs for confirmed accounts. On an update, act only when the
  -- address has just been confirmed or has just changed (a confirmed email change).
  if tg_op = 'UPDATE' and old.email_confirmed_at is not null and old.email is not distinct from new.email then
    return new;
  end if;

  delete from public.volunteer_invitations
  where email = lower(trim(new.email))
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

drop trigger accept_volunteer_invitation on auth.users;
create trigger accept_volunteer_invitation
after insert or update of email, email_confirmed_at on auth.users
for each row
when (new.email_confirmed_at is not null)
execute function public.accept_volunteer_invitation();

-- Inviting an address applies at once only to a confirmed account; otherwise the
-- invitation waits for the address to be confirmed. Changing the role of someone who
-- already has access also needs users.edit, as it does in set_user_access.
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
