import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Service-role client: bypasses row-level security. Only for work the server must do on
 * a Reporter's behalf after its own checks (Turnstile, rate limits, tracking tokens),
 * and for reading Follower contacts to send notifications. Never import from client code.
 */
export function createAdminClient() {
  return createClient(env.supabaseUrl, env.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
