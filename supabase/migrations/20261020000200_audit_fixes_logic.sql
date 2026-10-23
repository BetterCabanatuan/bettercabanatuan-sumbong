-- Fixes from the second audit:
--   * Moving a Report to the status it already has is refused (no duplicate events or emails).
--   * Any public Report can be taken down, not only Published ones; its public photo paths are cleared.
--   * "Last activity" is the latest status change, so a Misroute no longer moves it backwards.
--   * A backdated Digest starts its Reports' Forwarded clock at the logged send time.
--   * Volunteers reopen only within 30 days of Resolved, like Followers.
--   * set_photo_review returns the previous public path so the app can delete the old file.
--   * The per-IP and per-device rate limits take a lock, so parallel requests can't all slip under them.

-- ---------------------------------------------------------------------------
-- Status machine
-- ---------------------------------------------------------------------------

alter table public.reports add column status_changed_at timestamptz;

update public.reports r
set status_changed_at = coalesce(
  (select max(e.created_at) from public.report_events e
   where e.report_id = r.id and e.kind in ('submitted', 'status_changed')),
  greatest(r.created_at, r.reviewed_at, r.published_at, r.first_forwarded_at, r.resolved_at, r.reopened_at)
);

create or replace function public.reports_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  transition text;
begin
  new.updated_at := now();

  if new.status is distinct from old.status then
    transition := old.status::text || '>' || new.status::text;
    if not transition = any (array[
      'pending_review>published',
      'pending_review>rejected',
      'published>forwarded',
      'reopened>forwarded',
      'published>resolved',
      'reopened>resolved',
      'forwarded>resolved',
      'forwarded>published',   -- Misroute
      'resolved>reopened',
      'published>rejected',    -- taken down after publication
      'forwarded>rejected',
      'resolved>rejected',
      'reopened>rejected'
    ]) then
      raise exception 'Invalid Report status transition: %', transition using errcode = 'P0001';
    end if;

    new.status_changed_at := now();

    if old.status = 'pending_review' then
      new.reviewed_at := now();
    end if;

    case new.status
      when 'published' then
        new.published_at := coalesce(old.published_at, now());
      when 'forwarded' then
        new.first_forwarded_at := coalesce(old.first_forwarded_at, now());
      when 'resolved' then
        new.resolved_at := now();
      when 'reopened' then
        new.reopened_at := now();
      else
        null;
    end case;
  end if;

  if public.is_public_status(new.status) and new.office_id is null then
    raise exception 'A public Report needs a Responsible Office' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create or replace function public.transition_report(
  p_report_id uuid,
  p_to public.report_status,
  p_note text default null
)
returns public.reports
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.reports;
  previous public.report_status;
begin
  select * into r from public.reports where id = p_report_id for update;
  if not found then
    raise exception 'Report not found' using errcode = 'P0002';
  end if;
  previous := r.status;
  if previous = p_to then
    raise exception 'no_status_change' using errcode = 'P0001',
      hint = 'The Report already has this status.';
  end if;

  update public.reports set status = p_to where id = p_report_id returning * into r;
  perform public.log_report_event(p_report_id, 'status_changed', previous, p_to, p_note, r.office_id);
  return r;
end;
$$;

-- Same columns as before; last_activity_at now comes from the latest status change.
create or replace view public.reports_view with (security_invoker = true) as
select
  r.id, r.public_code, r.category_id,
  extensions.st_y(r.location) as lat,
  extensions.st_x(r.location) as lng,
  r.barangay_id, r.title, r.landmark, r.description, r.status,
  r.suggested_office_id, r.office_id, r.rejection_reason, r.me_too_count,
  r.created_at, r.updated_at, r.reviewed_at, r.published_at,
  r.first_forwarded_at, r.resolved_at, r.reopened_at,
  coalesce(r.status_changed_at, r.created_at) as last_activity_at
from public.reports r;

-- ---------------------------------------------------------------------------
-- Take-down and photos
-- ---------------------------------------------------------------------------

