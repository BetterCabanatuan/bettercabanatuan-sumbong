"use server";

import { env } from "@/lib/env";
import { safeNextPath } from "@/lib/redirect";
import { emailAddress } from "@/lib/report-schema";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { status: "idle" | "sent" | "error"; email?: string };

export async function sendMagicLink(_: LoginState, form: FormData): Promise<LoginState> {
  const raw = String(form.get("email") ?? "").trim();
  const email = emailAddress.safeParse(raw);
  if (!email.success) return { status: "error", email: raw };

  const next = safeNextPath(form.get("next"));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: { emailRedirectTo: `${env.siteUrl}/auth/confirm?next=${encodeURIComponent(next)}` },
  });
  if (error) {
    console.error("[login] signInWithOtp failed", error.message);
    return { status: "error", email: email.data };
  }
  return { status: "sent", email: email.data };
}
