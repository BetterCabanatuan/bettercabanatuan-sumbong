# Sumbong · BetterCabanatuan — 1:30 flow explainer

A motion-design walkthrough of one Report's whole life, from the Reporter's pin to the Volunteer's "Resolved". Built as a seekable HTML timeline (`sumbong-flow.html`) and rendered frame by frame to `sumbong-flow.mp4`. Settings and admin screens are deliberately left out: the video only shows the flow.

| | |
| --- | --- |
| Runtime | 1:30.0 (2,700 frames @ 30 fps) |
| Format | MP4, H.264 1920×1080 + AAC 48 kHz stereo (music bed and sound effects, no voiceover; −16 LUFS) |
| Audience | Cabanatuan residents meeting Sumbong for the first time; new Volunteers being onboarded `[FILL: confirm]` |
| Platform | Facebook page / Reels-in-landscape, onboarding sessions, the `/about` page `[FILL: confirm]` |
| Language | English captions, Filipino UI labels exactly as the app shows them (`Ako rin`, `Sinusuri`, `Naipadala`…) |

## Visual system

- **Palette** (straight from `src/app/globals.css`): government blue `#0052BC`, navy `#002E6E`, ink `#14213D`, page `#F5F7FA`, flag red `#C8102E` (hazards, the stripe, the RECEIVED stamp), sun gold `#FCD116` reserved for **Ako rin** and for the on-screen guides. Status chips use the app's status tokens: Pending Review grey, Published amber, Forwarded blue, Resolved green.
- **Type**: IBM Plex Sans 400–700 for everything, IBM Plex Mono for Report codes (`CBN-7K2Q4M`).
- **Role colours** on eyebrows and the progress rail: Reporter blue, Volunteer navy, public board gold.
- **Motion**: one strong ease-out (`cubic-bezier(.23,1,.32,1)`, the app's own `--ease-out`) for entrances, a damped spring for pins, taps and the stamp, push transitions between phone screens like real navigation. Nothing moves without a reason: every move points at the thing the caption is talking about.
- **Spoon-feeding devices**:
  1. **Caption column** (left): eyebrow with step + who does it, a one-line headline, one sentence of how, one tip.
  2. **Progress rail** (bottom): 7 stops (Pin, Problem, Send, Review, Board, Digest, Resolve), the current one lit in its role colour.
  3. **Status chip** (top right): follows our Report `CBN-7K2Q4M` and flips each time its status changes.
  4. **Tap indicator**: a finger-dot that presses exactly what the caption names.
  5. **Callouts** (phone scenes): a gold dot on the exact UI element with a leader line to a short label ("Barangay tagged for you", "Ako rin = Me Too", "Your Report code"…).
  6. **Spotlight** (desktop scenes): the rest of the console dims and a gold frame walks from part to part (photo → checklist → office → Approve; our board card; letter → send log → stamp; before/after → Resolve).
  7. **Handoff**: the Report card lifts off the phone's success screen and flies into the Volunteer's review queue, so the viewer sees it is the same Report changing hands.

## Storyboard

The timeline is authored over 83 s and played back stretched to exactly 1:30, so the times below are video times.

| Time | Scene | Visual | On-screen caption |
| --- | --- | --- | --- |
| 0:00–0:08 | **Hook** | Navy night map of Cabanatuan draws itself; five pins drop on a pothole, leaning pole, dead streetlight, clogged drain, uncollected garbage. Light circle wipes out from the pothole pin. | "Every street has a problem someone walks past." → "Who do you tell?" / *Kanino ka magsusumbong?* |
| 0:08–0:14 | **Meet Sumbong** | Wordmark rises over the flag stripe. Cast cards: Reporter → Volunteer → Responsible Office. | "Residents report it. Volunteers carry it to the office that can fix it." |
| 0:14–0:25 | **1 · Pin it** (Reporter) | Phone: *Saan ito?* map, pin drops with ripple, barangay chip "Brgy. Sangitan East" pops, landmark typed. Tap *Susunod*. | "Drop a pin where the problem is." Barangay tagged automatically; outside city limits can't be sent. |
| 0:25–0:35 | **2 · What kind?** (Reporter) | Category list, *Kalsada at Lubak* chosen. Push to *May nakapag-sumbong na ba nito?*: nearby Reports within 100 m; tap **Ako rin**, count 12 → 13 in sun gold. Then *Ibang problema ba? Ituloy lang.* | "Pick the problem." → "Already reported? Tap Ako rin." (no Duplicate needed) |
| 0:35–0:44 | **3 · Send it** (Reporter) | Two photos pop in, title typed, optional email typed, *Ipadala*. Success screen: check draws, code `CBN-7K2Q4M`, private Tracking Link. Status chip appears: **Pending Review**. The Report card lifts off the phone. | "Add 1–3 photos and send." Email optional; hidden location data stripped from photos. |
| 0:44–0:56 | **4 · Review** (Volunteer) | The Report card lands in the Volunteer's review queue. Faces and the tricycle plate pixelate; four checks tick; Suggested Office *City Engineer's Office* confirmed; *Approve & publish*. Chip → **Published**. | "A Volunteer reviews every Report first." Rejected Reports never go public. |
| 0:56–1:03 | **5 · Public board** (Everyone) | Feedback board + map. Our card enters, Ako rin climbs 1 → 31 and it climbs the ranking. | "Now the whole city can see it." Ranked by Ako rin; filter by status, Category, barangay. |
| 1:03–1:14 | **6 · Digest** (Volunteer) | 14 Reports fly into one letter to the City Engineer's Office. Print, log "Letter, hand-delivered", *Mark as sent*. Chip → **Forwarded**. RECEIVED stamp slams down: Proof of Receipt. Misroute callout. | "Volunteers carry it to the office." Wrong office? Misroute sends it back to Published for the right office. |
| 1:14–1:23 | **7 · Resolved** (Volunteer → Followers) | Before/after wipe, *Resolve*. Chip → **Resolved**. Phone returns with the "Naayos na" email and *Hindi pa naayos? Buksan muli*. | "Fixed. Everyone following it hears back." Reopen within 30 days if it isn't. |
| 1:23–1:30 | **Recap + end card** | Four-stop pipeline with the Report dot travelling: Sinusuri → Na-publish → Naipadala → Naayos na. End card: *Mag-sumbong.* + URL + flag stripe over a map drawing itself. | "One pin. One photo. One voice." Not an official City Government channel. |

## Sound design

Everything is synthesized by `sound.mjs` (no samples, no licensing). Cues come from the timeline itself (`cues.json`, exported by the renderer and already in video time), so effects stay frame-accurate when the animation changes.

- **Music bed**, 96 BPM in C: a dark A-minor pad with a heartbeat pulse and a noise riser under the hook, a hit on the brand reveal, then I–V–vi–IV with a pluck arpeggio and bass. Half-time kick for the Reporter half; full kick, hats and soft claps for the Volunteer half. Drums drop out for the recap and it resolves on a big C major chord on the end card.
- **Effects**: taps, per-character key ticks, push swipes between screens, whooshes on scene changes, musical pin drops (pentatonic), pops for cards and labels, ascending checkbox ticks, a sparkle on Ako rin, a success chime on submit, a lift-and-land for the Report handoff, a status bell that rises in pitch with each status (Pending Review → Published → Forwarded → Resolved), bit-crush blips while faces and plates pixelate, rising count ticks as Ako rin climbs, paper swishes as Reports fill the Digest, a stamp thump, a notification ding for the Follower email.
- **Mix**: music sits under the effects (−4.4 dB), a shared reverb send, soft limiting, loudness-normalized to −16 LUFS / −1.5 dBTP at mux.

## Narration (optional VO, not in the render)

> **0:00** Every street has a problem someone walks past. A pothole. A leaning pole. A light that's been out for weeks. So who do you tell?
>
> **0:08** Meet Sumbong. Residents report it. BetterCabanatuan volunteers carry it to the office that can fix it.
>
> **0:14** Step one: drop a pin right where the problem is. Sumbong tags the barangay for you. Add a landmark so volunteers can find it.
>
> **0:25** Step two: pick what kind of problem it is. Sumbong shows open reports within a hundred metres. Same pothole? Just tap *Ako rin*. Something new? Keep going.
>
> **0:35** Step three: add one to three photos, a short title, and, if you want updates, your email. Send it, and save your private tracking link.
>
> **0:44** Before anything goes public, a volunteer reviews it: blurs faces and plate numbers, checks the pin and the category, and confirms the responsible office.
>
> **0:56** Now it's on the public board. Every *Ako rin* moves it up.
>
> **1:03** Volunteers batch reports into a Digest for each office, send it through the office's official channel, and log the proof of receipt.
>
> **1:14** When it's fixed, a volunteer marks it resolved with an "after" photo, and everyone following it hears back. Not really fixed? Reopen it within thirty days.
>
> **1:23** One pin. One photo. One voice. Mag-sumbong.

## Assets

All drawn in code, no stock: city map (SVG paths), map pins, Lucide-style icons (pin, camera, send, shield, building, mail, check), phone and browser frames, the pothole before/after "photos" (CSS gradients), the mosaic pixelation, the Digest letter and RECEIVED stamp. Fonts: IBM Plex Sans / Mono from Google Fonts.

## Re-rendering

Run from a folder where `playwright-core` is installed (Chrome is used if present):

```bash
node docs/video/render.mjs --cues-only
```

```bash
node docs/video/sound.mjs
```

```bash
node docs/video/render.mjs
```

The first writes `cues.json`, the second synthesizes `sumbong-flow-audio.wav`, the third renders the frames and muxes the audio into `sumbong-flow.mp4`.

Open `docs/video/sumbong-flow.html` in a browser to scrub the timeline live (space to play/pause, arrow keys to step a second).

## Open items

- `[FILL: target platform]` — a 9:16 cut for Reels/TikTok would need its own layout.
- `[FILL: audience]` — confirm whether the Volunteer half should go deeper (onboarding) or shorter (public promo).
