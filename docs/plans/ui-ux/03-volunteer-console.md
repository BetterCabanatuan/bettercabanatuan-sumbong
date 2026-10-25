# Spec 3: the Volunteer console (dashboard, Review, Reports, Digests)

Status: proposed, 2026-10-25. Read [`00-overview.md`](00-overview.md) first. Land spec 1 (`DataView` empty props, status icons) before this one.

## Role

- **Executor**: a frontend engineer who can read Server Actions and Supabase RPC calls but does not need to change them (one exception: the redirect target in task 3).
- **Skills**: `impeccable` (layout, clarify, polish), `shadcn`, `emil-design-eng` (key hints, feedback after an action), `design:design-critique` on the screens once they have real data, `design:accessibility-review`.
- **Users affected**: Volunteers (daily work), Coordinators. Everything here is English-only and gated by permissions; every control must stay hidden for roles without the permission.

## Context

A Volunteer opens the console to do two jobs: **Review** new Reports, then **send Digests** to Responsible Offices. The current console is clean and consistent, but it shows counts instead of work. The dashboard is six zeros and a table of offices with a "Go to Digests" button as its only prominent action, and nothing on the screen says that Review comes first. The Review queue is a plain table with no sense of age, and after a decision the Volunteer lands back on the list and must click the next Report.

The screenshots only showed empty states, because the live database has no Reports. The first task is therefore a safe way to get realistic data, since three of the other tasks can't be judged without it.

## Goals

1. The dashboard answers "what should I do now?" in one glance: how many Reports wait for Review, how old the oldest is, how many Digests are ready.
2. Working through the Review queue is a loop: decide, land on the next Report, with the position shown ("2 of 7").
3. Large lists can be acted on without opening each row (Reports select, filter chips).
4. A Digest shows where it is in its lifecycle, using only state that already exists.
5. Frequent actions have a keyboard path, discoverable from the screen.

## Non-goals

- A new `Printed` Digest state. `CONTEXT.md` defines a Digest as sent only once a Volunteer logs when and how, and the schema has no "printed" field. Adding one needs a migration and a decision; it is out of scope.
- Snooze, "Need info" and Duplicate-merge verdicts in Review. These come from Linear's triage model but each needs new statuses or tables. Listed under "Later".
- Changing permissions, roles or any RPC.
- The plan in `docs/plans/after-forwarded.md` (Office Replies, Overdue, Follow-up Digests). When that ships, the dashboard will gain "overdue" counts; leave a slot for it, build nothing.

## Already built (extend, don't add)

| Capability | Where |
| --- | --- |
| Status tiles link to the filtered list, permission-aware | `src/app/v/page.tsx` (`href` is `/v/review` for `pending_review`, `/v/reports?status=…` otherwise) |
| Pending count badge on the Review nav item | `VolunteerSidebar` (`badge: "pending"`, hidden at 0) |
| Review detail: sticky decision panel, "N of M cleared" photo progress, approve locked until photos are cleared | `src/app/v/review/[id]/page.tsx`, `review-decision.tsx` |
| Reject presets | `REJECT_PRESETS` in `review-decision.tsx` |
| Table / list / grid switcher remembered in a cookie | `view-switcher.tsx`, `src/lib/data-view.ts` |
| CSV export gated by permission | `ListHeader` `exportHref` |
| `Empty` used in Review | `review/page.tsx` |
| Digest detail with printable letter, send form, Proof of Receipt upload | `src/app/v/digests/[id]/page.tsx`, `proof-upload.tsx` |

## References

- Linear triage: https://linear.app/docs/triage (verdict set, "triage inbox" model)
- Linear selecting issues: https://linear.app/docs/select-issues (J/K, X, Shift-arrows, Cmd/Ctrl+A over the filtered set, bulk bar)
- Linear inbox: https://linear.app/docs/inbox
- GitHub keyboard shortcuts: https://docs.github.com/en/get-started/accessibility/keyboard-shortcuts (item action vs destination are separate)
- shadcn dashboard example: https://ui.shadcn.com/examples/dashboard (stat cards, tabs with counts, table with selected footer)
- shadcn Empty: https://ui.shadcn.com/docs/components/empty
- NN/g empty states: https://www.nngroup.com/articles/empty-state-interface-design/
- Not opened, so unsourced: Zendesk, Intercom, Front, Reddit mod queue, redaction tools.
- Repo: `src/app/v/{page,layout}.tsx`, `src/app/v/review/**`, `src/app/v/reports/**`, `src/app/v/digests/**`, `src/app/v/actions.ts`, `src/components/volunteer/*`, `src/lib/{data,data-view,digests,report-filters}.ts`, `CONTEXT.md` (Digest, Review)

