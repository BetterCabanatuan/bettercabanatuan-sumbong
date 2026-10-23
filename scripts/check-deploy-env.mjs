// Runs before `npm run deploy`. A production build reads .env, .env.production,
// .env.local and .env.production.local: Next inlines their NEXT_PUBLIC_* values, and
// OpenNext copies every value into the Worker, where it backs up any secret not set
// with `wrangler secret put`. A developer's .env.local would ship localhost links and
// test keys (such as the always-pass Turnstile secret), so refuse to build with it.
import { existsSync, readFileSync } from "node:fs";

const fail = (message) => {
  console.error(`\ncheck-deploy-env: ${message}\n`);
  process.exit(1);
};

if (existsSync(".env.local")) {
  fail(
    ".env.local would be copied into the production Worker. Move it aside (mv .env.local .env.local.off) " +
      "or deploy from a clean checkout, and put production NEXT_PUBLIC_* values in .env.production.",
  );
}

// Same precedence as Next: the shell's environment, then .env.production.local, .env.production, .env.
const fromFiles = {};
for (const file of [".env", ".env.production", ".env.production.local"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match) fromFiles[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}
const value = (name) => process.env[name] || fromFiles[name];

const missing = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
].filter((name) => !value(name));
if (missing.length > 0) {
  fail(`Set ${missing.join(", ")} (exported, or in .env.production) before building: they are inlined into the build.`);
}
if (/localhost|127\.0\.0\.1/.test(value("NEXT_PUBLIC_SITE_URL"))) {
  fail(`NEXT_PUBLIC_SITE_URL is ${value("NEXT_PUBLIC_SITE_URL")}; sign-in and notification links would point there.`);
}
