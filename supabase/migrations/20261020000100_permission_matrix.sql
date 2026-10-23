-- Permissions become a matrix of area × action (View, Add, Edit, Delete, Archive,
-- Print, Export, plus Review for Reports and Send for Digests). Only actions the
-- console really has exist; there is no "Delete Reports" or "Print Categories".
--
-- Existing roles keep exactly what they could do:
--   reports.review    -> reports.view, reports.review, reports.archive (taking down was part of Review)
--   reports.manage    -> reports.view, reports.edit
--   digests.manage    -> digests.view, .add, .edit, .delete, .send, .print
--   categories.manage -> categories.view, .add, .edit, .archive (and the same for offices)
--   users.manage      -> users.view, .add, .edit, .archive
--   roles.manage      -> roles.view, .add, .edit, .delete
-- Every role also gets reports.view and digests.view, which any Volunteer had before.
-- A role that held every old permission (Coordinator) gets every new one, Export included.
--
-- "View" now decides who sees non-public data: pending and rejected Reports, their
-- original photos and history, and Digests.

-- ---------------------------------------------------------------------------
-- The matrix
-- ---------------------------------------------------------------------------

alter table public.permissions
  add column resource text,
  add column action text;

insert into public.permissions (key, resource, action, label, description, sort_order) values
  ('reports.view',      'reports',    'view',    'View Reports',       'See every Report, including ones waiting for Review or rejected, with original photos and history.', 100),
  ('reports.review',    'reports',    'review',  'Review Reports',     'Clear photos, then approve or reject new Reports.', 101),
  ('reports.edit',      'reports',    'edit',    'Edit Reports',       'Resolve, reopen and Misroute published Reports.', 102),
  ('reports.archive',   'reports',    'archive', 'Archive Reports',    'Take down a published Report.', 104),
  ('reports.export',    'reports',    'export',  'Export Reports',     'Download the Report list as CSV.', 106),
  ('digests.view',      'digests',    'view',    'View Digests',       'See Digest drafts, sent Digests and Proof of Receipt.', 200),
  ('digests.add',       'digests',    'add',     'Add Digests',        'Create a Digest draft for an office.', 201),
  ('digests.edit',      'digests',    'edit',    'Edit Digests',       'Remove Reports from a draft.', 202),
  ('digests.delete',    'digests',    'delete',  'Delete Digests',     'Discard a draft that was never sent.', 203),
  ('digests.send',      'digests',    'send',    'Send Digests',       'Log how and when a Digest went out (its Reports become Forwarded) and upload Proof of Receipt.', 204),
  ('digests.print',     'digests',    'print',   'Print Digests',      'Open and print the Digest letter.', 205),
  ('digests.export',    'digests',    'export',  'Export Digests',     'Download the Digest list as CSV.', 206),
  ('categories.view',   'categories', 'view',    'View Categories',    'Open the Categories settings, including inactive ones.', 300),
  ('categories.add',    'categories', 'add',     'Add Categories',     'Create Categories.', 301),
  ('categories.edit',   'categories', 'edit',    'Edit Categories',    'Change Categories and their questions.', 302),
  ('categories.archive','categories', 'archive', 'Archive Categories', 'Deactivate or reactivate a Category.', 304),
  ('offices.view',      'offices',    'view',    'View Responsible Offices',    'Open the Responsible Offices settings, including inactive ones.', 400),
  ('offices.add',       'offices',    'add',     'Add Responsible Offices',     'Create Responsible Offices.', 401),
  ('offices.edit',      'offices',    'edit',    'Edit Responsible Offices',    'Change an office’s names, channel and letter details.', 402),
  ('offices.archive',   'offices',    'archive', 'Archive Responsible Offices', 'Deactivate or reactivate an office.', 404),
  ('users.view',        'users',      'view',    'View users',         'See every account, its role and pending invitations.', 500),
  ('users.add',         'users',      'add',     'Add users',          'Invite people, give a role to an account without one, and cancel invitations.', 501),
  ('users.edit',        'users',      'edit',    'Edit users',         'Change someone’s role.', 502),
  ('users.archive',     'users',      'archive', 'Archive users',      'Remove someone’s access.', 504),
  ('users.export',      'users',      'export',  'Export users',       'Download the account list as CSV.', 506),
  ('roles.view',        'roles',      'view',    'View roles',         'See roles and their permissions.', 600),
  ('roles.add',         'roles',      'add',     'Add roles',          'Create roles.', 601),
  ('roles.edit',        'roles',      'edit',    'Edit roles',         'Change a role’s name and permissions. Whoever has this can give their own role every permission.', 602),
  ('roles.delete',      'roles',      'delete',  'Delete roles',       'Delete a role nobody holds.', 603)
