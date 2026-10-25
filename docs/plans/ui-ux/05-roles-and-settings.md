# Spec 5: roles, users and settings screens

Status: proposed, 2026-10-25. Read [`00-overview.md`](00-overview.md) first. Land spec 1 first: it fixes the empty states, the Offices Channel clamp and the Users search field, and this spec does not repeat them.

## Role

- **Executor**: a frontend engineer. No SQL: the rules that matter here already live in the database, and this spec must not weaken or duplicate them.
- **Skills**: `impeccable` (clarify, harden), `shadcn` (`alert-dialog`, `accordion`, `tabs` are installed), `design:accessibility-review` (the matrix is a dense control and the most likely place to fail a keyboard or screen-reader test), `design:ux-copy` for the confirmation wording.
- **Users affected**: Coordinators (they own Roles, Users, Categories, Offices); Volunteers with narrower roles see these pages read-only or not at all.

## Context

The settings area is where a mistake costs the most: a wrong checkbox can lock a Volunteer out of Review, or give someone the power to remove others' access. The matrix of areas × actions is already careful. It shows a dash for actions an area doesn't have, turns View on when any action is checked, clears the row when View is turned off, has select-all on every row and column, shows "N of M permissions", and explains each permission in a details block. The database blocks the dangerous cases (nobody can change their own role, give permissions they don't hold, or remove the last active holder of `roles.edit`).

What is missing is mostly orientation and safety nets around that control: you can't start from a similar role, you can't see in one line what a role will not be able to do, the 720px table is a sideways scroll on a phone, and removing someone's access is one dropdown choice and a Save.

## Goals

1. Creating a role is "start from one that's close, then adjust", not 40 checkboxes.
2. Before saving a role or removing someone's access, the Coordinator sees what will change.
3. The role editor works on a phone.
4. Nothing here changes which action the database allows.

## Non-goals

- Making the Coordinator role read-only or "system". One research source suggests this to prevent lockout; the database already prevents the real risk (last holder of `roles.edit`), and a read-only Coordinator would stop the team from tuning its own permissions. Not adopted.
- Adding permissions, areas or actions (they come from the `permissions` table; changing them is a migration with a test in `tests/db/permission-matrix.test.ts`).
- Per-user permission overrides.
- An audit-log screen.

## Already built (extend, don't add)

| Capability | Where |
| --- | --- |
| Dash for actions an area doesn't have, with an `aria-label` | `permission-matrix.tsx` |
| Checking any action turns on View; unchecking View clears the row | `update()` in the same file |
| Select-all per row and per column, `N of M permissions` | same file |
| "What each permission allows" details | same file |
| Your own role flagged, warning when editing it | `roles/[id]/page.tsx` (`isMine` alert, "Your role" badge) |
| Delete blocked while people hold the role, with the reason | `roles/[id]/page.tsx` |
| "People with this role" list | same file |
| Role picker offers only what the viewer may grant; "No access" = Archive permission | `AccessControl` in `users/page.tsx` |
| Invitations list with resend | `users/page.tsx` (`DataView` with `empty="No invitations."`) |
| Pending invitations kept separate from accounts, Volunteers / All accounts tabs, search with an accessible label | `users/page.tsx` |
| Database rules: no self role change, no escalation, last `roles.edit` holder protected | stated in `README.md`; the `roles.edit` rule is in `supabase/migrations/20261020000100_permission_matrix.sql` (check `20261020000200_audit_fixes_logic.sql` for later changes before relying on exact wording); tests in `tests/db/{roles,permissions,permission-matrix}.test.ts` |

## References

- WorkOS RBAC: https://workos.com/docs/rbac/configuration (roles as named bundles of stable permission slugs; a default role can't be deleted)
- GitHub custom repository roles: https://docs.github.com/en/organizations/managing-peoples-access-to-your-organization-with-roles/about-custom-repository-roles (start from a base role, add only what's missing)
- Linear members and roles: https://linear.app/docs/members-roles (few named roles; pending invites as part of the member list)
- shadcn data table: https://ui.shadcn.com/docs/components/radix/data-table (rounded wrapper, column controls)
- NN/g placeholders: https://www.nngroup.com/articles/form-design-placeholders/ (visible labels)
- NN/g empty states: https://www.nngroup.com/articles/empty-state-interface-design/
- Not opened, so unsourced: Notion, Vercel, Stripe, Clerk, Auth0 role UIs; any specific mobile treatment of a permission grid.
- Repo: `src/components/volunteer/permission-matrix.tsx`, `src/lib/permissions.ts`, `src/app/v/settings/{roles,users,offices,categories}/**`, `src/app/v/actions.ts` (`saveRole`, `deleteRole`, `setUserAccess`, `inviteVolunteer`), `tests/db/permission-matrix.test.ts`, `CONTEXT.md` (Role, Permission, Volunteer Invitation)

## Tasks

### Task 1: "Start from" an existing role

**Files**: `permission-matrix.tsx`, `src/app/v/settings/roles/[id]/page.tsx`.

1. Pass the other roles (`id`, `name`, `permissions`) into the editor. The page already queries `roles` for the list page; add the same select to the detail page (one extra query).
2. Above the grid, a `NativeSelect` labelled "Start from": "Blank", then each existing role by name. Choosing one replaces the selection with that role's permissions (client state only) and shows "Copied from {role}. Adjust, then save." A role being edited can't be its own source.
3. Don't hard-code "Volunteer"/"Coordinator"/"Read-only": the migrations seed two roles, and Coordinators can rename or delete them.
4. If the user has edited the grid, ask before overwriting ("Replace your changes?") with the `AlertDialog` that's already installed.
5. New role default (currently `reports.view`, `digests.view`) stays when "Blank" is chosen.

**Acceptance**: with the two seeded roles, "Start from: Coordinator" checks every cell; the form then submits exactly the checked set (`permissions` hidden inputs), and the database still enforces its own rules (try granting beyond your own role; the action must fail with the existing message).

### Task 2: group the rows, mark the risky columns

1. Group the six areas into three bands with a small label row each: **Work** (Reports, Digests), **Setup** (Categories, Responsible Offices), **Access** (Users, Roles). The grouping lives in `permissions.ts` beside `PERMISSION_AREAS` (add a `group` field), not in the component.
2. Put a visible separator (a 2px `border-l`) before the **Delete** and **Archive** columns and give their header a muted warning tint using a theme token (`bg-destructive/10`, not raw red), so the destructive actions read as a block.
3. Keep the sticky first column and the `aria-label`s. Do not change tab order or the checkbox semantics.

### Task 3: a phone layout

The grid is `min-w-[720px]` inside `overflow-x-auto`: usable with a thumb-scroll, but hard to read and easy to miss a column.

1. Below `md`, render each area as an `Accordion` item: header "Reports · 4 of 5", content a wrapped list of labelled checkboxes ("View", "Review", "Edit", "Archive", "Export"), 44px high. Use the same `update()` so the View rule still applies, and render only the cells that exist (no dashes needed).
2. Keep the table at `md` and up. Don't render both at once: choose with a CSS breakpoint class pair (`hidden md:block` / `md:hidden`) and make sure the hidden copy doesn't submit duplicate `permissions` inputs (render the hidden inputs once, outside both).
3. Select-all per area is a checkbox in the accordion header, labelled "Everything in {area}".

**Acceptance**: at 390px every permission is reachable without horizontal scroll; the submitted set is identical to the desktop grid for the same clicks; only one set of hidden inputs exists in the DOM.

### Task 4: say what the role can't do, and what will change

1. **"Cannot" summary** under the count: "This role cannot: delete Digests, archive Reports, manage Roles." Built from unchecked cells that exist, grouped by area, collapsed to the first three with "and N more". It's text, not red; the point is to make exceptions visible.
2. **Pending changes** (edit mode only): compare the current selection with the saved set and show "Adding: Export Reports. Removing: Send Digests." above the Save button, with `aria-live="polite"`. If the role has people (`members.length > 0`) add "This affects {n} people now." Hide it when nothing changed.
3. Warn when the edit would remove the viewer's own access to this page (the current `isMine` alert covers the generic case; make it specific: "You'll lose: Edit roles."). The database refuses to remove the last `roles.edit` holder; surface that error text as it comes back, don't pre-empt it in the UI.

### Task 5: removing access is not a quiet dropdown

**File**: `users/page.tsx` (`AccessControl`).

1. Show the **Save** button only when the select differs from the current role (a tiny client wrapper; the form stays a server action). It prevents the "I changed it, did it save?" doubt.
2. Choosing **No access** for an active Volunteer opens an `AlertDialog` before submitting: "Remove {name}'s access? They'll keep their account and their own Reports, but lose the Volunteer console. You can give a role back later." Buttons "Remove access" (destructive) and "Cancel". Changing between two roles needs no dialog.
3. Add a status badge to each row that already exists conceptually: **Active** (`account.active`), **Invited** (pending invitation list), **No access**. Currently active accounts show only the role badge; keep it, add the status text for no-access ones (already present) and the invited ones.
4. Pending invitations: label the resend action's result ("Invitation sent again to {email}") and show how long ago it was last sent; the sent-again feature exists (`20261023000200_invitation_resend.sql`), the feedback may not.
5. Below `md`, stack the select, the Save button and the status badge in one column; the current `flex-wrap` row already wraps, so check rather than rewrite.

### Task 6: Offices and Categories forms

1. **Offices** detail: the "Official channel" `Textarea` has no hint. Add a `FieldDescription`: "How a Digest reaches this office, as a Volunteer would say it: letter to whom, text line, email. This prints in the Digest letter." Confirm what the letter actually prints (`src/app/v/digests/[id]/letter/page.tsx`) before writing "prints".
2. Add a character count and a soft limit of 300 (counter only; don't change the database).
3. Show the clamp from spec 1 in the list, and the full text in the form.
4. **Categories**: audit the detail form (207 lines) for visible labels and for hints on the Category Question editor; fix only what is clearly missing, and list the rest in the PR.

## Copy deliverables

All inline English (volunteer screens are English-only): "Start from", "Copied from {role}. Adjust, then save.", "Replace your changes?", "This role cannot: …", "Adding: … Removing: …", "This affects {n} people now.", "Remove {name}'s access?", "Invitation sent again to {email}.", the Offices channel hint.

## Testing and verification

- `npm test`, `npm run lint`, `npm run typecheck`. No database change is planned, so no new SQL test; if one becomes necessary, add it to `tests/db/permission-matrix.test.ts` first.
- Component checks (manual or with Playwright): copy-from fills the grid; unchecking View clears the row on both layouts; submitted `permissions` equals the visible state; the Save button appears only on change; the No-access dialog traps focus and returns it to the select.
- Run the scenario "a role without `users.archive` opens Users": the select must not offer No access, as today.
- Screenshots at 1280 and 390px: new role, edit role with changes, Users with the dialog open, Offices form.
- `design:accessibility-review` on the role editor at both widths, with a screen reader on the accordion.

## Risks

- Two renderings of one control (table and accordion) can drift. Keep one `update()` and one source of selected state; test both.
- The pending-changes text depends on saved vs unsaved state; after a successful save the page revalidates, so make sure the "saved" set comes from props, not a stale client copy.
- Presets copied from a role that the viewer may not grant in full will be rejected by the database (it blocks escalation). Show the returned error; consider marking cells the viewer can't grant as disabled once the database exposes that (not today).

## Open questions

1. Do Coordinators want named, built-in presets (for example "Reviewer", "Digest sender") in addition to copying from existing roles?
2. Should deleting a role with people in it offer "reassign to…" instead of refusing? Today it refuses; a reassign flow would need a server action and a test.
