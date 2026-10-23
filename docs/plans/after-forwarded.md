# Plan: what happens after a Report is Forwarded

Status: proposed, 2026-10-19. Nothing here is built yet.

## Why

Today a Report sits in Forwarded until a Volunteer marks it Resolved. Nothing records what the office said, nothing says when a reply is due, and `create_digest` only picks Published and Reopened Reports, so there is no follow-up letter. The Philippine projects closest to ours (Check My School, Bantay Lansangan) stalled at this exact step: offices did not answer and volunteers did not chase them. Járókelő, the closest working twin, tracks "waiting for answer", "waiting for fix" and "unsolved" and chases on a legal deadline. Evidence: `docs/research/sumbong-prior-art.md` §0, §3.4, §6, §7.

Goal: every Forwarded Report always shows one of three things, to Volunteers and to the public:
- we are **waiting** for the office, with a date the reply is due;
- the office **replied**, and what it said;
- the office is **overdue**, and what we did about it (follow-up, then escalation).

## Decision: Office Replies are records, not new statuses

Recommended: keep the six statuses. Add an **Office Reply** record and work out **Overdue** from dates.

- A reply can be "acknowledged", "scheduled for the 28th", "not ours" or "no budget". None of these is a fix, and a status per reply kind would multiply the transitions in `reports_before_update`, the board filters, the badges and the emails.
- "Not ours" already has a transition: Misroute (`mark_misroute`). "Office says it's fixed" already has one: `resolve_report`, ideally with an after-photo. A Volunteer still judges the fix (ADR 0001), so the office saying so is a reply, not a resolution.
- The Scorecard stays as defined in `CONTEXT.md`: Forwarded to final Resolved. Replies don't stop the clock.

Alternative, if you'd rather see it on the board: one new status `acknowledged` between Forwarded and Resolved. It costs a trigger change, a badge, a filter value, two message keys per language and an email. I'd add it later only if residents ask for it.

## New domain terms (add to CONTEXT.md)

- **Office Reply**: what a Responsible Office said about one or more Forwarded Reports, logged by a Volunteer with the date, how it came (letter, text, call, in person, email, social media) and a short public summary. The kinds are acknowledged, scheduled (with a date), says fixed, not ours, declined and other. The summary names offices and positions, never people. _Avoid_: Response, Acknowledgement.
- **Reply-by Date**: the date a Digest asks the office to answer by. It is the send date plus the office's **Reply Days**, counted in working days. Reply Days come from the office's Citizen's Charter or RA 11032 processing time where one applies, and are printed in the letter with that basis.
- **Overdue**: a Forwarded Report whose Reply-by Date has passed with no Office Reply since, or whose scheduled date has passed with no fix. It is worked out from dates, never stored as a status.
- **Follow-up**: a Digest that sends Overdue Reports to the same office again. It does not change their status and does not reset the Scorecard clock.
- **Escalation**: a Digest that takes Reports a Follow-up didn't answer past the office: to 8888, ARTA or the Office of the City Mayor. Only a Coordinator can send one.
- **Digest** gains a kind: new, follow-up or escalation.

Record the decision in `docs/adr/0004-office-replies-not-statuses.md`.

## Database

Three new migrations. Don't edit the existing ones; `20261019000100_hardening.sql` is still uncommitted, so the new files sort after it.

### `20261019000200_after_forwarding_types.sql`

New enum values get a file of their own. Postgres won't let a transaction use an enum value it just added, and `supabase db push` runs each file in one transaction.
- `alter type report_event_kind add value` `'office_replied'`, `'followed_up'`, `'escalated'`.
- `create type digest_kind as enum ('new', 'follow_up', 'escalation')`.
- `create type office_reply_kind as enum ('acknowledged', 'scheduled', 'says_fixed', 'not_ours', 'declined', 'other')`.
- `create type reply_channel as enum ('letter', 'text', 'call', 'in_person', 'email', 'social_media', 'other')`.

### `20261019000300_after_forwarding.sql`

**Offices**
- `responsible_offices.reply_days smallint not null default 7 check (reply_days between 1 and 60)`.
- `responsible_offices.reply_basis text`, printed in the letter, e.g. "Citizen's Charter, complex transaction: 7 working days (RA 11032 s.9(b))".
- Seed values:

  | Office | Reply Days | Basis |
  | --- | --- | --- |
  | CEO | 7 | Charter enrolls road clearing, de-clogging and lighting repair as Complex |
  | CENRO | 3 | Charter "Filing of Complaint" is Simple |
  | CELCOR | 7 | BetterCabanatuan default (private utility, not covered by RA 11032) |
  | DPWH-NE2 | 7 | RA 11032 complex default |
  | BARANGAY | 7 | RA 11032 complex default |

  Coordinators edit these in `/v/settings/offices`.

