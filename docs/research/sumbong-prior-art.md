# Prior art for Sumbong: who else carries residents' reports to the office that can fix them?

Retrieved 2026-10-19. Scope: platforms in the Philippines and elsewhere whose purpose overlaps with Sumbong · BetterCabanatuan, especially **non-government intermediaries** (charities, NGOs, volunteer groups, media) that take citizen reports and push them to the Responsible Office, instead of being the office's own system. This doc compares each one against what Sumbong actually implements today.

It builds on [`civic-reporting-platforms.md`](civic-reporting-platforms.md) (2026-10-18), which already covers SeeClickFix, Open311, FixMyStreet's technical model, MyNaga, QC iReport, 8888, eGovPH, Cabanatuan's official channels, PH law and the routing table. That doc is cited here as **[CRP §n]**, and its ground is not repeated.

How to read this: every claim carries the URL it came from. **Primary** means the operator's own site, code, data, store listing or annual report, an official issuance, or a peer-reviewed paper. Claims backed only by news, Wikipedia, blogs or search-result summaries are tagged **(secondary)** and collected again under [Unverified / low-confidence](#8-unverified--low-confidence). Comparison-table cells don't repeat URLs; each cell's source is in the platform's own section (§4, §5). Where a fetch failed, it says so.

## Contents

