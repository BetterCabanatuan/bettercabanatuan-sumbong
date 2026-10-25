# Spec 1: polish, status badges and empty states

Status: proposed, 2026-10-25. Read [`00-overview.md`](00-overview.md) first.

## Role

- **Executor**: a frontend engineer (agent or human) comfortable with Tailwind 4, shadcn on Base UI and next-intl. No SQL.
- **Skills**: `impeccable` (harden, clarify), `shadcn`, `design:ux-copy`, then `design:accessibility-review`.
- **Users affected**: Volunteers and Coordinators (console copy, empty states, tables); Reporters and visitors (status badge, emergency banner, header).

## Context

The first screenshot pass found the same small faults on most screens: bare empty states, a table column that overflows, a cut-off placeholder, Filipino status badges inside the English-only console, badges that rely on colour alone, and a `/report` page whose title looked hidden behind the sticky header. None needs new data or new rules; they are the cheapest way to lift every screen. Spec 1 also lays the shared pieces (status icons, `DataView` empty and clamp props) that specs 2–5 reuse.

## Goals

1. Every empty list tells the Volunteer what the list is, why it is empty, and what to do next.
2. No table clips or scrolls sideways because of one long field.
3. A status is recognisable without colour, and reads in the language of the screen it is on.
4. Resident screens show the emergency number where someone in danger will see it first.
5. The `/report` header overlap is either fixed or proven not to exist.

## Non-goals

- Dark mode. It is not reachable today (see task 4), so this spec only keeps the tokens complete.
- Redesigning the permission matrix or the Users page layout (spec 5).
- New dashboard content (spec 3).
- Changing the flag stripe. That is a brand decision, tracked as an open question in the overview thread.

## Already built (extend, don't add)

- `src/components/ui/empty.tsx` exists and `review/page.tsx` uses it; `DataView` still renders a bare `<p>` in a `Card`.
- The Users search input already has an accessible label; only its visible placeholder is cut off.
- `StatusBadge` already uses the `status-*` token pairs with sufficient text contrast. The research measured 5.76–7.68:1 for text on its own tint. Don't change the colours.

## References

- GOV.UK Tag: https://design-system.service.gov.uk/components/tag/ (sentence case, one colour per status everywhere)
- WCAG 1.4.1 Use of Color: https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html
- NN/g, Designing empty states: https://www.nngroup.com/articles/empty-state-interface-design/ (status, teach, direct path)
- shadcn Empty: https://ui.shadcn.com/docs/components/empty
- MDN `text-overflow`: https://developer.mozilla.org/en-US/docs/Web/CSS/text-overflow (needs `overflow:hidden` and `white-space:nowrap`)
- NN/g, Placeholders in form fields: https://www.nngroup.com/articles/form-design-placeholders/
- Repo: `src/components/status-badge.tsx`, `src/lib/status.ts`, `src/components/volunteer/data-view.tsx`, `src/app/globals.css`, `src/app/v/settings/users/page.tsx`, `src/app/v/settings/offices/page.tsx`, `src/components/site-header.tsx`, `src/components/report-form/report-form.tsx`

## Tasks

### Task 1: confirm or fix the `/report` header overlap

**Why**: In the full-page screenshot the title "Mag-sumbong" sat half under the sticky header, with an empty strip above the nav. Two research agents saw it too. Full-page capture of a `position: sticky` header is a known artefact, so it may not be real.

**Steps**
1. Run the dev server (own port, not 3000 if another project holds it): `npx next dev -p 3100`.
2. At 390×844 and 1280×800 open `/report`, scroll to the top, take a **viewport** screenshot (not full page). Then press "Susunod" through each step and screenshot the top of each step.
3. The form calls `top.current?.scrollIntoView({ block: "start" })` with `scroll-mt-24` on each step change (`report-form.tsx`). The header is `h-14` plus the stripe. Confirm `scroll-mt-24` (96px) clears it.
4. If the title is really clipped, fix by giving the sticky header's height a CSS variable and using `scroll-mt-[calc(var(--header-h)+1rem)]`, not a magic number.

**Acceptance**: a viewport screenshot at each step shows the step heading fully visible with 16px of air under the header. If nothing is wrong, record "not reproducible" in the PR and change nothing.