## Tasks

### Task 1: a realistic, safe seed

**Why**: Tasks 2–6 can't be judged on an empty database, and the production Supabase project must not be seeded.

**Files**: new `scripts/seed-demo.mjs`; a line in `README.md` under "Local development".

**Steps**
1. The script reads `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SECRET_KEY` and **refuses to run unless the URL is `http://127.0.0.1:*` or `http://localhost:*`** (print why and exit 1). No override flag.
2. Create 3 roles' worth of test accounts if missing: Coordinator, Volunteer, and a read-only role. Print the sign-in emails (local inbucket/Mailpit receives the magic link).
3. Create ~25 Reports through the `submit_report` function (service role only, as the README says) across all Categories, with coordinates inside Cabanatuan, so the real trigger path is used. Move them through statuses with the same RPCs the console uses (`review_approve`, `review_reject`, Digest creation and send, `resolve_report`). Backdate `created_at` so ages run from 1 hour to 12 days.
4. Upload 2–3 sample JPEGs (generated by the script with a canvas-free approach, e.g. solid-colour test cards with text, committed under `scripts/seed-assets/`, < 50 KB each).
5. Make it idempotent: tag seeded rows (`landmark` starts with "[seed]") and delete-and-recreate those on re-run.

**Acceptance**: `supabase start && node scripts/seed-demo.mjs` produces a console where every status tile is non-zero, at least two offices have waiting Reports, there is one Draft and one Sent Digest; running it against a hosted URL exits 1 without touching anything.

### Task 2: dashboard: what to do now

**File**: `src/app/v/page.tsx` (plus a small server component if it grows).

1. Above the status tiles, add a "Needs you" strip with up to three items, each only if the role may act on it:
   - **Review** (`reports.review`): "{n} Reports waiting for Review. Oldest: {age}." Button "Start Review" → `/v/review`. When 0: "Nothing waiting. Caught up." (no button).
   - **Digests** (`digests.add`): "{k} offices have Reports waiting for a Digest." Button "Open Digests" → `/v/digests`.
   - **Drafts** (`digests.view`): "{d} Draft Digests not sent yet." Link to `/v/digests`.
2. Oldest age: one extra query, `reports` where `status = 'pending_review'` ordered by `created_at` limit 1, formatted as "3 days" / "5 hours" using `Intl.RelativeTimeFormat("en")`. Add it to the existing `Promise.all`; don't add a round trip.
3. Make Review the primary (filled) button; "Go to Digests" in the table card stays outline. The page currently never mentions Review in its action buttons.
4. "Waiting for the next Digest" table: render offices with 0 waiting collapsed into one muted line, "{n} offices have nothing waiting.", behind a `<details>`; keep rows with ≥1 on top, sorted by count descending. Add the office `short_name` as the link to `/v/digests?office={id}` (the Digests page already supports `?office=`).
5. Add a "First run" card **only when** the database has zero Reports and the role has `categories.edit` or `offices.edit`: a 3-item checklist: "Share the public form link ({NEXT_PUBLIC_SITE_URL}/report)", "Check every Responsible Office has a way to be reached" (link to Offices), "Check the Categories residents will see" (link to Categories). Don't offer "load demo data" here; the seed is a developer tool.
6. Keep the six status tiles and their links unchanged. Add an icon from spec 1's `STATUS_ICON` to the tile badge (it comes for free once `StatusBadge` has it).

**Acceptance**: with seed data the strip shows the right numbers for a Coordinator and only the permitted items for a read-only role; with zero data the first-run card shows for a Coordinator and not for a read-only role; no extra sequential queries (check the Supabase logs or add a timing comment in the PR).

### Task 3: Review queue: age, position, and "next Report"

**Files**: `src/app/v/review/page.tsx`, `src/app/v/review/[id]/page.tsx`, `src/app/v/actions.ts` (`approveReport`, `rejectReport`), `src/components/volunteer/review-decision.tsx`.