**Working days**
- `add_working_days(d date, n int) returns date`, immutable, skips Saturdays and Sundays. Holidays are ignored for now, which errs in the office's favour by at most a few days. Dates are taken in Asia/Manila.

**Digests**
- `digests.kind digest_kind not null default 'new'`.
- `digests.reply_by date`, set by `send_digest`.
- `digests.escalated_to text` (e.g. "8888 Citizens' Complaint Center"), required when kind = escalation.

**Office Replies**

```sql
create table public.office_replies (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  office_id uuid not null references public.responsible_offices (id),
  digest_id uuid references public.digests (id) on delete set null,
  kind public.office_reply_kind not null,
  channel public.reply_channel not null,
  replied_on date not null,
  scheduled_for date,                 -- required when kind = 'scheduled'
  summary text not null check (char_length(summary) between 1 and 500),
  proof_path text,                    -- photo/scan of the reply, private bucket
  logged_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check ((kind = 'scheduled') = (scheduled_for is not null))
);
```

- RLS: anyone can read replies of Reports with a public status (same rule as `report_photos`); Volunteers read all; no direct writes. `proof_path` stays in the private bucket.

**Where each Forwarded Report stands**

Append columns to `reports_view`. `create or replace view` can only add columns at the end.
- `last_sent_at`: latest sent Digest of any kind that contains the Report, for its current office.
- `reply_by`: that Digest's `reply_by`.
- `last_reply_kind`, `last_replied_on`: the latest Office Reply for the current office.
- `follow_ups`: the number of sent follow-up Digests since `first_forwarded_at`.
- `due_on`:
  - no reply since `last_sent_at` → `reply_by`;
  - reply kind scheduled → `scheduled_for` + 7 days;
  - acknowledged, says_fixed or other → `replied_on` + 30 days;
  - declined → null (a Coordinator decides; see `waiting_state`).
- `waiting_state`, null unless the status is Forwarded:
  - `awaiting_reply`: no reply yet, not past `due_on`.
  - `replied`: replied, not past `due_on`.
  - `overdue`: today is past `due_on`.
  - `declined`.

Also add a security-invoker view `overdue_by_office` (office, barangay, count) for the Digests page.

**Functions** (all SECURITY DEFINER, gated like the existing ones)

- `create_digest(p_office_id, p_barangay_id default null, p_kind digest_kind default 'new')`. Drop and recreate it and re-grant, the way the hardening migration handled `add_me_too`.
  - `new`: today's behaviour.
  - `follow_up`: Forwarded Reports for this office (and barangay) whose `waiting_state = 'overdue'`.
  - `escalation`: `require_coordinator`. Overdue Forwarded Reports with `follow_ups >= 1` whose latest follow-up `reply_by` has passed with no reply.
  - All kinds skip Reports already in another unsent Digest, as today.
- `send_digest(...)` gains `p_escalated_to text default null`. It sets `reply_by = add_working_days(p_sent_at::date, n)`, with n = the office's `reply_days`, or 3 for escalations (8888's 72-hour rule).
  - `new`: unchanged; Reports move to Forwarded.
  - `follow_up` / `escalation`: the drop-stale step keeps only Reports still Forwarded to this office. Status stays the same, and each Report gets a `followed_up` or `escalated` event.
- `log_office_reply(p_report_ids uuid[], p_kind, p_channel, p_replied_on, p_summary, p_scheduled_for default null, p_digest_id default null, p_proof_path default null) returns setof uuid`.
  - Volunteer only.
  - Every Report must be Forwarded to the same office. One letter from the office often answers a whole Digest, hence the array.
  - Inserts one row per Report and logs `office_replied` with the summary as the note.
  - Refuses a `replied_on` in the future or before the Report's `first_forwarded_at`.
  - Doesn't change status. The UI follows up: `not_ours` opens the Misroute form, `says_fixed` opens Resolve.
- `require_coordinator()` helper, next to `require_volunteer()`.

### `20261019000400_office_contacts.sql`