### Task 2: `DataView` empty state and column clamp

**Files**: `src/components/volunteer/data-view.tsx`, every caller (`grep -rn "<DataView" src/app`).

**Steps**
1. Change the `empty` prop from `ReactNode` to `{ title: string; description?: string; icon?: LucideIcon; action?: ReactNode } | ReactNode`. Render the object form with `Empty`, `EmptyHeader`, `EmptyMedia variant="icon"`, `EmptyTitle`, `EmptyDescription`, `EmptyContent`, inside the existing `Card`. Keep the ReactNode form working so callers migrate one by one.
2. Add `clamp?: number` to `DataField` (lines of text before truncation, default none). In the table layout render clamped values as `<span className="line-clamp-2 max-w-[28ch] break-words" title={plain text}>`. In the grid layout show the full value (cards have room). Keep `hideInList` as is.
3. Give the table wrapper `overflow-x-auto` as a safety net, and `table-fixed` only if every column has a width (otherwise leave auto layout).
4. On `/v/settings/offices` set `clamp: 2` on the `channel` field. Do the same for any long free-text field found in categories (`description`).
5. Migrate callers with new wording (table below).

| Screen | Title | Description | Action |
| --- | --- | --- | --- |
| Reports, no Reports at all | No Reports yet | Reports show up here once residents submit them from the public form. | "Open public form" → `/report` |
| Reports, a filter matched nothing | No Reports match these filters | Try a different Status, Office or Barangay. | "Clear filters" → `/v/reports` |
| Digests, nothing waiting | Nothing waiting for a Digest | A Digest takes every Published or Reopened Report for one Responsible Office. | none |
| Digests, no Digests | No Digests yet | The order is: draft, print the letter, send it, log the send. | none |
| Roles | No roles yet | A role is a set of permissions. Create one, then give it to a Volunteer when you invite them. | "New role" |
| Users, Volunteers tab | No Volunteers yet | Invite someone and choose their role. | none (form is above) |
| Users, All accounts | No accounts yet | People appear here after they sign in or accept an invitation. | none |
| Users, search found nothing | Nothing matches "{q}" | Check the spelling or search by email. | "Clear search" |
| Invitations | No pending invitations | | none |
| Offices | No Responsible Offices yet | Add the office a Report gets carried to, and how Volunteers reach it. | "New office" |
| Categories | No Categories yet | Residents choose a Category when they report. | "New Category" |

Distinguish "no data" from "no match" in each caller by checking whether a filter or search is active.

**Acceptance**: no list renders a bare `<p>`; the Offices table at 1280px has no horizontal scrollbar and shows ≤2 lines of Channel with the full text in the cell's `title` and in the grid layout; unit-render check with 0 items in each of the three layouts.

### Task 3: Users page: search field and Role select

**File**: `src/app/v/settings/users/page.tsx`

1. The placeholder reads "Search by email or na…" because the `Field` is squeezed beside the tabs. Make the search form `w-full sm:w-72` and the input `min-w-0 flex-1`; shorten the placeholder to "Search name or email". Keep the `sr-only` label.
2. The invite form's Role `NativeSelect` shows empty when no role is named "Volunteer". Add a disabled first option "Choose a role" (value `""`, `required`) so the control never looks broken. Don't change who can be given which role (the database enforces that).
3. Leave labels as they are; they are already visible.

**Acceptance**: at 1024px the search placeholder is fully visible; with zero roles the select reads "Choose a role"; submitting without a role is blocked by the browser.

### Task 4: status badge: icon, English labels, dark tokens

**Files**: `src/components/status-badge.tsx`, `src/lib/status.ts`, `src/app/globals.css`, the callers of `StatusBadge` under `src/app/v`.

