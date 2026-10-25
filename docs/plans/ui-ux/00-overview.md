# UI/UX pass: overview and shared rules

Status: proposed, 2026-10-25. Nothing in these specs is built yet.

Five specs, one per priority. Read this file first; each spec assumes it.

| # | Spec | Surface | Size | Depends on |
| --- | --- | --- | --- | --- |
| 1 | [`01-polish-and-empty-states.md`](01-polish-and-empty-states.md) | Console and shared components | S–M | none |
| 2 | [`02-report-flow-and-login.md`](02-report-flow-and-login.md) | `/report`, `/login`, confirmation | M | 1 (tokens, status icons) |
| 3 | [`03-volunteer-console.md`](03-volunteer-console.md) | `/v` dashboard, Review, Reports, Digests | M–L | 1 (Empty, DataView changes) |
| 4 | [`04-board-map-and-report-page.md`](04-board-map-and-report-page.md) | `/`, map, `/r/[code]` | M–L | 1 (status icons) |
| 5 | [`05-roles-and-settings.md`](05-roles-and-settings.md) | `/v/settings/*` | S–M | 1 (DataView changes) |

Order: 1 first. After that, 2 to 5 are independent and can run in parallel in separate worktrees, as long as they don't both edit the same file (the "Shared files" table below lists the collisions).

## Why this exists

On 2026-10-25 the app was screenshotted with the route and role guards temporarily bypassed (nine screens, 1280px wide, empty data) and rated about 7/10. Five research agents then looked at civic-reporting products, government design systems, triage consoles, role-settings UIs and status/map visuals. Their reports are model output with uneven sourcing, so each claim was checked against the code before it went into a spec.

## What the research got wrong (already built; do not redo)

The agents mostly read screenshots, not code. These suggestions are **already in the app**:

| Suggestion | Where it already is |
| --- | --- |
| Back link on every step | `StepNav` in `src/components/report-form/report-form.tsx` |
| Review page with "Edit" per section | `step === "review"` and `SummaryRow`, same file |
| Draft saved on the device, "start over" | `loadDraft`/`saveDraftFields` in `src/lib/draft.ts`, `restored` alert |
| Nearby Reports before submitting | `nearby-check.tsx`, the `nearby` step |
| Per-Category urgent notice | `urgent_notice` rendered in the `category` step |
| Reference code large, copy and share buttons | `DoneView` in `report-form.tsx` |
| Photo compression before upload | `toUploadableJpeg` in `src/lib/image.ts` (1600px, JPEG 0.82) |
| Mobile filter sheet on the board | `BoardFilterSheet` in `src/components/board/board-filters.tsx` |
| Timeline on the public Report page | `updates` list and the dot column in `src/app/(public)/r/[code]/page.tsx` |
| Dashboard status cards link to filtered lists | `src/app/v/page.tsx` (`href` per status, permission-aware) |
| Pending count badge in the sidebar | `VolunteerSidebar`, `badge: "pending"` (hidden at 0) |
| Search has an accessible label | `user-search` label with `sr-only` in `src/app/v/settings/users/page.tsx` |
| Invite fields have visible labels | `FieldLabel` in the same file (the empty Role select was only the empty database) |
| `Empty` component installed and used | `src/components/ui/empty.tsx`, used in `review/page.tsx`, `board.tsx`, `me/page.tsx` |
| Permission matrix with dashes, view-implies-row, row and column helpers | `src/components/volunteer/permission-matrix.tsx` |
| "Can't remove the last holder of `roles.edit`" | enforced in the database (see `README.md`, "Business rules") |
| Map pins are coloured circles, not Leaflet's default blue pin | `CircleMarker` in `reports-map-inner.tsx`, colours from `STATUS_MARKER` |

Where a spec below touches one of these it says "extend", never "add".

## Shared constraints (copy these into every task)

From `AGENTS.md` and `README.md`:

1. **Next.js 16 has breaking changes.** Before writing code, read the relevant guide in `node_modules/next/dist/docs/` and heed deprecation notices. Don't write from memory.
2. **Domain words**: Report, Reporter, Follower, Volunteer, Coordinator, Responsible Office, Digest, Review, Misroute, Me Too. Never Issue, Ticket, Complaint, User (for a Reporter), Admin, Upvote, Moderation queue. (See `CONTEXT.md`.)
3. **Copy**: resident-facing text goes in `src/messages/{fil,en}.json` with identical keys (a test checks). Volunteer screens under `/v` are English-only and are written inline in the component.
4. **Theme tokens only** (`bg-primary`, `text-muted-foreground`, `bg-sun`, `text-navy`, `bg-status-*`…). No raw hex or `text-red-500` in components. New colours become tokens in `src/app/globals.css`, in both `:root` and `.dark`.
5. **shadcn on Base UI.** Add components with `npx shadcn@latest add`. A link styled as a button is `<Button nativeButton={false} render={<Link … />}>`.
6. **Business rules live in SQL.** UI specs here change no migration, except spec 5 if it adds a rule. Never update `reports` from app code. Never edit an applied migration; add a new one with a test in `tests/db/`.
7. **Keep the board's data flow**: `src/lib/board.ts` holds the shared query options; "Ako rin" is an optimistic mutation in `use-me-too.ts`.
8. **Motion**: respect `prefers-reduced-motion` (existing code uses `motion-reduce:`). Only animate `transform` and `opacity`.
9. **Accessibility floor**: WCAG 2.2 AA, visible focus, 44px touch targets on resident screens, status never conveyed by colour alone.

