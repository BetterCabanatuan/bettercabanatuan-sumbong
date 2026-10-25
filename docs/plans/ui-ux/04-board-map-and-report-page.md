# Spec 4: the public board, the map and the Report page

Status: proposed, 2026-10-25. Read [`00-overview.md`](00-overview.md) first. Land spec 1 (`STATUS_ICON`, English/Filipino badge labels) before this one.

## Role

- **Executor**: a frontend engineer comfortable with Leaflet, TanStack Query and next-intl. One task (the activity strip) touches a server query; none touches SQL.
- **Skills**: `frontend-design` (visual direction for markers and cards), `impeccable` (layout, polish), `animate` and `emil-design-eng` (only for the pin and sheet transitions), `mobile-native` (bottom sheet, tap highlights, safe areas), `design:accessibility-review`.
- **Users affected**: residents browsing the board (Filipino first, phones), Reporters watching their own Report, Followers arriving from an email link, and anyone who opens a shared `/r/CBN-XXXXXX` link from Facebook.

## Context

The board is the public face: people decide here whether this project is alive and trustworthy. It already has real strengths: server-prefetched first page with infinite scroll, an optimistic "Ako rin" button with the sun motif, sort and filter controls, a mobile filter sheet, a list/map toggle, a timeline on each Report, and a fixed "Mag-sumbong" button on phones. With an empty board it looks sparse and says nothing about whether anyone is at work.

Three real gaps came out of reading the code, not just the screenshots:

1. On screens narrower than 1280px the "How it works" card and the **emergency notice are not rendered at all** on the board (`<aside className="hidden … xl:flex">`). Only the footer repeats the CDRRMO number.
2. The map shows every Report as the same size of circle, differing only by colour; nothing clusters; the map mode is local component state, so it can't be linked or restored with the Back button.
3. A Reporter or neighbour who only has a Report code has no way to use it: the board has no lookup, and an unpublished Report's page returns 404 without the private link.

## Goals

1. An empty or young board still shows that the project is active and what to do.
2. Emergencies are never more than one glance away on any screen size.
3. A status is recognisable on the card, the Report page, the timeline and the map without relying on colour.
4. The map stays readable with hundreds of Reports, and the view is shareable.
5. A visitor can find a Report from its code and is told honestly when it isn't public.

## Non-goals

