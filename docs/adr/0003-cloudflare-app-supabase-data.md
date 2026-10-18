# Next.js on Cloudflare Workers, data in Supabase

The app is a mobile-first Next.js web app deployed to Cloudflare Workers through the OpenNext adapter, which is where the rest of BetterCabanatuan already runs. Server-side work runs there:

- Turnstile verification
- per-device and per-IP rate limits
- stripping photo metadata
- sending email

Data stays in Supabase: Postgres with PostGIS, auth and photo storage.

We rejected an all-Cloudflare stack (D1 + R2 + auth we would run ourselves) because the core queries are spatial: the city-boundary check, Barangay tagging and the nearby-Reports check. PostGIS does all three natively, while on D1 we would have to write them ourselves. Supabase auth (email magic links) and row-level security also keep Pending Review Reports and Reporter contact details private without auth code of our own.

## Consequences

- Two vendors have to stay within free or volunteer-budget tiers. Moving off Supabase would mean migrating auth users, storage and the PostGIS functions.
- The Worker holds the Supabase secret key and uses it only for Reporter-side operations and notifications. Those database functions refuse every other role. Volunteer actions run as the signed-in Volunteer, under row-level security.
- Next 16 runs `proxy.ts` on the Node.js runtime, which OpenNext supports on Cloudflare only experimentally. The proxy only refreshes the session and redirects signed-out visitors away from `/v`, and every page and action re-checks access, so failing there isn't a security risk.
