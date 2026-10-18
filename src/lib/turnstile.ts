import "server-only";
import { env } from "@/lib/env";

/** Verifies a Cloudflare Turnstile token server-side. */
export async function verifyTurnstile(token: string | null, ip: string | null): Promise<boolean> {
  if (!token) return false;
  const body = new FormData();
  body.append("secret", env.turnstileSecretKey);
  body.append("response", token);
  if (ip) body.append("remoteip", ip);

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  if (!response.ok) return false;
  const result = (await response.json()) as { success: boolean };
  return result.success === true;
}
