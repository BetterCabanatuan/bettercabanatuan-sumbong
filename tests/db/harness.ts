// Runs the Supabase migrations against an in-process Postgres (PGlite + PostGIS),
// with minimal stand-ins for the parts of Supabase the schema depends on:
// the anon/authenticated/service_role roles, auth.users + auth.uid(), and storage.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { postgis } from "@electric-sql/pglite-postgis";

const MIGRATIONS_DIR = join(__dirname, "..", "..", "supabase", "migrations");

// pg_cron is not available in PGlite; the schedule is a one-line migration.
const SKIPPED_MIGRATIONS = new Set(["20261018000400_retention_schedule.sql"]);

const SUPABASE_STANDINS = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema extensions;
  create schema auth;
  create schema storage;
  grant usage on schema public, extensions, auth, storage to anon, authenticated, service_role;

  create table auth.users (
    id uuid primary key, email text, email_confirmed_at timestamptz,
    created_at timestamptz not null default now(), last_sign_in_at timestamptz,
    invited_at timestamptz, encrypted_password text
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid
  $$;
  grant execute on function auth.uid() to anon, authenticated, service_role;

  create table storage.buckets (
    id text primary key, name text, public boolean,
    file_size_limit bigint, allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid
  );
  alter table storage.objects enable row level security;
  grant all on storage.objects to anon, authenticated, service_role;

  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`;

export type Db = PGlite;
export type Role = "anon" | "authenticated" | "service_role";

/**
 * A fresh database with the migrations applied. With `before`, stops ahead of the first
 * migration whose name starts at or after that prefix; `applyMigrations` runs the rest.
 */
export async function createDb(options: { before?: string } = {}): Promise<Db> {
  const db = await PGlite.create({ extensions: { postgis } });
  await db.exec(SUPABASE_STANDINS);
  await applyMigrations(db, (file) => !options.before || file < options.before);
  return db;
}

/** Applies the migrations `include` selects, in order. */
export async function applyMigrations(db: Db, include: (file: string) => boolean = () => true) {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql") && !SKIPPED_MIGRATIONS.has(f) && include(f))
    .sort();
  for (const file of files) {
    try {
      await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
    } catch (error) {
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`);
    }
  }
}

/** Runs `fn` as a Supabase API role, optionally as a signed-in user, inside a rolled-back-on-error transaction. */
export async function as<T>(
  db: Db,
  role: Role,
  userId: string | null,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify(userId ? { sub: userId, role } : { role }),
    ]);
    await tx.exec(`set local role ${role}`);
    return fn(tx);
  });
}

/**
 * Creates an account. Unless `confirmed` is false, its email is confirmed, as after a
 * magic-link sign-in. `via` says how an unconfirmed one came about: "password" is a
 * sign-up with a password, "invite" is the account Supabase's invite link creates, and
 * "otp" is a passwordless sign-in.
 */
export async function createUser(
  db: Db,
  email: string,
  { confirmed = true, via = "otp" }: { confirmed?: boolean; via?: "password" | "invite" | "otp" } = {},
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `insert into auth.users (id, email, email_confirmed_at, invited_at, encrypted_password)
     values (gen_random_uuid(), $1, case when $2 then now() end,
             case when $3 = 'invite' then now() end, case when $3 = 'password' then 'x' end)
     returning id`,
    [email, confirmed, via],
  );
  return rows[0].id;
}

/** Creates an account with a Volunteer row holding the named role ("Volunteer", "Coordinator" or a custom one). */
export async function createVolunteer(db: Db, email: string, role = "Volunteer"): Promise<string> {
  const id = await createUser(db, email);
  const { affectedRows } = await db.query(
    `insert into public.volunteers (user_id, display_name, role_id)
     select $1, $2, id from public.roles where name = $3`,
    [id, email.split("@")[0], role],
  );
  if (!affectedRows) throw new Error(`createVolunteer: no role named "${role}"`);
  return id;
}

// Real points, checked against supabase/data (see its README).
export const CITY_HALL = { lng: 120.95195, lat: 15.47082 }; // Hermogenes C. Concepcion, Sr.
export const DOWNTOWN = { lng: 120.967, lat: 15.4868 }; // San Roque Norte
export const MANILA = { lng: 120.9842, lat: 14.5995 };