-- Rejecting a Report in Review needs reports.review; taking down a public one needs reports.archive.
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
  actor := public.require_permission(
    case when r.status = 'pending_review' then 'reports.review' else 'reports.archive' end
  );

  if nullif(trim(p_reason), '') is null then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;
  if r.status = 'rejected' then
    raise exception 'cannot_reject' using errcode = 'P0001';
  end if;

  update public.reports
  set rejection_reason = trim(p_reason), reviewed_by = coalesce(reviewed_by, actor)
  where id = p_report_id;

  -- The app deletes the public files; nothing should point at them afterwards.
  update public.report_photos set public_path = null where report_id = p_report_id;

  return public.transition_report(p_report_id, 'rejected', p_reason);
end;
$$;

update public.permissions
set description = 'Take down a public Report (Published, Forwarded, Resolved or Reopened).'
where key = 'reports.archive';

drop function public.set_photo_review(uuid, text, boolean);

-- Returns the public path the photo had before, so the app can delete that file
-- when it is hidden or replaced by a new redacted copy.
create function public.set_photo_review(p_photo_id uuid, p_public_path text, p_hidden boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous text;
begin
  perform public.require_permission('reports.review');
  select public_path into previous from public.report_photos where id = p_photo_id for update;
  if not found then
    raise exception 'Photo not found' using errcode = 'P0002';
  end if;
  update public.report_photos
  set public_path = case when p_hidden then null else p_public_path end,
      hidden = p_hidden
  where id = p_photo_id;
  return previous;
end;
$$;

revoke execute on function public.set_photo_review(uuid, text, boolean) from public, anon;
grant execute on function public.set_photo_review(uuid, text, boolean) to authenticated, service_role;

create policy "reviewers and archivers delete public photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'report-public'
    and (public.has_permission('reports.review') or public.has_permission('reports.archive'))
  );

-- ---------------------------------------------------------------------------
-- Reopen window
-- ---------------------------------------------------------------------------

create or replace function public.reopen_report(p_report_id uuid, p_note text default null)
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
  if found and r.status = 'resolved' and now() > r.resolved_at + interval '30 days' then
    raise exception 'reopen_window_closed' using errcode = 'P0001';
  end if;
  return public.transition_report(p_report_id, 'reopened', p_note);
end;
$$;

-- ---------------------------------------------------------------------------
-- Digests
-- ---------------------------------------------------------------------------

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
  -- The letter is printed from the draft, so it can't have gone out before the draft's (Manila) day.
  if p_sent_at < (date_trunc('day', d.created_at at time zone 'Asia/Manila') at time zone 'Asia/Manila') then
    raise exception 'sent_before_draft' using errcode = 'P0001';
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
    -- The trigger stamped now() if this is the office's first Digest; use when it really went out.
    update public.reports set first_forwarded_at = p_sent_at
    where id = rid and first_forwarded_at = now();
    return next rid;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rate limits under concurrency
-- ---------------------------------------------------------------------------

create or replace function public.submit_report(
  p_id uuid,
  p_category_id uuid,
  p_lng double precision,
  p_lat double precision,
  p_landmark text,
  p_description text,
  p_answers jsonb,        -- [{"question_id": "...", "value": "..."}]
  p_photo_paths text[],   -- object paths already uploaded to report-originals
  p_tracking_token_hash text,
  p_ip_hash text,
  p_device_hash text,
  p_email text default null,
  p_user_id uuid default null,
  p_locale text default 'fil',
  p_max_per_hour integer default 5,
  p_title text default null
)
returns public.reports
language plpgsql
security definer
set search_path = ''
as $$
declare
  cat public.categories;
  barangay integer;
  r public.reports;
  q public.category_questions;
  answer text;
  i integer;
