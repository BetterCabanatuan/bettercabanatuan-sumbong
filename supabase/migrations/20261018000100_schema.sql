-- Core schema for the BetterCabanatuan Community Issue Reporter.
-- Vocabulary follows CONTEXT.md: Report, Reporter, Follower, Category, Responsible Office, Digest.

create extension if not exists postgis with schema extensions;

create type public.report_status as enum (
  'pending_review', 'rejected', 'published', 'forwarded', 'resolved', 'reopened'
);
create type public.volunteer_role as enum ('volunteer', 'coordinator');
create type public.question_kind as enum ('text', 'yes_no', 'choice');
create type public.photo_kind as enum ('evidence', 'after');
create type public.office_scope as enum ('citywide', 'per_barangay');
create type public.digest_channel as enum ('letter', 'text_line', 'email', 'in_person', 'other');
create type public.report_event_kind as enum (
  'submitted', 'status_changed', 'office_changed', 'category_changed', 'misrouted', 'note'
);

-- ---------------------------------------------------------------------------
-- Geography
-- ---------------------------------------------------------------------------

create table public.city_boundary (
  id smallint primary key default 1 check (id = 1),
  name text not null,
  geom extensions.geometry(MultiPolygon, 4326) not null
);

create table public.barangays (
  id serial primary key,
  name text not null,
  psgc text unique,
  geom extensions.geometry(MultiPolygon, 4326) not null
);
create index barangays_geom_idx on public.barangays using gist (geom);

-- ---------------------------------------------------------------------------
-- Responsible Offices, Categories, Category Questions
-- ---------------------------------------------------------------------------

create table public.responsible_offices (
  id uuid primary key default gen_random_uuid(),
  short_name text not null unique,
  name_en text not null,
  name_fil text not null,
  scope public.office_scope not null default 'citywide',
  -- How a Digest reaches this office (its official Citizen's Charter channel).
  channel text not null,
  letter_addressee text,
  letter_attention text,
  email text,
  phone text,
  address text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name_en text not null,
  name_fil text not null,
  description_en text,
  description_fil text,
  icon text not null default 'circle-alert',
  -- Shown before the form, e.g. "Live wire? Call CELCOR / CDRRMO now". Emergencies never wait for a Digest.
  urgent_notice_en text,
  urgent_notice_fil text,
  default_office_id uuid references public.responsible_offices (id) on delete set null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.category_questions (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete cascade,
  prompt_en text not null,
  prompt_fil text not null,
  kind public.question_kind not null default 'text',
  -- For kind = 'choice': [{"value": "...", "label_en": "...", "label_fil": "..."}]
  choices jsonb not null default '[]'::jsonb check (jsonb_typeof(choices) = 'array'),
  required boolean not null default false,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (kind <> 'choice' or jsonb_array_length(choices) >= 2)
);
create index category_questions_category_idx on public.category_questions (category_id, sort_order);

-- ---------------------------------------------------------------------------
-- Volunteers
-- ---------------------------------------------------------------------------

create table public.volunteers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  role public.volunteer_role not null default 'volunteer',
  active boolean not null default true,
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------

create function public.generate_report_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  code text := 'CBN-';
begin
  for i in 1..6 loop
    code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return code;
end;
$$;

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  public_code text not null unique default public.generate_report_code(),
  category_id uuid not null references public.categories (id),
  location extensions.geometry(Point, 4326) not null,
  barangay_id integer references public.barangays (id),
  landmark text check (char_length(landmark) <= 200),
  description text check (char_length(description) <= 2000),
  status public.report_status not null default 'pending_review',
  suggested_office_id uuid references public.responsible_offices (id),
  office_id uuid references public.responsible_offices (id),
  rejection_reason text,
  me_too_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  published_at timestamptz,
  -- First time the Report reached its current Responsible Office. Reset on Misroute.
  first_forwarded_at timestamptz,
  -- Latest Resolved; "final Resolved" once the reopen window has passed.
  resolved_at timestamptz,
  reopened_at timestamptz
);
create index reports_location_idx on public.reports using gist (location);
create index reports_status_created_idx on public.reports (status, created_at desc);
create index reports_office_status_idx on public.reports (office_id, status);

-- Private per-Report data that only the server (service role) may read.
create table public.report_secrets (
  report_id uuid primary key references public.reports (id) on delete cascade,
  -- SHA-256 of the Reporter's private tracking token; the token itself is never stored.
  tracking_token_hash text not null,
  -- Salted hashes used for rate limiting; purged after 30 days.
  ip_hash text,
  device_hash text,
  created_at timestamptz not null default now()
);
create index report_secrets_ip_idx on public.report_secrets (ip_hash, created_at);
create index report_secrets_device_idx on public.report_secrets (device_hash, created_at);

-- Followers: contact details for status notifications. Purged 90 days after final Resolved.
create table public.report_followers (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  email text check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  -- Language for notification emails.
  locale text not null default 'fil' check (locale in ('fil', 'en')),
  created_at timestamptz not null default now(),
  check (user_id is not null or email is not null)
);
create unique index report_followers_user_uniq on public.report_followers (report_id, user_id);
create unique index report_followers_email_uniq on public.report_followers (report_id, lower(email));
create index report_followers_user_idx on public.report_followers (user_id);

-- Answers to Category Questions. The prompt is snapshotted so answers survive question edits.
create table public.report_answers (
  report_id uuid not null references public.reports (id) on delete cascade,
  question_id uuid references public.category_questions (id) on delete set null,
  prompt_en text not null,
  prompt_fil text not null,
  value text not null check (char_length(value) <= 500),
  sort_order integer not null default 0,
  primary key (report_id, prompt_en)
);

create table public.report_photos (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  kind public.photo_kind not null default 'evidence',
  -- Object path in the private `report-originals` bucket.
  original_path text not null,
  -- Object path in the public `report-public` bucket, set once a Volunteer clears or blurs it.
  public_path text,
  hidden boolean not null default false,
  sort_order integer not null default 0,
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index report_photos_report_idx on public.report_photos (report_id, sort_order);

create table public.me_toos (
  report_id uuid not null references public.reports (id) on delete cascade,
  device_hash text not null,
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (report_id, device_hash)
);

create table public.report_events (
  id bigint generated always as identity primary key,
  report_id uuid not null references public.reports (id) on delete cascade,
  kind public.report_event_kind not null,
  from_status public.report_status,
  to_status public.report_status,
  office_id uuid references public.responsible_offices (id),
  previous_office_id uuid references public.responsible_offices (id),
  actor_id uuid references auth.users (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create index report_events_report_idx on public.report_events (report_id, created_at);

-- ---------------------------------------------------------------------------
-- Digests
-- ---------------------------------------------------------------------------

create table public.digests (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.responsible_offices (id),
  -- Set for offices whose scope is per_barangay (one Digest per barangay hall).
  barangay_id integer references public.barangays (id),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  sent_by uuid references auth.users (id) on delete set null,
  channel public.digest_channel,
  channel_detail text,
  proof_photo_path text,
  notes text,
  check ((sent_at is null) = (channel is null))
);
create index digests_office_idx on public.digests (office_id, created_at desc);

create table public.digest_reports (
  digest_id uuid not null references public.digests (id) on delete cascade,
  report_id uuid not null references public.reports (id) on delete cascade,
  primary key (digest_id, report_id)
);
create index digest_reports_report_idx on public.digest_reports (report_id);
