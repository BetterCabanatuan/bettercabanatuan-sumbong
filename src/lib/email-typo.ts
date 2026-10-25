// Typos seen often enough to be worth a one-tap fix. Only the part after "@" is compared, and we
// never block sign-in on a match: it is a suggestion.
const DOMAIN_FIXES: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.con": "gmail.com",
  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "yahoo.con": "yahoo.com",
  "hotmial.com": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "outlok.com": "outlook.com",
  "outlook.con": "outlook.com",
};

/** The address with a likely-mistyped domain corrected, or null when nothing looks wrong. */
export function suggestEmail(raw: string): string | null {
  const email = raw.trim();
  const at = email.lastIndexOf("@");
  if (at < 1) return null;
  const fixed = DOMAIN_FIXES[email.slice(at + 1).toLowerCase()];
  return fixed ? `${email.slice(0, at)}@${fixed}` : null;
}