## Definition of done (every spec)

- `npm run lint`, `npm run typecheck`, `npm test` pass.
- The new copy exists in both `fil.json` and `en.json` (resident screens), with the key-parity test green.
- Screenshots before and after for each changed screen, at 1280px and 390px, saved under `.playwright-mcp/` (gitignored) and described in the PR.
- Checked with real data, not just empty states (see "Test data" below).
- Dark mode checked if the screen is reachable in dark mode (see spec 1, task 4, for whether it is).
- One commit per task, message in the repo's existing style (imperative, describes the behaviour).

## Test data

Most volunteer screens only look right with Reports in them, and the live database has none. Do not seed the production Supabase project.

- Preferred: a local Supabase (`supabase start`) or a separate throwaway project, with a seed script at `scripts/seed-demo.mjs` (to be written as part of spec 3, task 1) that creates ~25 Reports across all six statuses, 3 photos each, 5 offices' worth of Forwarded Reports, one Digest per state, and three roles.
- The unit tests (`npm test`) use PGlite and need none of this.
- To review volunteer screens without a login, temporarily bypass the guards in `src/lib/auth.ts` and `src/lib/supabase/proxy.ts`, **and revert it before committing** (`git diff` must show neither file).

## Shared files (merge-collision map)

| File | Specs that edit it |
| --- | --- |
| `src/app/globals.css` | 1 (status dark tokens), 4 (marker tokens) |
| `src/components/status-badge.tsx`, `src/lib/status.ts` | 1 (icons, English labels), 4 (timeline icons reuse) |
| `src/components/volunteer/data-view.tsx` | 1 (empty, clamp), 5 (card fallback) |
| `src/messages/fil.json`, `en.json` | 1, 2, 4 (merge by key; keep sorted by section) |
| `src/components/report-form/report-form.tsx` | 2 only |
| `src/app/v/page.tsx` | 3 only |

If two specs run in parallel, land 1 first and have the others rebase onto it.

## Skills to run, and when

| Phase | Skill | Used for |
| --- | --- | --- |
| Before coding each spec | `design:design-critique` on the current screenshots | confirm the problem list |
| While coding | `impeccable` (polish, harden, clarify), `shadcn` | implementation conventions |
| Copy tasks | `design:ux-copy`, `stop-slop` | Filipino/English strings, empty states, errors |
| After coding | `design:accessibility-review`, `web-design-guidelines` | audit against WCAG and guidelines |
| Motion tasks only | `animate`, `emil-design-eng` | transitions, key-hint feedback |
| Domain-term changes | `domain-modeling` | add terms to `CONTEXT.md` |

## Source list (pages the research agents actually opened)

Civic reporting: https://www.fixmystreet.com/, https://portal.311.nyc.gov/ (offline copy), https://www.open311.org/learn/, https://fixmystreet.org/, https://www.philstar.com/headlines/climate-and-environment/2024/01/30/2329621/multi-hazard-platform-empowers-filipinos-report-disasters-real-time/amp/

Government design systems and forms: https://design-system.service.gov.uk/patterns/question-pages/, https://design-system.service.gov.uk/components/error-summary/, https://design-system.service.gov.uk/patterns/check-answers/, https://design-system.service.gov.uk/patterns/confirmation-pages/, https://design-system.service.gov.uk/patterns/start-using-a-service/, https://design-system.service.gov.uk/patterns/email-addresses/, https://design-system.service.gov.uk/components/file-upload/, https://designsystem.digital.gov/components/step-indicator/, https://designsystem.digital.gov/components/form/, https://designsystem.digital.gov/components/banner/

Consoles and empty states: https://linear.app/docs/triage, https://linear.app/docs/select-issues, https://linear.app/docs/inbox, https://docs.github.com/en/get-started/accessibility/keyboard-shortcuts, https://ui.shadcn.com/docs/components/empty, https://ui.shadcn.com/examples/dashboard, https://www.nngroup.com/articles/empty-state-interface-design/

Settings and tables: https://workos.com/docs/rbac/configuration, https://docs.github.com/en/organizations/managing-peoples-access-to-your-organization-with-roles/about-custom-repository-roles, https://linear.app/docs/members-roles, https://ui.shadcn.com/docs/components/radix/data-table, https://developer.mozilla.org/en-US/docs/Web/CSS/text-overflow, https://www.nngroup.com/articles/form-design-placeholders/

Status, timeline, map: https://primer.style/components/timeline/, https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html, https://design-system.service.gov.uk/components/tag/, https://designsystem.digital.gov/components/tag/, https://leaflet.github.io/Leaflet.markercluster/

Not opened (treat any claim attributed to them as unsourced): SeeClickFix (403), Waze, Google Maps, Decidim, Reddit mod queue, Zendesk, Intercom, Front, gov.ph / eGovPH guidance, NN/g map articles, Material 3 bottom sheets (summary only).
