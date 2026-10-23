-- Hardening after the v1 audit:
--   * Me Too is rate-limited per IP as well as counted once per device.
--   * Review refuses to publish photos nobody cleared, and to move a Report into an inactive Category.
--   * Resolving and adding the "after" photo happen in one call, so a failed resolve leaves no photo behind.
--   * Nobody can change their own Volunteer role or access.

-- ---------------------------------------------------------------------------
-- Me Too
-- ---------------------------------------------------------------------------

alter table public.me_toos add column ip_hash text;
create index me_toos_ip_idx on public.me_toos (ip_hash, created_at) where ip_hash is not null;

drop function public.add_me_too(uuid, text, uuid);

-- The device cookie stops repeat taps; the IP limit slows down anyone clearing it to vote again.
-- The limit is generous because mobile carriers put many residents behind one IP.
create function public.add_me_too(
  p_report_id uuid,
  p_device_hash text,
  p_user_id uuid default null,
  p_ip_hash text default null,
  p_max_per_hour integer default 30
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.report_status;
  total integer;
begin
  select status, me_too_count into s, total from public.reports where id = p_report_id;
  if s is null or s not in ('published', 'forwarded', 'reopened') then
    raise exception 'not_open' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.me_toos where report_id = p_report_id and device_hash = p_device_hash) then
    return total;
  end if;

  if p_ip_hash is not null and (
    select count(*) from public.me_toos m
    where m.ip_hash = p_ip_hash and m.created_at > now() - interval '1 hour'
  ) >= p_max_per_hour then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into public.me_toos (report_id, device_hash, user_id, ip_hash)
  values (p_report_id, p_device_hash, p_user_id, p_ip_hash)
  on conflict do nothing;

  select me_too_count into total from public.reports where id = p_report_id;
  return total;
end;
$$;

revoke execute on function public.add_me_too(uuid, text, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.add_me_too(uuid, text, uuid, text, integer) to service_role;

-- Same retention as before, plus Me Too IP hashes after 30 days.
create or replace function public.purge_expired_personal_data()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.report_followers f
  using public.reports r
  where f.report_id = r.id
    and (
      (r.status = 'resolved' and r.resolved_at < now() - interval '90 days')
      or (r.status = 'rejected' and coalesce(r.reviewed_at, r.updated_at) < now() - interval '30 days')
    );

  update public.report_secrets
  set ip_hash = null, device_hash = null
  where created_at < now() - interval '30 days'
    and (ip_hash is not null or device_hash is not null);

  update public.me_toos
  set ip_hash = null
  where created_at < now() - interval '30 days'
    and ip_hash is not null;
$$;

-- ---------------------------------------------------------------------------
-- Review
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
  actor uuid := public.require_volunteer();
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

-- ---------------------------------------------------------------------------
-- Resolve with an "after" photo
-- ---------------------------------------------------------------------------

drop function public.resolve_report(uuid, text);

create function public.resolve_report(
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
  actor uuid := public.require_volunteer();
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

revoke execute on function public.resolve_report(uuid, text, text, text) from public, anon;
grant execute on function public.resolve_report(uuid, text, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Volunteers cannot change their own role or access
-- ---------------------------------------------------------------------------

create function public.volunteers_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.user_id = auth.uid()
     and (new.role is distinct from old.role or new.active is distinct from old.active) then
    raise exception 'cannot_change_own_access' using errcode = '42501',
      hint = 'Ask another Coordinator.';
  end if;
  return new;
end;
$$;

create trigger volunteers_before_update
before update on public.volunteers
for each row execute function public.volunteers_before_update();

revoke execute on function public.volunteers_before_update() from public, anon, authenticated;
