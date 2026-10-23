const BASE = "https://sumbong.invalid";

/**
 * A same-site path to send someone to after signing in, or `fallback`. Browsers treat `\` like
 * `/` and drop tabs and newlines, so `/\evil.com` would leave the site: resolve the value the
 * way the browser will and keep it only if it stays on our origin. Resolving also collapses dot
 * segments, so `/.//evil.com` comes out as `//evil.com`, which is another site once redirected
 * to: refuse a result that starts with `//`.
 */
export function safeNextPath(raw: unknown, fallback = "/"): string {
  if (typeof raw !== "string" || !raw.startsWith("/")) return fallback;
  try {
    const url = new URL(raw, BASE);
    if (url.origin !== BASE || url.pathname.startsWith("//")) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
