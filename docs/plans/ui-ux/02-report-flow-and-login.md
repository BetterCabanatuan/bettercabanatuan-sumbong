# Spec 2: the `/report` flow, confirmation and sign-in

Status: proposed, 2026-10-25. Read [`00-overview.md`](00-overview.md) first. Land spec 1 (status icons, emergency banner) before this one.

## Role

- **Executor**: a frontend engineer who has read `src/components/report-form/report-form.tsx` end to end (718 lines, one client component). A copywriter or `design:ux-copy` for the Filipino strings.
- **Skills**: `design:ux-copy`, `impeccable` (clarify, harden), `mobile-native` (viewport, tap targets, input zoom), `web-design-guidelines`, then `design:accessibility-review`.
- **Users affected**: Reporters (residents, mostly on phones, often on weak mobile data, Filipino first) and Followers signing in by email.

## Context

The wizard is already good. It has a progress bar, a back button, a review step with "Edit" per section, a nearby check, a saved draft, camera and gallery photo input with JPEG compression, and a confirmation page with the code, a private link, copy and share. What is left is the friction at the edges: a disabled "Susunod" button that doesn't say why, no promise of how long it takes, nothing early that says this is a volunteer project, and a sign-in confirmation that leaves people stuck if the email is wrong or late.

The target user is someone standing next to a pothole with a phone and a patchy signal. Every extra decision costs completions.

## Goals

1. A Reporter who is blocked always sees why, next to the button, in plain words.
2. A Reporter knows before step 1 how long it takes and what to have ready.
3. "Volunteer-run, not official" is stated once, early, and again on the confirmation page, without a government look.
4. The confirmation page says what happens next and where updates will appear, without promising a time Volunteers can't keep.
5. Sign-in recovers from the three common failures: wrong email, email not arriving, expired link.

## Non-goals

- Reordering the steps or merging the Category and details steps.
- Photo-first entry with EXIF pin placement. It is listed as an optional stretch (task 8), because it changes the first step.
- A 6-digit code login. Noted as a later option.
- A messaging-app intake channel.

## Already built (extend, don't add)

| Capability | Where |
| --- | --- |
| Progress "Step X of Y" and bar | `report-form.tsx` (`progress`, `Progress`) |
| Back button | `StepNav` `onBack`, plus `back` on the review step |
| Review with Edit per section | `SummaryRow`, `review.edit`, `review.editLabel` |
| Saved draft (fields in localStorage, photos in IndexedDB, 7 days, email never saved) | `src/lib/draft.ts` |
| Camera and gallery inputs, remove button, max 3 | `photo-picker.tsx` |
| JPEG resize to 1600px at 0.82 | `src/lib/image.ts` |
| Optional markers on optional fields | `t("optional")` |
| API error → alert with a specific message | `errors.*` keys, `Alert variant="destructive"` |
| Confirmation: code, private link, copy, share, follow form | `DoneView` |
| Login "sent" state with the email shown | `login-form.tsx` (`state.status === "sent"`) |

## References

- GOV.UK question pages: https://design-system.service.gov.uk/patterns/question-pages/ (one thing per page, short hint, "(optional)" not asterisks)
- GOV.UK error summary: https://design-system.service.gov.uk/components/error-summary/ (summary at top, links to fields, focus moves to it)
- GOV.UK check answers: https://design-system.service.gov.uk/patterns/check-answers/ (button named for the action; "nothing is sent until you confirm")
- GOV.UK confirmation pages: https://design-system.service.gov.uk/patterns/confirmation-pages/ (reference number, what happens next, how to track)
- GOV.UK start page: https://design-system.service.gov.uk/patterns/start-using-a-service/ (what it is, how long, what you need)
- GOV.UK email addresses: https://design-system.service.gov.uk/patterns/email-addresses/ (`type=email`, `spellcheck=false`, don't block on typos)
- GOV.UK file upload: https://design-system.service.gov.uk/components/file-upload/ (specific errors per failure)
- USWDS form guidance: https://designsystem.digital.gov/components/form/ (avoid disabled states)
- USWDS banner: https://designsystem.digital.gov/components/banner/ (never use the official-site banner on a non-government site)
- NN/g placeholders: https://www.nngroup.com/articles/form-design-placeholders/
- FixMyStreet, for the flow shape: https://www.fixmystreet.com/
- Repo: `src/components/report-form/{report-form,photo-picker,nearby-check}.tsx`, `src/app/(public)/report/page.tsx`, `src/app/(public)/login/{page,login-form,actions}.ts*`, `src/messages/{fil,en}.json` (`reportForm`, `login`), `supabase/config.toml` (`[auth.email]`), `supabase/templates/magic_link.html`