1. **Queue table**: replace the "Submitted" column with "Waiting" ("3 days", with the exact Manila date in `title`). Add a photos count column (`details` would need a join; if not already in `getReports`, skip rather than add an N+1). Add a "Start with the oldest" button above the table → `/v/review/{oldest.id}`.
2. **Age emphasis**: no threshold exists in the domain, so don't invent a red "overdue". Show age as plain text; ask the Coordinators for a target (open question 1) before colouring anything.
3. **Next Report after a decision**: in `approveReport` and `rejectReport` (when `from === "review"`), after the RPC succeeds, look up the next oldest `pending_review` Report (excluding the current id) with one query and redirect to `/v/review/{nextId}?approved=1` (or `rejected=1`); if none, redirect to `/v/review?approved=1` as today. Keep `revalidatePath("/v", "layout")`. Don't change the RPCs.
4. **Position**: on the detail page show "Report 2 of 7 waiting" next to the code. Compute from a `count` of `pending_review` and the rank of this Report by `created_at`; two cheap queries, only when `isPending`.
5. **Banner copy**: the "Approved and published." alert should name the next step when a next Report exists: "Approved. Here is the next one."
6. Edge cases to handle explicitly: two Volunteers reviewing at once (the RPC will fail the second with a state error; show `failure(error)`'s message and a "Back to the queue" link); the last Report in the queue; a Report that was taken down while open.

**Acceptance**: with 3 seeded pending Reports, approving the first opens the second with "Report 1 of 2 waiting"; approving the last returns to the queue with the "Caught up" empty state; rejecting behaves the same.

### Task 4: Reports list: selection and filter chips

**Files**: `src/app/v/reports/page.tsx`, `src/components/volunteer/data-view.tsx` (a `selectable` prop), a new client component `report-bulk-bar.tsx`.

1. **Status filter labels**: the Status `<select>` renders `s.replace("_", " ")`, which shows "pending review" and "published" in raw enum words. Use the same English labels as the badge (`STATUS_LABEL_EN` from spec 1).
2. **Filter chips**: above the table, show the active filters as removable chips ("Status: Forwarded ×", "Office: CEO ×"), each a link that removes only that parameter (`reportFiltersToSearch`). Hide the Filter button's role as the only way to apply: also auto-apply on change with a tiny client wrapper (`onChange → form.requestSubmit()`), keeping the button for no-JS.
3. **Selection**: add a first column of checkboxes (table layout only) and "Select all {n} shown". A bar fixed to the bottom of the viewport appears when ≥1 is selected: "{n} selected · Export selected CSV". Gate the export on `reports.export`. Only add actions that already exist as server code; do not invent "Add to Digest" (a Digest takes every Published or Reopened Report for an office; selecting Reports into one is a new rule).
4. **Selected export**: extend the existing `/v/reports/export` route to accept `ids=` (validate as UUIDs, cap at 300 like the list). If it is not trivial, ship selection with "Copy codes" only, and list export-selected under "Later".
5. **Keyboard**: with focus in the table, `J`/`K` move the row highlight, `X` toggles selection, `Esc` clears, `Enter` opens. Implement as one `useRowNavigation` hook; ignore keys when an input or select has focus; never intercept browser/OS shortcuts. Show "Press ? for shortcuts" in the footer of the table.

**Acceptance**: filter chips round-trip through the URL; selecting 3 rows shows the bar with "3 selected"; Esc clears; the keyboard hook is inert inside the filter form; roles without export never see the export button.

### Task 5: Digest lifecycle indicator

**Files**: `src/app/v/digests/[id]/page.tsx`, `src/app/v/digests/page.tsx`.

Use only existing state: a Digest is **Draft** until `sent_at`; the letter is a page; the send is logged with `channel` and `sent_at`; Proof of Receipt is `proof_photo_path`.

1. At the top of the detail page, a three-step indicator: **1. Draft ready** (always done), **2. Sent and logged** (done when `sent_at`), **3. Proof of Receipt** (done when `proof_photo_path`; optional, labelled "optional"). Steps use `CircleCheck`/`CircleDashed` as `review-decision.tsx` already does.
2. Copy for the active step: Draft: "Print the letter, send it through the office's channel, then log it below." Sent without proof: "Logged. Upload the office's Proof of Receipt when you have it."
3. On the list page, the "Draft"/"Sent" badge gains the proof state: "Sent · no proof" (muted) vs "Sent · proof". Keep the existing token classes.
4. The "Ready to send" card: for rows with a count of 0 nothing is shown already; add the office's `reply`/channel hint (`office.channel`, clamped) under the name so the Volunteer sees how it will be sent before creating the draft.
5. **Do not** add "Printed". Record it under open question 2.

### Task 6: shortcuts and command palette

**Files**: new `src/components/volunteer/shortcuts.tsx` (client), mounted in `src/app/v/layout.tsx`.

1. A single global key listener, active only when no input, textarea, select or contenteditable has focus and no modifier is held (except `⌘/Ctrl+K`).
2. Navigation chords (Linear style): `G` then `R` → Review, `G` then `P` → Reports, `G` then `D` → Digests, `G` then `H` → Dashboard. Only for destinations the role may open (use `permissions` from the layout's `volunteer`).
3. In Review detail: `1` focuses Approve, `2` focuses Reject (focus only; never submit on a key), `]` goes to the next waiting Report. Show the key on the button as a `<kbd>` hint on desktop only.
4. `?` opens a `Dialog` listing every shortcut that applies on the current page; `Esc` closes it. This is the discoverability mechanism; without it the shortcuts don't exist.
5. `⌘/Ctrl+K` opens a `Command`-style palette with the same destinations plus recent Reports by code. Add it via `npx shadcn@latest add command` (cmdk). If the dependency isn't wanted, ship tasks 6.1–6.4 without the palette.
6. Respect `prefers-reduced-motion`; no animation on the dialog beyond the existing `Dialog` defaults.

**Acceptance**: with a read-only role, `G R` does nothing (no Review permission); typing "gr" into the search box doesn't navigate; `?` shows only valid shortcuts; screen reader reads the dialog title.

### Task 7: sidebar and topbar

1. Add a count badge to **Digests** (`SidebarMenuBadge`) for offices with waiting Reports. Compute in `src/app/v/layout.tsx` beside the existing `pending` count, using one `select` on `reports` where `status in ('published','reopened')` and count distinct `office_id` client-side from the returned rows (limit 1000, or add an RPC later; don't add a migration here).
2. Topbar: replace the static "BetterCabanatuan Volunteers" with a breadcrumb (`Breadcrumb` is installed) built from `usePathname`: "Settings / Roles / Edit". Keep "Public board" at the right.
3. `Coordinator` line overlapping Sign out was the Next.js dev badge; no code change, mention in the PR so nobody chases it.

## Later (not in this spec)

Snooze and "Need info" verdicts; Duplicate merge from Review (needs the Duplicate flow in `CONTEXT.md` surfaced in the UI); an explicit Printed state on Digests; bulk "add to Digest"; Overdue badges once `docs/plans/after-forwarded.md` lands.

## Testing and verification

- `npm test`, `npm run lint`, `npm run typecheck`.
- Add database tests only if a task unexpectedly needs a migration (none planned).
- With the seed, screenshots at 1280px and 768px of: dashboard (Coordinator, then a read-only role), Review queue, Review detail with "2 of N", Reports with chips and a selection, Digest draft and sent, the `?` dialog.
- Two-browser concurrency check for task 3.
- Keyboard-only walkthrough of Review (open the queue, decide, next, decide).
- `design:accessibility-review` on the dashboard and the Review detail.

## Risks

- Redirecting to "next Report" changes a flow Volunteers know. If the Coordinators prefer the list, hide it behind a per-user preference (a cookie like the view switcher) instead of dropping it.
- Global key listeners are easy to get wrong with assistive tech and IMEs (Filipino keyboards, voice input). Keep the no-modifier shortcuts few, and provide the same actions as visible buttons.
- The Digests badge query runs on every console page. If it shows up in latency, move it behind `unstable_cache`/a tag invalidated by `createDigest`, or only compute on `/v` and `/v/digests`.
- The seed script is a sharp tool. The localhost-only guard is non-negotiable; test the refusal path.

## Open questions

1. Do Coordinators want an age target for Review (for example "review within 3 days")? Without one, no colour or "overdue" wording.
2. Should "Printed" become a recorded Digest state? It needs a decision, a migration and a test in `tests/db/`.
3. Should selecting Reports ever put them into a Digest, or is "every Published or Reopened Report for the office" the rule to keep?
4. Is a command palette worth the `cmdk` dependency for a console this size?