-- reports.review keeps its key; only its wording and place in the matrix change.
on conflict (key) do update
  set resource = excluded.resource, action = excluded.action, label = excluded.label,
      description = excluded.description, sort_order = excluded.sort_order;

with old_to_new (old_key, new_key) as (
  values
    ('reports.review', 'reports.view'), ('reports.review', 'reports.review'), ('reports.review', 'reports.archive'),
    ('reports.manage', 'reports.view'), ('reports.manage', 'reports.edit'),
    ('digests.manage', 'digests.view'), ('digests.manage', 'digests.add'), ('digests.manage', 'digests.edit'),
    ('digests.manage', 'digests.delete'), ('digests.manage', 'digests.send'), ('digests.manage', 'digests.print'),
    ('categories.manage', 'categories.view'), ('categories.manage', 'categories.add'),
    ('categories.manage', 'categories.edit'), ('categories.manage', 'categories.archive'),
    ('offices.manage', 'offices.view'), ('offices.manage', 'offices.add'),
    ('offices.manage', 'offices.edit'), ('offices.manage', 'offices.archive'),
    ('users.manage', 'users.view'), ('users.manage', 'users.add'),
    ('users.manage', 'users.edit'), ('users.manage', 'users.archive'),
    ('roles.manage', 'roles.view'), ('roles.manage', 'roles.add'),
    ('roles.manage', 'roles.edit'), ('roles.manage', 'roles.delete')
)
insert into public.role_permissions (role_id, permission)
select distinct rp.role_id, m.new_key
from public.role_permissions rp
join old_to_new m on m.old_key = rp.permission
on conflict do nothing;

insert into public.role_permissions (role_id, permission)
select r.id, k
from public.roles r
cross join (values ('reports.view'), ('digests.view')) as always (k)
on conflict do nothing;

insert into public.role_permissions (role_id, permission)
select r.id, p.key
from public.roles r
cross join public.permissions p
where p.resource is not null
  and (
    select count(*) from public.role_permissions rp
    where rp.role_id = r.id and rp.permission in (
      'reports.review', 'reports.manage', 'digests.manage', 'categories.manage',
      'offices.manage', 'users.manage', 'roles.manage'
    )
  ) = 7
on conflict do nothing;

-- The lockout guard watched roles.manage; it watches roles.edit from here on.
drop trigger role_permissions_keep_an_administrator on public.role_permissions;

delete from public.permissions
where key in (
  'reports.manage', 'digests.manage', 'categories.manage', 'offices.manage', 'users.manage', 'roles.manage'
);

alter table public.permissions
  alter column resource set not null,
  alter column action set not null,
  add constraint permissions_action_check
    check (action in ('view', 'add', 'edit', 'delete', 'archive', 'print', 'export', 'review', 'send')),
  add constraint permissions_key_matches check (key = resource || '.' || action);

-- ---------------------------------------------------------------------------
-- Lockout protection: someone active must keep "Edit roles"
-- ---------------------------------------------------------------------------

create or replace function public.keep_an_administrator()
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
    where v.active and rp.permission = 'roles.edit'
  ) then
    raise exception 'last_administrator' using errcode = 'P0001',
      hint = 'Someone active must keep a role with "Edit roles".';
  end if;
  return null;