Corrects and fills office contacts from `docs/research/office-contacts.md` §11. Each value gets its source in a SQL comment. It contains:
- `update responsible_offices` for CEO, CENRO, CELCOR and DPWH-NE2, with the values in [Office contacts](#office-contacts) below;
- `responsible_offices.facebook_url text`, for CELCOR's page today, and others as Coordinators find them;
- a new `PRIMEWATER` office and, in a later pass, a "Water leaks" Category routed to it;
- the `poles-wires` urgent notice naming CELCOR's 24/7 mobile lines, in both `en` and `fil`.

Barangay hall contacts are left out: no source lists any. Coordinators add them after the 2 Nov 2026 barangay elections. That needs `barangays.hall_email` / `hall_phone` / `hall_facebook` plus a Coordinator update policy, and can be its own small migration then.

## App

**Volunteer screens (English only)**
- `/v/digests`:
  - an "Overdue" count per office, from `overdue_by_office`, with a "Create follow-up" button next to "Create Digest";
  - Coordinators also see "Escalate" when eligible;
  - the list shows each Digest's kind and Reply-by Date.
- `/v/digests/[id]`:
  - after sending, the page shows the Reply-by Date and a **Log office reply** form for the whole Digest, with a checkbox per Report and all ticked by default;
  - the send form for escalations asks for "Escalated to".
- `/v/digests/[id]/letter`, one template per kind:
  - **New**: adds "Under {reply_basis}, we respectfully ask for an update by {reply_by}."
  - **Follow-up**: "On {first sent date} we sent you {n} reports (received by your office on {date}, if Proof of Receipt exists). We have not received an update on the following…", listing each Report with its first-sent date and days waiting, and a new Reply-by Date.
  - **Escalation**: addressed to `escalated_to`. A factual timeline per Report: sent, received, followed up, no reply as of today. Same neutral tone, no accusations (the Review rule).
- `/v/reports`: a filter for `waiting_state` (Overdue first) and columns for due date and follow-ups.
- `/v/reports/[id]`: a "Log office reply" form, and the Office Replies in the timeline.
- `/v/settings/offices`: edit `reply_days`, `reply_basis` and `facebook_url`; barangay contacts if added.
- `src/app/v/actions.ts`: `logOfficeReply`, plus `createDigest` and `sendDigest` taking a kind. `src/lib/digests.ts` loads the earlier Digests per Report for follow-up letters.

**Resident screens (fil + en, same keys)**
- `/r/[code]` timeline:
  - "Followed up with {office}"
  - "Escalated to {escalated_to}"
  - "{office} replied: {summary}", with "scheduled for {date}" when present
- `/r/[code]` status line under Forwarded:
  - replaces the current "waiting N days" with "Waiting for {office}'s reply, requested by {reply_by}";
  - or "No reply from {office} after {n} working days. We followed up on {date}."
- `src/lib/notify.ts`: new notices `office_replied` and `escalated`, with `email` keys in both message files. Follow-ups don't email, to cut noise.
- Board: leave unchanged in this pass. An "Overdue" chip on cards can come later with public counts.

## Tests (`npm test`, PGlite)

New file `tests/db/after-forwarding.test.ts`. It backdates sends through `send_digest(p_sent_at => …)`.
- `add_working_days`: Friday + 1 = Monday; Wednesday + 7 = the next Friday but one.
- `send_digest` (new) sets `reply_by`; `waiting_state` is `awaiting_reply`, then `overdue` once backdated past it.
- `create_digest('follow_up')`:
  - takes only Overdue Forwarded Reports and raises `nothing_to_send` when there are none;
  - skips Reports with a reply after the last send.
- Sending a follow-up:
  - status stays Forwarded and `first_forwarded_at` doesn't change;
  - logs `followed_up`, gives a new `reply_by`, and `follow_ups = 1`.
- Escalation:
  - a plain Volunteer gets 42501;
  - it is refused with no prior follow-up;
  - it requires `escalated_to`.
- `log_office_reply`:
  - refused for an anonymous caller, for Reports that aren't Forwarded, for mixed offices and for future dates;
  - `scheduled` without a date fails the check;
  - a reply moves `waiting_state` to `replied`, and a lapsed `scheduled_for` makes it `overdue` again.
- RLS: anon reads a reply on a Forwarded Report, but not on a Rejected one, and never sees `proof_path` objects.
- Misroute after a reply: the new office starts clean (`waiting_state` follows the current office only).
- Contacts migration: spot-check the seeded values.
- `src/messages` key-parity test still passes.

## Order of work

1. ADR 0004 and the `CONTEXT.md` terms. Agree on the names before the code.
2. The types migration, then the logic migration, with the tests alongside.
3. The contacts migration, once `docs/research/office-contacts.md` lands.
4. Volunteer screens: Digest kinds, letters, the reply form and the overdue filter.
5. Resident timeline, status line, messages and emails.
6. A short Volunteer runbook in `README.md`:
   - check Overdue weekly;
   - follow up once;
   - a Coordinator escalates after the second Reply-by Date passes;
   - a public post is the last step, and stays neutral.

## Not in this plan

These are from the same research, left for later:
- "Ako rin" residents becoming Followers;
- Followers confirming a fix from the Resolved email;
- public counts and the Scorecard;
- Volunteer shifts and queue ownership;
- a shutdown plan for the domain.

## Open questions

1. Reply Days for CELCOR, DPWH and barangays: is a flat 7 working days fine to start?
2. Escalation targets: 8888 and the Mayor's Office for City offices. For CELCOR, its regulator (the ERC's consumer channel) needs research first.
3. Should Office Reply summaries be public word for word, or Volunteer-paraphrased only? The plan assumes paraphrased, with no names.