## Tasks

### Task 1: say why "Susunod" is blocked

**Problem**: `StepNav` renders `disabled={nextDisabled}`. On step 1 the button is pale blue with no explanation (`report.png`). A disabled button gives a screen reader nothing and gives a sighted user nothing to fix.

**Decision** (settled, because USWDS and GOV.UK both avoid disabled submit buttons): keep the button **enabled**. When pressed while a requirement is missing, don't advance; show an inline error under the relevant control, move focus to it, and `aria-invalid` it. Keep the visual `Next` style normal.

**Steps** (`report-form.tsx`)
1. Replace `nextDisabled: boolean` with `blocked?: { message: string; focus: () => void } | null`. `StepNav` calls `blocked.focus()` and shows the message in a `role="alert"` paragraph above the button; it clears when the condition is met.
2. Messages and focus targets:

| Step | Condition | Message (en) | Focus |
| --- | --- | --- | --- |
| location | no pin | Place the pin on the map first. | the map container (`tabIndex={0}` already supports keyboard) |
| category | no Category | Choose the kind of problem. | the radio group |
| category | missing required answer | Answer the required question: "{prompt}". | that question's field |
| details | no photo | Add at least 1 photo. | the camera button |
| review | no Turnstile token | Wait a moment while we check you're not a bot. | the widget (see task 5) |

3. Keep `nearby.isLoading` as a true pending state (spinner on the button, `aria-busy`), not an error.
4. Add `reportForm.blocked.{pin,category,answer,photo,captcha}` in both locales.

**Acceptance**: with an empty form, tapping "Susunod" on each step shows the message and moves focus; a screen reader announces it; fixing the cause clears the message and the next tap advances; Tab order unchanged.

### Task 2: set expectations before step 1

**Files**: `src/app/(public)/report/page.tsx`, `report-form.tsx`, messages.

1. Under the page `h1`, one line: "About 2 minutes. Have a photo ready, and be near the problem." (fil/en). Use a measured time: run the flow with five people or time yourself three times, then round up. Don't ship "2 minutes" unmeasured.
2. Show it only on the `location` step and only when there is no restored draft.
3. Add the volunteer-run line in the same block, once: "Run by BetterCabanatuan volunteers. This is not an official City Government channel. We review your report and carry it to the right office." Link "How it works" to `/about`. No flag, seal or "gov" styling.
4. Mark optional fields "(optional)" consistently. The landmark field on step 1 is optional but unmarked; confirm with a Volunteer whether it is, then add the marker.

**Acceptance**: both lines visible at 390px without scrolling on step 1, under the emergency banner from spec 1; fil copy fits at 360px on two lines max.

### Task 3: move focus and the error summary on submit failure

The failure alert (`submitError`) renders at the top but nothing moves the reader there, so on a phone the error appears above the fold while the user is looking at the submit button.