0. [Verdict](#0-verdict)
1. [What Sumbong implements today (from the code)](#1-what-sumbong-implements-today-from-the-code)
2. [Platforms at a glance](#2-platforms-at-a-glance)
3. [Feature-by-feature comparison](#3-feature-by-feature-comparison)
   - 3.1 [Matrix A: intermediaries](#31-matrix-a-non-government-intermediaries)
   - 3.2 [Matrix B: Philippine government and media channels](#32-matrix-b-philippine-government-and-media-channels)
   - 3.3 [Where each beats us, where we beat it](#33-where-each-beats-us-where-we-beat-it)
   - 3.4 [What to copy, ranked](#34-what-to-copy-ranked)
4. [Philippine platforms (new ground)](#4-philippine-platforms-new-ground)
5. [Global platforms (new ground)](#5-global-platforms-new-ground)
6. [The volunteer-intermediary model](#6-the-volunteer-intermediary-model)
7. [What we already do well, gaps, things to avoid](#7-what-we-already-do-well-gaps-things-to-avoid)
8. [Unverified / low-confidence](#8-unverified--low-confidence)

---

## 0. Verdict

**For Cabanatuan: no. Nobody is doing this, properly or otherwise.**
- The City has no online reporting channel [CRP §5].
- No LGU in Nueva Ecija has a reporting app in either app store (searched 2026-10-19; §4.9).
- No Philippine non-government group runs a public board of public-space Reports that it forwards and tracks (§4).
- The Philippine intermediaries that exist fall into two kinds:
  - **Media "sumbungan" shows** (Tulfo). These work by on-air pressure, with no board and no published outcomes.
  - **Civil-society monitoring projects** (Check My School, Bantay Lansangan). These are dead, and both failed at the step after forwarding.
- Sumbong is not redundant locally.

**In general: yes. The *model* has been built properly, more than once, and we should copy it rather than reinvent it.**
- **Járókelő.hu** (Budapest, volunteer association, since 2012) is almost the same product:
  - Residents submit photo, pin and category.
  - Volunteer "case handlers" check each report, forward it to the responsible office, chase the reply, publish the office's answer, and close the case.
  - It says it gets about **6,000 problems a year solved** (primary, §5.1).
- **FixMyStreet UK** (charity mySociety, since 2007) is the same idea with email instead of volunteers: 8,082,765 reports, 3,170,494 marked fixed (§5.2).
- Both are alive. Most other NGO and volunteer copies are dead (§6).
- **Where Sumbong is new:**
  - The batched, paper-letter Digest with Proof of Receipt, fitted to Philippine Citizen's Charter channels.
  - Misroute as a first-class step.
  - Pre-publication Review with photo pixelation.
  - A bilingual public board with "Ako rin" that feeds into the letter.
- **Where Sumbong is behind:** Járókelő's post-forwarding lifecycle, which tracks "waiting for answer" vs "waiting for fix" vs "unsolved after the legal deadline". That stage is exactly where the Philippine precedents died (§6.2).

**The proper version done by government** is QC iReport: an LGU system with an 82% resolution rate published for early September 2026 (§4.7). If Cabanatuan ever builds one, Sumbong becomes complementary; ADR 0001 already anticipates this.

---

## 1. What Sumbong implements today (from the code)

Read from the repo on 2026-10-19. Where docs and code disagree, the code wins. This section reflects the working tree, which had uncommitted changes at the time:
- several `src/` files;
- a new migration, `supabase/migrations/20261019000100_hardening.sql`. It adds a per-IP rate limit on Me Too, makes resolving and adding the after-photo one call (`resolve_report`), refuses unreviewed photos at approval, and blocks Volunteers from changing their own role.

**Statuses and the status machine**
- Six statuses: `pending_review`, `rejected`, `published`, `forwarded`, `resolved`, `reopened` (`supabase/migrations/20261018000100_schema.sql`, `report_status`).
- The trigger `reports_before_update` allows only these transitions (`supabase/migrations/20261018000200_logic.sql`):
  - pending_review→published / rejected
  - published→forwarded / resolved / rejected (take-down)
  - reopened→forwarded / resolved
  - forwarded→resolved
  - forwarded→published (Misroute)
  - resolved→reopened
- The trigger also stamps `reviewed_at`, `published_at`, `first_forwarded_at`, `resolved_at` and `reopened_at`, and refuses a public Report without a Responsible Office.
- **There is no state between Forwarded and Resolved.** The model cannot tell "office hasn't answered" apart from "office answered and scheduled a fix".

**Audit trail**
- Every change is written to `report_events` with kinds `submitted`, `status_changed`, `office_changed`, `category_changed`, `misrouted` and `note`, plus the actor (`20261018000100_schema.sql`).

**Roles**
- `volunteer` and `coordinator` (`volunteer_role`).
- Volunteer actions are SECURITY DEFINER functions gated by `require_volunteer()`: `review_approve`, `review_reject`, `set_photo_review`, `add_after_photo`, `resolve_report`, `reopen_report`, `mark_misroute`, `create_digest`, `remove_from_digest`, `discard_digest`, `send_digest`, `set_digest_proof` (`20261018000200_logic.sql`).
- Reporter-side functions (`submit_report`, `add_me_too`, `reopen_by_follower`) are service-role only, so the Worker runs Turnstile (`src/app/api/reports/route.ts`) and rate limits first.

**Submission**
- Pin inside the city boundary (with a 500 m edge tolerance) plus Barangay auto-tagging (`locate_point`).
- A Category with Category Questions (`category_questions`; kinds text, yes_no, choice).
- 1–3 photos (enforced in `submit_report`), an optional title (`20261018000800_board.sql`), landmark and description.
- Rate limit: 5 per hour per IP hash and per device hash (`p_max_per_hour`).
- Photos are re-encoded in the browser, which drops EXIF and GPS (`src/lib/image.ts`).

**No account needed**
- The Reporter gets a private Tracking Link; only its SHA-256 hash is stored (`report_secrets`).
- An optional email or magic-link account makes them a Follower (`report_followers`; `src/app/(public)/me/page.tsx`).

**Before submitting: nearby check**
- `nearby_reports` returns open Reports within 100 m by default (clamped to 10–500 m), so the Reporter can tap "Ako rin" instead.

**Me Too**
- One per device hash (`me_toos` primary key), plus a per-IP limit (hardening migration), counted by trigger, allowed only on published, forwarded or reopened Reports (`add_me_too`).
- **A Me Too does not make the resident a Follower.** `followByEmail` requires Reporter credentials (`src/app/actions/reporter.ts`).

**Review**
- `/v/review` and `/v/review/[id]`: each photo must be published (with faces and plates pixelated) or hidden before approval (`src/app/v/review/[id]/page.tsx`, `set_photo_review`).
- The Volunteer confirms the Category and the Responsible Office.
- Photo originals sit in a private bucket; only the reviewed copies are public (`report_photos.original_path` / `public_path`).

**Routing**
- A Suggested Office comes from Category and location (`suggested_office_id` vs `office_id`); `responsible_offices.scope` is citywide or per_barangay.
- The seeded offices (CEO, CENRO, CELCOR, DPWH-NE2, BARANGAY) each carry the Citizen's Charter channel text and letter addressee (`supabase/migrations/20261018000500_reference_data.sql`).

**Digest**
- `create_digest` collects an office's (or one barangay's) Published and Reopened Reports.
- The letter (`src/app/v/digests/[id]/letter/page.tsx`):
  - lists each Report with its "N other residents confirmed" count and a "previously marked fixed" flag;
  - asks for "any update";
  - has a "Received by / Date / stamp" footer.
- `send_digest` logs when it went and how (`digest_channel`: letter, text_line, email, in_person, other) and moves the Reports to Forwarded.
- `set_digest_proof` stores the Proof of Receipt.
- **The letter cites no processing time and asks for no reply-by date.**

**After forwarding**
- `resolve_report` with an optional after-photo (one call in the hardening migration).
- `mark_misroute` reassigns the office and returns the Report to Published.
- `reopen_report` (Volunteer).
- `reopen_by_follower` within 30 days of Resolved.

**Feedback**
- Bilingual emails to Followers for: submitted, published, rejected, forwarded, resolved, reopened, misrouted (`src/lib/notify.ts`; `email` keys in `src/messages/en.json`).
- The public Report page shows a timeline built from the status timestamps (`src/app/(public)/r/[code]/page.tsx`). **There is nowhere to record or show what the office said.**

**Public board**
- `/` lists Reports with sorting by most "Ako rin", newest, or recently updated.
- Views: open / resolved / all. Filters: status, Category, Barangay. List or map (`src/lib/board.ts`, `src/components/board/*`).

**Privacy**
- Reporter identity is never public.
- A daily pg_cron job purges Follower contacts 90 days after final Resolved (30 days after Rejected), and rate-limit hashes after 30 days (`purge_expired_personal_data`, `20261018000400_retention_schedule.sql`).
- Resident copy says plainly that this is "a volunteer project, not an official City Government system" and redirects emergencies to CDRRMO (`about.unofficial`, `board.emergency` in `src/messages/en.json`).

**Not implemented**
- Duplicate linking (deferred; ADR 0002)
- Scorecard
- Web push
- SMS / Messenger intake
- Offline sending (an unfinished Report is kept on the device, but sending still needs a connection)
- Open data / Open311 export
- Any record of office replies, follow-up letters or escalation

---

## 2. Platforms at a glance

| Platform | Operator | Country | How Reports reach the office | Public board | Me Too / follow | Feedback loop | Alive (2026-10-19) | Relevance to us |
|---|---|---|---|---|---|---|---|---|
| **Járókelő.hu** | Volunteer association + small paid staff | Hungary | Volunteers email/forward each Report same day, chase reply, publish answer | Yes | Others can comment and "join" | 8 statuses incl. waiting-for-answer, unsolved past 30-day legal deadline | Yes | **Closest twin.** Copy its post-forwarding lifecycle |
| **FixMyStreet UK** | mySociety (charity) | UK | Email by default; integrations for paying councils | Yes | Subscribe to alerts | Reporter marks fixed; 4-week survey | Yes | Proves email-to-office intermediary at scale |
| Popravi.to | Code for Croatia + Gong (NGOs) | Croatia | "We will report the problem on your behalf" | Yes | (FMS) | (FMS) | Yes, low volume | Small NGO can sustain an FMS instance |
| FiksGataMi | NUUG (volunteer user group) | Norway | Email by location/category | Yes | (FMS) | (FMS) | Dead (retired 2024) | Volunteer FMS lasted 13 years |
| Aduanku | Sinar Project + TI-Malaysia | Malaysia | Residents, site reviewers or community partners forward | Yes | (FMS) | (FMS) | Dead | Paper-only respondents forced manual relay |
| Por Mi Barrio | DATA Uruguay (NGO) | Uruguay | City complaint system, by agreement | Yes | (FMS) | Public stats page | Dead; domain now a gambling site | Stats page built credibility |
| **BudgIT Tracka** | BudgIT (NGO), paid staff + volunteer Community Champions | Nigeria | Letters to legislators/MDAs, FOI, anti-graft agencies, town halls | Project tracker | — | Scheduled site re-visits | Yes | Letters + scheduled follow-up; only 2.1% FOI response |
| I Change My City | Janaagraha (NGO) | India | Fed into BBMP's Sahaaya system | Yes | Vote, "follow the engineer" | Email updates | Dormant (app last updated 2023) | Collapsed when its one government link broke |
| Colab | Company (B2G SaaS) | Brazil | Paid city-hall integration | Yes | Support, comment, follow | Yes | Yes | Shows where intermediaries drift: selling to cities |
| Reclame Aqui | Company | Brazil | Public pressure: response-rate reputation score | Yes | — | Respondent replies publicly | Yes | Pressure on respondents who never joined |
| Mängelmelder | Company | Germany | Municipality opts in | Yes | ? | Often none: ~21% solved | Yes | Non-responding offices make the board look broken |
| Safetipin | Social enterprise | India | Audit reports commissioned by government | Map | — | Re-audit | Yes | Audit + re-audit loop for streetlights |
| **Check My School** | ANSA-EAP (NGO) + DepEd MOA | Philippines | Volunteer letters, 2 follow-ups, then media (never used) | Map | — | Mostly none | Dead; domain now spam | **The local failure case** |
| Bantay Lansangan | 23 CSOs + DPWH | Philippines | Secretariat raises volunteer findings with DPWH | No | — | KARSA waited 8+ months | Dead (~2010) | Partnership alone didn't make DPWH respond |
| G-Watch Textbook Count / Bayanihang Eskwela | Ateneo School of Government + DepEd | Philippines | Volunteers sign off deliveries/construction inside DepEd's process | No | — | Built into procurement | Ended as programmes | Worked because it was *inside* the agency's process |
| FixMyBarangay | World Bank / Cebu City / mySociety | Philippines | SMS → barangay hall verifies → city departments | ? | ? | ? | Not found after ~2013 | Only PH FixMyStreet deployment found |
| Raffy Tulfo in Action | Private media | Philippines | Host calls the official on air | No (videos) | — | On air only | Yes | Pressure works; circus and no records |
| Bayan Mo, iPatrol Mo / YouScoop | ABS-CBN / GMA | Philippines | Broadcast exposure | No | — | No | Probably dead | Media intake, no routing |
| QC iReport | Quezon City LGU | Philippines | Validated, auto-forwarded to department | No | No | 72 h update; 82% resolved | Yes | Proper LGU version [CRP §5] |
| Sumbong sa Pangulo | Office of the President | Philippines | All forwarded to ICI | Project list, not reports | — | None public | Yes | National, flood-control projects only |
| DPWH Feedback & Complaints Mechanism | DPWH | Philippines | Action Officer issues "Request for Action Memorandum" | No | — | Response on action taken | Yes | Same human relay as our Digest, inside DPWH |

---

## 3. Feature-by-feature comparison

"(FMS)" means stock FixMyStreet behaviour [CRP §3]. "?" means not found in a primary source. Each cell's sources are in §4–§5 and [CRP].

### 3.1 Matrix A: non-government intermediaries

| Feature | **Sumbong** | Járókelő (HU) | FixMyStreet UK | Popravi.to (HR) | Check My School (PH) | BudgIT Tracka (NG) | I Change My City (IN) |
|---|---|---|---|---|---|---|---|
| Operator | Volunteers, invite-only | Volunteer association + small paid staff | Charity (mySociety) | NGOs | NGO + DepEd MOA | NGO, paid state officers + volunteers | NGO |
| Anonymous vs account | No account; Tracking Link; optional email/magic link | Registered users only; can hide name from the office | Email confirm or account; name hidden by default | (FMS) | Volunteer infomediaries; SMS (unused) | App, social DMs, town halls | Account |
| Photo / location | 1–3 photos required; pin in city polygon; Barangay auto-tag | Photo(s) or video link; map pin; category | Photo optional; pin; MapIt areas | (FMS) | School-level data; GPS only for 8,684 of 44,000+ schools | Project site visits | Photo + location |
| Category → office routing | Suggested Office from Category + location; Volunteer confirms | Volunteers pick office by type, place, other criteria | Automatic by area + category (bodies/contacts) | (FMS) | Volunteers / ANSA team | Tied to budget line + named official | Automatic to BBMP/BWSSB/BESCOM |
| Human review before public / forward | **Yes, pre-publication**, with photo pixelation | **Yes**, admins check before forwarding; may ask for more info | No (reactive moderation) | (FMS) | ANSA team compiles | Staff | "Volunteer moderators" (v1.6) |
| Misroute handling | **First-class**: `mark_misroute`, back to Published, Followers emailed | Volunteers forward on based on the reply | "Not responsible" state | (FMS) | — | — | — |
| Public board | Yes, list + map, filters | Yes, public cases + office replies | Yes | Yes | Website map | Project tracker | Yes |
| Me Too / support | "Ako rin", 1 per device; count printed in the letter | Comments, "join" | — | — | — | — | Vote |
| Follow by other residents | **No** (Reporter only) | Yes ("join", get information) | Yes (alerts) | (FMS) | — | — | Yes |
| Duplicate merge | Nearby check before submit; linking deferred | ? | Nearby suggestions + `duplicate_of` | (FMS) | — | — | ? |
| Status lifecycle | 6 statuses; nothing between Forwarded and Resolved | New → Processing → Needs info → **Waiting for answer → Waiting for fix** → Solved / **Unsolved** / Waiting for confirmation | Open/investigating/…/fixed/not responsible/duplicate | (FMS) | Informal | Completed / ongoing / abandoned / not executed | Open / resolved / closed |
| Feedback to Reporter & Followers | Bilingual email on 7 events | Automatic email on forwarding; replies published | Email; survey after ~4 weeks | (FMS) | Rare | Community town halls | Email |
| Batched Digest | **Yes**: per office / per Barangay letter | No, per Report, same day | No, per Report | No | Letters per issue | Letters per community | No |
| Office integration | Letter / text line / email / in person, logged; **Proof of Receipt** | Email/letter by volunteers | Email default; Open311 / back-end for Pro councils | Email | Letters | Letters, FOI, visits | API into Sahaaya |
| SLA / escalation | None encoded; Followers can reopen within 30 days | **Statutory 30-day reply duty** (Act XXV 2023) marks "Unsolved"; then "publicity" | None; council's own | — | 2 follow-up letters then media (never done) | Follow-up visits every 3 months; media; ICPC/EFCC | Agency's own |
| Moderation / privacy | Pre-review, pixelation, EXIF strip, retention purge, DPA notice | GDPR policy; anonymity to the office | Reactive; abuse links; names hidden | (FMS) | — | — | ? |
| Bilingual / local language | Filipino + English | Hungarian | English | Croatian | ? | ? | ? |
| Offline / SMS | No | No | SMS variant exists in code | No | SMS (switched on too late, unused) | Town halls | No |
| Open data / Open311 | No | ? | Open311 + data | (FMS) | — | Reports | Open dataset |
| Evidence of resolution | None yet (pre-launch) | ~6,000 solved a year (self-reported) | 39% marked fixed all-time | 8 fixed in past month | 3 fixes named | 51% projects completed (not attributable); 2.1% FOI replies | 57% (2019) → 6–12% (2020–22) |
| Alive | Pre-launch | Yes | Yes | Yes | Dead | Yes | Dormant |

### 3.2 Matrix B: Philippine government and media channels

| Feature | **Sumbong** | QC iReport | MyNaga | 8888 | DPWH FCM | Sumbong sa Pangulo | Raffy Tulfo in Action |
|---|---|---|---|---|---|---|---|
| Operator | Volunteers | Quezon City LGU | Naga City LGU + vendor | Office of the President | DPWH | Office of the President | Private media |
| Anonymous vs account | No account needed | Guest with email OTP | Account (name, phone linked) | Anonymous allowed | Any channel | Name/email optional | Walk-in, screened |
| Photo / location | Required; pin | Yes | Yes; geotagged camera for some categories | ? | ? | Photo/video ≤10 MB per project | On camera |
| Category → office routing | Suggested Office + Volunteer | Auto-forward after validation | Centralised; vendor triage (secondary) | 8888 Center refers to agency (32-min target) | Action Officer → office memo | All to ICI | Host calls the official |
| Human review before public | Yes | Validation before forward | ? | Call-takers | Action Officer | ? | Staff screening |
| Misroute handling | First-class | ? | ? | Re-referral | ? | — | — |
| Public board | Yes | **No** (dashboards only) | No | No | No | Project list only | Episode videos |
| Me Too / follow | Ako rin; Reporter follows | No | No | No | No | No | No |
| Duplicate merge | Nearby check | ? | ? | ? | ? | "Duplicate" means duplicate *project* | — |
| Status lifecycle | 6 statuses | Ticket statuses | Includes "pending confirmation" + "No" | Ticket | Action taken | None public | — |
| Feedback to Reporter | Email | In-app | In-app; rate the fix | Ticket | Response | ? | On air |
| Batched Digest | Yes | — | — | — | Memo per complaint | Bulk to ICI | — |
| Office integration | Paper/text/email, logged with Proof of Receipt | Native | Native | Agency 8888 portals | Internal memo | ICI | Phone, on air |
| SLA / escalation | None encoded | 72 h | "minutes to 12 h" for safety | **72 h, non-extendible; covers LGUs** | ? | ? | Public shaming |
| Moderation / privacy | Pre-review + pixelation | PI never posted | Name/phone linked | — | — | ? | Faces on TV |
| Bilingual | Fil + En | ? | ? | ? | ? | ? | Filipino (broadcast) |
| Offline / SMS | No | Helpline 122 | ? | Call/text | Hotline, Viber, text | No | Walk-in, radio |
| Open data | No | QCitizen Data dashboards | No | No | No | Project data (mirrored on GitHub) | No |
| Evidence of resolution | — | **82% resolved, 99% responded** (Sep 2026) | 58% (Oct 2025) [CRP §4] | Self-reported ~100% "acted upon"; COA: 792,685 calls abandoned | ? | None | None |
| Alive | Pre-launch | Yes | Yes | Yes | Yes | Yes | Yes |

### 3.3 Where each beats us, where we beat it

**Járókelő**
- *Beats us:*
  - It tracks what happens *after* forwarding: "Waiting for answer" vs "Waiting for fix", "Unsolved" once the office's legal 30-day reply window lapses, and "Waiting for confirmation".
  - It publishes the office's reply on the case.
  - Other residents can join a case.
  - Forwarding happens the same day.
  - It has a documented volunteer operations model (training, knowledge base, weekly shifts, coordinator).
- *We beat it:*
  - No account needed.
  - Photo pixelation before publication.
  - Misroute is explicit.
  - Batched letters suit offices that only take paper.
  - Proof of Receipt.
  - Me Too counts go into the letter.

**FixMyStreet UK**
- *Beats us:* scale; zero-touch routing; anyone can subscribe; a 4-week "is it fixed?" survey; Open311 and open data; years of evidence.
- *We beat it:* pre-publication Review (FMS publishes first and moderates later); Misroute handling; Digest and Proof of Receipt; Filipino UI.

**Check My School**
- *Beats us:* it had an MOA with the agency (DepEd).
- *We beat it:* we have a tracked lifecycle, Followers and a public board. It had no structured follow-up, which the case study names as the problem.

**BudgIT Tracka**
- *Beats us:*
  - Scheduled follow-up (site re-visits every 3 months).
  - An explicit escalation ladder: FOI, then anti-graft agencies, then media.
  - Paid staff anchor the volunteers.
  - Offline town halls.
- *We beat it:* per-Report public tracking and resident-facing notifications.

**I Change My City**
- *Beats us:* open dataset; direct link into the city's own system (while it lasted).
- *We beat it:* we don't depend on one government system staying compatible.

**QC iReport**
- *Beats us:* the office itself is in the loop; a 72-hour rule; a published resolution rate.
- *We beat it:* a public board; Me Too; Misroute visible to residents; no OTP needed.

**MyNaga**
- *Beats us:* the Reporter confirms or denies the fix ("pending confirmation", then "No"); a native app.
- *We beat it:* public visibility; minimal personal data.

**8888**
- *Beats us:* legal teeth (72 hours, non-extendible, administrative sanctions) and LGU coverage.
- *We beat it:* transparency. No 8888 ticket is public, and "resolution" counts tickets acted upon (§4.6).

**Tulfo**
- *Beats us:* immediate leverage over officials.
- *We beat it:* records, privacy, no public humiliation, and no dependence on one personality.

### 3.4 What to copy, ranked

P0 means "do before or right at launch, because the precedents died here".

1. **P0: Track what happens after Forwarded** (from Járókelő; Check My School and Bantay Lansangan are the counter-examples).
   - Add a way to log an office reply (text plus optional scan) and show it publicly on the Report page.
   - Distinguish "Forwarded, no reply yet" from "Office replied / fix scheduled".
   - Derive an "overdue" flag once the Charter processing time has passed: 7 working days for the City Engineer's "Complex" services, 3 for CENRO complaints [CRP §6.3].
   - Smallest version: new `report_event_kind` values (e.g. `office_replied`, `follow_up_sent`) plus a computed overdue view, without new statuses. This is a new migration, so add a test under `tests/db/` (AGENTS.md).
2. **P0: A written escalation ladder with an owner and dates** (from Tracka and Járókelő; Check My School never used its media step).
   - Order: follow-up Digest of overdue Reports, then 8888 or ARTA (the 8888 FAQ says LGUs are covered, §4.6), then a public post.
   - The Coordinator owns each rung, on a fixed schedule.
   - Build a "follow-up Digest": a Digest of Forwarded Reports past their deadline. Today `create_digest` only takes Published and Reopened Reports.
3. **P0: Put the clock in the letter** (from Járókelő's statutory 30-day duty; Valenzuela's Charter sets 16 days for repair requests, §4.9).
   - Name the Citizen's Charter service and its processing time in the Digest letter.
   - Ask for a reply by a date.
   - Today the letter asks only for "any update" (`src/app/v/digests/[id]/letter/page.tsx`).
4. **P1: Let "Ako rin" residents follow** (from FMS alerts, Colab and Járókelő).
   - Offer an optional "notify me" email after a Me Too.
   - Today `add_me_too` stores only a device hash, and `followByEmail` requires Reporter credentials.
5. **P1: Ask Followers to confirm a fix** (from MyNaga's "pending confirmation", Járókelő's "Waiting for confirmation" and FMS's 4-week survey).
   - The Resolved email could carry "Fixed? Yes / No" links. "No" calls `reopen_by_follower`.
6. **P1: Publish honest counts early** (from Por Mi Barrio's stats page, QC's 82% and Járókelő's ~6,000 a year).
   - Ship simple citywide totals before the full Scorecard.
   - Define "resolved" as fixed, not "acted upon" (the 8888 caveat, §4.6).
   - No rankings (mySociety's league-table warning, §6.3).
7. **P1: A volunteer operations model, not just software** (from Járókelő and Tracka).
   - Fixed weekly shifts of 2–3 hours, onboarding, a knowledge base, a coordinator.
   - At least one paid or committed anchor person.
8. **P1: Offline and assisted intake** (from Aduanku, Tracka town halls and Check My School's Facebook page). This is already on the equity list [CRP §10].
9. **P2: Duplicate linking** (from FMS `duplicate_of`); already deferred in ADR 0002.
10. **P2: Open data / Open311 export** (from FMS and ICMyC's open dataset); already P2 [CRP §10].

---

## 4. Philippine platforms (new ground)

### 4.1 Media "sumbungan" intermediaries

**Raffy Tulfo in Action / Wanted sa Radyo** (private media)
- Walk-in complainants are screened by staff ("rigorous screening process"). The host calls the other party or the official on air. Staff may provide a lawyer and draft settlement agreements **(secondary)** ([Rest of World, 2024](https://restofworld.org/2024/raffy-tulfo-philippines-president/); [Wikipedia](https://en.wikipedia.org/wiki/Wanted_sa_Radyo)).
- About 28M+ YouTube subscribers in 2024 (same, secondary).
- No public tracking, duplicate handling or published outcome counts were found.
- Criticised for humiliating parties on air (Rest of World).

**Isumbong mo kay Tulfo** (Ramon Tulfo)
- Ran 1991–2022.
- Four staffers screened callers, called or visited agencies, and sometimes went with complainants to the office.
- Ended when the host retired **(secondary; host's own column)** ([Philstar, 2022](https://www.philstar.com/opinion/2022/07/05/2193026/end-era)).

**Bayan Mo, iPatrol Mo** (ABS-CBN)
- Citizen reports by SMS, MMS, app and social media; 1M members in 2014 **(secondary)** ([Marketing-Interactive](https://www.marketing-interactive.com/abs-cbns-bayan-mo-patrol-mo-now-1m-members)).
- Influence came through broadcast exposure only; no referral or outcome tracking was found.
- `bmpm.abs-cbnnews.com` did not connect and `news.abs-cbn.com/bmpm` returned 403 (2026-10-19). Probably dead.

**GMA YouScoop**
- Eyewitness upload (2009–10), later an app. "Complaints" were a main theme in a 2010 sample of 1,646 uploads **(secondary)** ([UP thesis wiki](https://iskomunidad.upd.edu.ph/index.php/Frames_in_the_Grassroots)).
- The likely current URL returns 404.

**Rappler MovePH / Project Agos**
- Volunteers verify disaster reports before they go on an alert map shared with responders. That verification step is close to our Review **(secondary)** ([Rappler](https://amp.rappler.com/move-ph/issues/disasters/95880-project-agos-push-zero-casualty-goal-northern-mindanao)). No 2024+ activity found.

**Lesson:** the media model gets results through one personality's leverage and public shame. It leaves no record, has no duplicate handling, publishes no outcomes, and ends when the host leaves. Avoid the shaming; copy only the fact that **publicity is the last rung of escalation**.

### 4.2 Check My School (ANSA-EAP, 2011–): the key local precedent

Primary source: J. Shkabatur, *Check My School: A Case Study on Citizens' Monitoring of the Education Sector in the Philippines*, World Bank Institute, 2012 ([PDF](https://ansa-eap.net/wp-content/uploads/848/CMS_Case_Study.pdf); page numbers below are PDF pages).

**Model**
- A DepEd partnership gave ANSA-EAP school data and endorsement letters.
- Unpaid volunteer "infomediaries" checked schools against official data.

**Problem-solving was improvised**
- "Infomediaries proactively identified 231 issues that required resolution in 84 schools" (p. 40).
- The process ("Operation Thank You"): report to DepEd or other authorities in writing; "if the authorities did not respond, up to two follow-up letters would be sent, and then the issue would be brought to the media (however, this never happened, even if authorities were nonresponsive)" (p. 40).

**Outcome**
- Infomediaries "reported to the authorities only a handful of problems, and typically they did not hear back from authorities and did not send follow-up letters" (p. 41).
- Only a few fixes are named. One was a toilet repair after a complaint from an infomediary who personally knew the DepEd officials (p. 41).
- Conclusion: "problem-solving mechanisms should be better structured and institutionalized" (p. 47).

**Sustainability risks the study names** (p. 48)
- Self-selected, unpaid infomediaries whose "long-term commitment … may be difficult to sustain".
- Dependence on DepEd's support.
- "Dependence on ANSA-EAP": the core team sent all the letters and follow-ups, which "seems problematic from a sustainability perspective".

**Fate**
- An ANSA page (2021) lists MOAs for 2010–12 and 2018–20 without outcome figures ([ANSA](https://ansa-eap.net/checkmyschool-philippines/)).
- `checkmyschool.org` now serves an Indonesian gambling spam page (title checked 2026-10-19).

**For us:** this is Sumbong's exact risk. A small core team writes the letters, and the follow-up depends on initiative. §3.4 items 1–2 and 7 answer it.

### 4.3 G-Watch (Ateneo School of Government): Textbook Count and Bayanihang Eskwela

**Textbook Count** (from 2002)
- CSO volunteers, including scouts, counted textbook deliveries as part of DepEd's own procurement process. Delivery errors reportedly fell to about 5% ([ANSA-EAP PDF](https://ansa-eap.net/wp-content/uploads/758/textbookcount.pdf); [PTF](https://ptfund.org/publication_page/helping-department-of-education-improve-procurement-and-distribution-of-textbooks)).

**Bayanihang Eskwela** (from 2005)
- More than 700 community monitors checked 133 classrooms worth ₱122.8M.
- DepEd adopted it as the community-monitoring part of its school-building programme ([G-Watch](https://www.g-watch.org/resources/political-democracy-and-reforms-poder-studies/constructing-philippine-education-bayanihang-eskwela)).

**Hostility and safety**
- In restricted civic space, "not only are government officials uncooperative, but some turn hostile". G-Watch now includes safety and security in monitor orientations ([Aceron, ARC, 2024](https://accountabilityresearch.org/monitoring_political_meaning/)).

**Lesson:** it worked because volunteer sign-off was written into the agency's own process. For us, that is the "MOU later" path in ADR 0001.

### 4.4 Bantay Lansangan (Road Watch), 2007–~2010

- A partnership of 23 organisations with DPWH. The secretariat "should bring to the attention of DPWH any report of problems that its volunteers… discover", and DPWH could "address those issues internally first" ([ANSA-EAP, 2010](https://ansa-eap.net/wp-content/uploads/200/59-1-4_Bantay_Lansangan_Road_Watch_Experience.pdf)).
- A Kalinga monitoring group, "eight months hence, … has yet to hear from anyone on its complaints". Volunteers paid their own costs, and monitoring stopped for lack of funds (same source).
- DPWH's first road-sector report card was graded "incomplete" because DPWH did not provide its data **(secondary)** ([PCIJ](https://old.pcij.org/blog/?p=4638)).

**Lesson:** even a formal partnership didn't guarantee replies. Silence needs a scheduled consequence.

### 4.5 FixMyBarangay (Cebu, ~2012–13) and DevLIVE

**FixMyBarangay**
- A World Bank-funded, Open311/SMS variant of FixMyStreet for Cebu City, built with mySociety.
- Pilot barangays: Luz and Basak San Nicolas. Barangay hall staff verified texts before forwarding them to city departments ([OSM talk-ph, 2012](https://lists.openstreetmap.org/pipermail/talk-ph/2012-May/003949.html); [fixmystreet.org SMS docs](https://fixmystreet.org/install/fixmystreet-with-sms/)).
- No outcome data and no trace after about 2013. This is the only Philippine FixMyStreet deployment found.

**DevLIVE** (DILG + UNDP, 2018–19)
- A government app for geotagged citizen feedback on locally funded infrastructure **(secondary)** ([DILG MIMAROPA](https://mimaropa.dilg.gov.ph/2019/05/17/dilg-mimaropa-promotes-devlive-mobile-app/)). Current status unclear.

### 4.6 8888, re-verified, and how "resolved" is counted

**FAQ** (Wayback copy, 2022-06-07)
- A complaint "shall be referred by the 8888 Center to the appropriate agency within 32 minutes and shall be given a concrete and specific action within seventy-two (72) hours from receipt … by the proper government agency (GA) or instrumentality (GI), **and LGU**" ([Wayback](http://web.archive.org/web/20220607174815/https://8888.gov.ph/frequently-asked-questions-faqs/)).
- This resolves the LGU-coverage question left open in [CRP §9].

**IRR** (Wayback copy, 2022-06-07)
- The 72 hours are "non-extendible". Referrals go to official 8888 agency emails, and agencies report the action taken through their 8888 web portals.
- "Government Agency" includes a local government.
- It also mandates a weekly "8888 Show" on TV: the government copied the media sumbungan ([Wayback](http://web.archive.org/web/20220607175816/https://8888.gov.ph/implementing-rules-and-regulations-irr/)).

**Performance**
- COA's 2019 performance audit found 646,658 calls answered against 792,685 abandoned. The manual had "no provisions to implement administrative sanctions", and there was "no standard as to what constitutes a concrete and specific action" **(secondary)** ([ABS-CBN, 2020](https://news.abs-cbn.com/news/10/08/20/office-of-the-president-heeds-coa-recommendations-begins-reforms-on-8888-complaint-hotline)).
- **Two counts that sound alike:**
  - *Resolution rate* counts tickets acted upon regardless of timing.
  - *Compliance rate* counts only tickets acted upon within 72 hours.
  - Source: [UP Manila memo](https://hrdo.upm.edu.ph/sites/default/files/2022-09/Memorandum%20No.%20NGY%2022-100%20Monitoring%20of%20Hotline%20%238888%20and%20Contact%20Center%20ng%20Bayan%20%28CCB%29%20Resolution%20and%20Compliance%20Rates.pdf).
  - Agency self-reports of ~100% "resolution" should be read with this in mind.

**For us:** 8888 is a legitimate escalation rung for an unanswered Digest to a City office. CELCOR is a private utility, and its regulator channel was not researched.

### 4.7 QC iReport (update to [CRP §5])

- Categories expanded from 8 to 15. "The system forwards validated reports to the department concerned" ([QC program page](https://quezoncity.gov.ph/program/qc-ireport/)).
- **"As of early September 2026, 4,580 out of 5,589 reports had been resolved, resulting in an 82% resolution rate and a 99% response rate"** (same page, re-checked 2026-10-19). This is the only LGU resolution rate found.
- Bundled with the "QCitizen Data: Resibo ng Serbisyo" dashboards (May 2026) ([QC news](https://quezoncity.gov.ph/qc-govt-boosts-transparency-accountability-with-qcitizen-data-platforms/)). Individual reports are still not public.
- QCitizen app ratings: 3.8★ on Google Play (`ph.gov.quezoncity.qcitizen`) and 2.5★ on the App Store, with a July review saying photo attachment fails in "File a Report" ([App Store](https://apps.apple.com/ph/app/qcitizen/id1536531355)).

### 4.8 Sumbong sa Pangulo and DPWH's own channel

**Sumbong sa Pangulo** (sumbongsapangulo.ph)
- Launched 11 Aug 2025. It is a list of DPWH flood-control projects with a "Report" button per row, a map, and a form:
  - category: Completed / Defective / Duplicate / Unfinished / Ghost / N/A;
  - optional name and contact details;
  - message up to 5,000 characters; photo or video up to 10 MB.
  - Read live via a headless browser; plain fetches get a Cloudflare 403.
- More than 16,000 reports in the first month, "all … forwarded to the ICI" ([PCO](https://pco.gov.ph/news_releases/more-than-16k-complaints-submitted-to-sumbong-sa-pangulo-website-within-a-month/)).
- No public per-report status.
- It lists at least one Cabanatuan project (Pampanga River flood mitigation, Brgy. Pagas).
- A community mirror of its data exists ([rukku/sumbongsapangulo.ph-datasets](https://github.com/rukku/sumbongsapangulo.ph-datasets)).
- **Not overlapping:** national, flood-control projects only.

**DPWH Feedback and Complaints Mechanism**
- Hotline 16502, Viber/text, email, 8888 and social media.
- An Action Officer consolidates feedback and issues a **"Request for Action Memorandum"** to the head of the concerned office ([DPWH PDF](https://www.dpwh.gov.ph/dpwh/sites/default/files/5_feedback_and_complaints_mechanism_with_date.pdf)).
- That is a human relay much like our Digest, inside the agency, and the channel our DPWH Digests reach.

### 4.9 Other PH LGU channels (2024–2026)

- **Valenzuela Citizen's Charter 2025**
  - "Request for Repair and Maintenance of Public Property" (City Engineering Office) requires a **Request Letter**, open to residents, schools or barangays.
  - Category "Roads and Drainage". Total processing time **16 days, 2 hours, 20 minutes** ([PDF, pp. 357–358](https://valenzuela.gov.ph/files/citizen_charter/Final-Citizens-Charter-2025.pdf)).
  - This confirms letters are the normal Charter channel elsewhere too, and that processing times are citable.
- **Connect Metro Iloilo-Guimaras** (UP SMART METRO / DOST, Apr 2026)
  - "Report community issues with GPS location and photo… Monitor the status." ID-verified sign-up; LGUs use a web console ([App Store](https://apps.apple.com/ph/app/connect-metro-iloilo-guimaras/id6759637708); [DOST VI](https://region6.dost.gov.ph/2026/04/20/smart-metro-launched-in-iloilo-city/)).
- **Baguio BIMP+** (2026)
  - "Report local concerns", plus a forum and a "Virtual Townhall" ([App Store](https://apps.apple.com/ph/app/bimp/id6760680971)). The only LGU app with a public forum element.
- **Pasig**
  - Ugnayan sa Pasig is a tipline for "infrastructure problems, complaints, etc." ([Pasig services](https://pasigcity.gov.ph/services); TLS certificate error, fetched insecurely). No published resolution rate.
  - The Seermo app (May 2026) collects street-infrastructure ratings for planning, with leaderboard and badges. It is not a complaint loop **(secondary)** ([Top Gear PH](https://www.topgear.com.ph/mobility/pasig-city-walkable-initiatives-a5361-20260713)).
- **Davao City Contact Center** (235-9999, from 2023)
  - Takes "community concerns that require the attention of the government". No routing or stats published ([Davao City](https://davaocity.gov.ph/social-services/davao-city-launches-public-service-contact-center/)).
- **Makatizen:** not found in either PH store on 2026-10-19; probably delisted.
- **MMDA:** Hotline 136 handles traffic and flooding, not road defects **(secondary)**.
- **Nueva Ecija:** no LGU reporting app in either store for Cabanatuan, Palayan, Gapan, Muñoz, San Jose or the province (searched 2026-10-19).
- **Pattern:** no Philippine LGU channel found has a public board, Me Too or follow-by-others.

### 4.10 BetterGov.ph and GitHub civic-tech projects

**BetterGov.ph**
- GitHub org `bettergovph` was created 2025-06-05 and has 36 public repos ([GitHub](https://github.com/bettergovph)): transparency dashboards, flood-control viewers, petitions, the design system `kapwa`, and others.
- **No complaint or reporting repo.**
- The BetterLGU Directory lists 47 "Active" portals, each "Volunteer-run, not an official LGU website". BetterCabanatuan is Active ([lgu.bettergov.ph](https://lgu.bettergov.ph/)).
- Sumbong would be the first BetterLGU portal with a reporting loop. That makes it reusable by other BetterLGU volunteers (a reason to keep office and Charter data configurable rather than hard-coded).

**Code for Pilipinas**
- `codeforpilipinas.org` does not resolve; treated as dead.

**"Sumbong" repos on GitHub**
- A search turns up about 15 projects (e.g. `pyjom/Online-Sumbong-Barangay-Complaint-System`, `skadooshing/E-sumbong`, `Team-i-Sumbong/i-Sumbong-Static-Web`), almost all student capstones with 0–3 stars.
- They are built for barangay staff to receive complaints, not as public boards. None appears to be deployed ([GitHub search](https://github.com/search?q=sumbong&type=repositories), 2026-10-19).

### 4.11 Cabanatuan Facebook groups

- Searches (including `site:facebook.com`) found no indexed Cabanatuan community group acting as a de-facto sumbungan. Facebook content is not indexed for logged-out search.
- **Unverified:** this needs a manual, logged-in check. It matters because Check My School's Facebook page outperformed its own website and SMS: posts "were viewed almost 75,000 times", and ANSA-EAP "turned its attention to the Facebook page" when the site underperformed (CMS case study, PDF pp. 28, 45).

---

## 5. Global platforms (new ground)

### 5.1 Járókelő.hu (Budapest, 2012–): the closest twin

Primary source: the site's own "How it works" and volunteer pages. The site is a JavaScript single-page app, so the text was read from its published bundle at [jarokelo.hu](https://jarokelo.hu/) on 2026-10-19. The translations are ours.

**Purpose**
- "We receive reports about public-space problems, forward them to the responsible offices, and publish the answer."

**Lifecycle**
1. *New.* The resident gives a short title, a description, a category (e.g. traffic engineering, pothole), a map pin, and one or more photos or a video link.
2. *Being processed* / *Needs more information.* "The site's administrators check it, then forward it to the responsible party with the information needed to assess and solve the problem."
3. *Waiting for answer.* "After approval we forward your report **the same day** to the responsible organisation, based on the problem's type, location and other criteria. We notify you automatically by email."
4. *Waiting for fix.* "Our case handlers will watch whether the responsible party replies. Ideally the reply contains the planned date of the fix and the steps."
5. *Solved.* "If you as the reporter, or others in comments, confirm the responsible party fixed it, we consider the case solved."
6. *Unsolved.* "Under Act XXV of 2023, the recipient must answer citizens within 30 calendar days."
7. *Waiting for confirmation.*

**Reporting rules**
- "You can only report as a registered user, but you can stay anonymous so the responsible party doesn't see your name."

**Others can take part**
- "Many others living near you may be curious too. They can comment, join, and get information."

**Escalation**
- "If the responsible party doesn't answer or doesn't seek a solution, the power of publicity and the community can help." That means blog posts, social media and press.

**Volunteer operations**
- Volunteer "case handlers" are "the engine" and handle the offices' reply letters.
- They join through online induction training and a practice period, then get a knowledge base, a chat channel, a mailing list and a volunteer coordinator.
- Commitment: "**one fixed day a week, at most 2–3 hours**". One listed requirement: "you can tolerate monotony".

**Results**
- "On average 6,000 problems a year are solved with our help" (self-reported).
- Its 100,000th solved case came in December 2024 ([Telex](https://telex.hu/belfold/2024/12/11/jarokelo-problemamegoldo-szazezer-zebra-katyu-bokor)) and its 200,000th report in July 2026, with about 100 volunteers plus a small paid staff ([WeLoveBudapest, 2026](https://welovebudapest.com/cikk/2026/08/11/jarokelo-200-ezredik-bejelentese-budapest/)) **(secondary)**.

**Failure modes it reports**
- Offices "ping-pong" cases between each other.
- Some cases take years. One underpass case took seven years of letters, and an official told a resident to "buy pruning shears and trim it yourself" (Telex).
- More officials began replying over time because "they know us now" **(secondary)** ([WeLoveBudapest, 2019](https://welovebudapest.com/cikk/2019/05/10/mi-a-jo-abban-ha-valaki-torott-kukakat-es-katyukat-fotoz-es-jelent-interju-a-jarokelo-onkenteseivel-es-alapitojaval)).

**Why it survived:** a legal reply deadline to point at, same-day forwarding, structured volunteer shifts, a little paid staff, and 14 years of becoming known to the offices.

### 5.2 FixMyStreet UK: the charity-intermediary angle

(The technical model is in [CRP §3].)

- **Origin.** Launched February–March 2007 as "Neighbourhood Fix-It". More than 1,000 reports in the first week; the first went to Oxford City Council ([mySociety, 2017](https://www.mysociety.org/2017/07/21/the-big-one-million-celebrating-fixmystreet/)).
- **Plain email.** Reports are "just plain text emails" that "go into the same email inboxes as any other message to a council" ([mySociety, 2015](https://www.mysociety.org/2015/07/29/98-of-councils-accept-fixmystreet-reports-heres-how-we-cope-with-the-rest/)).
- **Council pushback was about workflow, not spam.**
  - In 2015, 10 of about 430 councils refused third-party reports because their system "can only handle problems reported via the council's own official web interface" (same post).
  - In 2024 mySociety repeated that "a small number of councils refuse to accept reports from residents via third parties" ([mySociety, 2024](https://www.mysociety.org/2024/02/06/statement-from-mysociety-regarding-misuse-of-fixmystreet-data/)).
- **No teeth.** "FixMyStreet sends reports to the people who can fix them, but we have no control over how or whether they are responded to." Some authorities mark a report "closed or fixed when it has been assigned to a third party or contractor" ([FAQ](https://www.fixmystreet.com/faq)).
- **Outcomes.**
  - All time: 8,082,765 reports, of which 3,170,494 were marked fixed (≈39%). Last 7 days: 22,556 reported, 16,126 marked fixed ([/reports](https://www.fixmystreet.com/reports), 2026-10-19).
  - mySociety warns that fixes rely on users coming back, that stale reports become "unknown", and that the data "should NOT be used to make comparisons" between places ([Understanding report data](https://osm.fixmystreet.com/about/understanding-report-data)).
  - A photo raises the odds of a council-marked fix by about 15% ([mySociety, 2020](https://www.mysociety.org/2020/11/16/do-photos-help-resolution-of-fixmystreet-reports/)). This supports our 1–3 photo requirement.
- **The move to selling to councils.**
  - From 2012 councils bought it ("FixMyStreet for Councils", now Pro).
  - In 2025 SocietyWorks served 40 councils and public bodies and donated £299k to mySociety ([SocietyWorks](https://www.societyworks.org/impact/2025-in-review/)).
  - The free intermediary is funded by selling the integrated version. That is a possible long-term path for us if the City ever wants accounts (ADR 0001).

### 5.3 NGO- and volunteer-run FixMyStreet sites: survivors and the dead

mySociety's list of sites ([fixmystreet.org/sites](https://fixmystreet.org/sites/), 2026-10-19) shows:

- **Running:**
  - Popravi.to (Croatia, Code for Croatia + Gong, 2021)
  - ndreqe (Kosovo, Democracy Plus, 2017)
  - FixaMinGata (Sweden, Sambruk, a municipal association)
- **"Sadly no longer running":**
  - FiksGataMi (Norway, NUUG, 2011)
  - Aduanku (Malaysia, Sinar Project, 2014)
  - PorMiBarrio (Uruguay, DATA, 2014)
  - FixMyCommunity (Uganda, CEW-IT, 2015)
  - Bellavista En Acción (Chile, Ciudad Viva)
  - Lokalizo (Kosovo, PIKS)
  - Arregla Mi Barrio and Cuida Alcalá (Spain)
  - ZeroTB (Delhi)
  - FixMyStreet.fr and FixMyStreet.ie

**Popravi.to**
- "We will report the problem on your behalf" ([popravi.to](https://popravi.to)). Reports dated 12–14 Oct 2026; repo last pushed 2026-05-30 ([GitHub](https://github.com/codeforcroatia/popravi.to)).

**FiksGataMi**
- The old service was "taken out of production in 2024" ([fiksgatami.no/about](https://www.fiksgatami.no/about)).
- 37% of 11,266 reports were marked solved by June 2012 **(secondary; from the operator's blog via search, the page was unreachable)**.

**Aduanku**
- "Reports received are forwarded to local councils by the residents themselves, or by website reviewers and community partners" ([TI-Malaysia, 2014](https://www.transparency.org.my/events/ti-m-and-sinar-launch-website-aduanku-to-report-and-monitor-local-council-issues)).
- In a public-housing project, the management company accepted only paper, so trained community leaders filed reports and they were "transcribed and processed manually" ([mySociety, 2016](https://www.mysociety.org/tag/sinar/)).
- Repo archived after 2019-08-13 ([GitHub](https://github.com/Sinar/fixmystreet)).

**Por Mi Barrio**
- Ran on a formal agreement with Montevideo. About 5% of the city's complaints; 54% "finalised" and 30% in progress (undated). Its public stats page is credited with building credibility ([mySociety case study](https://www.mysociety.org/community/fixmystreet/por-mi-barrio/)).
- `pormibarrio.uy` now redirects to `scatter.uy`, a gambling site (checked 2026-10-19).

**Lessons**
- NGO-run copies tend to die when grants or volunteers run out (§6).
- Two dead civic domains (Por Mi Barrio and Check My School) were taken over by gambling spam. **Plan a shutdown: keep the domain, or redirect it to an archive.**

### 5.4 BudgIT Tracka (Nigeria, 2014–)

**2023/24 annual report** ([PDF](https://budgit.org/wp-content/uploads/2025/01/Tracka2024AnnualReport-copy.pdf), text checked 2026-10-19)
- 1,404 federal projects tracked in 25 states: 720 (51%) completed, 332 (24%) ongoing, 129 (9%) abandoned or fraudulently delivered, 223 (16%) not executed.
- "We submitted 1460 letters to legislators, government officials, MDAs, and anti-corruption agencies. Of these, 1,049 need letters were generated from our town hall meetings, social media direct messaging, and Tracka Mobile app."
- 377 FOI letters went to Ministries, Departments and Agencies (MDAs): "we again recorded a 2.1% response rate"; "eight direct responses from the MDAs".
- 34 letters went to the anti-corruption agencies (ICPC and EFCC).
- Follow-up site visits every 3 months.

**Ten-year report** ([Tracka@10](https://budgit.org/wp-content/uploads/2024/10/Tracka@10Report-copy.pdf))
- 20,846 projects tracked, 12,408 completed. That is not shown to be caused by Tracka.
- The volunteer "Community Champions" (2,000+) work alongside paid state officers.

**Lesson:** even a large, funded intermediary gets about 2% written replies from agencies. Results came from site re-visits, local pressure and public naming, not from replies. Expect office silence and plan for it.

### 5.5 I Change My City (Janaagraha, Bengaluru)

- The app says complaints are "sent to the correct Civic Agency (BBMP, BWSSB, BESCOM)", offers email updates and "follow the engineer", and added "volunteer moderators" in v1.6. The last update was 1.7.2 on 27 Sep 2023 ([App Store](https://apps.apple.com/us/app/ichangemycity/id1239689812)).
- Janaagraha's open dataset ([OpenCity](https://data.opencity.in/dataset/i-change-my-city-data)) gives these shares of complaints resolved or closed. We computed them during this research and did not independently re-run them:

  | Year | Complaints | Resolved or closed |
  |---|---|---|
  | 2019 | 7,383 | 57% |
  | 2020 | 4,492 | 12% |
  | 2021 | 2,645 | 6% |
  | 2022 | 1,551 | 11% |

- The site returns an empty page.
- **Lesson:** an intermediary that depends on one government system's integration falls apart when that link breaks. This is our inference about the 2020 drop.

### 5.6 Colab, Reclame Aqui, Mängelmelder, Zlepšeme Česko, Lapor!

**Colab (Brazil)**
- Citizens can "support, comment and follow" a report. It claims "+80% of demands resolved" (self-reported) ([colab.com.br](https://www.colab.com.br/sou-cidadao)).
- Sold to city halls as SaaS ("Solicite orçamento", request a quote) ([gov page](https://www.colab.com.br/sou-governo)). Free to city halls in its early years **(secondary)** ([WSA](https://wsa-global.org/winner/colab-re/)).
- Not found: what happens to reports where the city isn't a customer.

**Reclame Aqui (Brazil)**
- A consumer-complaint company that also profiles city halls. Respondents answering fewer than 50% of complaints are rated "Não recomendada" (not recommended) **(secondary; the operator's FAQ returned 403)**.
- This puts public pressure on respondents who never joined. Our Scorecard idea is the gentle version; keep it neutral (CONTEXT.md bans rankings).

**Mängelmelder (Germany)**
- About 21% of 2017 reports were actually solved, because many municipalities never send a status back **(secondary)** ([KommunalWiki](https://kommunalwiki.boell.de/index.php/M%C3%A4ngelmelder)).
- **Lesson:** without volunteers chasing replies, the public board fills with stale "open" items.

**Zlepšeme Česko (Czech Republic)**
- A commercial product from the company behind Mobilní rozhlas (2018), routed by geolocation **(secondary)**. The site refused the connection on 2026-10-19.

**Lapor! (Indonesia)**
- A national government system connected to 718 agencies **(secondary)**. Not an intermediary.

**Dropped:** "Mejora Tu Ciudad" (Mexico) could not be verified to exist; Mexico City uses government channels instead **(secondary)** ([Expansión](https://politica.expansion.mx/cdmx/2022/01/06/asi-puedes-reportar-baches-desde-tu-cel-en-la-cdmx)).

### 5.7 Audits, neighbourhood apps, petitions

**Safetipin (India)**
- Volunteers and vehicle-mounted phones score streets on 9 parameters, including Lighting.
- In Delhi, after the report went to the Delhi Government, "the concerned departments of all the MCDs carried out work… fixing the non-operational street lights". The 2019 re-audit still found 2,768 dark spots ([Safetipin Delhi report 2019, pp. 8, 14–15](https://safetipin.com/wp-content/uploads/2019/12/delhi_a_safety_assessment_report_2019.pdf); self-published).
- Peer-reviewed description: Viswanath & Basu (2015), *Gender & Development* 23(1) ([Oxfam](https://policy-practice.oxfam.org/resources/safetipin-an-innovative-mobile-app-to-collect-data-on-womens-safety-in-indian-c-347219/)).
- **Lesson:** a commissioned audit plus a re-audit moved streetlights. A periodic Barangay streetlight walk feeding one Digest could copy this.

**iRAP Star Rating for Schools**
- Community road-safety assessments with offline collection. Outcome figures are self-reported by partners ([ACRS](https://acrs.org.au/?p=5962)).

**Volunteer streetlight walks**
- Seattle, 2009–10: 198 broken lights found by 17 volunteers **(secondary)** ([westsideseattle](https://www.westsideseattle.com/node/22373)).
- New York Upper West Side, 2025: 65 lights found and sent to DOT **(secondary)** ([West Side Spirit](https://www.westsidespirit.com/news/volunteers-identify-65-faulty-or-missing-uws-streetlights-HM4259988)).

**pothole-reporter (India, 2026)**
- An independent Android app. It groups nearby reports into "canonical potholes" and hands them off to the responsible body ([GitHub](https://github.com/coding-parrot/pothole-reporter); 157 stars, created 2026-08-17, pushed 2026-10-14).
- New and unproven, but the closest open-source analogue to our nearby check plus a count.

**Nextdoor for Public Agencies**
- A broadcast channel for agencies, not a report-to-city pipeline ([Nextdoor, 2014](https://blog.nextdoor.com/2014/10/03/nextdoor-opens-its-doors-to-all-local-public-agencies-across-the-country/)).

**Citizen app**
- Pushed a misidentified "suspect" to about 860k users with a bounty **(secondary)** ([VICE](https://www.vice.com/en/article/inside-crime-app-citizen-vigilante)).
- **Lesson:** never let the board point at people. CONTEXT.md's Review rule ("no accusations against named people") is right.

**Change.org**
- Decision makers are notified automatically at 10 signatures. It claims victories but publishes no response rate ([Change.org](https://llms.change.org/what-happens-after-the-signatures-on-changeorg)).

---

## 6. The volunteer-intermediary model

### 6.1 Who else does it, and how it worked

| Intermediary | Who does the forwarding | Channel | Kept alive by | Outcome |
|---|---|---|---|---|
| Járókelő (HU) | ~100 volunteer case handlers on weekly shifts + small paid staff | Email/letter, same day per Report | Legal 30-day reply duty; publicity; 14 years of recognition | ~6,000 solved/yr (self-reported) |
| FixMyStreet (UK) | Software (email) | Email per Report | Charity, funded by council sales | 39% marked fixed |
| Tracka (NG) | Paid state officers + 2,000+ volunteers | Letters, FOI, town halls, site visits | NGO funding | 2.1% FOI replies; results via re-visits and publicity |
| Check My School (PH) | Unpaid infomediaries + ANSA core team | Letters, 2 follow-ups, media (never done) | DepEd MOA, grants | "typically did not hear back"; dead |
| Bantay Lansangan (PH) | CSO secretariat | Raise with DPWH internally | Partnership | 8+ months unanswered; dead |
| Aduanku (MY) | Residents, reviewers, community partners | Email; manual paper relay | Grants | Dead |
| Rappler Agos (PH) | Volunteer verifiers | Alert map to responders | Media org | Unknown |

### 6.2 Failure modes, and how Sumbong stands on each

1. **The office doesn't answer.** Check My School: "typically they did not hear back" (p. 41). Bantay Lansangan: 8+ months. Tracka: 2.1% replies. FixMyStreet: "no control over how or whether they are responded to".
   - *Sumbong today:* Forwarded has no follow-up, no overdue flag and no place to record a reply (§1).
   - *Fix:* §3.4 items 1–3.
2. **Follow-up depends on a few people's initiative.** The CMS study names this "dependence on ANSA-EAP" (p. 48).
   - *Sumbong today:* Digest creation is manual. Nothing tells a Volunteer that a Report has been Forwarded for 30 days.
   - *Fix:* an overdue queue on `/v` and a scheduled follow-up Digest.
3. **Volunteer burnout and supply.**
   - Unpaid infomediaries' "long-term commitment … may be difficult to sustain" (CMS p. 48).
   - Code for America ended its brigade network in 2023: "Volunteerism is down across industries" **(secondary)** ([StateScoop](https://statescoop.com/code-for-america-former-brigades-regroup/)).
   - Járókelő copes with fixed short shifts and a coordinator, and is candid that the work is monotonous.
   - *Sumbong today:* invite-only Volunteers (`inviteVolunteer`), but no shift or workload view.
   - *Fix:* §3.4 item 7, plus a queue that shows age and owner.
4. **Credibility with the office.**
   - FixMyStreet councils objected to re-keying third-party emails ([mySociety, 2015](https://www.mysociety.org/2015/07/29/98-of-councils-accept-fixmystreet-reports-heres-how-we-cope-with-the-rest/)).
   - Járókelő won replies through accurate, well-targeted reports ("they get only the ones that belong to them") and through being known over time.
   - *Sumbong today:* Review plus Misroute keeps letters accurate, and the letter follows each office's Charter channel (`responsible_offices.channel`). Proof of Receipt records the stamp. **This is a strength.**
5. **Liability.** Under *Disini v. Secretary of Justice* (2014), online libel attaches to the original author, not those who merely react ([Lawphil](https://lawphil.net/judjuris/juri2014/feb2014/gr_203335_2014.html)).
   - Volunteers who rewrite Reports into letters could arguably be authors (our interpretation) [CRP §6.4].
   - G-Watch reports officials turning hostile ([ARC, 2024](https://accountabilityresearch.org/monitoring_political_meaning/)). The Citizen app shows the harm of crowd accusations.
   - *Sumbong today:* Review bans accusations against named people (CONTEXT.md); photos are pixelated; the letter is private to the office. **Keep the letter about assets, never people.**
6. **"Resolved" that isn't.**
   - FixMyStreet authorities close a report when they assign a contractor ([FAQ](https://www.fixmystreet.com/faq)).
   - 8888's "resolution" counts tickets acted upon (§4.6).
   - MyNaga users reported recurrence [CRP §8].
   - *Sumbong today:* Volunteer-judged Resolved, an after-photo, and a 30-day Follower reopen. Good; add Follower confirmation (§3.4 item 5).
7. **Dependence on one government link.** ICMyC collapsed after 2019 (§5.5).
   - *Sumbong today:* by design not dependent (ADR 0001).
8. **Funding.**
   - "The lack of viable and proven business models has constrained the growth" ([Knight Foundation, 2017](https://knightfoundation.org/reports/scaling-civic-tech/)).
   - The Civic Tech Field Guide counts dozens of dead tools ([civictech.guide](https://civictech.guide/learning-from-the-civic-tech-graveyard)).
   - *Sumbong today:* two free tiers (ADR 0003). Keep running costs near zero; a later MOU could fund it.
9. **Skewed participation.** Deprived areas report less ([mySociety, 2016](https://www.mysociety.org/2016/11/23/fixmystreet-why-do-some-areas-report-more-than-others/)); covered in [CRP §8].

### 6.3 What the literature says about third parties

- Platforms that move responsiveness "somehow directly involve government".
- For third-party platforms such as FixMyStreet and IChangeMyCity, "there is virtually no knowledge about whether it is government access to decentralized information about problems, or the publicizing of government responses, or both together, that affects responsiveness".
- Civic tech creates a "voice-responsiveness deficit".
- Source for all three: Peixoto & Sifry (eds.), *Civic Tech in the Global South*, World Bank, 2017, pp. 46–47, 53 ([PDF](https://documents1.worldbank.org/curated/en/717091503398213001/pdf/119037-PUB-P133525-PUBLIC-21-8-2017-16-46-30-CivicTechPeixotoSify.pdf)).
- Fox (2015), *World Development* 72: 346–361. Information alone rarely works, while "multi-pronged strategies… bolster state capacity to actually respond": "voice needs teeth to have bite" ([abstract](https://accountabilityresearch.org/publication/social-accountability-what-does-the-evidence-really-say/)).
- Making All Voices Count: "the contribution of tech-enabled, individual, direct voice has been weak" compared with "collective, organised processes that combine online and offline approaches" **(secondary; authors' blog summary)** ([Oxfam FP2P](https://frompoverty.oxfam.org.uk/?p=26329)).
- mySociety warns against using its data for league tables ([mySociety, 2024](https://www.mysociety.org/2024/02/06/statement-from-mysociety-regarding-misuse-of-fixmystreet-data/)). That matches our "no rankings" rule for the Scorecard.

**What this means for Sumbong:** our "teeth" can only be:
- The **Charter and ARTA processing times** printed in the letter.
- **8888's 72-hour rule** as an escalation rung.
- **Publicity**: the board, honest counts, and the Scorecard.
- **Collective weight**: the "Ako rin" count in the letter, and Barangay-level Digests.

Sumbong already has the last two in part. The first two are cheap to add.

---

## 7. What we already do well, gaps, things to avoid

### Already better than most prior art

**Review before anything is public, with pixelation** (`src/app/v/review/[id]/page.tsx`; `set_photo_review`; private originals bucket)
- FixMyStreet moderates after publication.
- Járókelő checks before forwarding but doesn't describe photo masking.

**Misroute as a first-class transition**
- `mark_misroute`, the forwarded→published transition, the `misrouted` email in `src/lib/notify.ts`.
- None of the Philippine channels or intermediaries reviewed has this. Járókelő's "ping-pong" is the problem it solves.

**Letters that match how Philippine offices actually take requests**
- Per-office Charter channel and addressee (`20261018000500_reference_data.sql`); Barangay-scoped Digests (`office_scope = per_barangay`); a printable letter with a "Received by" block; Proof of Receipt (`set_digest_proof`).
- Aduanku hit paper-only respondents and Valenzuela's Charter requires a Request Letter, so this design fits PH reality better than email-only FixMyStreet.

**Collective weight in the letter**
- "N other residents confirmed" and "previously marked fixed" are printed per Report (`src/app/v/digests/[id]/letter/page.tsx`).
- No other intermediary reviewed puts a Me Too count in front of the office.

**No account needed, plus data minimisation and retention**
- Tracking Link hashed in `report_secrets`; EXIF stripped in `src/lib/image.ts`; `purge_expired_personal_data` on pg_cron.
- Járókelő requires registration, and MyNaga links name and phone.

**Honest framing**
- `about.unofficial` and the email footer say this is not an official channel. The emergency diversion to CDRRMO is on the board.

**Rules in the database**
- The status trigger and role-checked functions with `report_events` give an audit trail that most volunteer projects lacked.

### Gaps worth closing (from §3.4)

1. **Post-forwarding tracking:**
   - office replies recorded and shown publicly;
   - an overdue flag based on Charter time;
   - a follow-up Digest for overdue Forwarded Reports (`create_digest` currently selects only Published and Reopened).
2. A written **escalation ladder**: follow-up letter, then 8888 or ARTA, then a public post, with a Coordinator owner.
3. **Processing time and reply-by date in the Digest letter.**
4. **Follow for "Ako rin" residents** (`add_me_too`, `followByEmail`).
5. **Follower fix confirmation** from the Resolved email.
6. **Simple public counts** before the Scorecard, with "resolved" defined as fixed.
7. **Volunteer operations:** shifts, an onboarding doc, a queue showing age and owner.
8. **A shutdown plan for the domain** (two dead civic domains became gambling spam).

### Things to avoid

- **Media-style shaming of people or offices** (Tulfo). Keep the Scorecard neutral and free of rankings.
- **Dependence on one government integration** (ICMyC).
- **Publishing "resolution" figures that count "acted upon"** (8888) or "assigned to contractor" (the FixMyStreet caveat).
- **A board full of stale "open" items with nobody chasing** (Mängelmelder ~21%). If volunteer capacity drops, slow down publishing rather than let Forwarded go silent.
- **Expecting written replies to be the success signal.** Tracka gets 2%. Count fixes seen on the ground (after-photos, Follower confirmations) as the real outcome.
- **Turning on features before volunteers can serve them.** Check My School's SMS was switched on late and went unused.

---

## 8. Unverified / low-confidence

- **Járókelő totals.**
  - The 100,000th solved case (Dec 2024), the 200,000th report (Jul 2026) and "~100 volunteers plus small paid staff" come from Telex and WeLoveBudapest (secondary).
  - The ~6,000-a-year figure and the lifecycle text come from the operator's own site bundle (primary, self-reported). Translations are ours.
- **FiksGataMi** "37% of 11,266 solved (June 2012)" and municipality counts: from search summaries of the operator's blog, which was unreachable.
- **Mängelmelder** ~21% solved (2017): KommunalWiki (secondary).
- **Reclame Aqui** reputation formula, the 50% response threshold, and its city-hall profiles: search summaries; the operator's FAQ returned 403.
- **Colab:** whether reports reach non-customer cities is unknown. Its early free use comes from an award page (secondary). "+80% resolved" is a self-claim.
- **I Change My City** yearly resolution shares were computed from Janaagraha's open dataset during this research and not independently re-run. The cause of the 2020 collapse (BBMP Sahaaya changes) is our inference; the Deccan Herald and Citizen Matters sources could not be fetched.
- **Tracka@10** ten-year totals: read by a research pass, not re-checked line by line (the 2023/24 annual report figures were checked).
- **8888 COA audit figures** (792,685 abandoned calls; no sanction provisions): ABS-CBN and Inquirer excerpts; both pages returned 403.
- **Media sumbungan** details (Tulfo screening, subscriber counts, Isumbong mo kay Tulfo history, BMPM membership, YouScoop): news, Wikipedia, or the host's own column.
- **Rappler Project Agos** current status.
- **FixMyBarangay** outcomes and fate: none found.
- **DevLIVE** current status.
- **Pasig Seermo**'s role and Ugnayan's process details: news and LinkedIn snippets. The Ugnayan eFOI dataset returned 403.
- **MMDA** Hotline 136 scope and Viber number: news and an X bio snippet.
- **Makatizen** delisting: inferred from absence in both stores.
- **Sumbong sa Pangulo** totals after the first month (20,078 by Nov 2025): Inquirer (secondary). Tracking-number claims: third-party guides only.
- **Cabanatuan Facebook groups** as a de-facto sumbungan: not checkable without a logged-in search.
- **Zlepšeme Česko, Lapor!, Huduma (Kenya), Taarifa, #WhatIsARoad:** news, theses or developer blogs only.
- **Code for America brigade quote, Citizen app incident, Nextdoor profiling claims:** news (secondary).
- **MAVC synthesis quotes:** from the authors' blog summary; the IDS PDF returned 403.
- **Our interpretations:**
  - Volunteers writing Digest letters could be "authors" for cyber-libel purposes.
  - 8888 escalation is usable for unanswered Digests to City offices.
  - CELCOR (a private utility) needs a different escalation path (likely the regulator), which was not researched.
- **Fetch failures this round:**
  - Blocked or refused: sumbongsapangulo.ph (Cloudflare challenge; read via headless browser), raffytulfoinaction.com, opengovpartnership.org, the Princeton CCAGG case study, zlepsemecesko.cz, ndreqe.com.
  - Dead: codeforpilipinas.org (does not resolve). pormibarrio.uy and checkmyschool.org now serve gambling content.