end;
$$;

create trigger role_permissions_keep_an_administrator
after update or delete on public.role_permissions
for each row when (old.permission = 'roles.edit')
execute function public.keep_an_administrator();

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------

-- Creating a role needs roles.add; changing one needs roles.edit.
create or replace function public.save_role(p_role_id uuid, p_name text, p_description text, p_permissions text[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid := p_role_id;
  wanted text[] := coalesce(p_permissions, '{}');
begin
  perform public.require_permission(case when p_role_id is null then 'roles.add' else 'roles.edit' end);

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

create or replace function public.delete_role(p_role_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_permission('roles.delete');

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
-- Users
-- ---------------------------------------------------------------------------

-- Removing access needs users.archive, changing an active Volunteer's role needs
-- users.edit, and giving a role to an account without access needs users.add.
create or replace function public.set_user_access(p_user_id uuid, p_role_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid;
  account_email text;
begin
  if p_role_id is null then
    actor := public.require_permission('users.archive');
  elsif exists (select 1 from public.volunteers where user_id = p_user_id and active) then
    actor := public.require_permission('users.edit');
  else
    actor := public.require_permission('users.add');
  end if;
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

create or replace function public.list_users(
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
  perform public.require_permission('users.view');

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
  limit least(greatest(p_limit, 1), 1000)
  offset greatest(p_offset, 0);
end;
$$;

drop policy "user managers see invitations" on public.volunteer_invitations;
drop policy "user managers cancel invitations" on public.volunteer_invitations;

create policy "user viewers see invitations" on public.volunteer_invitations
  for select to authenticated using (public.has_permission('users.view'));
create policy "user adders cancel invitations" on public.volunteer_invitations
  for delete to authenticated using (public.has_permission('users.add'));

-- ---------------------------------------------------------------------------
-- Categories and Responsible Offices: Add, Edit and Archive are separate
-- ---------------------------------------------------------------------------

drop policy "office managers manage offices" on public.responsible_offices;
drop policy "category managers manage categories" on public.categories;
drop policy "category managers manage category questions" on public.category_questions;

create policy "office adders add offices" on public.responsible_offices
  for insert to authenticated with check (public.has_permission('offices.add'));
create policy "office editors and archivers update offices" on public.responsible_offices
  for update to authenticated
  using (public.has_permission('offices.edit') or public.has_permission('offices.archive'))
  with check (public.has_permission('offices.edit') or public.has_permission('offices.archive'));

create policy "category adders add categories" on public.categories
  for insert to authenticated with check (public.has_permission('categories.add'));
create policy "category editors and archivers update categories" on public.categories
  for update to authenticated
  using (public.has_permission('categories.edit') or public.has_permission('categories.archive'))
  with check (public.has_permission('categories.edit') or public.has_permission('categories.archive'));

-- Questions are part of a Category's content.
create policy "category editors manage questions" on public.category_questions
  for all to authenticated
  using (public.has_permission('categories.edit')) with check (public.has_permission('categories.edit'));

-- Row-level security can't tell which columns an update touches, so this trigger
-- does: switching `active` needs <area>.archive, anything else needs <area>.edit.
-- Updates without a signed-in user (SQL editor, migrations) are not checked.
create function public.check_edit_or_archive()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  area text := tg_argv[0];
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.active is distinct from old.active then
    perform public.require_permission(area || '.archive');
  end if;
  if (to_jsonb(new) - 'active' - 'updated_at') is distinct from (to_jsonb(old) - 'active' - 'updated_at') then
    perform public.require_permission(area || '.edit');
  end if;
  return new;
end;
$$;

create trigger categories_check_edit_or_archive
before update on public.categories
for each row execute function public.check_edit_or_archive('categories');

create trigger responsible_offices_check_edit_or_archive
before update on public.responsible_offices
for each row execute function public.check_edit_or_archive('offices');

-- ---------------------------------------------------------------------------
-- Reports
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

-- Rejecting a Report in Review needs reports.review; taking down a published one needs reports.archive.
create or replace function public.review_reject(p_report_id uuid, p_reason text)
returns public.reports
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid;
  r public.reports;
begin
  select * into r from public.reports where id = p_report_id for update;
  if not found then
    perform public.require_permission('reports.review');
    raise exception 'Report not found' using errcode = 'P0002';
  end if;
  actor := public.require_permission(case when r.status = 'published' then 'reports.archive' else 'reports.review' end);

  if nullif(trim(p_reason), '') is null then
    raise exception 'reason_required' using errcode = 'P0001';
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

create or replace function public.add_after_photo(p_report_id uuid, p_original_path text, p_public_path text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.require_permission('reports.edit');
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
  actor uuid := public.require_permission('reports.edit');
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
  perform public.require_permission('reports.edit');
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
  perform public.require_permission('reports.edit');

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

drop policy "volunteers see all reports" on public.reports;
create policy "report viewers see all reports" on public.reports
  for select to authenticated using (public.has_permission('reports.view'));

drop policy "answers follow report visibility" on public.report_answers;
create policy "answers follow report visibility" on public.report_answers
  for select using (
    public.has_permission('reports.view')
    or exists (select 1 from public.reports r where r.id = report_id and public.is_public_status(r.status))
  );

drop policy "cleared photos of public reports are visible" on public.report_photos;
create policy "cleared photos of public reports are visible" on public.report_photos
  for select using (
    public.has_permission('reports.view')
    or (
      public_path is not null and not hidden
      and exists (select 1 from public.reports r where r.id = report_id and public.is_public_status(r.status))
    )
  );

drop policy "volunteers see report history" on public.report_events;
create policy "report viewers see report history" on public.report_events
  for select to authenticated using (public.has_permission('reports.view'));

-- ---------------------------------------------------------------------------
-- Digests
-- ---------------------------------------------------------------------------

create or replace function public.create_digest(p_office_id uuid, p_barangay_id integer default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.require_permission('digests.add');
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
  perform public.require_permission('digests.edit');
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
  perform public.require_permission('digests.delete');
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
  actor uuid := public.require_permission('digests.send');
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
  perform public.require_permission('digests.send');
  update public.digests set proof_photo_path = p_path where id = p_digest_id and sent_at is not null;
  if not found then
    raise exception 'digest_not_sent' using errcode = 'P0001';
  end if;
end;
$$;

drop policy "volunteers see digests" on public.digests;
drop policy "volunteers see digest contents" on public.digest_reports;
create policy "digest viewers see digests" on public.digests
  for select to authenticated using (public.has_permission('digests.view'));
create policy "digest viewers see digest contents" on public.digest_reports
  for select to authenticated using (public.has_permission('digests.view'));

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------

drop policy "volunteers read photos" on storage.objects;
drop policy "volunteers upload photos" on storage.objects;
drop policy "volunteers replace public photos" on storage.objects;

create policy "report viewers and digest viewers read files" on storage.objects
  for select to authenticated
  using (
    (bucket_id in ('report-originals', 'report-public') and public.has_permission('reports.view'))
    or (bucket_id = 'digest-proofs' and public.has_permission('digests.view'))
  );

-- Reviewers upload blurred copies; editors upload "after" photos; senders upload Proof of Receipt.
create policy "reviewers, editors and senders upload files" on storage.objects
  for insert to authenticated
  with check (
    (bucket_id in ('report-originals', 'report-public')
      and (public.has_permission('reports.review') or public.has_permission('reports.edit')))
    or (bucket_id = 'digest-proofs' and public.has_permission('digests.send'))
  );

create policy "reviewers replace public photos" on storage.objects
  for update to authenticated
  using (bucket_id = 'report-public' and public.has_permission('reports.review'))
  with check (bucket_id = 'report-public' and public.has_permission('reports.review'));

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------

revoke execute on function public.check_edit_or_archive() from public, anon, authenticated;
grant execute on function public.check_edit_or_archive() to service_role;
