import "server-only";

function required(name: string, value = process.env[name]): string {
  if (!value) throw new Error(`Missing environment variable ${name}. See .env.example.`);
  return value;
}

export const env = {
  // NEXT_PUBLIC_* values are read as literal `process.env.NEXT_PUBLIC_…` so Next inlines
  // them at build time, as in the browser and proxy clients. Looked up by name, they
  // would have to exist again at runtime in the Worker, which only has its vars and secrets.
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  },
  get supabasePublishableKey() {
    return required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  },
  get supabaseSecretKey() {
    return required("SUPABASE_SECRET_KEY");
  },
  get siteUrl() {
    return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  },
  get turnstileSecretKey() {
    return required("TURNSTILE_SECRET_KEY");
  },
  get hashSalt() {
    return required("HASH_SALT");
  },
  get resendApiKey() {
    return process.env.RESEND_API_KEY || null;
  },
  get emailFrom() {
    return process.env.EMAIL_FROM ?? "BetterCabanatuan Sumbong <sumbong@bettercabanatuan.org>";
  },
};
