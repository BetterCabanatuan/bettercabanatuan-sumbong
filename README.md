# Sumbong · BetterCabanatuan

A mobile-first web app where residents of Cabanatuan City report problems in public spaces (potholes, leaning poles, dead streetlights, clogged drainage, uncollected garbage). BetterCabanatuan volunteers review each Report and carry it to the office that can fix it. The project is volunteer-run and independent of the City Government.

- Domain language: [`CONTEXT.md`](CONTEXT.md)
- Decisions: [`docs/adr/`](docs/adr)
- Background research (SeeClickFix, FixMyStreet, MyNaga, PH law, who owns what in Cabanatuan): [`docs/research/civic-reporting-platforms.md`](docs/research/civic-reporting-platforms.md)

## Stack

- **Next.js 16** (App Router), deployed to **Cloudflare Workers** with [OpenNext](https://opennext.js.org/cloudflare)
- **Supabase**: Postgres + PostGIS, Auth (email magic links), Storage
- **shadcn/ui** (Base UI primitives) with Tailwind CSS 4, themed to match bettercabanatuan.org (IBM Plex Sans, government blue, flag stripe)
- **TanStack Query** for the feedback board: server-prefetched first page, infinite scroll, optimistic "Ako rin"
- **next-intl**: Filipino (default) and English
- **Leaflet** with OpenStreetMap tiles; **Cloudflare Turnstile**; **Resend** for email

## How it works

| Who | Where | What |
| --- | --- | --- |
| Resident | `/` | Feedback board: Reports ranked by "Ako rin" (or newest / recently updated), filters by status, type and barangay, list or map. |
| Resident | `/report` | Pin, Category (+ Category Questions), 1–3 photos, optional email. Shows nearby open Reports first so they can tap **Ako rin** (Me Too) instead. |
| Resident | `/r/CBN-XXXXXX` | Public Report page. With the private tracking link (`?t=`) or an email link, the Reporter can also see it before Review, add an email, and reopen it within 30 days of Resolved. |
| Volunteer | `/v/review` | Review: pixelate faces and plate numbers, confirm Category and Responsible Office, then approve or reject. |
| Volunteer | `/v/digests` | Build a Digest per office, print the letter, log how it was sent (its Reports become Forwarded), and upload Proof of Receipt. |
| Volunteer | `/v/reports/:id` | Resolve (with an "after" photo), Misroute, reopen, or take down. |
| Coordinator | `/v/settings` | Manage Categories and their questions, Responsible Offices, and Volunteers (invite only). |

Business rules live in the database ([`supabase/migrations`](supabase/migrations)):

- A trigger enforces the Report status machine.
- Volunteers act only through `SECURITY DEFINER` functions, which check their role and write `report_events`.
- Reporter-side functions (`submit_report`, `add_me_too`, `reopen_by_follower`) can only be called with the service role. That way the Worker always runs Turnstile and the rate limits first.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in Supabase keys
npm run dev                  # http://localhost:3000
npm test                     # migrations + rules against in-process Postgres/PostGIS (PGlite), unit tests
npm run lint && npm run typecheck
```

The database tests need no Docker or Supabase project. `tests/db/harness.ts` stands in for the parts of Supabase the schema uses: roles, `auth.uid()` and storage tables.

## Setting up Supabase

1. Create a project. Then run `npx supabase login`, `npx supabase link --project-ref <ref>` and `npm run db:push`. The migrations do the following:
   - create the schema and the row-level security policies;
   - create the storage buckets;
   - schedule the daily retention job with `pg_cron`;
   - load the starting Responsible Offices and Categories;
   - load the city boundary and all 89 barangay boundaries.
2. Configure Auth (Authentication → URL Configuration):
   - **Site URL:** `https://sumbong.bettercabanatuan.org`
   - **Redirect URLs:** `https://sumbong.bettercabanatuan.org/auth/confirm`, plus `http://localhost:3000/auth/confirm` for dev
3. Set up custom SMTP (Authentication → SMTP), for example Resend. Supabase's built-in sender is heavily rate-limited and is not meant for production magic links.
4. Create the first Coordinator:
   - sign in once at `/login`;
   - run [`supabase/snippets/bootstrap-coordinator.sql`](supabase/snippets/bootstrap-coordinator.sql) in the SQL editor with your email.

   After that, invite everyone else from `/v/settings/volunteers`.

### Boundary data

`supabase/data/` contains the boundary data, with its source, license and validation notes in [`supabase/data/README.md`](supabase/data/README.md):

- **Source:** OCHA/HDX COD-AB (NAMRIA & PSA), CC BY-IGO 3.0, matched against PSA PSGC 2Q 2026.
- **After refreshing the GeoJSON:** run `npm run db:boundaries` to regenerate the migration.
- **Edge tolerance:** the reference outline can be off by a few hundred metres, so the app accepts pins up to 500 m outside it and assigns them the nearest barangay.

## Deploying to Cloudflare

```bash
npx wrangler login
npx wrangler secret put SUPABASE_SECRET_KEY
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put HASH_SALT          # long random string
npx wrangler secret put RESEND_API_KEY
# NEXT_PUBLIC_* values are inlined at build time: export them (or put them in .env.production) before building.
npm run deploy
```

Then add a custom domain (`sumbong.bettercabanatuan.org`) to the Worker, and create a Turnstile widget for that hostname.

## Before launch

- [ ] Replace the Data Protection Officer details in `src/lib/site.ts` and set up `privacy@` / `sumbong@bettercabanatuan.org`.
- [ ] Check NPC registration requirements for the DPO (see the research doc, §6).
- [ ] Verify CELCOR's address and contact details in Responsible Offices (the research flagged them as possibly outdated).
- [ ] Switch map tiles if traffic grows. The OpenStreetMap tile servers are for light use only ([tile usage policy](https://operations.osmfoundation.org/policies/tiles/)).
- [ ] Run one full flow against the real Supabase project: report, review, Digest, resolve, reopen.

## Known limitations

- Next 16 runs `src/proxy.ts` on the Node.js runtime. OpenNext marks Node middleware on Cloudflare as experimental. It works under `wrangler dev`; if it misbehaves in production, the `/v` layout still enforces Volunteer access on its own.
- Volunteer screens are English-only. Resident-facing screens and emails are bilingual.
- The Scorecard, web push and Volunteer linking of Duplicates are deferred until after v1. The schema already records `first_forwarded_at`, final `resolved_at` and Misroutes, so the Scorecard will have its data.
