"use server";

import { env } from "@/lib/env";
import { safeNextPath } from "@/lib/redirect";
import { emailAddress } from "@/lib/report-schema";
import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  status: "idle" | "sent" | "error";
  email?: string;
  /** Why a send failed, so the form can say something more useful than "try again". */
  reason?: "invalid" | "rate_limited" | "failed";
  /** When a link was sent (ms since epoch); a new value restarts the resend countdown. */
  sentAt?: number;
};

export async function sendMagicLink(_: LoginState, form: FormData): Promise<LoginState> {
  const raw = String(form.get("email") ?? "").trim();
  const email = emailAddress.safeParse(raw);
  if (!email.success) return { status: "error", email: raw, reason: "invalid" };

  const next = safeNextPath(form.get("next"));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: { emailRedirectTo: `${env.siteUrl}/auth/confirm?next=${encodeURIComponent(next)}` },
  });
  if (error) {
    console.error("[login] signInWithOtp failed", error.message);
    const limited = error.status === 429 || error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit";
    return { status: "error", email: email.data, reason: limited ? "rate_limited" : "failed" };
  }
  return { status: "sent", email: email.data, sentAt: Date.now() };
}
