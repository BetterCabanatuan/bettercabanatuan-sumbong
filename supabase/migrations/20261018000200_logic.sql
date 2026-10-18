-- Status machine, Volunteer/Reporter operations, and row-level security.
--
-- Reports are never updated directly by clients. Volunteers act through the
-- SECURITY DEFINER functions below (each checks the caller's role and logs a
-- report_event). Reporter-facing operations (submit, Me Too, reopen) are only
-- executable by the service role, so the Worker can enforce Turnstile and rate
-- limits before calling them.

-- ---------------------------------------------------------------------------
-- Role helpers
-- ---------------------------------------------------------------------------

create function public.is_volunteer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.volunteers v where v.user_id = auth.uid() and v.active
  );
$$;

create function public.is_coordinator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.volunteers v
    where v.user_id = auth.uid() and v.active and v.role = 'coordinator'
  );
$$;

create function public.require_volunteer()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_volunteer() then
    raise exception 'Volunteer access required' using errcode = '42501';
  end if;
  return auth.uid();
end;
$$;

create function public.is_public_status(s public.report_status)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select s in ('published', 'forwarded', 'resolved', 'reopened');
$$;

-- ---------------------------------------------------------------------------
-- Status machine
-- ---------------------------------------------------------------------------

create function public.reports_before_update()
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
      'published>rejected'     -- taken down after publication
    ]) then
      raise exception 'Invalid Report status transition: %', transition using errcode = 'P0001';
    end if;

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

create trigger reports_before_update
before update on public.reports
for each row execute function public.reports_before_update();

