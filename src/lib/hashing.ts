import "server-only";
import { env } from "@/lib/env";

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256(value: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

/**
 * Keyed hash (HMAC-SHA-256 with HASH_SALT). Used for rate-limit identifiers, so raw IPs and
 * device ids are never stored, and to sign Follower links in notification emails.
 */
export async function saltedHash(kind: "ip" | "device" | "follower", value: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(env.hashSalt), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(`${kind}:${value}`)));
}

/** URL-safe random token: the Reporter's private key to their Report's tracking page. */
export function generateToken(bytes = 24): string {
  const raw = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...raw)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Constant-time comparison for hex digests. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