- Cover photos on board cards. `reports_view` has no photo path, and adding one needs a migration and a test (`tests/db/`). Listed under "Later".
- Voting, sorting or filter changes (the board's data flow in `src/lib/board.ts` stays as is).
- A native-app-style three-state map sheet (listed as a stretch, task 7).
- Changing statuses, their names or the Filipino labels.

## Already built (extend, don't add)

| Capability | Where |
| --- | --- |
| Server-prefetched, infinitely scrolling list | `src/app/(public)/page.tsx`, `board.tsx` (`useInfiniteQuery`, `IntersectionObserver`) |
| Skeletons, error with retry, empty with CTA | `BoardList` in `board.tsx` |
| Mobile filter sheet, desktop rail | `board-filters.tsx` (`BoardFilterSheet`, `BoardFilterRail`) |
| Sort as a toggle group that scrolls inside its own row on phones | `board.tsx` |
| Fixed bottom "Mag-sumbong" button on phones | `page.tsx` (`md:hidden`, safe-area padding) |
| Public Report timeline (dots, dates, "Me too" milestone) | `src/app/(public)/r/[code]/page.tsx` (`updates`, `DOT`) |
| Status explainer sentence per status | `reportPage.statusExplainer.*` |
| "Waiting N days" on the Forwarded office card | same file, `waitingDays` |
| Coloured circle markers, white outline | `reports-map-inner.tsx`, `STATUS_MARKER` in `src/lib/status.ts` |
| Share card with the public URL | `ShareCard` in `reporter-actions.tsx` |

## References

- Primer Timeline: https://primer.style/components/timeline/ (badge icon on a rail, `Timeline.Break`, condensed items, `clipSidebar`)
- WCAG 1.4.1 Use of Color: https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html
- GOV.UK Tag: https://design-system.service.gov.uk/components/tag/ (sentence case; same colour everywhere)
- USWDS Tag: https://designsystem.digital.gov/components/tag/
- Leaflet.markercluster: https://leaflet.github.io/Leaflet.markercluster/ (cluster on zoom, spiderfy at max zoom, `iconCreateFunction`)
- FixMyStreet, for the activity counters and recent-report cards: https://www.fixmystreet.com/
- NYC 311, for "report" next to "look up a request": https://portal.311.nyc.gov/ (offline copy; links unverified)
- Philstar on MapaKalamidad (sharing and validation context): https://www.philstar.com/headlines/climate-and-environment/2024/01/30/2329621/multi-hazard-platform-empowers-filipinos-report-disasters-real-time/amp/
- Unopened, so unsourced: Airbnb/Zillow card-and-pin hover pattern, Material 3 bottom sheets (summary only), SeeClickFix, Waze, Google Maps.
- Repo: `src/components/board/*`, `src/components/map/*`, `src/app/(public)/page.tsx`, `src/app/(public)/r/[code]/{page,reporter-actions}.tsx`, `src/app/(public)/me/page.tsx`, `src/lib/{board,status}.ts`, `src/app/globals.css`, `src/app/not-found.tsx`

## Tasks

### Task 1: emergency and "how it works" on every screen size

**File**: `src/app/(public)/page.tsx`, `src/messages/{fil,en}.json` (`board.emergency`, `board.how`).

1. Keep the right-hand aside for `xl`. Below `xl`, render the emergency notice as a compact `Alert variant="destructive"` directly under the lead paragraph, with a `tel:09088811010` link. One line on phones: "Emergency? Call CDRRMO 0908-881-1010." (reuse `board.emergency.body` if it fits; otherwise add `board.emergency.short`).
2. Render "How it works" below `xl` as a collapsible (`Accordion` is installed), closed by default on phones, with the four steps inside. Don't duplicate it at `xl`.
3. Make sure the fixed bottom button doesn't cover either (the page already has `pb-28 md:pb-12`).

**Acceptance**: at 390, 768 and 1024px the emergency line is visible without scrolling past the first filter row; at 1280px nothing is duplicated; the number is a working `tel:` link.

### Task 2: status icons everywhere, a better timeline

**Files**: `src/components/status-badge.tsx` (from spec 1), `src/app/(public)/r/[code]/page.tsx`, `src/app/globals.css`.

1. The badge already gets `STATUS_ICON` from spec 1. Verify it shows on `ReportCard`, the Report page header, the map popup and the Volunteer tables.
2. **Timeline**: replace the 16px colour dots with 24px icon badges (the same `STATUS_ICON`, plus `HandHeart`/the sun for "Me too" and `FilePlus2` for "submitted"), keeping the left rail and the `ring-4 ring-background` cut-out. Each badge is `aria-hidden`; the title text already names the event. Keep the list an `<ol>`.
3. **Phase break** (Primer `Timeline.Break`): between the events that Volunteers do (Submitted, Published) and the events about the office (Forwarded, Resolved), insert a small, `aria-hidden` divider labelled "With the Responsible Office" **and** make the first office event's text say so, because the divider is decorative.
4. **Condensed items**: render the "Me too" milestone at smaller type and lighter weight than status changes, so a count of 40 doesn't compete with "Forwarded to CEO".
5. Keep the dates and `forwardedBody`/`publishedBody` text as is. Don't change which events appear.
6. Use only theme tokens for the badge fills (`bg-status-*`); the `DOT` map's `bg-sun`, `bg-primary` etc. are tokens already.

**Acceptance**: the Report page for each of the six statuses (seed from spec 3) renders a timeline whose last item matches the status badge; a greyscale screenshot still distinguishes every status by icon; screen readers read the title text only, once.

### Task 3: board card, "last update" and an honest activity strip

**Files**: `src/components/board/report-card.tsx`, `src/app/(public)/page.tsx`, a new `src/lib/board-stats.ts`.

1. **Last update**: `Report` already has `last_activity_at`. In `ReportCard`'s meta line show "Updated {relative}" when `last_activity_at` differs from `created_at` by more than a minute, using the same `format.relativeTime` as `progress`. Keep the existing "Forwarded to X {when}" line; don't stack two time phrases. Put "Updated" only when the status line has no time.
2. **Activity strip** under the lead on the board page, server-rendered: "{n} new this week · {m} resolved this month". Query with two `count: "exact", head: true` selects on `reports_view` (published within 7 days; resolved within 30 days), run in the page's existing `Promise.all`, cached with `unstable_cache` or the Next 16 equivalent for 5 minutes (read the caching guide in `node_modules/next/dist/docs/` first; it changed).
3. **Honesty rule**: render a number only when it is ≥ 1, and the whole strip only when at least one number shows. Never "0 resolved". A new project with few Reports shows nothing rather than a row of zeros.
4. **Wording**: Filipino first ("{n} bagong sumbong ngayong linggo · {m} naayos ngayong buwan"); add both locales.
5. No thumbnail on the card in this spec (see Non-goals).

**Acceptance**: with the seed the strip shows plausible numbers; with an empty board it is absent; the added count queries don't block the first paint (check the server timing, and that the strip is inside a `Suspense` if either query is slow).

### Task 4: find a Report by its code

**Files**: a small client component `src/components/board/code-lookup.tsx` placed on the board page (below the activity strip) and at the top of `/me`; `src/app/(public)/r/[code]/page.tsx`; `src/app/not-found.tsx`; messages.

1. Field "Look up a report" with placeholder `CBN-ABC123`. Normalise input (trim, upper-case, accept a pasted full URL and extract the code), validate against the real code pattern (read `public.generate_report_code()` in `supabase/migrations/20261018000100_schema.sql` before writing the regex), then `router.push("/r/{code}")`.
2. A Report that exists but is not public returns `notFound()` unless the visitor has the private link (`?t=`). The not-found page currently says generically that the page can't be found. For `/r/*` show: "We can't show this report. It may still be in review, or the code may be wrong. If it's yours, open the private link from when you sent it, or look under My reports." with links to `/me` and `/`. Don't confirm that a given code exists (that would let people enumerate unpublished Reports).
3. Keep the lookup client-side only; no new endpoint, no database call that reveals existence.

**Acceptance**: pasting `https://…/r/CBN-ABC123?t=…` goes to the Report; a wrong code and an unpublished code produce the identical message.

### Task 5: a readable map

**Files**: `src/components/map/reports-map-inner.tsx`, `src/components/map/constants.ts`, `src/lib/status.ts`, `src/components/board/board.tsx`, `package.json`.

1. **Mode in the URL**: replace `useState<Mode>` with a `?mode=map` search param read in `Board` and written through `useBoardNavigation`'s `update` (extend `BoardFilters` or handle it beside it; keep the TanStack query keys unchanged). Back/forward then work, and a map link can be shared.
2. **Markers**: move from `CircleMarker` to `L.divIcon` markers that are an inline SVG: a **shape per status** (circle, square, diamond, ring) filled with the status colour, a 2px white outline, a 1px navy outer ring (≥3:1 against OSM tiles), and a **category glyph** in the centre using the same lucide icons as `CategoryIcon`. Resolved markers at 60% opacity so open problems read first. Keep the markers keyboard-focusable (`keyboard: true`, `title`/`alt` with the Report title and status).
3. **Clustering**: add `leaflet.markercluster` (or the `react-leaflet-cluster` wrapper after checking it supports react-leaflet 5 and React 19; the repo is on `react-leaflet ^5`). Cluster bubbles are navy with a white count; a click zooms to bounds; at max zoom spiderfy. `maxClusterRadius` ~50. `fetchMapPoints` already returns up to 1000 points.
4. **Popup**: title, status badge (with icon), category, barangay, the code as a link, and an "Ako rin" count (read-only). Use theme tokens only. Make sure popup content wraps at 280px.
5. **Fit**: on first load fit bounds to the markers (with `maxZoom: 16`), not a fixed `DEFAULT_ZOOM`. Keep the city centre when there are no markers. Show an `Empty`-style overlay "No reports to show on the map" in that case.
6. **Legend**: a small collapsible legend (shape, colour, label) in the corner; its text comes from `status.*` messages so it is bilingual.
7. **Tiles**: `TILE_URL` uses `tile.openstreetmap.org`. OpenStreetMap's tile usage policy restricts heavy use of that server; check the current policy and decide whether a production deployment needs a different tile provider (open question 2). Don't change it in this task.

**Acceptance**: with 300 seeded points the map clusters at the default zoom, spiderfies at zoom 18, keeps 60 fps while panning on a mid-range phone (use the Performance panel with 4× CPU throttle), and every status is distinguishable in greyscale; `?mode=map` survives a reload.

### Task 6: card and pin linked (desktop only)

At `lg` and wider, show the list and the map side by side when mode is `map`: list on the left (scrollable, same `ReportCard`s), map on the right (sticky). Hovering or focusing a card highlights its marker (larger, ring); selecting a marker scrolls the list to its card and opens its popup. Use a tiny shared store (`useSyncExternalStore` or React context) keyed by Report id; don't lift state into `Board`'s query layer. Below `lg`, keep today's single-pane toggle. This pattern is common in listing sites but no source was opened; treat it as a prototype and cut it if it complicates the code.

### Task 7 (stretch): mobile map sheet

On phones, tapping a marker opens a bottom sheet (`Sheet side="bottom"` is installed) with the card instead of a popup, and the map keeps ≥50% of the screen. Detents and drag-to-expand are optional; a simple "peek card" that closes on tap-outside is enough. The source for detents (Material 3 bottom sheets) was only a summary, so don't build a three-state sheet from it.

## Copy deliverables (both locales)

`board.emergency.short`, `board.how.toggle`, `board.stats.{week,month}`, `board.lookup.{label,placeholder,submit,invalid}`, `reportPage.notFound.{title,body}`, `reportPage.timeline.officePhase`, `board.mode.map` unchanged, `board.map.{empty,legend,legendShape}`. Filipino strings via `design:ux-copy`; the key-parity test must stay green.

## Testing and verification

- `npm test`, `npm run lint`, `npm run typecheck`.
- Unit tests for the code normaliser (task 4): a full URL, lower-case, spaces, wrong length, SQL-looking input.
- Seed from spec 3, then screenshots at 390 / 768 / 1280: board (empty, 25 Reports, filtered), map (default, zoomed, popup), Report page for all six statuses, the not-found message.
- Keyboard: tab through markers, open a popup with Enter, close with Escape.
- Contrast of marker outline vs OSM tiles with a colour-contrast checker on a zoomed screenshot.
- `design:accessibility-review` on `/` in list and map modes and on `/r/[code]`.

## Risks

- `leaflet.markercluster` is an imperative plugin and React 19 strict mode double-mounts effects; test for duplicated layers on route change.
- Switching map mode to the URL changes `BoardFilters` consumers (`boardFiltersToSearch`); keep the new param out of `boardKeys` so the list and map caches aren't invalidated by it.
- The activity strip adds two public counts. Make sure they only read the same rows the board already exposes (`reports_view`), never `reports`.
- Hiding the emergency aside below `xl` was probably a space decision; check no one relies on it before moving it.

## Open questions

1. Should the status shapes (square, diamond) be visible in the public legend, or is colour + glyph enough?
2. Is the OSM tile server acceptable for the expected production traffic, or should the deployment use another tile provider?
3. Do residents want photos on board cards? It needs a `reports_view` change, so it is a separate, migration-backed spec.
4. Should the code lookup live on the board, on `/me`, or only on `/me`?

## Later

Photo thumbnails (migration + test); "Fixed this month" counters per barangay on `/about`; a Messenger share image (Open Graph) for `/r/[code]`; a "Look up" entry in the header.
