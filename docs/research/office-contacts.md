# Responsible Office contacts: research for Sumbong · BetterCabanatuan

Retrieved 2026-10-19. Scope: verified contact details (email first, then phone/text lines, postal address, Facebook page and head of office) for every Responsible Office that Volunteers send Digests to, plus escalation channels. The goal is to correct and complete the `responsible_offices` seed rows in `supabase/migrations/20261018000500_reference_data.sql`.

How to read this: every value has a source. Status is one of:

- **verified**: an official source (the office's own site, the City Government's site or Citizen's Charter, or a national agency's site) states it.
- **community-listed**: only bettercabanatuan.org / its repo (or BetterGov) states it.
- **unverified**: only a secondary source (aggregator, news, search-result extract) states it.

When an official page blocked automated fetching, I used an Internet Archive copy of the same URL and give the snapshot timestamp. Those values are still **verified**, but they are only as current as the snapshot.

## Contents

0. [Key findings](#0-key-findings)
1. [Sources used](#1-sources-used)
2. [City Engineer's Office (CEO)](#2-city-engineers-office-ceo)
3. [City ENRO (CCENRO)](#3-city-enro-ccenro)
4. [Office of the City Mayor and the complaint desk](#4-office-of-the-city-mayor-and-the-complaint-desk)
5. [CELCOR](#5-celcor-cabanatuan-electric-corporation)
6. [DPWH Nueva Ecija 2nd District Engineering Office](#6-dpwh-nueva-ecija-2nd-district-engineering-office)
7. [CDRRMO](#7-cdrrmo)
8. [Barangays, Liga ng mga Barangay and DILG](#8-barangays-liga-ng-mga-barangay-and-dilg)
9. [Escalation and other channels](#9-escalation-and-other-channels)
10. [Conflicts between sources](#10-conflicts-between-sources)
11. [Changes to our seed data](#11-changes-to-our-seed-data)
12. [Gaps and pages that failed to load](#12-gaps-and-pages-that-failed-to-load)

---

## 0. Key findings

- **The City Engineer's Office and City ENRO publish no email address of their own.** The Citizen's Charter 2022, the city's "Office Contacts" graphic and bettercabanatuan.org all list only a mobile line for each. `cabanatuan.lgu@gmail.com` is the **Office of the City Mayor's** address ([Charter p.340](https://www.cabanatuancity.gov.ph/uploads/photos/detail/61d7d8890742f0.14414526.pdf)). Using it for CEO and CENRO is still correct in practice, because the Charter routes both offices' requests and complaints through a letter to the Mayor (pp.140, 143-146). The seed should say so instead of implying the address belongs to those offices.
- **The CEO phone in our seed is right.** `0919-081-3694` is the Office of the City Engineer (Charter p.343; city "Office Contacts" graphic). `+63 919 081 3749` is a different office, the Office of the City Mayor (Charter pp.340, 342). The two numbers do not conflict.
- **CELCOR has an official website with an email, 24/7 hotlines and a Facebook page.** celcor.com.ph lists `ask.celcor@gmail.com`, landlines (044) 463-7398 / 600-2414 / 463-0811 / 463-0505, Globe 0966-980-2280, Smart 0968-246-0131, and facebook.com/celcorofficialpage. The DOE's distribution-utility list (as of December 2024) gives the same email and (044) 463-0811. The address "along Maharlika Highway, Barangay Bitas, Cabanatuan City, Nueva Ecija 3100" is confirmed, so the seed's "(verify)" can go. bettercabanatuan.org currently says no official CELCOR hotline exists; that is out of date.
- **DPWH Nueva Ecija 2nd DEO has a verified email**, but only per person: District Engineer (OIC) Cyrone Kevin R. Tolentino, `tolentino.cyrone_kevin@dpwh.gov.ph`, and Assistant District Engineer (OIC) Leonora J. Cruz, `cruz.leonora@dpwh.gov.ph`. The office phone (044) 311-8476 in our seed is confirmed ([DPWH](https://www.dpwh.gov.ph/dpwh/node/1536)).
- **CDRRMO 0908-881-1010 is confirmed** by Charter p.229 and the city's "Emergency Hotlines" graphic. Charter p.344 misprints it as "0908881101".
- **No source lists barangay-hall emails, phones or Facebook pages.** The only per-barangay numbers I found are three Punong Barangay mobiles in search-result extracts from barangaydirectory.com, a private aggregator that returned HTTP 503 when I tried to open it.
- **New escalation contacts:** PrimeWater Cabanatuan (`primewatercabanatuan@primewatercorp.com`, #229 CVR, Brgy. Dicarma); DILG Nueva Ecija (Ramoso St., Old Capitol Compound, Cabanatuan City, 044-940-0616, `dilgr3nuevaecija@gmail.com` / `dilg_nuevaecija@yahoo.com`); ARTA's current complaint lines. The Charter's ARTA number 8-478-5093 is commented out of ARTA's own page.

Offices with a **verified email** they can be sent a Digest at: Office of the City Mayor (also the channel for CEO and CENRO), CELCOR, DPWH NE 2nd DEO (District Engineer's address), PrimeWater Cabanatuan, DILG Nueva Ecija, ARTA, 8888. No verified email: CEO and CENRO as offices of their own, CDRRMO, Sangguniang Panlungsod, any barangay, the Liga ng mga Barangay, the City Administrator, and the telecom pole owners.

---

## 1. Sources used

| Key | Source | Retrieved | Notes |
| --- | --- | --- | --- |
| **Charter** | City Government of Cabanatuan, *Citizen's Charter 2022 (2nd Edition)*, [PDF](https://www.cabanatuancity.gov.ph/uploads/photos/detail/61d7d8890742f0.14414526.pdf), 345 pp., PDF metadata dated 2022-02-21, SHA-256 `074f620d17b3a53cff0cee320556bc5cdd449e221f9bc1ad76435088df5047f3` | 2026-10-19 | Official. Text extracted with `pdftotext`. pp.140-146 (CENRO, CEO), p.229 (CDRRMO), pp.340-345 (complaints, list of offices). |
| **City-Contacts** | cabanatuancity.gov.ph "Office Contacts" page (dated 17 Nov 2020), image [`60051196ba6971.32335170.jpg`](https://www.cabanatuancity.gov.ph/uploads/photos/index-gallery/60051196ba6971.32335170.jpg) (EXIF 2021-01-18) | 2026-10-19 | Official. Image only: "Lines are open for calls and text messages from MONDAY-FRIDAY, 8AM to 5PM." |
| **City-Hotlines** | cabanatuancity.gov.ph "Emergency Hotlines" page, image [`6004fd2a917012.33383579.jpg`](https://www.cabanatuancity.gov.ph/uploads/photos/index-gallery/6004fd2a917012.33383579.jpg) (EXIF 2020-11-16) | 2026-10-19 | Official. "Lines are open for calls and text messages for emergency concerns 24/7." |
| **City-Home** | [cabanatuancity.gov.ph](https://www.cabanatuancity.gov.ph/) homepage and side bar | 2026-10-19 | Official. Links facebook.com/cabanatuancdrrmo/ and facebook.com/CITOCabanatuan/. "Contact Us" still points to `maintenance.php`. |
| **City-APP** | City Government of Cabanatuan, Annual Procurement Plan FY 2026, [PDF](https://www.cabanatuancity.gov.ph/uploads/files/procurement/6a5878e43d7118.12679050.pdf), signed 2025-12-23 | 2026-10-19 | Official. Signatory "HON. MYCA ELIZABETH R. VERGARA, Head of the Procuring Entity". |
| **BC** | `github.com/BetterCabanatuan/bettercabanatuan`, commit `7b8d528341c1a370551ebeefaa5489a9468a7464` (2026-10-19 08:44 +0800), shallow clone; no code run | 2026-10-19 | Community-maintained, CC0. Its office data says it was transcribed from Charter pp.342-345. |
| **BC-live** | bettercabanatuan.org production bundle `/assets/index-DV8fqQ16.js` | 2026-10-19 | The live site is a client-rendered SPA. Its bundle has the same CEO, CENRO, Mayor, CDRRMO and complaint-line numbers as the repo, so the live site and the commit above agree. |
| **CELCOR** | [celcor.com.ph](https://www.celcor.com.ph/) (routes `/aboutcelcor/contact-us`, `/frequently-asked-questions`, `/averia`). SPA; text read from its bundle `/static/js45/main.ed39cb89.js`; index `Last-Modified: Fri, 27 Mar 2026` | 2026-10-19 | Official (the utility's own site). |
| **DOE-DU** | DOE, "List of Distribution Utilities, As of December 2024", `legacy.doe.gov.ph/.../Program Partners - Distribution Utilities.pdf`. legacy.doe.gov.ph does not resolve (DNS), so I used [Wayback 20250503231145](https://web.archive.org/web/20250503231145/https://legacy.doe.gov.ph/sites/default/files/pdf/er1-94/Program%20Partners%20-%20Distribution%20Utilities.pdf), SHA-256 `bc72a63f039fcedc33147466db40b9a1fb82ee759fda7a094ccf3b1b9cf6e32e` | 2026-10-19 | Official (DOE). |
| **DPWH** | [dpwh.gov.ph/dpwh/node/1536](https://www.dpwh.gov.ph/dpwh/node/1536) "Nueva Ecija 2nd District Engineering Office" | 2026-10-19 | Official, fetched live. |
| **PrimeWater** | [primewatercorp.com/contact-us/](https://primewatercorp.com/contact-us/), branch "Primewater Cabanatuan". The page fills the branch details from its own branch API (`mobile-app.primewatercorp.com/pavi/api/mobile/branch/fd369ce1-5e65-11ec-96df-42010aaa0004`); I made the same GET the page makes | 2026-10-19 | Official (operator's own site). |
| **DILG-NE** | DILG Region III, Nueva Ecija "Location Map" page, [Wayback 20260616035357](https://web.archive.org/web/20260616035357/https://region3.dilg.gov.ph/nueva-ecija/index.php/home-1/location-map); Nueva Ecija home, [Wayback 20260712112032](https://web.archive.org/web/20260712112032/https://region3.dilg.gov.ph/nueva-ecija/) | 2026-10-19 | Official. Live site serves a Sucuri JavaScript challenge to scripts. Emails were behind Joomla's spam cloak; I decoded the HTML entities in the archived page. |
| **ARTA** | [arta.gov.ph/contact-us/](https://arta.gov.ph/contact-us/), live returns 403; [Wayback 20240814083130](https://web.archive.org/web/20240814083130/https://arta.gov.ph/contact-us/) | 2026-10-19 | Official, but the snapshot is from Aug 2024. |
| **8888** | [8888.gov.ph/page/contact-us](https://8888.gov.ph/page/contact-us), live returns 403; [Wayback 20250422200336](https://web.archive.org/web/20250422200336/https://8888.gov.ph/page/contact-us) | 2026-10-19 | Official, Apr 2025 snapshot. |

---

## 2. City Engineer's Office (CEO)

Seed `short_name = 'CEO'`. Handles city roads, road clearing, drainage de-clogging (Construction and Maintenance Division) and streetlight and electrical repair (Electrical Division) (Charter pp.143-146).

| Field | Value | Status | Source |
| --- | --- | --- | --- |
| Official name | Office of the City Engineer (Charter section heading: "OFFICE OF THE CITY ENGINEER"; service rows: "City Engineer's Office") | verified | Charter pp.142-143, 343 |
| Address | CEO Bldg., City Hall Compound, Kapitan Pepe Subd, Phase II, Cabanatuan City, 3100 | verified | Charter p.343 |
| Phone / text | 0919 081 3694 | verified | Charter p.343; City-Contacts ("City Engineering Office 0919-081-3694"); also BC `src/data/departments.yaml`, `src/data/department-contacts.yaml` @7b8d528 |
| Hours | Calls and texts Mon-Fri, 8 AM-5 PM | verified | City-Contacts |
| Email | **None published.** The route for road clearing, de-clogging and lighting repair is a "Request letter addressed to the City Mayor", submitted to the Office of the City Mayor, with an advance copy to the CEO. The Mayor's address is `cabanatuan.lgu@gmail.com` (see §4). | verified (absence) | Charter pp.143-146, 340, 343; BC `departments.yaml` has `email: ''` for this office @7b8d528 |
| Divisions | Construction and Maintenance Division (road clearing, de-clogging); Electrical Division (lighting fixtures, electrification, trouble-shooting); also Geodetic Services / Survey and Plans, Program and Design Divisions | verified | Charter pp.143-146 |
| Lighting repair eligibility | "Who may avail: Different Barangays and Offices of LGU of City of Cabanatuan", not individual residents. A streetlight Digest is best co-signed or relayed by the barangay. | verified | Charter p.145 |
| Head | City Engineer (name not found in any official source) | verified (title) | Charter p.143 ("City Engineer Indorse to…") |
| Facebook | None found | — | Search found none; city site links none |

## 3. City ENRO (CCENRO)

Seed `short_name = 'CENRO'`.

| Field | Value | Status | Source |
| --- | --- | --- | --- |
| Official name | Cabanatuan City Environment and Natural Resources Office (CCENRO) | verified | Charter pp.140, 343 |
| Address | 2nd Floor, City Hall, Kapitan Pepe Subd. Phase II, Cabanatuan City, 3100 | verified | Charter p.343 |
| Phone / text | 0919 081 4509 | verified | Charter p.343; City-Contacts ("City Environment and Natural Resources Office 0919-081-4509"); BC `department-contacts.yaml` @7b8d528 |
| Email | **None published.** "Complaints for CCENRO lodged through the Office of the City Mayor": a complaint letter addressed to the Mayor plus the complainant's ID, which the Mayor's Office endorses to CCENRO. | verified (absence) | Charter p.140; BC `departments.yaml` `email: ''` @7b8d528 |
| Who acts on a complaint | Administrative Division receives it; the Enforcement and Regulatory Division (ERD), Ecological Management Division (EMD) or **Solid Waste Management Division (SWMD) Officer** inspects within 1 day, coordinating with barangay officials; the Head, CCENRO chairs a technical conference if the parties don't agree | verified | Charter pp.140-141 |
| Head | "Head, CCENRO" / "City ENRO" (name not found) | verified (title) | Charter p.141 |
| Facebook | None found | — | Search found none |
| Not to confuse with | DENR's national **CENRO Cabanatuan City**, Capitol Compound, (044) 940-9695 / 411-1496 / 456-2234. This is a national DENR office, not the city's CCENRO. | verified (DENR directory, per BC page; not re-fetched) | BC `content/services/environment/file-an-environmental-complaint.md` @7b8d528 citing [DENR R3 directory](https://r3.denr.gov.ph/index.php/about-us/denr-directory) |

## 4. Office of the City Mayor and the complaint desk

Both CEO and CENRO Digests legally go here first (Charter pp.140, 143-146).

| Field | Value | Status | Source |
| --- | --- | --- | --- |
| Address | 2nd Floor, City Hall, Kapitan Pepe Subd. Phase II, Cabanatuan City, 3100 | verified | Charter p.342 |
| Phone / text | +63 919 081 3749 (Charter); "City Mayor's Office - Admin 0919-081-3749" (city graphic) | verified | Charter pp.340, 342; City-Contacts |
| Email | `cabanatuan.lgu@gmail.com` | verified | Charter p.340 ("Contact Information: Office of the City Mayor +63 919 081 3749 cabanatuan.lgu@gmail.com") |
| Head | City Mayor: Hon. Myca Elizabeth R. Vergara (2025-2028) | verified | City-APP signature block (2025-12-23); also BC `src/data/publicOfficials.ts` @7b8d528 |
| Public Assistance and Complaint Desk | Paper Feedback/Complaint form in the suggestion box at the City Hall lobby; CHRMO collects daily and endorses to the Office of the City Mayor | verified | Charter p.340 |
| Complaint text line | 0917 813 3247 ("Concerns can also be relayed through txt message via Mobile No. 09178133247") | verified | Charter p.340 |
| Community Affairs Office (under the Mayor's Office) | 0919 081 3983, 1st Floor, City Hall | verified | Charter p.343; City-Contacts |
| City Information and Tourism Office (city's public-information arm) | 0919 089 9862; Facebook facebook.com/CITOCabanatuan/ | verified | Charter p.342; City-Home side bar |
| Sangguniang Panlungsod / Vice Mayor's Office | 2nd Floor, City Hall; 0919 081 3730 | verified | Charter p.342; City-Contacts |
| Vice Mayor (presiding officer) | Joselito C. Roque (2025-2028) | community-listed | BC `src/data/publicOfficials.ts` @7b8d528 |
| SP alternate line | 044 960 1294 (given for the Vice Mayor and councilors) | community-listed | BC `src/data/publicOfficials.ts` lines 72, 92 @7b8d528 |
| SP email | None found. BC gives `cabanatuan.lgu@gmail.com` for every councilor, but that is the Mayor's Office address. | community-listed (and misattributed) | BC `publicOfficials.ts` @7b8d528 |
| City Administrator | Not found in the Charter's list of offices, on the city site, or in search | — | — |

## 5. CELCOR (Cabanatuan Electric Corporation)

Seed `short_name = 'CELCOR'`. Franchise holder for electric distribution in the city (RA 9968).

| Field | Value | Status | Source |
| --- | --- | --- | --- |
| Main office address | "Along Maharlika Highway, Barangay Bitas, Cabanatuan City, Nueva Ecija — 3100" (contact page); "Daang Maharlika, Bitas, Cabanatuan City 3100" (printed bill header) | verified | CELCOR (`/aboutcelcor/contact-us`; bill template in bundle); DOE-DU ("Brgy. Bitas Maharlika Highway, Cabanatuan City, Nueva Ecija 3100") |
| Collection office | Samahang Magsasaka Incorporated (SMI) Collection Office, Del Pilar St., Cabanatuan City | verified | CELCOR (`/billing-and-payment/where-to-pay/celcor-offices`) |
| Email (customer service) | `ask.celcor@gmail.com` | verified | CELCOR ("EMAIL US AT ask.celcor@gmail.com"; "For further assistance, you may send us a message at ask.celcor@gmail.com"); DOE-DU |
| 24/7 emergency hotlines, landline | 463-7398; 600-2414; 463-0811; 463-0505 (area code (044)) | verified | CELCOR FAQ: "You may report Electricity-related Emergencies thru the following CELCOR 24/7 Hotlines: LANDLINE: 463-7398; 600-2414; 463-0811; 463-0505". DOE-DU prints "(044) 463-0811". |
| 24/7 emergency hotlines, mobile | Globe 0966-980-2280; Smart 0968-246-0131 | verified | CELCOR FAQ and Contact Us |
| Other landline | 463-0408 (printed on bill header with 463-0505 / 463-0811) | verified | CELCOR bundle, bill PDF template |
| Office hours | Mon-Fri 8:00 AM-5:00 PM; Sat 8:00 AM-12:00 NN | verified | CELCOR Contact Us |
| Facebook | facebook.com/celcorofficialpage | verified | CELCOR site footer link |
| Outage reporting app | "Averia" app: averia.celcor.com.ph, Android APK from restapi.celcor.com.ph | verified | CELCOR `/averia` |
| Line clearance / tree trimming ("TABAS") | Walk-in at the Main Office with the CELCOR account number | verified | CELCOR `/services/line-clearance-tree-trimming` |
| Head | Chief Executive Officer: Engr. Villamor G. Dagamac | verified | DOE-DU ("DU Head: ENGR. VILLAMOR G. DAGAMAC"); CELCOR news item ("CELCOR's Chief Executive Officer, Engr. Villamor Dagamac") |
| Engineering / line maintenance | "Engineering & Design Services Department". Its head, and CELCOR's Regulatory Compliance Officer, is Engr. Bernie Laguni. No separate phone or email is published for it. | verified (name from a CELCOR news item, undated in the bundle) | CELCOR bundle, news text on the Anti-Obstruction of Power Lines Act |
| bettercabanatuan.org's position | "This portal lists no CELCOR hotline because none was found on an official source." | community-listed (out of date) | BC `content/services/infrastructure-public-works/electricity-and-water-providers.md` @7b8d528 |

## 6. DPWH Nueva Ecija 2nd District Engineering Office

Seed `short_name = 'DPWH-NE2'`. National roads and bridges.

| Field | Value | Status | Source |
| --- | --- | --- | --- |
| Address | Brgy. San Isidro, Cabanatuan City, Nueva Ecija, Philippines | verified | DPWH |
| Phone | (044) 311-8476 (listed for both the DE and the ADE) | verified | DPWH |
| District Engineer | DE Cyrone Kevin R. Tolentino (OIC) | verified | DPWH |
| District Engineer email | `tolentino.cyrone_kevin@dpwh.gov.ph` | verified | DPWH |
| Assistant District Engineer | ADE Leonora J. Cruz (OIC) | verified | DPWH |
| ADE email | `cruz.leonora@dpwh.gov.ph` | verified | DPWH |
| Generic office email | None published | — | DPWH |
| DPWH national hotline | 165-02; cellphone/Viber 0961-684-7084 (national, not district) | verified | DPWH page footer |
| Facebook | Only the national facebook.com/dpwhph; no district page found | verified (national) | DPWH |
| Caveat | Both officials are OIC. The email addresses are personal, so a change of DE breaks them. Re-check the DPWH page before each Digest cycle. | — | — |

## 7. CDRRMO

Not a seed row, but its number is in the `urgent_notice_*` text of the `poles-wires` and `drainage-flooding` categories.

| Field | Value | Status | Source |
| --- | --- | --- | --- |
| Address | CDRRMO Bldg., City Hall Compound, Kapitan Pepe Subd. Phase II, Cabanatuan City 3100 | verified | Charter p.344 |
| Emergency hotline (Smart) | 0908 881 1010 | verified | Charter p.229 ("Smart – 0908 881 1010"); City-Hotlines ("City Disaster Risk Reduction and Management Office 1: 0908-881-1010", 24/7) |
| Emergency hotline (Globe) | 0917 851 1320 | verified | Charter pp.229, 344; City-Hotlines |
| Landline | (044) 940-0161 | verified | Charter p.344; City-Hotlines |
| Email | None found | — | — |
| Facebook | facebook.com/cabanatuancdrrmo/ | verified | City-Home side bar link; BC `content/services/disaster-preparedness/call-the-cdrrmo-emergency-line.md` @7b8d528 |
| Head | "Department Head" (name not found) | community-listed (title) | BC `departments.yaml` @7b8d528 |

## 8. Barangays, Liga ng mga Barangay and DILG

### Barangay halls

Seed `short_name = 'BARANGAY'` (`scope = 'per_barangay'`).

**No official or community source lists barangay-hall emails, phone numbers or Facebook pages for Cabanatuan.** I checked:

- the Charter. It has no barangay directory; the only barangay-located numbers are the City Health Centers on p.344, which are city offices, not barangay halls.
- the city website. It has no barangay page.
- BC `src/data/barangays.yaml` and `src/data/barangays-data.json` @7b8d528: names, PSGC, population and health centres only.
- web search for barangay Facebook pages. It returned only barangaydirectory.com (a private aggregator that says it uses a "2023-2026 official masterlist") and citypopulation.de.

barangaydirectory.com returned **HTTP 503 ("DEPLOYMENT_PAUSED")** on 2026-10-19 and has no Internet Archive copy, so I could not open any of its pages. The three numbers below come only from search-result extracts of its pages. They are personal mobiles of Punong Barangays, not hall lines. **Do not seed them.** The Barangay and SK elections on **2 November 2026** may change every Punong Barangay two weeks from now.

Names and PSGC codes come from `supabase/data/cabanatuan-barangays.geojson` (PSA PSGC 2Q 2026).

| Barangay | PSGC | Email | Phone | Facebook | Source |
| --- | --- | --- | --- | --- | --- |
| Aduas Centro | 0304903002 | — | — | — | — |
| Aduas Norte | 0304903090 | — | — | — | — |
| Aduas Sur | 0304903091 | — | — | — | — |
| Bagong Buhay | 0304903005 | — | — | — | — |
| Bagong Sikat | 0304903003 | — | — | — | — |
| Bakero | 0304903006 | — | — | — | — |
| Bakod Bayan | 0304903007 | — | — | — | — |
| Balite | 0304903008 | — | — | — | — |
| Bangad | 0304903009 | — | — | — | — |
| Bantug Bulalo | 0304903010 | — | — | — | — |
| Bantug Norte | 0304903011 | — | 0917-847-6075 (Punong Barangay, unverified) | — | [BD]¹ |
| Barlis | 0304903012 | — | — | — | — |
| Barrera District | 0304903013 | — | — | — | — |
| Bernardo District | 0304903015 | — | — | — | — |
| Bitas | 0304903016 | — | — | — | — |
| Bonifacio District | 0304903017 | — | — | — | — |
| Buliran | 0304903018 | — | — | — | — |
| Caalibangbangan | 0304903019 | — | — | — | — |
| Cabu | 0304903020 | — | — | — | — |
| Calawagan | 0304903040 | — | — | — | — |
| Campo Tinio | 0304903022 | — | 0968-855-9743 (Punong Barangay, unverified) | — | [BD]¹ |
| Caridad | 0304903096 | — | — | — | — |
| Caudillo | 0304903026 | — | — | — | — |
| Cinco-Cinco | 0304903024 | — | — | — | — |
| City Supermarket | 0304903025 | — | — | — | — |
| Communal | 0304903027 | — | — | — | — |
| Cruz Roja | 0304903028 | — | — | — | — |
| Daang Sarile | 0304903029 | — | — | — | — |
| Dalampang | 0304903030 | — | — | — | — |
| Dicarma | 0304903031 | — | — | — | — |
| Dimasalang | 0304903032 | — | — | — | — |
| Dionisio S. Garcia | 0304903033 | — | — | — | — |
| Fatima | 0304903035 | — | — | — | — |
| General Luna | 0304903036 | — | — | — | — |
| Hermogenes C. Concepcion, Sr. | 0304903092 | — | — | — | — |
| Ibabao Bana | 0304903037 | — | — | — | — |
| Imelda District | 0304903038 | — | — | — | — |
| Isla | 0304903039 | — | — | — | — |
| Kalikid Norte | 0304903041 | — | — | — | — |
| Kalikid Sur | 0304903042 | — | — | — | — |
| Kapitan Pepe | 0304903023 | — | — | — | — |
| Lagare | 0304903043 | — | — | — | — |
| Lourdes | 0304903051 | — | — | — | — |
| M. S. Garcia | 0304903044 | — | — | — | — |
| Mabini Extension | 0304903046 | — | — | — | — |
| Mabini Homesite | 0304903047 | — | — | — | — |
| Macatbong | 0304903048 | — | — | — | — |
| Magsaysay District | 0304903049 | — | — | — | — |
| Magsaysay South | 0304903097 | — | — | — | — |
| Maria Theresa | 0304903098 | — | — | — | — |
| Matadero | 0304903050 | — | — | — | — |
| Mayapyap Norte | 0304903052 | — | — | — | — |
| Mayapyap Sur | 0304903053 | — | — | — | — |
| Melojavilla | 0304903054 | — | — | — | — |
| Nabao | 0304903087 | — | — | — | — |
| Obrero | 0304903055 | — | 0975-012-2570 (Punong Barangay, unverified) | — | [BD]¹ |
| Padre Burgos | 0304903088 | — | — | — | — |
| Padre Crisostomo | 0304903056 | — | — | — | — |
| Pagas | 0304903057 | — | — | — | — |
| Palagay | 0304903058 | — | — | — | — |
| Pamaldan | 0304903059 | — | — | — | — |
| Pangatian | 0304903060 | — | — | — | — |
| Patalac | 0304903061 | — | — | — | — |
| Polilio | 0304903063 | — | — | — | — |
| Pula | 0304903064 | — | — | — | — |
| Quezon District | 0304903065 | — | — | — | — |
| Rizdelis | 0304903066 | — | — | — | — |
| Samon | 0304903067 | — | — | — | — |
| San Isidro | 0304903068 | — | — | — | — |
| San Josef Norte | 0304903071 | — | — | — | — |
| San Josef Sur | 0304903072 | — | — | — | — |
| San Juan Pob. | 0304903073 | — | — | — | — |
| San Roque Norte | 0304903074 | — | — | — | — |
| San Roque Sur | 0304903075 | — | — | — | — |
| Sanbermicristi | 0304903076 | — | — | — | — |
| Sangitan | 0304903077 | — | — | — | — |
| Sangitan East | 0304903099 | — | — | — | — |
| Santa Arcadia | 0304903078 | — | — | — | — |
| Santo Niño | 0304903100 | — | — | — | — |
| Sapang | 0304903093 | — | — | — | — |
| Sumacab Este | 0304903094 | — | — | — | — |
| Sumacab Norte | 0304903079 | — | — | — | — |
| Sumacab South | 0304903095 | — | — | — | — |
| Talipapa | 0304903089 | — | — | — | — |
| Valdefuente | 0304903082 | — | — | — | — |
| Valle Cruz | 0304903083 | — | — | — | — |
| Vijandre District | 0304903084 | — | — | — | — |
| Villa Ofelia-Caridad | 0304903085 | — | — | — | — |
| Zulueta District | 0304903086 | — | — | — | — |

¹ [BD] = search-result extract of `https://www.barangaydirectory.com/barangay/city-of-cabanatuan/<slug>` (campo-tinio, obrero, bantug-norte), retrieved 2026-10-19; the page itself did not load. Status **unverified**.

The letter address in the seed (`The Punong Barangay / Barangay {barangay} / Cabanatuan City, Nueva Ecija`) remains the only channel we can support for every barangay.

### Liga ng mga Barangay (Cabanatuan City chapter)

Nothing found: no officer, address, phone or page for the city chapter. A DILG Nueva Ecija report from 17 Oct 2025 names only a provincial LnB Secretary (Aristotle P. Manabat) **(unverified; search-result extract)**.

### DILG

| Field | Value | Status | Source |
| --- | --- | --- | --- |
| DILG Nueva Ecija Provincial Office address | Ramoso St., Old Capitol Compound, Cabanatuan City, Nueva Ecija | verified | DILG-NE location page (Wayback 2026-06-16) |
| Telephone / fax | 044-940-0616 | verified | DILG-NE location page |
| Email | `dilgr3nuevaecija@gmail.com` and `dilg_nuevaecija@yahoo.com` (both on the page) | verified | DILG-NE location page (Joomla-cloaked addresses, decoded) |
| Provincial Director | Atty. Ofelio A. Tactac, Jr., CESO V | verified | DILG-NE home (Wayback 2026-07-12), news item of 25 Feb 2026 |
| Cabanatuan City field office (C/MLGOO) | CLGOO LGOO VI Louie C. Manarpiis, as of Sept 2023. No office address, phone or email found. | unverified (search-result extract of a 2023 DILG R3 news page; page blocked by Sucuri) | [DILG R3 news](https://www.region3.dilg.gov.ph/index.php/news-events/4200-dilg-nueva-ecija-joins-cabanatuan-city-in-the-conduct-of-lab-for-all) |
| Other figures seen | A DILG Google Sites page lists hotline 044-958-6464; another DILG page lists a PD line (044) 796-12-86 | unverified (search extracts, not opened) | sites.google.com/view/dilg-nuevaecija; region3.dilg.gov.ph |

---

## 9. Escalation and other channels

| Channel | Email | Phone / text | Address | Status | Source |
| --- | --- | --- | --- | --- | --- |
| **8888 Citizens' Complaint Center** | `8888complaint@op.gov.ph` | Dial 8888 (complaints and inquiries); 8249-8310 (admin) | J. P. Laurel St., San Miguel, Manila | verified (Apr 2025 snapshot) | 8888 |
| Same, as printed in our Charter (2022) | `pcc@malacanang.gov.ph` (as "Presidential Complaint Center") | 8888 | — | verified but older; prefer the 8888 site's address | Charter p.340 |
| **ARTA** complaints | `complaints@arta.gov.ph` (also `info@arta.gov.ph`) | ARTA Complaint Center 0928-690-4080, 0969-257-7242, 1-2782 local 1040-1049; PLDT 1-ARTA (12782), (02) 8246-7940; Smart 0920-925-3078, 0998-856-8338 | 4th & 5th Floor, NFA Building, NFA Compound, Visayas Avenue, Brgy. Vasra, Diliman, Quezon City 1128 | verified (Aug 2024 snapshot) | ARTA |
| ARTA, as printed in our Charter | `complaints@arta.gov.ph` | 8-478-5093 | — | **phone stale**: ARTA's page wraps "8478-5091 • 8478-5093 • 8478-5099" in an HTML comment, so it is no longer displayed | Charter p.340; ARTA page source |
| Contact Center ng Bayan | `email@contactcenterngbayan.gov.ph` | +63 908 881 6565 | — | verified (Charter 2022 only; contactcenterngbayan.gov.ph returned 403) | Charter p.341 |
| **DILG Nueva Ecija** | `dilgr3nuevaecija@gmail.com`, `dilg_nuevaecija@yahoo.com` | 044-940-0616 | Ramoso St., Old Capitol Compound, Cabanatuan City | verified | DILG-NE |
| **Sangguniang Panlungsod** | none | 0919 081 3730 | 2nd Floor, City Hall | verified | Charter p.342; City-Contacts |
| **PrimeWater Cabanatuan** (water leaks; JV with Cabanatuan City Water District since 30 Jan 2017) | `primewatercabanatuan@primewatercorp.com` | Customer care: (044) 463-1646 to 47; 463-0017; 463-0019; 463-2877 | #229 CVR, Barangay Dicarma, Cabanatuan City 3100 | verified | PrimeWater |
| Cabanatuan City Water District (the GOCC itself) | none found | none found | none found | — | [eFOI listing](https://foi.gov.ph/agencies/cabcwd) has no contacts in search extracts |
| PLDT / Globe / Converge (telecom poles) | none local | none local | none found | — | Search found no Cabanatuan business-centre or pole-reporting contact. Only national channels exist; not researched further. |

---

## 10. Conflicts between sources

| Item | Source A | Source B | Resolution |
| --- | --- | --- | --- |
| CEO phone vs "Mayor's Office number" | Seed and BC: CEO 0919-081-3694 | `civic-reporting-platforms.md`: Mayor's Office +63 919 081 3749 | **No conflict.** Two different offices, both confirmed by Charter pp.342-343 and City-Contacts. |
| Email for CEO and CENRO | Seed: `cabanatuan.lgu@gmail.com` for both | Charter p.340: that address is the Office of the City Mayor's; pp.342-343 print no email for CEO or CCENRO | The address is right as a channel (the Charter sends both offices' requests through the Mayor) but wrong as the office's own email. |
| CELCOR hotline exists? | BC `electricity-and-water-providers.md`: "no CELCOR hotline … found on an official source" | CELCOR's own site: four 24/7 landlines, two mobiles, an email | CELCOR's site wins; BC is out of date. |
| CELCOR contact age | `civic-reporting-platforms.md` §9 called the DOE list "old … may be outdated" | DOE-DU header: "As of December 2024"; CELCOR's site (Mar 2026 build) gives the same email and 463-0811 | Current; promote to verified. |
| CDRRMO Smart number | Charter p.229 and City-Hotlines: 0908 881 1010 | Charter p.344: "0908881101" (one digit short) | p.344 is a typo. Older BC copies had 0918-881-1010; BC now has 0908-881-1010. |
| ARTA phone | Charter p.340: 8-478-5093 | ARTA page: that line is commented out; current Complaint Center lines are 0928-690-4080 / 0969-257-7242 / 1-2782 loc. 1040-1049 | Use ARTA's current lines. |
| 8888 email | Charter p.340: `pcc@malacanang.gov.ph` | 8888.gov.ph: `8888complaint@op.gov.ph` | Use the 8888 site's address. |
| City Budget Office line (not a Responsible Office; noted for the city directory's reliability) | Charter p.342: 0919 081 1400 | City-Contacts: 0919-081-3199 | Unresolved; it shows the 2020 graphic and 2022 charter can differ. |
| Councilors' email | BC `publicOfficials.ts`: `cabanatuan.lgu@gmail.com` for all councilors | Charter: that is the Mayor's Office address; no SP email printed | BC misattributes it. |

---

## 11. Changes to our seed data

Current rows are from `supabase/migrations/20261018000500_reference_data.sql`. Proposed values are for a **new** migration (do not edit the applied one). Each one is exact text. `E'…\n…'` means a Postgres escape string with newlines, as in the current file.

### `CEO`

| Field | Current value | Proposed value | Reason |
| --- | --- | --- | --- |
| `email` | `cabanatuan.lgu@gmail.com` | `cabanatuan.lgu@gmail.com` (no change) | The CEO publishes no email (Charter p.343). Requests go to the Mayor (pp.143-146), and this is the Mayor's verified address (p.340). Keep it, but see `channel`. |
| `channel` | `Request letter addressed to the City Mayor, filed at the Office of the Mayor (Citizen's Charter: road clearing, de-clogging, lighting repair).` | `Request letter addressed to the City Mayor, filed at the Office of the City Mayor (email cabanatuan.lgu@gmail.com is the Mayor's Office address; the CEO has none), with an advance copy to the CEO (Citizen's Charter pp.143-146: road clearing, de-clogging, lighting repair).` | Says plainly whose email it is, and adds the Charter's "advance copy to the office" step. |
| `phone` | `0919-081-3694` | `0919-081-3694` (no change) | Confirmed by Charter p.343 and City-Contacts. It is the CEO's line, not the Mayor's (0919-081-3749). |
| `address` | `City Hall, Cabanatuan City` | `CEO Bldg., City Hall Compound, Kapitan Pepe Subd. Phase II, Cabanatuan City 3100` | Charter p.343. The CEO has its own building in the compound. |
| `letter_addressee` | `E'The Honorable City Mayor\nCity Government of Cabanatuan\nCity Hall, Cabanatuan City, Nueva Ecija'` | `E'Hon. Myca Elizabeth R. Vergara\nCity Mayor, City Government of Cabanatuan\n2nd Floor, City Hall, Kapitan Pepe Subd. Phase II\nCabanatuan City, Nueva Ecija 3100'` | Full Charter address (p.342) and the incumbent's name (City-APP). If you'd rather not hard-code a name that changes in 2028, keep `The Honorable City Mayor` as line 1 and change only the address lines. |
| `letter_attention` | `City Engineer's Office (Construction & Maintenance / Electrical Division)` | `Office of the City Engineer (Construction and Maintenance Division / Electrical Division)` | Charter wording (pp.143-146, 343). Cosmetic. |

### `CENRO`

| Field | Current value | Proposed value | Reason |
| --- | --- | --- | --- |
| `name_en` | `City Environment and Natural Resources Office` | `Cabanatuan City Environment and Natural Resources Office` | Charter name (pp.140, 343); avoids confusion with DENR's national "CENRO Cabanatuan City". |
| `email` | `cabanatuan.lgu@gmail.com` | `cabanatuan.lgu@gmail.com` (no change) | Same as CEO: complaints are "lodged through the Office of the City Mayor" (Charter p.140); no CCENRO email is published. |
| `channel` | `Complaint letter addressed to the City Mayor (Citizen's Charter: CCENRO complaints are lodged through the Office of the City Mayor).` | `Complaint letter addressed to the City Mayor with the complainant's valid ID (Citizen's Charter p.140: CCENRO complaints are lodged through the Office of the City Mayor; email cabanatuan.lgu@gmail.com is the Mayor's Office address). CCENRO inspects within 1 day with barangay officials.` | Adds the ID requirement and the inspection step from pp.140-141, and says whose email it is. |
| `phone` | `0919-081-4509` | `0919-081-4509` (no change) | Confirmed by Charter p.343 and City-Contacts. |
| `address` | `City Hall, Cabanatuan City` | `2nd Floor, City Hall, Kapitan Pepe Subd. Phase II, Cabanatuan City 3100` | Charter p.343. |
| `letter_addressee` | `E'The Honorable City Mayor\nCity Government of Cabanatuan\nCity Hall, Cabanatuan City, Nueva Ecija'` | Same as the proposed CEO value | Same reason as CEO. |
| `letter_attention` | `City ENRO, Solid Waste Management Division` | `Cabanatuan City Environment and Natural Resources Office (CCENRO), Solid Waste Management Division` | Charter names the office CCENRO and the unit "Solid Waste Management Division (SWMD)" (p.141). |

### `CELCOR`

| Field | Current value | Proposed value | Reason |
| --- | --- | --- | --- |
| `channel` | `Letter to CELCOR customer service (franchise holder for electric distribution in the city, RA 9968).` | `Email or letter to CELCOR customer service (franchise holder for electric distribution in the city, RA 9968). Live, sparking or fallen wires: CELCOR 24/7 hotlines, not a Digest.` | CELCOR publishes an email and 24/7 lines (celcor.com.ph). |
| `letter_addressee` | `E'Cabanatuan Electric Corporation (CELCOR)\nMaharlika Highway, Brgy. Bitas\nCabanatuan City, Nueva Ecija'` | `E'Engr. Villamor G. Dagamac\nChief Executive Officer\nCabanatuan Electric Corporation (CELCOR)\nMaharlika Highway, Brgy. Bitas\nCabanatuan City, Nueva Ecija 3100'` | Head from DOE-DU and CELCOR's site; ZIP 3100 from both. Optional: drop the first two lines to avoid a hard-coded name. |
| `letter_attention` | `Engineering / Line Maintenance` | `Engineering & Design Services Department` | The department name CELCOR itself uses (CELCOR news text). Its head is Engr. Bernie Laguni. |
| `email` | `null` | `ask.celcor@gmail.com` | CELCOR Contact Us and FAQ; DOE-DU (Dec 2024). |
| `phone` | `null` | `(044) 463-7398 / 600-2414 / 463-0811 / 463-0505; Globe 0966-980-2280; Smart 0968-246-0131 (24/7)` | CELCOR FAQ "24/7 Hotlines". If the column should hold one number, use `(044) 463-0811`, which appears on both CELCOR's site and DOE-DU. |
| `address` | `Maharlika Highway, Brgy. Bitas, Cabanatuan City (verify)` | `Along Maharlika Highway, Brgy. Bitas, Cabanatuan City, Nueva Ecija 3100` | Verified by CELCOR Contact Us and DOE-DU; remove "(verify)". |

Related, in `categories.urgent_notice_*` for `poles-wires` (not a `responsible_offices` field): "call CDRRMO at 0908-881-1010 or CELCOR right now" could name a CELCOR number. Suggest `CELCOR (Globe 0966-980-2280 / Smart 0968-246-0131)`. Resident-facing copy also needs the `fil` text updated, and both message files must stay in sync if the notice moves to `src/messages`.

### `DPWH-NE2`

| Field | Current value | Proposed value | Reason |
| --- | --- | --- | --- |
| `email` | `null` | `tolentino.cyrone_kevin@dpwh.gov.ph` | District Engineer's address on DPWH's office page. It is personal to the OIC, so re-check it when the DE changes. Alternative: `cruz.leonora@dpwh.gov.ph` (ADE OIC). |
| `phone` | `(044) 311-8476` | `(044) 311-8476` (no change) | Confirmed by DPWH. |
| `address` | `Brgy. San Isidro, Cabanatuan City` | `Brgy. San Isidro, Cabanatuan City, Nueva Ecija` | DPWH wording. Cosmetic. |
| `letter_addressee` | `E'The District Engineer\nDPWH Nueva Ecija 2nd District Engineering Office\nBrgy. San Isidro, Cabanatuan City, Nueva Ecija'` | `E'DE Cyrone Kevin R. Tolentino\nDistrict Engineer (OIC)\nDPWH Nueva Ecija 2nd District Engineering Office\nBrgy. San Isidro, Cabanatuan City, Nueva Ecija'` | Optional; the name is from DPWH. Keeping "The District Engineer" is safer if the OIC changes. |

### `BARANGAY`

| Field | Current value | Proposed value | Reason |
| --- | --- | --- | --- |
| all | (as seeded) | no change | No source lists barangay-hall emails, phones or pages (§8). Per-barangay contacts would need a new table or per-barangay office rows, filled by Coordinators after the 2 Nov 2026 barangay elections. |

### Possible new rows (not in the seed today)

| short_name | Why | Values to use |
| --- | --- | --- |
| `PRIMEWATER` | Water leaks and broken pipes are a common public-space Report, and the utility is private, like CELCOR | name `PrimeWater Cabanatuan (Cabanatuan City Water District JV)`; email `primewatercabanatuan@primewatercorp.com`; phone `(044) 463-1646 to 47 / 463-0017 / 463-0019 / 463-2877`; address `#229 CVR, Barangay Dicarma, Cabanatuan City 3100` (PrimeWater) |

---

## 12. Gaps and pages that failed to load

**Gaps**
- No email for the CEO, CCENRO, CDRRMO or Sangguniang Panlungsod as offices of their own.
- No names for the City Engineer, City ENRO or CDRRMO head.
- No City Administrator found.
- No barangay-hall contacts (§8), no Liga ng mga Barangay city-chapter contact, and no DILG Cabanatuan City field-office address or phone.
- No Cabanatuan City Water District contact separate from PrimeWater.
- No local telecom pole contacts (PLDT, Globe, Converge).
- No Facebook page found for the CEO, CCENRO or a DPWH NE 2nd DEO page.

**Pages that failed to load (2026-10-19)**
- `legacy.doe.gov.ph`: DNS does not resolve. Used the Wayback copy.
- `arta.gov.ph`, `8888.gov.ph`, `contactcenterngbayan.gov.ph`: HTTP 403 to scripts. Used Wayback copies for ARTA and 8888; CCB not checked.
- `region3.dilg.gov.ph` (and `mail.` mirror): Sucuri JavaScript challenge (HTTP 307). Used Wayback copies.
- `www.barangaydirectory.com`: HTTP 503 "DEPLOYMENT_PAUSED"; no Wayback copy.
- `lcp.org.ph/92/cabanatuan-city` (League of Cities profile): expired TLS certificate; not read.
- `bettercabanatuan.org`: loads, but as a client-rendered app. I read its JS bundle and the repo instead of rendered pages.
- `cabanatuancity.gov.ph` "Contact Us", "Trash Collection", "Public Utilities": still point to `maintenance.php`.
