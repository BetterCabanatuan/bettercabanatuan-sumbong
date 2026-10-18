import "server-only";
import { env } from "@/lib/env";

export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Sends through Resend; without RESEND_API_KEY (local dev) the email is logged instead. */
export async function sendEmail(email: Email): Promise<void> {
  const apiKey = env.resendApiKey;
  if (!apiKey) {
    console.info(`[email] to=${email.to} subject=${JSON.stringify(email.subject)}\n${email.text}`);
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.emailFrom, to: email.to, subject: email.subject, text: email.text, html: email.html }),
  });
  if (!response.ok) {
    console.error(`[email] Resend rejected email to ${email.to}: ${response.status} ${await response.text()}`);
  }
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