create function public.log_report_event(
  p_report_id uuid,
  p_kind public.report_event_kind,
  p_from public.report_status default null,
  p_to public.report_status default null,
  p_note text default null,
  p_office_id uuid default null,
  p_previous_office_id uuid default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.report_events
    (report_id, kind, from_status, to_status, note, office_id, previous_office_id, actor_id)
  values
    (p_report_id, p_kind, p_from, p_to, nullif(trim(p_note), ''), p_office_id, p_previous_office_id, auth.uid());
$$;

-- Internal: change status and log it. Callers have already authorised.
create function public.transition_report(
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

  update public.reports set status = p_to where id = p_report_id returning * into r;
  perform public.log_report_event(p_report_id, 'status_changed', previous, p_to, p_note, r.office_id);
  return r;
end;
$$;

-- ---------------------------------------------------------------------------
-- Me Too counter
-- ---------------------------------------------------------------------------

create function public.me_toos_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.reports set me_too_count = me_too_count + 1 where id = new.report_id;
  elsif tg_op = 'DELETE' then
    update public.reports set me_too_count = greatest(me_too_count - 1, 0) where id = old.report_id;
  end if;
  return null;
end;
$$;

create trigger me_toos_count
after insert or delete on public.me_toos
for each row execute function public.me_toos_count();

-- ---------------------------------------------------------------------------
-- Location helpers
-- ---------------------------------------------------------------------------

-- Returns the barangay for a point, or raises if the point is outside Cabanatuan City.
-- The reference boundary (OCHA/HDX COD-AB) can be off by up to ~460 m at the edges,
-- so points within 500 m of the city are accepted and given the nearest barangay.
-- Until boundary data is loaded, every point is accepted.
create function public.locate_point(p_lng double precision, p_lat double precision)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  edge_tolerance_m constant double precision := 500;
  pt extensions.geometry := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326);
  barangay integer;
begin
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Invalid coordinates' using errcode = '22023';
  end if;

  if exists (select 1 from public.city_boundary)
     and not exists (
       select 1 from public.city_boundary c
       where extensions.st_dwithin(c.geom::extensions.geography, pt::extensions.geography, edge_tolerance_m)
     ) then
    raise exception 'outside_city' using errcode = 'P0001',
      hint = 'The location is outside Cabanatuan City.';
  end if;

  select b.id into barangay
  from public.barangays b
  where extensions.st_intersects(b.geom, pt)
  order by b.id
  limit 1;

  if barangay is null then
    select b.id into barangay
    from public.barangays b
    where extensions.st_dwithin(b.geom::extensions.geography, pt::extensions.geography, edge_tolerance_m)
    order by extensions.st_distance(b.geom::extensions.geography, pt::extensions.geography)
    limit 1;
  end if;

  return barangay;
end;
$$;

-- Public, open Reports near a point (for the "has someone reported this?" check).
create function public.nearby_reports(
  p_lng double precision,
  p_lat double precision,
  p_radius_m double precision default 100,
  p_category_id uuid default null
)
returns table (
  id uuid,
  public_code text,
  category_id uuid,
  status public.report_status,
  distance_m double precision,
  me_too_count integer,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.public_code, r.category_id, r.status,
         extensions.st_distance(
           r.location::extensions.geography,
           extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography
         ) as distance_m,
         r.me_too_count, r.created_at
  from public.reports r
  where r.status in ('published', 'forwarded', 'reopened')
    and (p_category_id is null or r.category_id = p_category_id)
    and extensions.st_dwithin(
      r.location::extensions.geography,
      extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography,
      least(greatest(p_radius_m, 10), 500)
    )
  order by distance_m
  limit 10;
$$;

-- ---------------------------------------------------------------------------
-- Reporter operations (service role only)
-- ---------------------------------------------------------------------------

create function public.submit_report(
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
  p_max_per_hour integer default 5
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

  insert into public.reports (id, category_id, location, barangay_id, landmark, description, suggested_office_id)
  values (
    p_id,
    p_category_id,
    extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326),
    barangay,
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

create function public.add_me_too(p_report_id uuid, p_device_hash text, p_user_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.report_status;
  total integer;
begin
  select status into s from public.reports where id = p_report_id;
  if s is null or s not in ('published', 'forwarded', 'reopened') then
    raise exception 'not_open' using errcode = 'P0001';
  end if;

  insert into public.me_toos (report_id, device_hash, user_id)
  values (p_report_id, p_device_hash, p_user_id)
  on conflict do nothing;

  select me_too_count into total from public.reports where id = p_report_id;
  return total;
end;
$$;

-- A Follower says a Resolved Report is not actually fixed (within 30 days).
create function public.reopen_by_follower(p_report_id uuid, p_note text default null)
returns public.reports
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.reports;
begin
  select * into r from public.reports where id = p_report_id for update;
  if not found then
    raise exception 'Report not found' using errcode = 'P0002';
  end if;
  if r.status <> 'resolved' then
    raise exception 'not_resolved' using errcode = 'P0001';
  end if;
  if now() > r.resolved_at + interval '30 days' then
    raise exception 'reopen_window_closed' using errcode = 'P0001';
  end if;
  return public.transition_report(p_report_id, 'reopened', coalesce(p_note, 'Reopened by Follower'));
end;
$$;

-- Data retention: drop Follower contact details 90 days after final Resolved,
-- and rate-limit hashes after 30 days.
create function public.purge_expired_personal_data()
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
$$;

-- ---------------------------------------------------------------------------
-- Volunteer operations
-- ---------------------------------------------------------------------------

create function public.review_approve(
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

  if p_category_id is distinct from r.category_id then
    if not exists (select 1 from public.categories where id = p_category_id) then
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

create function public.review_reject(p_report_id uuid, p_reason text)
returns public.reports
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.require_volunteer();
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

-- Volunteers record cleared/blurred photo copies before approving.
create function public.set_photo_review(p_photo_id uuid, p_public_path text, p_hidden boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_volunteer();
  update public.report_photos
  set public_path = case when p_hidden then null else p_public_path end,
      hidden = p_hidden
  where id = p_photo_id;
  if not found then
    raise exception 'Photo not found' using errcode = 'P0002';
  end if;
end;
$$;

create function public.add_after_photo(p_report_id uuid, p_original_path text, p_public_path text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.require_volunteer();
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

create function public.resolve_report(p_report_id uuid, p_note text default null)
returns public.reports
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_volunteer();
  return public.transition_report(p_report_id, 'resolved', p_note);
end;
$$;

create function public.reopen_report(p_report_id uuid, p_note text default null)
returns public.reports
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_volunteer();
  return public.transition_report(p_report_id, 'reopened', p_note);
end;
$$;

-- The receiving office says a Forwarded Report is not theirs.
create function public.mark_misroute(p_report_id uuid, p_new_office_id uuid, p_note text default null)
returns public.reports
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.reports;
begin
  perform public.require_volunteer();

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

-- Builds a draft Digest with every Report waiting for this office (and barangay,
-- for per-barangay offices) that is not already in another unsent Digest.
create function public.create_digest(p_office_id uuid, p_barangay_id integer default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.require_volunteer();
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

create function public.remove_from_digest(p_digest_id uuid, p_report_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_volunteer();
  if exists (select 1 from public.digests where id = p_digest_id and sent_at is not null) then
    raise exception 'digest_already_sent' using errcode = 'P0001';
  end if;
  delete from public.digest_reports where digest_id = p_digest_id and report_id = p_report_id;
end;
$$;

create function public.discard_digest(p_digest_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_volunteer();
  delete from public.digests where id = p_digest_id and sent_at is null;
  if not found then
    raise exception 'digest_already_sent' using errcode = 'P0001';
  end if;
end;
$$;

-- Logs how and when a Digest went out; its Reports become Forwarded.
-- Returns the ids of Reports whose status changed, for notifications.
create function public.send_digest(
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
  actor uuid := public.require_volunteer();
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

create function public.set_digest_proof(p_digest_id uuid, p_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_volunteer();
  update public.digests set proof_photo_path = p_path where id = p_digest_id and sent_at is not null;
  if not found then
    raise exception 'digest_not_sent' using errcode = 'P0001';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------

-- Supabase grants EXECUTE on new public functions to anon and authenticated;
-- lock everything down and re-grant deliberately.
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.is_volunteer(),
  public.is_coordinator(),
  public.is_public_status(public.report_status),
  public.nearby_reports(double precision, double precision, double precision, uuid)
to anon, authenticated;

grant execute on function
  public.review_approve(uuid, uuid, uuid, text),
  public.review_reject(uuid, text),
  public.set_photo_review(uuid, text, boolean),
  public.add_after_photo(uuid, text, text),
  public.resolve_report(uuid, text),
  public.reopen_report(uuid, text),
  public.mark_misroute(uuid, uuid, text),
  public.create_digest(uuid, integer),
  public.remove_from_digest(uuid, uuid),
  public.discard_digest(uuid),
  public.send_digest(uuid, public.digest_channel, text, timestamptz),
  public.set_digest_proof(uuid, text)
to authenticated;

grant execute on all functions in schema public to service_role;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.city_boundary enable row level security;
alter table public.barangays enable row level security;
alter table public.responsible_offices enable row level security;
alter table public.categories enable row level security;
alter table public.category_questions enable row level security;
alter table public.volunteers enable row level security;
alter table public.reports enable row level security;
alter table public.report_secrets enable row level security;
alter table public.report_followers enable row level security;
alter table public.report_answers enable row level security;
alter table public.report_photos enable row level security;
alter table public.me_toos enable row level security;
alter table public.report_events enable row level security;
alter table public.digests enable row level security;
alter table public.digest_reports enable row level security;

-- Reference data: readable by everyone, managed by Coordinators.
create policy "city boundary is public" on public.city_boundary for select using (true);
create policy "barangays are public" on public.barangays for select using (true);

create policy "offices are public" on public.responsible_offices for select using (true);
create policy "coordinators manage offices" on public.responsible_offices
  for all to authenticated using (public.is_coordinator()) with check (public.is_coordinator());

create policy "categories are public" on public.categories for select using (true);
create policy "coordinators manage categories" on public.categories
  for all to authenticated using (public.is_coordinator()) with check (public.is_coordinator());

create policy "category questions are public" on public.category_questions for select using (true);
create policy "coordinators manage category questions" on public.category_questions
  for all to authenticated using (public.is_coordinator()) with check (public.is_coordinator());

create policy "volunteers see the roster" on public.volunteers
  for select to authenticated using (public.is_volunteer() or user_id = auth.uid());
create policy "coordinators update volunteers" on public.volunteers
  for update to authenticated using (public.is_coordinator()) with check (public.is_coordinator());

-- Reports: public once Reviewed; Volunteers see everything; account holders see their own.
create policy "public reports are visible" on public.reports
  for select using (public.is_public_status(status));
create policy "volunteers see all reports" on public.reports
  for select to authenticated using (public.is_volunteer());
create policy "followers see their reports" on public.reports
  for select to authenticated using (
    exists (select 1 from public.report_followers f where f.report_id = reports.id and f.user_id = auth.uid())
  );

create policy "followers see their own follow" on public.report_followers
  for select to authenticated using (user_id = auth.uid());

create policy "answers follow report visibility" on public.report_answers
  for select using (
    public.is_volunteer()
    or exists (select 1 from public.reports r where r.id = report_id and public.is_public_status(r.status))
  );

create policy "cleared photos of public reports are visible" on public.report_photos
  for select using (
    public.is_volunteer()
    or (
      public_path is not null and not hidden
      and exists (select 1 from public.reports r where r.id = report_id and public.is_public_status(r.status))
    )
  );

create policy "volunteers see report history" on public.report_events
  for select to authenticated using (public.is_volunteer());

create policy "volunteers see digests" on public.digests
  for select to authenticated using (public.is_volunteer());
create policy "volunteers see digest contents" on public.digest_reports
  for select to authenticated using (public.is_volunteer());

-- report_secrets and me_toos have no policies: service role only.

-- ---------------------------------------------------------------------------
-- Read model
-- ---------------------------------------------------------------------------

-- Reports with the location flattened to lat/lng. security_invoker keeps the
-- reports table's row-level security in force for whoever queries the view.
create view public.reports_view with (security_invoker = true) as
select
  r.id, r.public_code, r.category_id,
  extensions.st_y(r.location) as lat,
  extensions.st_x(r.location) as lng,
  r.barangay_id, r.landmark, r.description, r.status,
  r.suggested_office_id, r.office_id, r.rejection_reason, r.me_too_count,
  r.created_at, r.updated_at, r.reviewed_at, r.published_at,
  r.first_forwarded_at, r.resolved_at, r.reopened_at
from public.reports r;

grant select on public.reports_view to anon, authenticated, service_role;