1. **Icons**. Add `STATUS_ICON: Record<ReportStatus, LucideIcon>` to `status.ts`: `pending_review` → `Eye`, `published` → `Megaphone`, `forwarded` → `Send`, `resolved` → `CircleCheck`, `reopened` → `RotateCcw`, `rejected` → `CircleX`. Render it first in the badge with `aria-hidden` and `size-3`. The text label stays the accessible name. Spec 4 reuses this map for the timeline.
2. **English in the console**. The console shows "Sinusuri", "Na-publish"… because `StatusBadge` reads the cookie locale. Add an optional `locale?: "en"` prop **or** a `ConsoleStatusBadge`. Recommended: a `STATUS_LABEL_EN` constant in `status.ts` built from `import en from "@/messages/en.json"` (`en.status`), and `StatusBadge` takes `labels?: "en"` so the console passes `labels="en"` and never touches next-intl. This keeps the console independent of the visitor's language, per `AGENTS.md`. Update every use under `src/app/v` and `src/components/volunteer`.
3. **Border**. Add `border border-current/30` to the badge so a pale tint is still visible on a white card (the forwarded tint is only 1.15:1 against white).
4. **Dark tokens**. `.dark` in `globals.css` defines none of `--status-*`. Dark mode is not reachable today (there is no `ThemeProvider`; `next-themes` is only imported by `sonner.tsx`, and `Providers` hard-codes `theme="light"`), so this is a guard, not a visible change. Add dark pairs (tint ≈ 18% of the foreground over `--card`, foreground a lightened version) for all six statuses, and check each at ≥4.5:1. If you'd rather not carry unreachable CSS, skip this sub-task and note it in the PR.
5. Sentence case only, no `uppercase`.

**Acceptance**: every badge in `/v` reads English; every badge has an icon; the six statuses are distinguishable in a greyscale screenshot; the colour pairs are unchanged in light mode.

### Task 5: emergency banner on `/report`

**Files**: `src/components/report-form/report-form.tsx`, `src/messages/{fil,en}.json`.

The number already appears in the footer and on the board ("Emergency?" card, `board.emergency`). On `/report` it is below the fold, and a person reaching the form from a link never sees it before typing.

1. Above the progress bar, only on the `location` step, render an `Alert variant="destructive"` with a `TriangleAlert` icon: title "Emergency?", text "Live wires, fire or flooding with people in danger: call CDRRMO now. Don't use this form." and a `tel:09088811010` link styled as a button ("Call 0908-881-1010"), 44px tall.
2. Reuse the existing key `reportForm.urgent` for the title where it fits; add `reportForm.emergency.{title,body,call}` in both locales. Filipino copy to be written with `design:ux-copy`; keep "CDRRMO" and the number unchanged.
3. Do not block the form. Do not repeat the banner on later steps (the Category step already shows the per-Category `urgent_notice`).

**Acceptance**: at 390px the number is visible without scrolling on step 1; tapping it opens the dialler on a phone; fil/en key parity test passes.

### Task 6: footer credit contrast

`site-footer.tsx` small print (OCHA/HDX, PSGC) is very low contrast on the navy. Raise to the same token as the footer body text, or at least 4.5:1. Verify with the accessibility skill's contrast check.

## Copy deliverables

New or changed resident keys: `reportForm.emergency.title`, `.body`, `.call`. Console strings are inline English (table above, plus "Choose a role", "Search name or email").

## Testing and verification

- `npm test`, `npm run lint`, `npm run typecheck`.
- Add a render test for `DataView` empty (all three layouts) if the repo has a component-test setup; if not, don't introduce one here, verify by screenshot.
- Screenshot list, before and after, 1280px and 390px: `/v` dashboard, `/v/reports` (empty and with a filter), `/v/digests`, `/v/settings/{users,roles,offices,categories}`, `/report` step 1.
- Run `design:accessibility-review` on `/report` step 1 and `/v/settings/offices`.

## Risks

- Changing `DataView`'s `empty` prop type touches every caller; keep the old form working for one release.
- `STATUS_LABEL_EN` imports the whole `en.json` into a client bundle if the badge is a client component. `StatusBadge` is currently server-rendered; keep it that way, or import only `en.status` via a small generated file.
- A border on every badge may look heavy in dense tables; compare at 100% zoom before committing.

## Open questions

1. Keep or drop the red/blue flag stripe? One research agent says it can read as "official". This spec assumes it stays.
2. Should the console badge say "In review" (matches `en.json`) or "Pending review" (matches the enum)? Default: `en.json` wording.
