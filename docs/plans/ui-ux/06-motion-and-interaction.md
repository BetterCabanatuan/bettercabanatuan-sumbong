# Spec 6: motion and interaction rules

Status: in progress, 2026-10-25. Applies to specs 1–5. The colour palette does not change.

## Goal

Make the app feel modern and responsive without making it heavy. Residents are on phones and weak mobile data; Volunteers use the console for hours. Motion should confirm what just happened, never decorate.

## Rules (after Emil Kowalski's "Animations on the web" and the repo's existing idiom)

1. **Purpose first.** Animate only to show cause and effect: a press, an arrival, a state change. Skip anything the user does dozens of times a day (keyboard navigation, table sorting, shortcuts).
2. **One easing.** `--ease-out` (`cubic-bezier(0.23, 1, 0.32, 1)`), already the Tailwind `ease-out`. Enter fast, settle softly. No `ease-in` on entrances.
3. **Short.** 120–200 ms for presses and hovers, 240–420 ms for arrivals. Nothing over 500 ms except a one-off confirmation.
4. **Transform and opacity only** (plus `filter: blur` on at most one element at a time). Never animate layout properties.
5. **Interruptible.** Prefer CSS transitions to keyframes for anything the user can reverse mid-way; springs (`motion`) only for numbers and sheets.
6. **Stagger lightly.** `animate-rise-in` with 40 ms steps, at most 8 items; later items appear with no delay.
7. **Hover only on pointer devices.** Wrap hover lifts in `@media (hover: hover)`; touch screens never show a stuck hover.
8. **Reduced motion is a first-class path.** Use `motion-safe:` on every animation utility; the `motion` library hooks must check `useReducedMotion()`.
9. **Weight budget.** The public bundle stays CSS-first. `motion` (via Magic UI's `NumberTicker`) is used on Volunteer screens and in small, lazy client components only; do not import it into the resident report flow.
10. **No new colours.** Every state uses an existing theme token.

## Where each library is used

| Library | Used for | Not used for |
| --- | --- | --- |
| CSS (`starting:`, `animate-rise-in`, `animate-draw`, transitions) | resident screens: board cards arriving, confirmation check, timeline, button presses | anything above 8 items |
| Magic UI `NumberTicker` (via `motion`) | Volunteer dashboard counts and the Review wait time | resident screens, tables |
| Magic UI `BlurFade` | one-off section reveals on the dashboard | lists, the report form |
| Base UI `Drawer` (shadcn `drawer`) | the mobile map sheet and filters | desktop |
| cmdk (shadcn `command`) | the console command palette | resident screens |
| Sonner | toasts (already installed) | — |
| GSAP | not used: it adds ~70 KB for timeline-style choreography this product doesn't need | — |

"bencho.dev" was named in the request but could not be identified (no matching site or package was found), so no component was taken from it; the Magic UI, Emil Kowalski-style and Base UI pieces above cover the same ground.
