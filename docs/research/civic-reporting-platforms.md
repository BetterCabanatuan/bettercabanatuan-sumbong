# Civic issue-reporting platforms: research for BetterCabanatuan "sumbong" / e-reports

Retrieved 2026-10-18. Scope: a citizen app for Cabanatuan City, Nueva Ecija, where residents report leaning or misaligned poles, potholes, broken streetlights, clogged drainage, uncollected garbage and similar problems.

How to read this: every claim carries the URL it came from. **Primary** means the owner's own docs, code, law text, issuance or store listing. Claims backed only by news, Wikipedia or other secondary sources are tagged **(secondary)**, and they are collected again under [Unverified / low-confidence](#9-unverified--low-confidence).

## Contents

0. [Key findings](#0-key-findings)
1. [SeeClickFix / CivicPlus SeeClickFix 311 CRM](#1-seeclickfix--civicplus-seeclickfix-311-crm)
2. [Open311 GeoReport v2](#2-open311-georeport-v2)
3. [FixMyStreet (mySociety)](#3-fixmystreet-mysociety)
4. [MyNaga App (Naga City)](#4-mynaga-app-naga-city)
5. [Other Philippine channels, and Cabanatuan's own](#5-other-philippine-channels-and-cabanatuans-own)
6. [Philippine legal and regulatory constraints](#6-philippine-legal-and-regulatory-constraints)
7. [Who owns which asset in Cabanatuan (routing table)](#7-who-owns-which-asset-in-cabanatuan-routing-table)
8. [Lessons learned and failure modes](#8-lessons-learned-and-failure-modes)
9. [Unverified / low-confidence](#9-unverified--low-confidence)
10. [Implications for BetterCabanatuan](#10-implications-for-bettercabanatuan)

---

## 0. Key findings

- **BetterCabanatuan is not the LGU.** It is a community-run civic portal at bettercabanatuan.org. Its source is at `github.com/BetterCabanatuan/bettercabanatuan` (CC0, React/Vite) ([repo](https://github.com/BetterCabanatuan/bettercabanatuan)). BetterGov.ph's community-maintained "BetterLGU Directory" lists it as Active, with maintainers @joshuagemvicente and @iampoll ([lgu.bettergov.ph](https://lgu.bettergov.ph/)). The city's official site is cabanatuancity.gov.ph ([city site](https://www.cabanatuancity.gov.ph/)).
- **No official online reporting channel exists in Cabanatuan today.** The official website's "Trash Collection", "Public Utilities" and "Contact Us" menu items all link to `maintenance.php` (checked 2026-10-18) ([city site](https://www.cabanatuancity.gov.ph/)). The Citizen's Charter 2022 (2nd ed.) has three complaint routes: a paper form in the City Hall lobby suggestion box (Public Assistance and Complaint Desk), a text line **0917 813 3247**, and the Mayor's Office (+63 919 081 3749, cabanatuan.lgu@gmail.com) ([Charter pp. 340-341](https://www.cabanatuancity.gov.ph/uploads/photos/detail/61d7d8890742f0.14414526.pdf)).
- **Infrastructure requests currently need a letter to the Mayor.** "Request for clearing of Roads, De-clogging of Drainage Canals" and "Request for Repair of Lighting Fixtures…" are City Engineer's Office services. Both require a "Request letter addressed to the City Mayor", and the Mayor's Office endorses each request to the Construction and Maintenance Division or the Electrical Division. The charter's stated processing times are 1 day 15 minutes for clearing and de-clogging, and 3 hours 15 minutes for lighting repair ([Charter pp. 144-146](https://www.cabanatuancity.gov.ph/uploads/photos/detail/61d7d8890742f0.14414526.pdf)). The lighting service lists "Different Barangays and Offices of LGU" as who may avail, not individual residents.
- **Electric poles in the city belong to CELCOR, not NEECO.** Cabanatuan Electric Corporation (CELCOR) holds the legislative franchise for the distribution system "in the City of Cabanatuan", renewed for 25 years "from the date of approval" by RA 9968 (lapsed into law 6 Feb 2010, so it runs to about Feb 2035) ([RA 9968 text, lawphil](https://lawphil.net/statutes/repacts/ra2010/ra_9968_2010.html); Senate copy [PDF](https://legacy.senate.gov.ph/lisdata/1191710530!.pdf)). NEECO II Area 1 serves Talavera, Lupao, Carranglan, Aliaga, Quezon, Licab, Sto. Domingo, Muñoz, Guimba and Talugtug ([NEECO II Area 1 coverage](https://neeco2area1.com/page/coverage-area)). Telecom poles belong to the telcos.
- **National roads go to DPWH.** The DPWH Nueva Ecija 2nd District Engineering Office is in Brgy. San Isidro, Cabanatuan City ([DPWH](https://www.dpwh.gov.ph/dpwh/node/1536)). DO 132 s.1995 placed Cabanatuan City under a Nueva Ecija engineering district ([DPWH DO 132](https://www.dpwh.gov.ph/dpwh/issuances/department-order/9218)). City roads, drainage and streetlights go to the City Engineer's Office. Barangay roads belong to the barangay (LGC s.17(b)(1)(v)). Garbage goes to the City ENRO, whose Solid Waste Management Division handles complaints, and to the barangays (LGC s.17(b)(1)(iii); [Charter p.140](https://www.cabanatuancity.gov.ph/uploads/photos/detail/61d7d8890742f0.14414526.pdf)).
- **The feedback loop is the main retention lever.** In FixMyStreet data, a successful first report raised the probability of a second report by 57% ([Sjoberg, Mellon & Peixoto 2017](https://doi.org/10.1111/puar.12697)).

---

## 1. SeeClickFix / CivicPlus SeeClickFix 311 CRM

Source note: dev.seeclickfix.com returns a Cloudflare 403 to automated fetches. The API facts below come from that site's own source repository on GitHub ([SeeClickFix/dev.seeclickfix.com](https://github.com/SeeClickFix/dev.seeclickfix.com)). Product facts come from the CivicPlus help center.

### Three APIs
- **Open311 GeoReport v2** (`seeclickfix.com/open311/v2/:organization_id` and an aggregate `/open311/v2`): public issues only, no auth, and reporting without an account is possible ([recommendations.md](https://github.com/SeeClickFix/dev.seeclickfix.com/blob/master/content/v2/recommendations.md)).
- **Public APIv2** (`seeclickfix.com/api/v2`): organized by geography. Reading is anonymous; writing needs auth (same source).
- **APIv2 for Organizations** (`/api/v2/organizations/:id`): the only API that exposes private issues, and only to org members (same source).
- **Common conventions** ([v2.md](https://github.com/SeeClickFix/dev.seeclickfix.com/blob/master/content/v2.md)):
  - Format: JSON with WGS84/GeoJSON geometry.
  - Paging: 20 per page by default, up to 100.
  - Caching: ETag and Last-Modified conditional requests.
  - Rate limits: a User-Agent header is required, and the limit is 20 requests/min. Over the limit returns 429; abusers get a 403 blacklist.
  - Location: the `address` parameter is deprecated, so clients geocode locally and send lat/lng.
  - Data license: CC BY-NC-SA 3.0 US.
  - Auth: Personal Access Tokens or OAuth2 ([authentication.md](https://github.com/SeeClickFix/dev.seeclickfix.com/blob/master/content/v2/overview/authentication.md)).

### Citizen reporting flow
([reporting.md](https://github.com/SeeClickFix/dev.seeclickfix.com/blob/master/content/v2/issues/reporting.md))
1. `GET /issues/new?lat=&lng=` returns the request types available at that point. Each type belongs to an organization; a null organization means a "community" type. An "Other" type is always offered. **The point decides the categories.**
2. `GET /request_types/:id` returns that type's questions.
3. `POST /issues` with `lat`, `lng`, `address`, `request_type_id` and `answers`. Optional: `anonymize_reporter`, device info, and an image sent as multipart.

### Categories and custom questions
- API question types: text, textarea, select, multivaluelist, number, datetime, boolean, and display-only "note". `answer_kept_private` hides an answer from the public, and some types or questions are shown only to specific authenticated users ([reporting.md](https://github.com/SeeClickFix/dev.seeclickfix.com/blob/master/content/v2/issues/reporting.md)).
- In the admin UI, questions can be Required, "Internal Use Only", or publicly answered. "Secondary questions" are asked either at Open (by the reporter) or at Close (answered by staff) ([CivicPlus help](https://www.civicplus.help/seeclickfix/docs/add-a-question-or-message-to-a-request-category)).

### Statuses and workflow
- API statuses are `open`, `acknowledged`, `closed` and `archived` ([issues.md](https://github.com/SeeClickFix/dev.seeclickfix.com/blob/master/content/v2/issues.md)).
- Any authenticated user can toggle Open↔Closed. Only government staff can move Open→Acknowledged or Acknowledged→Closed. Every status change requires a comment. Closed issues auto-archive after 7 days, and archived issues are frozen ([changing_status.md](https://github.com/SeeClickFix/dev.seeclickfix.com/blob/master/content/v2/issues/changing_status.md)).
- The CRM adds internal-only "In Progress" and "Needs Review" statuses, which require an internal comment. Acknowledged and Closed need a public comment, and only an Owner or Manager can close ([CivicPlus help](https://www.civicplus.help/seeclickfix/docs/change-request-status)).

### Public vs private
- Categories are Public (default), **Internal Use Only** (only staff can file, but reports are public), **Private** (no public page; recommended for drug activity, police tips and encampments), or Internal + Private ([CivicPlus help](https://www.civicplus.help/seeclickfix/docs/difference-between-internal-and-private-request-categories)).
- Reporter identity has two modes. **Anonymous** reports display as "An Anonymous SeeClickFix 311 CRM User" but are still tied to an account. **Guest** reports display as "Neighbor" and need no account or email. The organization Owner toggles each mode ([CivicPlus help](https://www.civicplus.help/seeclickfix/docs/anonymous-reporting-compared-to-guest-reporting)).

### Engagement
- Vote (one per user, no downvotes) ([vote.md](https://github.com/SeeClickFix/dev.seeclickfix.com/blob/master/content/v2/issues/vote.md)).
- Comments with an image up to 20 MB ([comments.md](https://github.com/SeeClickFix/dev.seeclickfix.com/blob/master/content/v2/issues/comments.md)).
- Follow ([follow.md](https://github.com/SeeClickFix/dev.seeclickfix.com/blob/master/content/v2/issues/follow.md)).
- Flag an issue or a comment ([flagging.md](https://github.com/SeeClickFix/dev.seeclickfix.com/blob/master/content/v2/issues/flagging.md)).
- "Acknowledge" is a government-only status, not a citizen action ([changing_status.md](https://github.com/SeeClickFix/dev.seeclickfix.com/blob/master/content/v2/issues/changing_status.md)).

### Moderation
A central SeeClickFix team moderates, not city staff, on weekdays 9-6 ET. Flagged content is hidden immediately until reviewed. Keyword matches are held in a queue before posting, and images go through an adult-content classifier ([CivicPlus help](https://www.civicplus.help/seeclickfix/docs/requests-content-moderations-and-flagging)).

### Duplicates
Staff use "Mark as Duplicate" and enter the original's ID. The duplicate is auto-archived and cannot be reopened ([CivicPlus help](https://www.civicplus.help/seeclickfix/docs/mark-a-request-as-a-duplicate)). Duplicate detection before submission appears only in CivicPlus marketing **(secondary)** ([CivicPlus](https://www.civicplus.com/seeclickfix-311-crm/unified-platform/)).

### Assignment, SLAs, notifications
- Each category has a default "automatic assignee", and an Automations engine runs rule-based workflows ([CivicPlus help](https://www.civicplus.help/seeclickfix/docs/assignment-automations)).
- SLAs are set per category and measured open→close in weekday business hours, skipping holidays. They are an internal benchmark with overdue reporting ([CivicPlus help](https://www.civicplus.help/seeclickfix/docs/service-level-agreement-sla-overview)).
- Residents get emails on submitted, acknowledged and closed, and on city or neighbor comments. Templates are customizable ([CivicPlus help](https://www.civicplus.help/seeclickfix/docs/email-notifications)). Notices go out in the object's locale ([v2.md](https://github.com/SeeClickFix/dev.seeclickfix.com/blob/master/content/v2.md)).

**Takeaways for us:**
- Location-scoped categories.
- Government-only "acknowledged".
- Mandatory comment on every status change.
- Per-category privacy and anonymity switches.
- Duplicate-as-archive.
- Per-category SLA in business hours.

---

## 2. Open311 GeoReport v2

Spec: [wiki.open311.org/GeoReport_v2](http://wiki.open311.org/GeoReport_v2/).

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/services.[fmt]` | Service (category) list |
| GET | `/services/{service_code}.[fmt]` | Service definition (attributes), only when `metadata=true` |
| POST | `/requests.[fmt]` | Create a request (API key required) |
| GET | `/tokens/{token}.[fmt]` | Turn an async token into a request id |
| GET | `/requests.[fmt]` | Query requests |
| GET | `/requests/{id}.[fmt]` | Single request |

XML support is mandatory and JSON is optional. Text is UTF-8.

### POST fields
- **Required:** `service_code`, plus a location as **`lat`+`long`, or `address_string`, or `address_id`**.
- **Conditional:** `jurisdiction_id` only on multi-jurisdiction endpoints. `attribute[code]` only when the definition marks the attribute as required.
- **Optional:** `email`, `device_id`, `account_id`, `first_name`, `last_name`, `phone`, `description` (≤4,000 chars, no HTML), `media_url`.
- **Response:** returns `service_request_id` or `token`, optionally with `service_notice`.

### Attributes (custom questions)
- Fields: `variable`, `code`, `datatype` (string, number, datetime, text, singlevaluelist, multivaluelist), `required`, `datatype_description`, `order`, `description` and `values`.

### Statuses and response fields
- **`status` is only `open` or `closed`.**
- Optional: `status_notes`, `agency_responsible`, `service_notice`, `expected_datetime`.
- Always present: `requested_datetime` and `updated_datetime`.

### GET limits
- A query window cannot exceed 90 days. The default is the last 90 days, capped at 1,000 results.

### Who uses it
- The wiki server list shows Chicago, Boston, San Francisco, Washington DC, Baltimore, Toronto, Helsinki, several German cities, and others. The page is undated and may be stale ([servers](http://wiki.open311.org/GeoReport_v2/Servers/)).
- SeeClickFix exposes it per organization ([recommendations.md](https://github.com/SeeClickFix/dev.seeclickfix.com/blob/master/content/v2/recommendations.md)).
- FixMyStreet uses it both as a send method and as a server ([Open311.pm](https://github.com/mysociety/fixmystreet/blob/master/perllib/FixMyStreet/App/Controller/Open311.pm)).

### Worth adopting?
**Not as the internal model, but yes as a thin export or interop layer.** Two statuses and no comments, votes, assignment or moderation are too little to run on. Exposing `GET /services` and `GET /requests` is cheap: map our categories to `service_code`, our questions to attributes, and our state to open/closed plus `status_notes`, `agency_responsible` and `expected_datetime`. That makes the data reusable by researchers, journalists and any future FixMyStreet- or SeeClickFix-style client, and it gives the City a standard pipe if it ever adopts a CRM. The spec has been static for years, so plan to keep a richer native API next to it.

---

## 3. FixMyStreet (mySociety)

Code: [github.com/mysociety/fixmystreet](https://github.com/mysociety/fixmystreet) (Perl/Catalyst, AGPL). Docs live in its `docs/` folder, which is the source of fixmystreet.org.

### Routing by location
- The pin's lat/long goes to **MapIt**, which returns the containing area polygons. FMS then finds the **bodies** covering those areas and their **contacts**. Each contact is one category with a destination, so the category list is built per location ([fms_and_mapit.md](https://github.com/mysociety/fixmystreet/blob/master/docs/customising/fms_and_mapit.md)).
- Boundaries can be "Everywhere", simple areas, OSM data, or your own shapefiles ([boundaries.md](https://github.com/mysociety/fixmystreet/blob/master/docs/customising/boundaries.md)).
- A body has areas and a send method (email by default). A body with no contacts never receives reports. The send method can be set per contact, so some categories go via Open311 and others via email. Contacts can be inactive or soft-deleted ([bodies_and_contacts.md](https://github.com/mysociety/fixmystreet/blob/master/docs/running/bodies_and_contacts.md)).
- Integration levels: email; inject into the back-end; sync status back; publish back-end-created reports. The back-end id is stored as `external_id` ([integration.md](https://github.com/mysociety/fixmystreet/blob/master/docs/customising/integration.md)).
- **Direct fit for Cabanatuan.** One pin can be inside the city polygon and also on a DPWH national road or under a CELCOR line. A body/contact model per area and category handles that cleanly.

### States
- `confirmed` (shown as "Open") and `closed` are hard-coded ([State.pm](https://github.com/mysociety/fixmystreet/blob/master/perllib/FixMyStreet/DB/ResultSet/State.pm)).
- Seeded open states: investigating, in progress, planned, action scheduled.
- Seeded closed states: unable to fix ("No further action"), not responsible, duplicate, internal referral, cancelled; plus fixed ([fixture.sql](https://github.com/mysociety/fixmystreet/blob/master/db/fixture.sql)).
- Also `unconfirmed`, `hidden`, `partial`, and "fixed - user" vs "fixed - council". Admins can edit the list ([admin_manual.md](https://github.com/mysociety/fixmystreet/blob/master/docs/running/admin_manual.md)).
- **"Not responsible"** is the state we need for poles and national roads that belong to someone else.

### Confirmation, surveys, anonymity
- Reports stay unconfirmed and invisible until the emailed link is clicked, unless the user was logged in or an admin confirms. mySociety says this prevents spam "almost entirely" ([admin_manual.md](https://github.com/mysociety/fixmystreet/blob/master/docs/running/admin_manual.md)).
- A survey goes to the reporter about four weeks later asking whether the problem was fixed ([glossary.md](https://github.com/mysociety/fixmystreet/blob/master/docs/glossary.md)).
- Names are hidden publicly by default; users opt in to show theirs. Contact details go only to the authority ([citizens-experience.md](https://github.com/mysociety/fixmystreet/blob/master/docs/pro-manual/citizens-experience.md)). Fully anonymous reporting can be enabled per category (`anonymous_allowed`) and files reports under a shared account ([Cobrand/Default.pm](https://github.com/mysociety/fixmystreet/blob/master/perllib/FixMyStreet/Cobrand/Default.pm)). The schema has `problem.anonymous` and `problem.non_public` ([schema.sql](https://github.com/mysociety/fixmystreet/blob/master/db/schema.sql)).

### Moderation and abuse
- Moderation is reactive by default: every report has a "report abuse" link, and admins or staff can hide reports, which stay in the database. Pre-moderation exists in code but is enabled only for the Zurich cobrand ([admin_manual.md](https://github.com/mysociety/fixmystreet/blob/master/docs/running/admin_manual.md)).
- An `abuse` table bans email addresses ([users.md](https://github.com/mysociety/fixmystreet/blob/master/docs/running/users.md)).
- Moderators can edit report text. The original is kept in `moderation_original_data`, and actions go to `admin_log` ([Moderate.pm](https://github.com/mysociety/fixmystreet/blob/master/perllib/FixMyStreet/App/Controller/Moderate.pm)).

### Duplicate detection
- While reporting, users see nearby open reports in the same category and can subscribe instead of filing a new one ([citizens-experience.md](https://github.com/mysociety/fixmystreet/blob/master/docs/pro-manual/citizens-experience.md)).
- In code, `/around/nearby` returns 5 results. The default radius is **250 m** for suggestions and **1,000 m** for inspector de-duplication, overridable per category or cobrand ([Report.pm](https://github.com/mysociety/fixmystreet/blob/master/perllib/FixMyStreet/App/Controller/Report.pm)).
- The "duplicate" state stores `duplicate_of`, and the original keeps a `duplicates` list ([Problem.pm](https://github.com/mysociety/fixmystreet/blob/master/perllib/FixMyStreet/DB/Result/Problem.pm)).

### Cobrands and Pro
A cobrand is a per-hostname theme plus code overrides ([glossary.md](https://github.com/mysociety/fixmystreet/blob/master/docs/glossary.md)). FixMyStreet Pro is SocietyWorks' paid council edition. It adds staff tools, an embedded council-branded site, and an offline PWA with drafts ([pro-manual](https://github.com/mysociety/fixmystreet/blob/master/docs/pro-manual/index.md)).

---

## 4. MyNaga App (Naga City)

### What it is
- MyNaga is the city's "official mobile application developed in partnership with the Local Government of Naga City", powered by Easybus PH. It offers city service guides, news, emergency hotlines, and "Report community issues directly from your phone" ([naga.gov.ph](https://www2.naga.gov.ph/available-mynaga-app/)).
- Store listings: [Google Play](https://play.google.com/store/apps/details?id=com.easybusph.myNaga&hl=en_US) (package `com.easybusph.myNaga`) and the [App Store](https://apps.apple.com/ph/app/mynaga/id6748720972) (seller Easybus Ph Inc). The App Store showed 4.8★ from 103 ratings on retrieval.
- Launch: the city says it launched on **18 Aug 2025**. The App Store version history starts at v1.0 on 16 Aug 2025 ([naga.gov.ph](https://www2.naga.gov.ph/asian-con-cites-mynaga/); [App Store](https://apps.apple.com/ph/app/mynaga/id6748720972)).

### Report categories and volume
- Categories named by the city: broken streetlights, sidewalk obstructions, illegal parking, defective traffic lights, tree trimming, declogging, uncollected garbage and animal cruelty, "among others" ([naga.gov.ph, posted 17 Oct 2025](https://www2.naga.gov.ph/asian-con-cites-mynaga/)).
- Volume: **2,074 reports, 1,213 resolved** (about 58%) as of that article (same source). I found no newer official figures.

### Response-time commitment
- "Public safety concerns are usually resolved within minutes to 12 hours". Reports that need multiple processes are queued while resources are limited (same source). No per-department SLA table is published.

### How reports reach departments
- The city describes "a centralized database" used to track recurring issues (same source). It names no per-department routing rules.
- AI triage by a vendor (AIRA Labs) is reported only by Rappler **(secondary)**.
- Ordinance 2026-062 ("CitiZend") is the first published routing rule. Traffic-violation reports go to the Public Safety Office's **Traffic Management Center**, which reviews them and may issue a Notice of Violation. The City Legal Office decides within 72 hours of the respondent's answer ([Ord. 2026-062](https://www2.naga.gov.ph/sp_ordinances/ordinance-no-2026-062/)).

### Design details from the store changelog
([App Store](https://apps.apple.com/ph/app/mynaga/id6748720972))

| Version | Date | Change |
|---|---|---|
| 1.0.2 | Aug 2025 | 400-character limit on reports |
| 1.0.5 | Sept 2025 | Extra address fields; visible report control number; more categories |
| 1.0.6 | Sept 2025 | "No" response for "pending confirmation" status (a reporter can say the fix didn't hold) |
| 1.1.1 | Dec 2025 | Rate and give feedback on resolved cases |
| 2.1.2 | — | Cancel / resolve / reject report |
| 2.2.x | — | "DisipliNaga" categories (in-app camera with geotag for illegal parking) |

- Privacy labels declare precise location, name, phone, address, photos and user ID as "linked to you" (same source).
- A user review asks for a way to mark a case not complied with, because problems recurred after being "cleared" (same source).

### CitiZend Ordinance (Ord. No. 2026-062, enacted 26 May 2026)
([naga.gov.ph](https://www2.naga.gov.ph/sp_ordinances/ordinance-no-2026-062/))
- Proof may be a live photo or video captured in MyNaga, with GPS coordinates, timestamp and device ID "when practicable".
- Anonymous reports are accepted if the required information and proof are present.
- The reporter's identity is required for verification but excluded from the Notice of Violation.
- Reports that are "unverifiable, incomplete, patently meant to harass and prank, or fraudulent" may be summarily dismissed.
- All TMC actions are logged for audit.
- The ordinance has **no data-privacy section**.

### Awards
- The city says MyNaga was invited to exhibit at an international digital-transformation conference in Pasig City on 1-2 Oct 2025, and the headline calls it a "benchmark" ([naga.gov.ph](https://www2.naga.gov.ph/asian-con-cites-mynaga/)). No formal award was found.

---

## 5. Other Philippine channels, and Cabanatuan's own

### National

**8888 Citizens' Complaint Hotline**
- Established by EO 6 s.2016 for complaints of red tape and corruption. EO 6 s.5(d) requires "concrete and specific action within seventy-two (72) hours from receipt" by the agency ([EO 6](https://lawphil.net/executive/execord/eo2016/eo_6_2016.html); [8888.gov.ph](https://8888.gov.ph/)). LGU coverage is not explicit; see §6.3.
- Channels: call or text 8888, or the web form. Email 8888complaint@op.gov.ph ([contact](https://8888.gov.ph/page/contact-us)).
- The IRR says the 8888 Center refers a complaint to the agency within **32 minutes**. The agency must take "concrete and specific action" within **72 hours**, which is non-extendible. After-hours receipts start counting at 8:00 next working day. If an agency misses the deadline, it gets a follow-up and another 72 hours.
- Anonymous complaints are allowed. These IRR facts come from [8888.gov.ph IRR](https://8888.gov.ph/implementing-rules-and-regulations-irr/) and [FAQ](https://8888.gov.ph/frequently-asked-questions-faqs/); the pages returned 403 to my fetch, so I took the content from search-result extracts of the official pages. Re-verify by hand.
- Cabanatuan's own charter lists 8888 (as the "Presidential Complaint Center", pcc@malacanang.gov.ph), ARTA (complaints@arta.gov.ph, 8-478-5093) and the Contact Center ng Bayan (+63 908 881 6565) as escalation channels ([Charter pp. 340-341](https://www.cabanatuancity.gov.ph/uploads/photos/detail/61d7d8890742f0.14414526.pdf)).

**eGovPH Super App (DICT)**
- "eReport" (the People's Feedback Mechanism) launched with the eLGU system in July 2023 for crime, fire and emergencies. It links to the PNP iReport and BFP systems ([PNA](https://www.pna.gov.ph/articles/1205835)).
- Later reporting modules include DTI e-commerce complaints (Nov 2024, under RA 11967) ([PNA](https://www.pna.gov.ph/articles/1237165)) and DOE "Gas Station Concerns" (2026). The gas-station module requires mobile OTP and face verification and issues a ticket number ([PIA](https://pia.gov.ph/press-release/doe-dict-launch-gas-station-concerns-feature-on-egovph-app-to-strengthen-consumer-protection/)).
- An ARTA eCMS complaint module was added in Sept 2025 **(secondary)** ([Interaksyon](https://interaksyon.philstar.com/trends-spotlights/2025/09/15/302085/how-to-file-complaint-slow-government-services-egovph-app/)).
- I found no eGovPH module for local infrastructure (potholes, streetlights). PNA and PIA are state news agencies, so these are medium confidence.

### Other cities

**Quezon City: QC iReport**
- Available on the QC e-Services site and the QCitizen app. Beta categories: streetlights out, clogged drainage, illegal gambling, illegal parking, unauthorized structures, businesses without permits, potholes, and uncollected household garbage.
- Guests can report with only an email OTP.
- Each report is "automatically forwarded to the office assigned to that type of incident". Departments have **72 hours to act**, and infrastructure items get at least an update within 72 hours.
- Reports cannot be edited or cancelled, but drafts are allowed. Personal information is never posted publicly.
- Anything outside the categories goes to Helpline 122 (24/7) ([QC iReport FAQ](https://quezoncity.gov.ph/faqs/faq-ireport/); [QC iReport program](https://quezoncity.gov.ph/program/qc-ireport/)).
- QC also runs an 8888 Action Team ([QC PDF](https://quezoncity.gov.ph/wp-content/uploads/2026/01/The-Quezon-City-Citizens-Complaint-Hotline-8888-Action-Team.pdf)).
- **QC iReport is the closest PH analogue to what we're building.**

**Pasig: Ugnayan sa Pasig**
- A 24/7 hotline plus email and social media, run by the Public Participation, Accountability and Transparency Unit **(secondary, 2015-era)** ([Rappler](https://www.rappler.com/?p=235464)). I found no dedicated Pasig issue-reporting app; "PasigPass" is a 2020 QR contact-tracing tool ([MB](https://mb.com.ph/2020/10/09/pasig-city-unveils-new-health-monitoring-system/)).

**Valenzuela: PASPAS**
- PASPAS is an online business-permit system, not a complaint channel **(secondary)** ([Manila Times](https://www.manilatimes.net/2019/11/13/news/national/phs-first-10-second-permit-application-system-launched-in-valenzuela/656180/)).

**Makati: Makatizen app**
- The mayor urged residents to use the Makatizen app to report crimes and illegal activity (15,000 users in 2020) **(secondary)** ([Inquirer](https://newsinfo.inquirer.net/1231184/makati-govt-urges-citizens-to-stay-vigilant-on-prostitution-dens)).

### Cabanatuan City: existing official channels

**Website**
- cabanatuancity.gov.ph has no online report form. "Trash Collection", "Public Utilities" and "Contact Us" all point to `maintenance.php` (checked 2026-10-18). The site does host the Citizen's Charter PDF, project pages and an "Emergency Hotlines" / "Office Contacts" page ([city site](https://www.cabanatuancity.gov.ph/)).

**Citizen's Charter 2022 (2nd ed.)**
([PDF](https://www.cabanatuancity.gov.ph/uploads/photos/detail/61d7d8890742f0.14414526.pdf))
- *Feedback and complaints (pp. 340-341):*
  - Submit a form at the suggestion box of the Public Assistance and Complaint Desk in the City Hall lobby. CHRMO collects the forms daily and endorses significant feedback to the Office of the City Mayor, which transmits it to the concerned offices.
  - Concerns can also be texted to **0917 813 3247**.
  - Mayor's Office: +63 919 081 3749, cabanatuan.lgu@gmail.com.
- *City Engineer's Office, "Request for clearing of Roads, De-clogging of Drainage Canals and Other Maintenance Services" (pp. 144-145):*
  - Classified "Complex", G2C, open to "Constituents of City of Cabanatuan".
  - Requires a request letter addressed to the City Mayor.
  - The City Engineer endorses it to the Construction and Maintenance Division. Inspection and clearing take "1 day or more (depending on the area/volume)"; total 1 day 15 min.
- *City Engineer's Office, "Request for Repair of Lighting Fixtures, Electrification, Trouble Shooting of Electrical Wirings…" (pp. 145-146):*
  - Who may avail: "Different Barangays and Offices of LGU". Requires a letter to the Mayor.
  - Handled by the Electrical Division; total 3 hours 15 min.
  - **Implication:** streetlight reports from residents probably have to be channeled through the barangay or the Mayor's Office under the current charter.
- *City ENRO, "Filing of Complaint" (p.140 of the CCENRO section):*
  - "Complaints for CCENRO lodged through the Office of the City Mayor". Requires a valid ID and a complaint letter to the Mayor.
  - The Enforcement and Regulatory, Ecological Management, and **Solid Waste Management** Divisions inspect within 1 day, coordinate with barangay officials, and may issue a Notice of Violation.
- *Department lines (pp. 342-345, as transcribed in the BetterCabanatuan repo):* City Engineer 0919-081-3694, CENRO 0919-081-4509. Hours Mon-Fri 8-5 ([department-contacts.yaml](https://github.com/BetterCabanatuan/bettercabanatuan/blob/main/src/data/department-contacts.yaml)).

**Facebook**
- The city government posts on facebook.com/lgucabanatuan; the BetterCabanatuan portal imports its posts as "City Government of Cabanatuan" ([siteConfig.ts](https://github.com/BetterCabanatuan/bettercabanatuan/blob/main/src/lib/siteConfig.ts)). I could not verify the page's official status from facebook.com directly (no automated access).
- CDRRMO runs its own page, facebook.com/cabanatuancdrrmo (same repo).

**Apps**
- No Cabanatuan City app was found in a web search on 2026-10-18, so there is no primary source to cite. The DILG eLGU rollout included Region III LGUs, but Cabanatuan was not named ([PNA](https://www.pna.gov.ph/articles/1205835)).

### BetterCabanatuan: what it is
- A community-run, volunteer civic portal: "a community-driven civic platform that makes public information about Cabanatuan City more accessible". It is a CC0 starter kit "any Philippine LGU can fork". Stack: React 19, Vite 7, TS, Tailwind 4, Leaflet, i18next ([repo README](https://github.com/BetterCabanatuan/bettercabanatuan)).
- Its README credits UI components from BetterGov's `@bettergov/kapwa` library. Its data comes from sibling BetterGov APIs (budget, juris, DPWH flood control, PSGC), committed as YAML with no runtime calls ([BETTERGOV_PROJECTS.md](https://github.com/BetterCabanatuan/bettercabanatuan/blob/main/BETTERGOV_PROJECTS.md)).
- Listed in BetterGov.ph's community-maintained **BetterLGU Directory** as Active, with maintainers **@joshuagemvicente and @iampoll** ([lgu.bettergov.ph](https://lgu.bettergov.ph/)).
- The portal tells users that official transactions go through the city government and cabanatuancity.gov.ph (search-result extract of [bettercabanatuan.org](https://bettercabanatuan.org/); the page itself is a JS SPA, so the about text was not fetchable as HTML).
- **It is not an LGU office.** That has legal consequences; see §6.

---

## 6. Philippine legal and regulatory constraints

Access note: privacy.gov.ph, officialgazette.gov.ph and arta.gov.ph return 403 to automated fetches. Their documents were read from Wayback Machine copies of the official file URLs, which are cited below. Statute text is from lawphil.net. The RA 11032 IRR is a scanned PDF and was read through OCR, so its wording may contain small OCR errors.

### 6.1 Data Privacy Act of 2012 (RA 10173) and its 2016 IRR
([law](https://lawphil.net/statutes/repacts/ra2012/ra_10173_2012.html); [IRR](https://privacy.gov.ph/implementing-rules-regulations-data-privacy-act-2012/))

**What counts as personal and sensitive information (s.3)**
- *Personal information* (s.3(g)) is information from which identity "is apparent or can be reasonably and directly ascertained… or when put together with other information would directly and certainly identify an individual." That covers the reporter's name and contact details, and an identifiable face in a photo.
- *Sensitive personal information* (s.3(l)) includes information about "any proceeding for any offense committed or **alleged to have been committed**" (s.3(l)(2)). A report accusing a named or visible person of, say, illegal dumping is arguably SPI. **(Our interpretation.)**

**Lawful basis**
- An LGU-run app fits s.12(e): "to fulfill functions of public authority which necessarily includes the processing of personal data for the fulfillment of its mandate."
- A volunteer operator acting as its own controller would rely on consent (s.12(a)) or legitimate interest (s.12(f)).
- SPI about an alleged violator can be passed to the LGU under s.13(f) ("when provided to government or public authority"). That basis does **not** cover publishing it.
- The "public authority" special case (s.4(e), IRR s.5(d)) applies "only to the minimum extent" necessary. Security duties still apply. NPC Advisory Opinion 2024-018 says the authority "must still comply with the other requirements of the DPA" ([AO 2024-018](https://privacy.gov.ph/wp-content/uploads/2024/12/NPC-Advisory-Opinion-No.-2024-018-Toll-Regulatory-Board_Redacted.pdf)).
- Information about government officers relating to their official functions is outside the Act (s.4(a)).

**Principles and data subject rights**
- s.11: transparency, legitimate purpose and proportionality. Data must be "adequate and not excessive" and kept "only for as long as necessary."
- s.16 rights: to be informed, access, correction, and erasure or blocking. s.18 adds portability.

**Security and accountability**
- s.20 requires organizational, physical and technical measures, and processors are bound too.
- IRR s.26(a): every controller and processor must designate a DPO or compliance officer.
- s.21: the controller stays accountable for data passed to third parties.
- Penalties (ss.25-36): unauthorized processing of SPI carries 3-6 years and PHP 500k-4M. The maximum applies when 100 or more people are affected.

**Registration and DPO: NPC Circular 2022-04** ([PDF](https://privacy.gov.ph/wp-content/uploads/2023/05/Circular-2022-04.pdf))
- *Who must register (s.5):* controllers or processors with 250 or more employees, **or** processing SPI of 1,000 or more people, **or** processing "likely to pose a risk to the rights and freedoms of data subjects." Systems with automated decision-making or profiling must always be registered.
- *Deadline (s.7):* new systems are registered within 20 days.
- *City DPO (s.10):* cities must register a DPO "with a rank not lower than Department Head", and barangay-level compliance officers may sit under the city DPO.
- **Implication:** if the City adopts the app, it is a new data processing system for the City DPO to register.

**Breach notification: NPC Circular 16-03** ([PDF](https://privacy.gov.ph/wp-content/uploads/2022/01/sgd-npc-circular-16-03-personal-data-breach-management.pdf))
- When it applies: a breach involving SPI or identity-fraud-enabling data (including passwords and ID copies) that carries a "real risk of serious harm."
- Who and when: the NPC is notified "within seventy-two (72) hours" (s.17(A)), and affected data subjects within the same window (s.18(A)).
- A full report follows within 5 days.

**Privacy notice: NPC Circular 2023-04, Guidelines on Consent** ([PDF](https://privacy.gov.ph/wp-content/uploads/2023/11/NPC-Circular-No.-2023-04_Guidelines-on-Consent_07Nov2023.pdf))
- "A privacy notice is required in any instance of processing," including non-consent bases (s.3(D)(5)(a)).
- Format: layered, in plain language, with "at set-up" and "just-in-time" variants for apps.
- Language: one the audience understands (s.3(E)), so Filipino and English.
- Data posted publicly is not blanket consent for other uses (s.17).

**Data sharing: NPC Circular 2020-03** ([PDF](https://www.privacy.gov.ph/wp-content/uploads/2021/01/Circular-Data-Sharing-Agreement-amending-16-02-21-Dec-2020-clean-copy-FINAL-LYA-and-JDN-signed-minor-edit.pdf))
- *Controller-to-controller sharing* "may be covered by" a data sharing agreement (s.8). A DSA is not strictly mandatory, but the NPC treats it as evidence of accountability. Data subjects must be told the recipients and purpose before sharing (s.5).
- *Controller-to-processor outsourcing* is excluded from the circular (s.1). It is governed by DPA s.14 and the IRR's subcontracting rules instead.
- **This decides the BetterCabanatuan structure.** In model A, volunteers are an independent controller forwarding to the City: they need their own notice, DPO, registration or sworn declaration, and a DSA with the City. In model B, volunteers build or host for the City as a processor: they need an outsourcing agreement, and the City is the controller.

### 6.2 Photos, plates, CCTV, posting online, location

**CCTV: NPC Circular 2024-02** (9 Aug 2024) ([PDF](https://privacy.gov.ph/wp-content/uploads/2024/08/NPC-Circular-No.-2024-02-CCTV-Systems.pdf))
- It succeeds Advisory 2020-04 and covers fixed cameras, so it is not directly binding on citizen phone photos. It is still the closest NPC framework for imagery of people in public.
- *Masking* (s.2(C)) is defined as "blurring or covering faces, body parts, or other objects that will reveal personal data."
- *Publishing* (s.7(B)(4)): no disclosure of identifiable images "for amusement or entertainment" without consent. Bystanders must be masked "before making the footage public."
- *Storage and retention* (s.5(B)(3)-(4)): encrypted storage, restricted access and access logs. Retention is "only for as long as necessary", not set by storage capacity.

**Plate numbers**
- On their own they are not personal information: "plate numbers only identify a vehicle and not the user or its owner" without access to other databases ([AO 2024-018](https://privacy.gov.ph/wp-content/uploads/2024/12/NPC-Advisory-Opinion-No.-2024-018-Toll-Regulatory-Board_Redacted.pdf)).
- A vehicle owner's name and address *are* personal information. NPC AO 2022-005 involved a resident who photographed plates and asked the LTO for owner details ([AO 2022-005](https://privacy.gov.ph/wp-content/uploads/2022/08/Advisory-Opinion-No.-2022-005_Redacted.pdf)).
- **Implication:** a plate combined with a face, a home location or a lookup becomes personal information, so blur plates on public display.

**Posting photos of people online**
- "A person's data privacy rights do not cease even when one is in a public space" ([AO 2021-014](https://privacy.gov.ph/wp-content/uploads/2022/01/Redacted-Advisory-Opinion-No.-2021-014.pdf)).
- Candid photos posted online "may be considered as unauthorized processing" ([AO 2018-051](https://privacy.gov.ph/wp-content/uploads/2022/01/AONo_2018-051.pdf)).
- No NPC issuance was found specifically on LGU "name and shame" posts.

**Location data and apps**
- No dedicated NPC circular on location data was found.
- NPC's 2020 guidance to LGU contact-tracing app developers calls for privacy by design, opt-in, deletion at the end of the purpose, and a PIA **(low-confidence, snippet only)** ([privacy.gov.ph/?p=11622](https://privacy.gov.ph/?p=11622)).
- NPC Circular 2023-06 (security of personal data) adds privacy by design and default and PIAs **(low-confidence on details)**.

### 6.3 RA 11032 (Ease of Doing Business Act) / ARTA, and RA 9485
([RA 11032](https://lawphil.net/statutes/repacts/ra2018/ra_11032_2018.html); [IRR, JMC 2019-001](https://arta.gov.ph/wp-content/uploads/2020/07/JMC2019-001_-_Implementing_Rules_and_Regulations_of_RA_11032.pdf); [RA 9485](https://lawphil.net/statutes/repacts/ra2007/ra_9485_2007.html))

**Coverage and processing times**
- The Act covers all government offices "including local government units" (amended s.3). The head of office, here the Mayor, is primarily responsible (s.8).
- Processing times (amended s.9(b)): **3 working days** for simple transactions, **7** for complex, and **20** for highly technical ones. Each can be extended once, with notice.
- Unclassified services are treated as simple (IRR Rule IV s.3(a)).

**Does it apply to complaints?** Indirectly.
- "Government service" covers applications for privileges, licenses, permits and so on (s.4(f)), plus "frontline services enrolled in the existing Citizen's Charter" (IRR definition (gg)).
- Cabanatuan's charter enrolls "Request for clearing of Roads, De-clogging of Drainage Canals" and lighting repair as **Complex**, so 7 working days. CENRO "Filing of Complaint" is **Simple**, so 3 working days ([Charter pp.140-146](https://www.cabanatuancity.gov.ph/uploads/photos/detail/61d7d8890742f0.14414526.pdf)).
- Reports arriving through those charter services therefore carry ARTA time limits. **(Our interpretation.)**

**Feedback and complaints mechanism**
- "Each office or agency shall establish a public assistance/complaints desk in all their offices" (amended s.9(h)).
- The office "shall institute hotline numbers, short message service, information communication technology, or other mechanisms by which the clients may adequately express their complaints, comments, or suggestions" (IRR Rule VII s.9). **This is a direct legal hook for an LGU-adopted app.**
- Feedback results go into the annual report (amended s.20), and Client Satisfaction Survey results go to ARTA (IRR Rule IV s.3(b)).

**Citizen's Charter**
- It must state "the procedure for filing complaints" (amended s.6(g)) and list the escalation contacts: PCC/8888, ARTA, the Contact Center ng Bayan and the CSC (IRR Rule IV s.2(g)).
- It is updated by 31 March each year.

**Anonymous complaints**
- Complaints that don't identify the complainant "will be acted upon and treated as an anonymous complaint" (IRR Rule XIV s.2(a)(ii)).
- ARTA MC 2020-05 lists anonymous complaints as a valid filing mode ([PDF](https://law.upd.edu.ph/wp-content/uploads/2020/07/ARTA-MC-No-05-Series-of-2020.pdf)).

**Hotline 8888**
- EO 6 s.2016 created the 8888 Citizens' Complaint Center for complaints of red tape and corruption ([EO 6](https://lawphil.net/executive/execord/eo2016/eo_6_2016.html)).
- **"concrete and specific action within seventy-two (72) hours from receipt"** (s.5(d)). Non-response is a ground for administrative sanctions (s.10).
- Sec. 2 names national agencies, GOCCs and "other instrumentalities", not LGUs explicitly. LGU "Permanent Action Teams" for 8888 under DILG MC 2017-109 are **low-confidence (secondary)**.
- EO 38 s.2023 moved 8888 and the Presidential Action Center under the STAR Office in the Office of the Executive Secretary ([EO 38](https://lawphil.net/executive/execord/eo2023/eo_38_2023.html)).

### 6.4 Other laws

**Cyber-libel**
- RA 10175 s.4(c)(4) penalizes libel "committed through a computer system", one degree higher (s.6) ([RA 10175](https://lawphil.net/statutes/repacts/ra2012/ra_10175_2012.html)).
- *Disini v. Secretary of Justice* (G.R. 203335, 2014) holds the original author liable, but not those who merely receive and react to a post ([SC](https://lawphil.net/judjuris/juri2014/feb2014/gr_203335_2014.html)).
- Malice is presumed "even if it be true", except for "a private communication made… in the performance of any legal, moral or social duty" (RPC Art. 354) ([RPC](https://lawphil.net/statutes/acts/act1930/act_3815_1930.html)).
- **Implication:** a report sent privately to the responsible office is likely privileged. A public feed that names people is not. **(Our interpretation.)**

**RA 9003 s.10** ([lawphil](https://lawphil.net/statutes/repacts/ra2001/ra_9003_2001.html))
- "Segregation and collection of solid waste shall be conducted at the barangay level specifically for biodegradable, compostable and reusable wastes: Provided, That the collection of non-recyclable materials and special wastes shall be the responsibility of the municipality or city."
- Garbage routing therefore splits by waste type.

**RA 11361 (Anti-Obstruction of Power Lines Act)**
- The power-line operator has the primary duty to keep the corridor clear (see §7) ([lawphil](https://lawphil.net/statutes/repacts/ra2019/ra_11361_2019.html)).

---

## 7. Who owns which asset in Cabanatuan (routing table)

Legal baseline (Local Government Code, RA 7160, s.17; text via [lawphil](https://lawphil.net/statutes/repacts/ra1991/ra_7160_1991.html)):
- **Barangays** provide "Maintenance of barangay roads and bridges and water supply systems" (s.17(b)(1)(v)) and "Services and facilities related to general hygiene and sanitation, beautification, and solid waste collection" (s.17(b)(1)(iii)).
- **Municipalities** provide "Infrastructure facilities intended primarily to service the needs of the residents… including… municipal roads and bridges… drainage and sewerage, and flood control; traffic signals and road signs" (s.17(b)(2)(viii)), and a "Solid waste disposal system or environmental management system…" (s.17(b)(2)(vi)).
- **Cities** provide "All the services and facilities of the municipality and province" plus communication and transport facilities (s.17(b)(4)).
- Cabanatuan is a **1st class component city** with 89 barangays ([Charter p.5](https://www.cabanatuancity.gov.ph/uploads/photos/detail/61d7d8890742f0.14414526.pdf)).

| Asset / issue | Responsible body | Evidence | Confidence |
|---|---|---|---|
| Electric distribution poles, lines, leaning electric poles, sagging lines | **Cabanatuan Electric Corporation (CELCOR)**, a private distribution utility | RA 9968 (2010) renews CELCOR's franchise "to construct, operate and maintain a distribution system… in the City of Cabanatuan" for 25 years ([RA 9968 text, lawphil](https://lawphil.net/statutes/repacts/ra2010/ra_9968_2010.html); Senate copy [PDF](https://legacy.senate.gov.ph/lisdata/1191710530!.pdf)). The City's own Charter lists a "Notice to Proceed/Memorandum of Agreement" from CELCOR among the requirements for a permit, next to a DPWH clearance and DICT for mobile network operators ([Charter p.174](https://www.cabanatuancity.gov.ph/uploads/photos/detail/61d7d8890742f0.14414526.pdf)). | High |
| Same, in edge barangays | Possibly NEECO II Area 2 near Santa Rosa | OSM wiki (citing DOE) says CELCOR serves "Cabanatuan City and parts of Santa Rosa"; NEECO II Area 2 serves Santa Rosa, Palayan, Laur etc. "excluding Cabanatuan City" ([OSM wiki](https://wiki.openstreetmap.org/wiki/Power_networks/Philippines/Operators)) **(secondary)**. NEECO II Area 1 does **not** list Cabanatuan ([NEECO II Area 1](https://neeco2area1.com/page/coverage-area)). | Medium |
| Trees and structures obstructing power lines | The power-line operator (CELCOR) has the primary duty to clear; owners must report and allow access | RA 11361 (Anti-Obstruction of Power Lines Act), ss.5-8 ([lawphil](https://lawphil.net/statutes/repacts/ra2019/ra_11361_2019.html)) | High |
| Overloaded or hazardous poles, dangling or "spaghetti" cables (electric and telecom) | The LGU inspects and assesses within its territory; a task force clears overloaded or hazardous poles. Cables belong to the pole users (telcos, cable TV) | DILG MC 2023-115 "Inspection and Assessment of the Structural Integrity and Safety of All Poles and Towers Bearing Power Lines and Telecommunication Cables within the LGU's Territorial Jurisdiction" ([DILG](https://dilg.gov.ph/issuances/mc/Inspection-and-Assessment-of-the-Structural-Integrity-and-Safety-of-All-Poles-and-Towers-Bearing-Power-Lines-and-Telecommunication-Cables-within-the-Local-Government-Units-Territorial-Jurisdiction/3780)), amended by DILG MC 2024-122 (task force; cables attached without the pole owner's approval) ([batasnatin copy](https://batasnatin.com/laws/mc-2024-122)) | Medium-High (full text not read) |
| Telecom poles (PLDT, Globe, Converge, cable TV) | The owning telco; NTC regulates | No primary routing source found | Low |
| Electric poles obstructing a national road right-of-way | DPWH and the utility relocate under DOE-DPWH Joint Circulars (JC 3 s.2021 mandated immediate relocation; JC 4 covers EC poles) | [DOE-DPWH JC 4](https://doe.gov.ph/sites/default/files/pdf/announcements/DOE-DPWH_JC_No.4_on_Relocation_of_Poles.pdf); [DPWH DO 98 s.2020](https://dpwh.gov.ph/DPWH/sites/default/files/issuances/DO_98_s2020.pdf); [DPWH news](https://dpwh.gov.ph/dpwh/news/29916) | High (applies to national roads) |
| National roads (potholes, drainage along them, national bridges) | **DPWH Nueva Ecija 2nd District Engineering Office**, Brgy. San Isidro, Cabanatuan City, (044) 311-8476; DPWH hotline 165-02 | [DPWH office page](https://www.dpwh.gov.ph/dpwh/node/1536); DO 132 s.1995 "Placing Cabanatuan City under the jurisdiction of Nueva Ecija Engineering District Office" ([DPWH](https://www.dpwh.gov.ph/dpwh/issuances/department-order/9218)); the 2nd DEO built the Cesar Angeles-Emilio Vergara Bypass linking Sta. Rosa and Cabanatuan ([DPWH news](https://www.dpwh.gov.ph/dpwh/news/16201)) | High for the office; **which segments are national is unverified** (Maharlika Highway is generally N1) |
| City roads, road clearing, city drainage and canal de-clogging | **City Engineer's Office**, Construction and Maintenance Division (0919-081-3694) | [Charter pp. 144-145](https://www.cabanatuancity.gov.ph/uploads/photos/detail/61d7d8890742f0.14414526.pdf); LGC s.17(b)(2)(viii) | High |
| Streetlights (city-owned) and city electrical fixtures | **City Engineer's Office**, Electrical Division | [Charter pp. 145-146](https://www.cabanatuancity.gov.ph/uploads/photos/detail/61d7d8890742f0.14414526.pdf) | High (barangay-installed lights may be the barangay's: unverified) |
| Barangay roads | **The barangay** (Punong Barangay / Sangguniang Barangay) | LGC s.17(b)(1)(v) | High (legal); the city may help via "Program of Works for Barangay" ([Charter p.143](https://www.cabanatuancity.gov.ph/uploads/photos/detail/61d7d8890742f0.14414526.pdf)) |
| Garbage: uncollected household waste, illegal dumping, burning | **Barangay** for collection (biodegradable and segregation under RA 9003 s.10; see §6); **City ENRO (CCENRO)** Solid Waste Management and Enforcement Divisions for complaints and violations, CENRO line 0919-081-4509 | LGC s.17(b)(1)(iii), (2)(vi); [Charter p.140](https://www.cabanatuancity.gov.ph/uploads/photos/detail/61d7d8890742f0.14414526.pdf) | High for complaints; the collection schedule and hauler are **unverified** (not in the charter) |
| Flooding, fallen trees in emergencies, rescue | **CDRRMO** (0908-881-1010 / 0917-851-1320 / (044) 940-0161) | Charter p.229 as transcribed in [hotlines.ts](https://github.com/BetterCabanatuan/bettercabanatuan/blob/main/src/data/hotlines.ts) | High |
| Illegal vending, market issues | **CEEPUM Office** (City Economic Enterprise and Public Utilities Management) | "Complaint Against Illegal Vending" ([Charter p.337](https://www.cabanatuancity.gov.ph/uploads/photos/detail/61d7d8890742f0.14414526.pdf)) | High |
| Traffic signs, signals, tricycles | Community Affairs Office, Traffic Management Section | Charter p.41 (MTOP), as summarised in the BetterCabanatuan [resident-needs research](https://github.com/BetterCabanatuan/bettercabanatuan/blob/main/docs/superpowers/specs/2026-10-11-cabanatuan-resident-needs-research.md) | Medium |
| Water leaks, no water | Cabanatuan City Water District, in a JV with PrimeWater since 2017 | [eFOI](https://foi.gov.ph/agencies/cabcwd); [PPP Center](https://ppp.gov.ph/?p=51258) | Medium |
| Provincial roads inside the city (if any) | Nueva Ecija Provincial Engineering Office | No source found | Low |

---

## 8. Lessons learned and failure modes

- **No feedback means no return reporting.**
  - Using FixMyStreet data on 399,364 users, a successful first report was associated with a **57%** higher probability of a second report. The response to the first report predicts all later reporting. Sjoberg, Mellon & Peixoto (2017), *Public Administration Review* 77(3):340-351 ([DOI 10.1111/puar.12697](https://doi.org/10.1111/puar.12697); [preprint](https://ora.ox.ac.uk/objects/uuid:2bd169fd-0b27-46e4-8b81-1ccfccf7c55a)).
- **Uptake without government buy-in fails.**
  - Across 23 platforms in 17 Global South countries, high uptake and high responsiveness often did not go together. The platforms that drove responsiveness were mostly government-led or government-partnered, and they built officials' *capacity* to respond more than their *willingness* to. Peixoto & Fox (2016), *IDS Bulletin* 47(1) ([IDS](https://bulletin.ids.ac.uk/index.php/idsbo/article/download/34/html?inline=1)).
  - **This is the biggest risk for a volunteer-run app with no LGU partner.**
- **Unstructured reports don't change crew behaviour.**
  - In Kampala, 23,856 SMS reports on garbage did not reduce informal waste, because agency staff found the reports inconsistent and not matched to how they make decisions. Buntaine, Hunnicutt & Komakech (2021), *JPART* 31(1):108-127 ([DOI 10.1093/jopart/muaa026](https://doi.org/10.1093/jopart/muaa026); [AidData](https://aiddata.org/publications/the-challenges-of-using-citizen-reporting-to-improve-public-services-a-field-experiment-on-solid-waste-services-in-uganda)).
  - **This applies directly to our garbage category.**
- **Equity: complaint data under-represents poorer areas.**
  - Boston 311: Clark, Brudney & Jang (2013), *PAR* 73(5) ([DOI 10.1111/puar.12092](https://doi.org/10.1111/puar.12092)).
  - Kansas City, where low-income and minority neighbourhoods under-report relative to need: Kontokosta & Hong (2021), *Sustainable Cities and Society* 64:102503 ([DOI 10.1016/j.scs.2020.102503](https://doi.org/10.1016/j.scs.2020.102503)).
  - FixMyStreet Brussels: Pak, Chua & Vande Moere (2017), *J. Urban Technology* 24(2) ([DOI 10.1080/10630732.2016.1270047](https://doi.org/10.1080/10630732.2016.1270047)).
  - mySociety's own user surveys: users skew male, over 45 and degree-educated ([mySociety 2015](https://www.mysociety.org/2015/10/28/who-benefits-from-civic-technology/)).
  - **Don't treat report counts per barangay as a measure of need.** Offer non-app channels (barangay-assisted, SMS or Messenger).
- **Spam and abuse are manageable.**
  - FixMyStreet's email confirmation prevents spam "almost entirely". Joke reports should be hidden fast because they invite copycats ([admin_manual.md](https://github.com/mysociety/fixmystreet/blob/master/docs/running/admin_manual.md)).
- **Punitive KPIs distort behaviour.**
  - In Jakarta's Qlue, response rates fed subdistrict-head KPIs. Officials reported quotas, blame for misrouted reports, and avoidance of hard problems, and responsiveness dipped when the governor's attention lapsed ([GMF / Living Cities](https://www.gmfus.org/download/article/21459)). **Not peer-reviewed.**
- **Recurring problems after "resolved".**
  - A MyNaga user review describes problems returning days after clearance and asks for a "No" option. The app has added a "No" response to "pending confirmation" ([App Store](https://apps.apple.com/ph/app/mynaga/id6748720972)). **Build reporter confirmation of a fix and a reopen path.**
- **No rigorous Philippine evaluation found.**
  - I found no peer-reviewed evaluation of any PH LGU issue-reporting app.

---

## 9. Unverified / low-confidence

- **8888 IRR details** (32-minute referral, non-extendible 72 hours, anonymous allowed). They come from search-result extracts of 8888.gov.ph pages that returned 403 to direct fetch. Re-verify by hand. The 72-hour action rule itself is confirmed in EO 6 s.5(d).
- **Whether 8888's 72-hour rule binds LGUs.** EO 6 does not name LGUs; DILG MC 2017-109 "Permanent Action Teams" are known from secondary sources only.
- **Legal interpretations that are ours, not stated in any source:**
  - Sumbong reports fall under RA 11032 time limits only via enrolled charter services.
  - Reports accusing a person are SPI under DPA s.3(l)(2).
  - How cyber-libel applies to an operator that republishes user reports.
- **NPC items seen only in snippets or secondary sources:**
  - "Reminder on Sharing Photos and Videos" (2024).
  - 2020 contact-tracing app guidance.
  - Circular 2023-06 details.
  - Advisory 2026-02 on breach-filing via the DBNMS portal.
  - The repeal status of Advisory 2020-04.
  - The Circular 16-03 "no delay if 100 or more subjects" rule.
- **Contact Center ng Bayan numbers.** 1-6565 / 0908-881-6565 come from agency pages; the city charter lists +63 908 881 6565.
- **The official status of facebook.com/lgucabanatuan** as the City's page. It is inferred from content and from the BetterCabanatuan repo config, not confirmed on Facebook.
- **The bettercabanatuan.org "unofficial / directs to cabanatuancity.gov.ph" wording.** It comes from a search-result summary; the SPA did not render for the fetcher.
- **CELCOR's franchise reaching "parts of Santa Rosa"**, and whether any Cabanatuan barangay is served by NEECO II Area 2. Source: OSM wiki citing DOE (secondary). The DOE DU profile page (legacy.doe.gov.ph) was unreachable.
- **CELCOR contact details** ((044) 463-0811, ask.celcor@gmail.com, Brgy. Bitas, Maharlika Hwy). Source: an old DOE partner-list PDF ([DOE legacy PDF](https://legacy.doe.gov.ph/sites/default/files/pdf/er1-94/Program%20Partners%20-%20Distribution%20Utilities.pdf)); may be outdated. No official CELCOR outage hotline was found.
- **Which road segments in Cabanatuan are national.** I could not retrieve DPWH road inventory data for the Nueva Ecija 2nd DEO. Maharlika Highway (N1) is the obvious one; bypasses and others need checking against DPWH's road data or OSM `ref=N*` tags.
- **Barangay-installed streetlights.** Whether they are maintained by the barangay or by the City Electrical Division is not stated in the charter.
- **The garbage collection schedule and hauler** (city-run or contractor). Not in the charter.
- **Telecom pole ownership and routing.** No primary source.
- **The DILG MC 2023-115 / 2024-122 provisions.** Only titles and preambles were read.
- **MyNaga's AI triage (AIRA Labs)** and download and user counts. These come from Rappler and local press (secondary).
- **eGovPH ARTA eCMS module.** Philstar/Interaksyon only.
- **Pasig (Ugnayan sa Pasig), Makati (Makatizen) and Valenzuela (PASPAS).** News sources only, some from 2015-2020.
- **SeeClickFix pre-submission duplicate detection.** Marketing claim only.
- **Open311 server list.** Undated, possibly stale.
- **Qlue and LAPOR! findings.** Theses and abstracts, not full reads; see §8.

---

## 10. Implications for BetterCabanatuan

Prioritized. P0 items block a credible launch.

**P0: Decide the operating model with the City before building intake.**
- Peixoto & Fox find that platforms only drive responsiveness when the government leads or partners (§8). The City's charter currently has no online channel and requires a letter to the Mayor for engineering requests (§5).
- Ask the Mayor's Office, City Engineer and CCENRO to accept app reports as equivalent to the request letter. The cleanest framing is the RA 11032 IRR Rule VII s.9 "ICT… mechanisms" duty (§6.3).
- Pick the data-privacy model:
  - **Model A:** BetterCabanatuan is its own controller and forwards to the City. This needs a privacy notice, DPO, NPC registration or sworn declaration, and a DSA under Circular 2020-03.
  - **Model B:** BetterCabanatuan builds or hosts as the City's processor. This needs an outsourcing agreement, and the City DPO registers the system.
- Without either, launch as a clearly labelled **unofficial tracker that also files to official channels**: the text line 0917 813 3247, the Mayor's email, CCENRO and DPWH. Never imply that a report has been officially received.

**P0: Routing table as data, keyed by location and category (the FixMyStreet bodies/contacts model).**
- **Electric poles and lines** go to CELCOR (RA 9968).
- **Telecom poles and cables** go to the owning telco, with LGU pole inspection under DILG MC 2023-115/2024-122.
- **National roads** go to DPWH NE 2nd DEO, using a national-road polygon or line layer (OSM `ref=N*` until DPWH data is obtained).
- **City roads, drainage and streetlights** go to the City Engineer's Office (Construction & Maintenance and Electrical Divisions).
- **Barangay roads** go to the barangay.
- **Garbage** goes to the barangay for biodegradable collection, and to CCENRO SWMD for residual waste, dumping and violations (RA 9003 s.10).
- **Emergencies** go to the CDRRMO hotline, never the queue.
- Include a "not responsible / forwarded to X" state (FixMyStreet) so that pole and national-road reports close honestly with a referral.

**P0: The feedback loop is the product.**
- Each report gets a visible tracking number (MyNaga v1.0.5, ARTA s.9(a)).
- Status changes are made by staff only and always carry a public note (SeeClickFix).
- The reporter is notified on every status change.
- After "resolved", the reporter is asked to confirm, with a "No, it's not fixed" option that reopens the report (MyNaga 1.0.6, FixMyStreet 4-week survey).
- Show time-to-acknowledge and time-to-resolve against the charter's own commitments: 7 working days for Complex engineering services, 3 for CCENRO complaints, and 72 hours where we mirror 8888 and QC iReport.

**P0: Privacy by default.**
- *Data minimization:* name and contact are optional and never public, and anonymous submission is allowed (ARTA IRR Rule XIV, FixMyStreet `anonymous_allowed`). Strip EXIF. Record only the report's location.
- *Image masking:* auto-mask faces and plates before public display, and keep originals access-controlled and logged (Circular 2024-02 masking).
- *Notices and rules:* a layered privacy notice in Filipino and English (Circular 2023-04), a retention schedule, a 72-hour breach plan (Circular 16-03), and a PIA before launch.
- *No accusations of people:* public reports describe the asset, not an accused person. Categories that inherently accuse individuals (illegal dumping by a named neighbour, illegal parking) should be **private by default** (SeeClickFix "Private" categories) to limit SPI and cyber-libel exposure.

**P1: Duplicate handling.**
- Before submit, show open reports within about 250 m in the same category and offer "+1 / follow" instead of a new report (FixMyStreet defaults).
- Staff can merge duplicates into the original with `duplicate_of`, and duplicates are archived (SeeClickFix).
- Follower counts give a priority signal without encouraging spam.

**P1: Structured categories with required questions** (SeeClickFix request types / Open311 attributes).
- Example: pole → leaning / fallen / sparking / dangling wires, plus a pole number if visible.
- Mark sparking, fallen or live-wire reports as "call CDRRMO/CELCOR now" interstitials.
- The Kampala study shows unstructured garbage reports don't change crew behaviour.

**P1: Abuse controls.**
- Phone or email OTP confirmation before a report is public (FixMyStreet: spam "almost entirely" prevented; QC iReport uses email OTP).
- A flag/report-abuse link.
- Hidden-not-deleted moderation with an audit log.
- A small character limit and photo requirement for some categories.

**P1: Equity.**
- Accept reports from barangay staff on behalf of residents, and via Messenger or SMS later.
- Don't publish "most complaints per barangay" as a need ranking (Boston, Kansas City, Brussels studies).

**P2: Open311 GeoReport v2 read-only export** (`/services`, `/requests`) as the public data API. Keep a richer native API internally.

**P2: Reuse the BetterCabanatuan stack and data.**
- The portal's department-contacts YAML (charter-sourced) can seed the routing contacts.
- Keep this app as a separate service, since the portal is static with no runtime API.

**Open questions to resolve with the City and utilities:**
- Does the City accept app reports in place of a letter?
- Which office is the single intake point (Mayor's Office/PACD, CHRMO, or each department)?
- What are CELCOR's official reporting channel and SLA?
- Who maintains barangay-installed streetlights?
- What is the garbage collection schedule, and who is the hauler?
- Which road segments are national, provincial, city or barangay?
- Does the City have a registered DPO?
