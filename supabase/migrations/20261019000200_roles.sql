-- Roles and permissions.
--
-- Permissions are a fixed list: each one is checked by the functions and policies
-- below. Roles are rows that Coordinators create and edit, and each Volunteer has
-- one role. The old fixed roles become the "Volunteer" and "Coordinator" roles.
--
-- Rules:
--   * A signed-in user can never remove the last active holder of roles.manage.
--   * Nobody can change their own role or access.
--   * You can only give, change or take away a role whose permissions you hold yourself.
--   * Volunteer Invitations are by email and take effect as soon as that account exists.

-- ---------------------------------------------------------------------------
-- Permissions and roles
-- ---------------------------------------------------------------------------

create table public.permissions (
  key text primary key,
  label text not null,
  description text not null,
  sort_order integer not null default 0
);

insert into public.permissions (key, label, description, sort_order) values
  ('reports.review', 'Review Reports', 'Approve or reject new Reports, clear their photos, and take down published ones.', 10),
  ('reports.manage', 'Follow up on Reports', 'Resolve, reopen and Misroute Reports after they are published.', 20),
  ('digests.manage', 'Send Digests', 'Build Digests, log how they went out and upload Proof of Receipt.', 30),
  ('categories.manage', 'Manage Categories', 'Add and edit Categories and their questions.', 40),
  ('offices.manage', 'Manage Responsible Offices', 'Add and edit Responsible Offices and how to reach them.', 50),
  ('users.manage', 'Manage users', 'Invite people, give them a role and remove their access.', 60),
  ('roles.manage', 'Manage roles', 'Create and edit roles and their permissions. Whoever has this can give their own role every permission.', 70);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 60),
  description text,
  created_at timestamptz not null default now()
);

create unique index roles_name_key on public.roles (lower(name));

create table public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission text not null references public.permissions (key) on delete cascade,
  primary key (role_id, permission)
);

insert into public.roles (name, description) values
  ('Volunteer', 'Reviews Reports and carries them to Responsible Offices.'),
  ('Coordinator', 'Everything a Volunteer does, plus Categories, Responsible Offices, users and roles.');

insert into public.role_permissions (role_id, permission)
select r.id, p.key
from public.roles r
cross join public.permissions p
where r.name = 'Coordinator'
   or p.key in ('reports.review', 'reports.manage', 'digests.manage');

-- ---------------------------------------------------------------------------
-- volunteers.role (enum) becomes volunteers.role_id
-- ---------------------------------------------------------------------------

-- A Volunteer without access keeps their last role until that role is deleted.
alter table public.volunteers
  add column role_id uuid references public.roles (id) on delete set null;

update public.volunteers v
set role_id = r.id
from public.roles r
where r.name = case v.role when 'coordinator' then 'Coordinator' else 'Volunteer' end;

alter table public.volunteers
  add constraint volunteers_active_needs_role check (role_id is not null or not active);

create index volunteers_role_idx on public.volunteers (role_id);

drop policy "coordinators manage offices" on public.responsible_offices;
drop policy "coordinators manage categories" on public.categories;
drop policy "coordinators manage category questions" on public.category_questions;
drop policy "coordinators update volunteers" on public.volunteers;
drop function public.is_coordinator();

alter table public.volunteers drop column role;
drop type public.volunteer_role;

-- ---------------------------------------------------------------------------
-- Volunteer Invitations
-- ---------------------------------------------------------------------------

create table public.volunteer_invitations (
  email text primary key check (email = lower(trim(email)) and email like '%_@_%'),
  role_id uuid not null references public.roles (id),
  display_name text,
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Permission helpers
-- ---------------------------------------------------------------------------

create function public.has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.volunteers v
    join public.role_permissions rp on rp.role_id = v.role_id
    where v.user_id = auth.uid() and v.active and rp.permission = p_permission
  );
$$;