begin
  select * into cat from public.categories where id = p_category_id and active;
  if not found then
    raise exception 'unknown_category' using errcode = 'P0001';
  end if;

  if coalesce(array_length(p_photo_paths, 1), 0) not between 1 and 3 then
    raise exception 'photos_required' using errcode = 'P0001',
      hint = 'A Report needs 1 to 3 photos.';
  end if;

  -- Serialise submissions from one IP / device so concurrent requests count each other.
  -- Always IP first, then device, so two requests can't wait on each other.
  if p_ip_hash is not null then
    perform pg_advisory_xact_lock(hashtextextended('submit_report:ip:' || p_ip_hash, 0));
  end if;
  if p_device_hash is not null then
    perform pg_advisory_xact_lock(hashtextextended('submit_report:device:' || p_device_hash, 0));
  end if;

  if (p_ip_hash is not null and (
        select count(*) from public.report_secrets s
        where s.ip_hash = p_ip_hash and s.created_at > now() - interval '1 hour'
      ) >= p_max_per_hour)
     or (p_device_hash is not null and (
        select count(*) from public.report_secrets s
        where s.device_hash = p_device_hash and s.created_at > now() - interval '1 hour'
      ) >= p_max_per_hour) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  barangay := public.locate_point(p_lng, p_lat);

  insert into public.reports (id, category_id, location, barangay_id, title, landmark, description, suggested_office_id)
  values (
    p_id,
    p_category_id,
    extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326),
    barangay,
    nullif(trim(p_title), ''),
    nullif(trim(p_landmark), ''),
    nullif(trim(p_description), ''),
    cat.default_office_id
  )
  returning * into r;

  insert into public.report_secrets (report_id, tracking_token_hash, ip_hash, device_hash)
  values (r.id, p_tracking_token_hash, p_ip_hash, p_device_hash);

  for q in
    select * from public.category_questions
    where category_id = p_category_id and active
    order by sort_order, created_at
  loop
    select nullif(trim(a ->> 'value'), '') into answer
    from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) a
    where a ->> 'question_id' = q.id::text
    limit 1;

    if answer is null then
      if q.required then
        raise exception 'missing_answer' using errcode = 'P0001', detail = q.id::text;
      end if;
      continue;
    end if;

    if q.kind = 'yes_no' and answer not in ('yes', 'no') then
      raise exception 'invalid_answer' using errcode = 'P0001', detail = q.id::text;
    end if;
    if q.kind = 'choice' and not exists (
      select 1 from jsonb_array_elements(q.choices) c where c ->> 'value' = answer
    ) then
      raise exception 'invalid_answer' using errcode = 'P0001', detail = q.id::text;
    end if;

    insert into public.report_answers (report_id, question_id, prompt_en, prompt_fil, value, sort_order)
    values (r.id, q.id, q.prompt_en, q.prompt_fil, left(answer, 500), q.sort_order);
  end loop;

  for i in 1..array_length(p_photo_paths, 1) loop
    insert into public.report_photos (report_id, kind, original_path, sort_order)
    values (r.id, 'evidence', p_photo_paths[i], i);
  end loop;

  if p_email is not null or p_user_id is not null then
    insert into public.report_followers (report_id, user_id, email, locale)
    values (r.id, p_user_id, nullif(lower(trim(p_email)), ''), coalesce(p_locale, 'fil'));
  end if;

  perform public.log_report_event(r.id, 'submitted', null, 'pending_review');
  return r;
end;
$$;

create or replace function public.add_me_too(
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

  if p_ip_hash is not null then
    perform pg_advisory_xact_lock(hashtextextended('add_me_too:ip:' || p_ip_hash, 0));
    if (
      select count(*) from public.me_toos m
      where m.ip_hash = p_ip_hash and m.created_at > now() - interval '1 hour'
    ) >= p_max_per_hour then
      raise exception 'rate_limited' using errcode = 'P0001';
    end if;
  end if;

  insert into public.me_toos (report_id, device_hash, user_id, ip_hash)
  values (p_report_id, p_device_hash, p_user_id, p_ip_hash)
  on conflict do nothing;

  select me_too_count into total from public.reports where id = p_report_id;
  return total;
end;
$$;