1. Give the alert `ref`, `tabIndex={-1}`, `role="alert"`, and call `.focus()` and `scrollIntoView({ block: "center" })` when `submitError` becomes non-null.
2. Prefix `document.title` with "Error: " while it is set (GOV.UK pattern); restore on clear.
3. Where the error maps to a step (`outside_city` → location, `photos_required`/`invalid_photo` → details, `missing_answer`/`invalid_answer`/`unknown_category` → category), add a "Go to {step}" button in the alert that calls `setStep`. `outside_city` already jumps; make the others do the same and keep the alert text.
4. Keep the draft intact on every error (it already is; add a test or a manual check).
5. `rate_limited`: show the retry time if the API response provides it; otherwise keep the current text.

**Acceptance**: with a forced `server_error` (stub `/api/reports`), focus lands on the alert, the page title is prefixed, and the draft survives a reload.

### Task 4: review step: the commitment line and button label

**Files**: `report-form.tsx` (`review` step), messages.

1. Under the lead, add "Nothing is sent until you press the button below." (GOV.UK check-answers).
2. The submit button reads "Send report". Keep it, but state the outcome in the lead: "A volunteer will review it before it appears on the board." (This is already true; see `done.lead`. Don't add a time.)
3. Show "None" (or "Wala") for skipped optional rows rather than an empty row. `review.noDetails` exists; check the landmark row (`review.pinOnly`).

### Task 5: submit button and Turnstile

`disabled={!captcha || submitting}` leaves the button pale until Turnstile finishes, with no explanation, which on a slow connection can look like a bug.

1. Use task 1's `blocked` mechanism with the `captcha` message instead of `disabled`.
2. While the widget is loading show "Checking you're not a bot…" with a spinner next to the (enabled) button. When it errors or times out (Turnstile's `error-callback`, 15 s), show "We couldn't check. Tap to try again." with a retry that bumps `captchaReset`.
3. Don't change `Turnstile`'s keys or server verification.

**Acceptance**: with the Turnstile script blocked (DevTools), the review step shows the retry within 15 seconds and the form is not stuck.

### Task 6: confirmation page: what happens next

**File**: `DoneView`, messages `reportForm.done`.

Current lead: "A volunteer will review it soon. This is your report code." Replace with a three-line "What happens next" list under the code:

1. "A volunteer checks your photos and location. Faces and plate numbers are blurred."
2. "Once approved it appears on the public board, and other residents can tap 'Me too'."
3. "A volunteer sends it to {the Responsible Office}. You'll see each step on your report page."

Rules:
- No promised turnaround. `docs/plans/after-forwarded.md` and the ADRs set no review SLA. If the team later sets one, add it here as a variable, not a literal.
- Say where updates arrive: by email if the Reporter gave one, otherwise only on the private link and under "My reports". Reuse `savedHere`.
- Repeat the volunteer-run sentence from task 2, shortened: "Run by volunteers, not the City Government."
- Keep the code at `text-3xl font-mono` and keep copy/share.
- Add "Make another report" (secondary button) that calls `startOver`-equivalent and returns to step 1.

### Task 7: sign-in: recover from a wrong, late or expired link

**Files**: `login-form.tsx`, `login/page.tsx`, `login/actions.ts`, `messages.login`.

Current "sent" state shows "Check your email (x@y.com) for the sign-in link." and nothing else.

1. **Wrong address**: add a "Wrong email? Change it" button that returns to the form with the address filled in (`state.email`).
2. **Resend**: add "Send the link again", disabled for 60 seconds with a visible countdown. **Verify the real limit first**: `supabase/config.toml` sets `[auth.rate_limit] email_sent = 2` per hour locally, and the hosted default without custom SMTP is similarly small. The cooldown must be ≥ the provider's minimum and the UI must handle a rate-limit error with its own message ("Too many emails. Try again in about an hour.") instead of the generic `error`. Return a `reason: "rate_limited" | "invalid" | "failed"` from `sendMagicLink` and map it to copy.
3. **Expiry**: say how long the link lasts. `supabase/config.toml` has `otp_expiry = 3600` (one hour) locally. **Check the hosted project's value in the Supabase dashboard before writing it into copy.** Then: "The link works for 1 hour and only once."
4. **Where to look**: "Check your spam folder. The email comes from {EMAIL_FROM display name}." Read the sender from `.env.example` (`BetterCabanatuan Sumbong`).
5. **Different browser**: the link may open in a mail app's in-app browser. Add one line: "If it opens in another app, copy the link into your usual browser." Verify `/auth/confirm` works when the session starts in a different browser from the request (it uses a token hash, so it should); test it.
6. **Email field**: `spellcheck={false}`, `autoCapitalize="none"`, `autoCorrect="off"`. Don't block on typos; if the domain looks like a typo of `gmail.com` (`gmial.com`, `gmal.com`, `gamil.com`), show "Did you mean gmail.com?" with a one-tap fix.
7. **Page**: below the form, a short list "What an account gives you: see all your reports in one place; get an email when a status changes." The lead already says the first part; keep one of them, not both.
8. `?error=` (invalid or expired link) already shows an alert; add a "Send a new link" focus jump to the email field.

**Acceptance**: manual test of each branch (wrong address, resend cooldown, rate-limit error, expired link) with the real Supabase project or a local one; the email template (`supabase/templates/magic_link.html`) mentions the same expiry.

### Task 8 (optional stretch): photo-first, pin from the photo

Only do this after tasks 1–7 ship and you have completion data.

- Idea (FixMyStreet): let the Reporter start with a photo, read GPS from the photo's EXIF, and pre-place the pin.
- **Constraint**: `toUploadableJpeg` re-encodes through a canvas, which strips EXIF, so GPS is read from the original `File` before conversion, used only to set the pin, and never uploaded. State that on screen ("We use the photo's location to place the pin. The location data is not stored.").
- Many phones strip GPS from gallery picks, and a camera capture needs location permission. Always keep the map and "Use my current location" as the fallback.
- Changes the step order, so prototype behind a query flag (`?photofirst=1`) and compare.

## Copy deliverables

Resident keys to add, both locales: `reportForm.blocked.*`, `reportForm.intro.{time,volunteer}`, `reportForm.review.commit`, `reportForm.done.{next1,next2,next3,another,volunteer}`, `reportForm.captcha.{checking,failed,retry}`, `login.{wrong,resend,resendIn,expiry,spam,otherApp,didYouMean,rateLimited}`. Write Filipino with `design:ux-copy`; keep it Taglish for tech words (email, link, photo), pick one register (informal "ka/mo" or "po") and use it everywhere. Check every new Filipino string at 360px width: Filipino runs 20–40% longer than English.

## Testing and verification

- `npm test`, `npm run lint`, `npm run typecheck`, key-parity test.
- Manual path on a real phone (or Chrome device mode with throttling "Slow 4G"): full submit with a draft restore in the middle; submit with Turnstile blocked; submit with the network offline.
- Keyboard-only run of all five steps; screen-reader pass of the blocked-button messages.
- Screenshots (390px): each step in its blocked state, the review step, the confirmation page, login in the idle, sent, resend-cooldown and rate-limited states.
- `design:accessibility-review` on `/report` and `/login`.

## Risks

- Turning disabled buttons into enabled-with-error changes the test and analytics surface (more taps on "Susunod"). That is intended; note it in the PR.
- The resend cooldown is cosmetic: the provider's limit is the real one. Surface the provider's error, don't hide it.
- Copy that promises an expiry or sender that differs from the hosted configuration will erode trust faster than saying nothing. Verify both values before shipping.
- `report-form.tsx` is large. Don't refactor it in the same change; extract only `StepNav` and `DoneView` if the diff gets unreadable, as a separate commit first.

## Open questions

1. Is the landmark field optional? (Task 2.4.)
2. What is the hosted `otp_expiry`, and is custom SMTP configured? (Task 7.)
3. Do Volunteers have a review turnaround they want stated publicly? (Task 6.)