create function public.require_permission(p_permission text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_permission(p_permission) then
    if not public.is_volunteer() then
      raise exception 'Volunteer access required' using errcode = '42501';
    end if;
    raise exception 'Your role does not allow this (needs "%")',
      coalesce((select label from public.permissions where key = p_permission), p_permission)
      using errcode = '42501';
  end if;
  return auth.uid();
end;
$$;

-- The checks for giving, changing or removing someone's role. Callers have
-- already required users.manage.
create function public.check_can_assign(p_actor uuid, p_user_id uuid, p_role_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_user_id = p_actor then
    raise exception 'cannot_change_own_access' using errcode = '42501',
      hint = 'Ask another Coordinator.';
  end if;

  if p_role_id is not null then
    if not exists (select 1 from public.roles where id = p_role_id) then
      raise exception 'unknown_role' using errcode = 'P0001';
    end if;
    if exists (
      select 1 from public.role_permissions rp
      where rp.role_id = p_role_id and not public.has_permission(rp.permission)
    ) then
      raise exception 'role_exceeds_yours' using errcode = '42501',
        hint = 'You can only give a role whose permissions you have yourself.';
    end if;
  end if;

  if exists (
    select 1
    from public.volunteers v
    join public.role_permissions rp on rp.role_id = v.role_id
    where v.user_id = p_user_id and v.active and not public.has_permission(rp.permission)
  ) then
    raise exception 'role_exceeds_yours' using errcode = '42501',
      hint = 'This person has permissions you do not have.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Guards
-- ---------------------------------------------------------------------------

create or replace function public.volunteers_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.user_id = auth.uid()
     and (new.role_id is distinct from old.role_id or new.active is distinct from old.active) then
    raise exception 'cannot_change_own_access' using errcode = '42501',
      hint = 'Ask another Coordinator.';
  end if;
  return new;
end;
$$;

-- Signed-in users cannot remove the last active holder of roles.manage. The SQL
-- editor and the service role (no auth.uid()) still can, to recover a project.
create function public.keep_an_administrator()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not exists (
    select 1
    from public.volunteers v
    join public.role_permissions rp on rp.role_id = v.role_id
    where v.active and rp.permission = 'roles.manage'
  ) then
    raise exception 'last_administrator' using errcode = 'P0001',
      hint = 'Someone active must keep a role with "Manage roles".';
  end if;
  return null;
end;
$$;

create trigger volunteers_keep_an_administrator
after update of role_id, active or delete on public.volunteers
for each row when (old.active)
execute function public.keep_an_administrator();

create trigger role_permissions_keep_an_administrator
after update or delete on public.role_permissions
for each row when (old.permission = 'roles.manage')
execute function public.keep_an_administrator();

-- An invited email gets its role the moment its account is created (magic link or invite).
create function public.accept_volunteer_invitation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.volunteer_invitations;
begin
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

create trigger accept_volunteer_invitation
after insert on auth.users
for each row execute function public.accept_volunteer_invitation();

-- ---------------------------------------------------------------------------
-- Role management
-- ---------------------------------------------------------------------------

-- Creates a role (p_role_id null) or updates one, replacing its permissions.
create function public.save_role(p_role_id uuid, p_name text, p_description text, p_permissions text[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid := p_role_id;
  wanted text[] := coalesce(p_permissions, '{}');
begin
  perform public.require_permission('roles.manage');

  if nullif(trim(p_name), '') is null then
    raise exception 'name_required' using errcode = 'P0001';
  end if;
  if exists (select 1 from unnest(wanted) k where k not in (select key from public.permissions)) then
    raise exception 'unknown_permission' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.roles r
    where lower(r.name) = lower(trim(p_name)) and r.id is distinct from p_role_id
  ) then
    raise exception 'role_name_taken' using errcode = 'P0001';
  end if;

  if target is null then
    insert into public.roles (name, description)
    values (trim(p_name), nullif(trim(p_description), ''))
    returning id into target;
  else
    update public.roles
    set name = trim(p_name), description = nullif(trim(p_description), '')
    where id = target;
    if not found then
      raise exception 'Role not found' using errcode = 'P0002';
    end if;
  end if;

  delete from public.role_permissions rp
  where rp.role_id = target and rp.permission <> all (wanted);

  insert into public.role_permissions (role_id, permission)
  select distinct target, k from unnest(wanted) k
  on conflict do nothing;

  return target;
end;
$$;

-- Deletes a role nobody active holds and no invitation uses. People without
-- access who last had it keep no role.
create function public.delete_role(p_role_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_permission('roles.manage');

  if exists (select 1 from public.volunteers where role_id = p_role_id and active)
     or exists (select 1 from public.volunteer_invitations where role_id = p_role_id) then
    raise exception 'role_in_use' using errcode = 'P0001',
      hint = 'Give everyone with this role, and every pending invitation, another role first.';
  end if;

  delete from public.roles where id = p_role_id;
  if not found then
    raise exception 'Role not found' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- User management
-- ---------------------------------------------------------------------------

-- Gives an existing account a role (and console access), or removes its access
-- when p_role_id is null.
create function public.set_user_access(p_user_id uuid, p_role_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.require_permission('users.manage');
  account_email text;
begin
  perform public.check_can_assign(actor, p_user_id, p_role_id);

  if p_role_id is null then
    update public.volunteers set active = false where user_id = p_user_id;
    return;
  end if;

  select u.email into account_email from auth.users u where u.id = p_user_id;
  if not found then
    raise exception 'User not found' using errcode = 'P0002';
  end if;

  insert into public.volunteers (user_id, display_name, role_id, invited_by)
  values (p_user_id, coalesce(nullif(split_part(account_email, '@', 1), ''), 'Volunteer'), p_role_id, actor)
  on conflict (user_id) do update set role_id = excluded.role_id, active = true;
end;
$$;

-- Invites someone by email. Returns true when they already had an account and
-- got the role now; false when the invitation waits for their account.
create function public.invite_volunteer(p_email text, p_role_id uuid, p_display_name text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.require_permission('users.manage');
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

  select u.id into existing from auth.users u where lower(u.email) = invitee limit 1;
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

-- Every account (Reporter accounts too), with its role if it has one. Volunteers
-- with access come first.
create function public.list_users(
  p_search text default null,
  p_staff_only boolean default false,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  user_id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  display_name text,
  role_id uuid,
  role_name text,
  active boolean,
  total bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  needle text := nullif(trim(p_search), '');
begin
  perform public.require_permission('users.manage');

  return query
  select u.id, u.email::text, u.created_at, u.last_sign_in_at,
         v.display_name, v.role_id, r.name, coalesce(v.active, false),
         count(*) over ()
  from auth.users u
  left join public.volunteers v on v.user_id = u.id
  left join public.roles r on r.id = v.role_id
  where (needle is null
         or u.email ilike '%' || needle || '%'
         or v.display_name ilike '%' || needle || '%')
    and (not p_staff_only or v.user_id is not null)
  order by coalesce(v.active, false) desc, (v.user_id is null), u.created_at desc
  limit least(greatest(p_limit, 1), 200)
  offset greatest(p_offset, 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- Volunteer operations now check a permission instead of any Volunteer role
-- ---------------------------------------------------------------------------

create or replace function public.review_approve(
  p_report_id uuid,
  p_category_id uuid,
  p_office_id uuid,
  p_note text default null
)
returns public.reports
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.require_permission('reports.review');
  r public.reports;
begin
  select * into r from public.reports where id = p_report_id for update;
  if not found then
    raise exception 'Report not found' using errcode = 'P0002';
  end if;
  if r.status <> 'pending_review' then
    raise exception 'not_pending' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.responsible_offices where id = p_office_id and active) then
    raise exception 'unknown_office' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.report_photos p
    where p.report_id = p_report_id and p.kind = 'evidence' and p.public_path is null and not p.hidden
  ) then
    raise exception 'photos_not_cleared' using errcode = 'P0001',
      hint = 'Clear, blur or hide every photo before approving.';
  end if;

  if p_category_id is distinct from r.category_id then
    if not exists (select 1 from public.categories where id = p_category_id and active) then
      raise exception 'unknown_category' using errcode = 'P0001';
    end if;
    update public.reports set category_id = p_category_id where id = p_report_id;
    perform public.log_report_event(p_report_id, 'category_changed', p_note => 'Category corrected in Review');
  end if;

  if p_office_id is distinct from r.suggested_office_id then
    perform public.log_report_event(
      p_report_id, 'office_changed',
      p_note => 'Suggested Office overridden in Review',
      p_office_id => p_office_id,
      p_previous_office_id => r.suggested_office_id
    );
  end if;

  update public.reports
  set office_id = p_office_id, reviewed_by = actor
  where id = p_report_id;

  return public.transition_report(p_report_id, 'published', p_note);
end;
$$;

create or replace function public.review_reject(p_report_id uuid, p_reason text)
returns public.reports
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.require_permission('reports.review');
  r public.reports;
begin
  if nullif(trim(p_reason), '') is null then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;

  select * into r from public.reports where id = p_report_id for update;
  if not found then
    raise exception 'Report not found' using errcode = 'P0002';
  end if;
  if r.status not in ('pending_review', 'published') then
    raise exception 'cannot_reject' using errcode = 'P0001';
  end if;

  update public.reports
  set rejection_reason = trim(p_reason), reviewed_by = coalesce(reviewed_by, actor)
  where id = p_report_id;

  return public.transition_report(p_report_id, 'rejected', p_reason);
end;
$$;

create or replace function public.set_photo_review(p_photo_id uuid, p_public_path text, p_hidden boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_permission('reports.review');
  update public.report_photos
  set public_path = case when p_hidden then null else p_public_path end,
      hidden = p_hidden
  where id = p_photo_id;
  if not found then
    raise exception 'Photo not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.add_after_photo(p_report_id uuid, p_original_path text, p_public_path text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.require_permission('reports.manage');
  photo_id uuid;
begin
  insert into public.report_photos (report_id, kind, original_path, public_path, sort_order, uploaded_by)
  values (
    p_report_id, 'after', p_original_path, p_public_path,
    100 + (select count(*) from public.report_photos where report_id = p_report_id and kind = 'after'),
    actor
  )
  returning id into photo_id;
  return photo_id;
end;
$$;

create or replace function public.resolve_report(
  p_report_id uuid,
  p_note text default null,
  p_after_original_path text default null,
  p_after_public_path text default null
)
returns public.reports
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.require_permission('reports.manage');
  r public.reports;
begin
  r := public.transition_report(p_report_id, 'resolved', p_note);

  if p_after_original_path is not null then
    insert into public.report_photos (report_id, kind, original_path, public_path, sort_order, uploaded_by)
    values (
      p_report_id, 'after', p_after_original_path, p_after_public_path,
      100 + (select count(*) from public.report_photos where report_id = p_report_id and kind = 'after'),
      actor
    );
  end if;

  return r;
end;
$$;

create or replace function public.reopen_report(p_report_id uuid, p_note text default null)
returns public.reports
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_permission('reports.manage');
  return public.transition_report(p_report_id, 'reopened', p_note);
end;
$$;

create or replace function public.mark_misroute(p_report_id uuid, p_new_office_id uuid, p_note text default null)
returns public.reports
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.reports;
begin
  perform public.require_permission('reports.manage');

  select * into r from public.reports where id = p_report_id for update;
  if not found then
    raise exception 'Report not found' using errcode = 'P0002';
  end if;
  if r.status <> 'forwarded' then
    raise exception 'not_forwarded' using errcode = 'P0001';
  end if;
  if p_new_office_id = r.office_id
     or not exists (select 1 from public.responsible_offices where id = p_new_office_id and active) then
    raise exception 'invalid_office' using errcode = 'P0001';
  end if;

  perform public.log_report_event(
    p_report_id, 'misrouted', p_note => p_note,
    p_office_id => p_new_office_id, p_previous_office_id => r.office_id
  );

  -- The new office's clock starts when its own Digest reaches it.
  update public.reports
  set office_id = p_new_office_id, first_forwarded_at = null
  where id = p_report_id;

  return public.transition_report(p_report_id, 'published', 'Misroute: returned for the next Digest');
end;
$$;

create or replace function public.create_digest(p_office_id uuid, p_barangay_id integer default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.require_permission('digests.manage');
  office public.responsible_offices;
  digest_id uuid;
  added integer;
begin
  select * into office from public.responsible_offices where id = p_office_id;
  if not found then
    raise exception 'unknown_office' using errcode = 'P0001';
  end if;
  if office.scope = 'per_barangay' and p_barangay_id is null then
    raise exception 'barangay_required' using errcode = 'P0001';
  end if;

  insert into public.digests (office_id, barangay_id, created_by)
  values (p_office_id, case when office.scope = 'per_barangay' then p_barangay_id end, actor)
  returning id into digest_id;

  insert into public.digest_reports (digest_id, report_id)
  select digest_id, r.id
  from public.reports r
  where r.office_id = p_office_id
    and r.status in ('published', 'reopened')
    and (office.scope = 'citywide' or r.barangay_id = p_barangay_id)
    and not exists (
      select 1 from public.digest_reports dr
      join public.digests d on d.id = dr.digest_id
      where dr.report_id = r.id and d.sent_at is null
    );
  get diagnostics added = row_count;

  if added = 0 then
    raise exception 'nothing_to_send' using errcode = 'P0001';
  end if;
  return digest_id;
end;
$$;

create or replace function public.remove_from_digest(p_digest_id uuid, p_report_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_permission('digests.manage');
  if exists (select 1 from public.digests where id = p_digest_id and sent_at is not null) then
    raise exception 'digest_already_sent' using errcode = 'P0001';
  end if;
  delete from public.digest_reports where digest_id = p_digest_id and report_id = p_report_id;
end;
$$;

create or replace function public.discard_digest(p_digest_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_permission('digests.manage');
  delete from public.digests where id = p_digest_id and sent_at is null;
  if not found then
    raise exception 'digest_already_sent' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.send_digest(
  p_digest_id uuid,
  p_channel public.digest_channel,
  p_channel_detail text default null,
  p_sent_at timestamptz default now()
)
returns setof uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.require_permission('digests.manage');
  d public.digests;
  rid uuid;
begin
  select * into d from public.digests where id = p_digest_id for update;
  if not found then
    raise exception 'Digest not found' using errcode = 'P0002';
  end if;
  if d.sent_at is not null then
    raise exception 'digest_already_sent' using errcode = 'P0001';
  end if;
  if p_sent_at > now() + interval '5 minutes' then
    raise exception 'sent_at_in_future' using errcode = 'P0001';
  end if;

  -- Drop Reports that changed since the draft was made (resolved, rejected, rerouted).
  delete from public.digest_reports dr
  using public.reports r
  where dr.digest_id = p_digest_id
    and dr.report_id = r.id
    and (r.status not in ('published', 'reopened') or r.office_id <> d.office_id);

  if not exists (select 1 from public.digest_reports where digest_id = p_digest_id) then
    raise exception 'nothing_to_send' using errcode = 'P0001';
  end if;

  update public.digests
  set sent_at = p_sent_at, sent_by = actor, channel = p_channel,
      channel_detail = nullif(trim(p_channel_detail), '')
  where id = p_digest_id;

  for rid in select report_id from public.digest_reports where digest_id = p_digest_id loop
    perform public.transition_report(rid, 'forwarded', 'Sent in Digest');
    return next rid;
  end loop;
end;
$$;

create or replace function public.set_digest_proof(p_digest_id uuid, p_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_permission('digests.manage');
  update public.digests set proof_photo_path = p_path where id = p_digest_id and sent_at is not null;
  if not found then
    raise exception 'digest_not_sent' using errcode = 'P0001';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------

revoke execute on function
  public.has_permission(text),
  public.require_permission(text),
  public.check_can_assign(uuid, uuid, uuid),
  public.keep_an_administrator(),
  public.accept_volunteer_invitation(),
  public.save_role(uuid, text, text, text[]),
  public.delete_role(uuid),
  public.set_user_access(uuid, uuid),
  public.invite_volunteer(text, uuid, text),
  public.list_users(text, boolean, integer, integer)
from public, anon, authenticated;

-- Policies call has_permission as the querying role.
grant execute on function public.has_permission(text) to anon, authenticated;

grant execute on function
  public.save_role(uuid, text, text, text[]),
  public.delete_role(uuid),
  public.set_user_access(uuid, uuid),
  public.invite_volunteer(text, uuid, text),
  public.list_users(text, boolean, integer, integer)
to authenticated;

grant execute on all functions in schema public to service_role;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.permissions enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.volunteer_invitations enable row level security;

-- Roles and permissions change only through save_role and delete_role.
create policy "volunteers see permissions" on public.permissions
  for select to authenticated using (public.is_volunteer());
create policy "volunteers see roles" on public.roles
  for select to authenticated using (public.is_volunteer());
create policy "volunteers see role permissions" on public.role_permissions
  for select to authenticated using (public.is_volunteer());

create policy "user managers see invitations" on public.volunteer_invitations
  for select to authenticated using (public.has_permission('users.manage'));
create policy "user managers cancel invitations" on public.volunteer_invitations
  for delete to authenticated using (public.has_permission('users.manage'));

create policy "office managers manage offices" on public.responsible_offices
  for all to authenticated
  using (public.has_permission('offices.manage')) with check (public.has_permission('offices.manage'));

create policy "category managers manage categories" on public.categories
  for all to authenticated
  using (public.has_permission('categories.manage')) with check (public.has_permission('categories.manage'));

create policy "category managers manage category questions" on public.category_questions
  for all to authenticated
  using (public.has_permission('categories.manage')) with check (public.has_permission('categories.manage'));
