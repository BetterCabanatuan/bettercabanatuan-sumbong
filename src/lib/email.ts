import "server-only";
import { env } from "@/lib/env";

export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Sends through Resend; without RESEND_API_KEY (local dev) the email is logged instead.
 * Never throws; returns false when the email was not sent.
 */
export async function sendEmail(email: Email): Promise<boolean> {
  const apiKey = env.resendApiKey;
  if (!apiKey) {
    // The body carries private Tracking Links, so it is only printed in local development.
    if (process.env.NODE_ENV === "production") {
      console.error(`[email] RESEND_API_KEY is not set; email not sent: ${JSON.stringify(email.subject)}`);
      return false;
    }
    console.info(`[email] to=${email.to} subject=${JSON.stringify(email.subject)}\n${email.text}`);
    return true;
  }

  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.emailFrom, to: email.to, subject: email.subject, text: email.text, html: email.html }),
    });
  } catch (error) {
    console.error(`[email] Could not reach Resend for ${JSON.stringify(email.subject)}`, error);
    return false;
  }
  if (!response.ok) {
    console.error(`[email] Resend rejected ${JSON.stringify(email.subject)}: ${response.status} ${await response.text()}`);
  }
  return response.ok;
}