## Office contacts

From `docs/research/office-contacts.md`, retrieved 2026-10-19. That file has the sources, the verification status of each value, and the exact old and new SQL values (§11).

**Responsible Offices**

| Office | Email for Digests | Phone | Address | Change from today's seed |
| --- | --- | --- | --- | --- |
| CEO | `cabanatuan.lgu@gmail.com` (Office of the City Mayor; the CEO publishes no email) | 0919-081-3694 (CEO's own line) | CEO Bldg., City Hall Compound, Kapitan Pepe Subd. Phase II, Cabanatuan City 3100 | Address; `channel` now says the email is the Mayor's and adds "advance copy to the CEO" (Charter pp.143-146) |
| CENRO | `cabanatuan.lgu@gmail.com` (Mayor's Office; complaints go through the Mayor, Charter p.140) | 0919-081-4509 | 2nd Floor, City Hall, Kapitan Pepe Subd. Phase II, 3100 | `name_en` becomes "Cabanatuan City ENRO" (avoids DENR's CENRO); address; `channel` notes the valid-ID requirement |
| CELCOR | `ask.celcor@gmail.com` | 24/7: (044) 463-0811, 463-7398, 600-2414, 463-0505; Globe 0966-980-2280; Smart 0968-246-0131 | Maharlika Highway, Brgy. Bitas, Cabanatuan City 3100 | Email and phone were empty; address verified; attention becomes "Engineering & Design Services Department" |
| DPWH-NE2 | `tolentino.cyrone_kevin@dpwh.gov.ph` (the District Engineer's own address; he is officer-in-charge) | (044) 311-8476 | Brgy. San Isidro, Cabanatuan City, Nueva Ecija | Email was empty |
| BARANGAY | none found | none found | per barangay | No change |
| PRIMEWATER (new) | `primewatercabanatuan@primewatercorp.com` | (044) 463-1646 | #229 CVR, Brgy. Dicarma, Cabanatuan City 3100 | New row |

**Escalation targets** (for Escalation Digests; not Responsible Offices, so they go in a short list in the letter template or a small `escalation_targets` table)

| Target | Email | Phone | Use for |
| --- | --- | --- | --- |
| 8888 Citizens' Complaint Center | `8888complaint@op.gov.ph` (newer than the Charter's `pcc@malacanang.gov.ph`) | 8888 | City offices, DPWH; 72-hour action rule |
| ARTA | `complaints@arta.gov.ph` | 0928-690-4080, 0969-257-7242 (the Charter's 8-478-5093 is stale) | Charter processing times not met |
| Office of the City Mayor | `cabanatuan.lgu@gmail.com` | 0919-081-3749; complaint desk text 0917-813-3247 | First escalation step for CEO and CENRO |
| DILG Nueva Ecija | `dilgr3nuevaecija@gmail.com` | 044-940-0616 | Barangays that don't answer |

**Rules for the migration**
- **Keep titles, not names, in `letter_addressee`** ("The Honorable City Mayor", "The District Engineer"). Names go stale. The barangay elections are on 2 Nov 2026, the next city elections in 2028, and DPWH's head is officer-in-charge. Use the full Charter addresses.
- **The DPWH email is personal to the officer-in-charge.** Seed it, and have `/v/settings/offices` show a "last verified" date (`responsible_offices.contacts_verified_on date`) so Coordinators re-check it.
- **CDRRMO 0908-881-1010 is confirmed**, so no change to the emergency copy.
- Unverified values (three Punong Barangay mobiles from an unreachable directory) are not seeded.
