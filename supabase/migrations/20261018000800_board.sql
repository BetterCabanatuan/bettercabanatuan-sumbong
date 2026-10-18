-- Feedback board: a short Report title, and a "last activity" time to sort by.

alter table public.reports
  add column title text check (char_length(title) <= 120);

-- submit_report gains p_title (last, so existing named-argument callers keep working).
drop function public.submit_report(
  uuid, uuid, double precision, double precision, text, text, jsonb, text[], text, text, text, text, uuid, text, integer
);

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

revoke execute on function public.submit_report(
  uuid, uuid, double precision, double precision, text, text, jsonb, text[], text, text, text, text, uuid, text, integer, text
) from public, anon, authenticated;
grant execute on function public.submit_report(
  uuid, uuid, double precision, double precision, text, text, jsonb, text[], text, text, text, text, uuid, text, integer, text
) to service_role;

-- Recreated to add title and last_activity_at (the latest status change, not Me Too clicks).
drop view public.reports_view;
create view public.reports_view with (security_invoker = true) as
select
  r.id, r.public_code, r.category_id,
  extensions.st_y(r.location) as lat,
  extensions.st_x(r.location) as lng,
  r.barangay_id, r.title, r.landmark, r.description, r.status,
  r.suggested_office_id, r.office_id, r.rejection_reason, r.me_too_count,
  r.created_at, r.updated_at, r.reviewed_at, r.published_at,
  r.first_forwarded_at, r.resolved_at, r.reopened_at,
  greatest(r.created_at, r.published_at, r.first_forwarded_at, r.resolved_at, r.reopened_at) as last_activity_at
from public.reports r;

grant select on public.reports_view to anon, authenticated, service_role;

create index reports_me_too_idx on public.reports (me_too_count desc, created_at desc);
