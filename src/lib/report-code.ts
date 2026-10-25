/**
 * Report codes look like `CBN-ABC234`: the prefix, then six characters from the alphabet that
 * `public.generate_report_code()` draws on (no 0, 1, I or O, which are easy to misread).
 */
const CODE_BODY = "[23456789A-HJ-NP-Z]{6}";
const LOOSE_PATTERN = new RegExp(`^(?:CBN-?)?(${CODE_BODY})$`);

/**
 * Turns what someone typed or pasted into a Report code, or null when it can't be one.
 * Accepts the code itself (any case, spaces, dash optional, prefix optional) or a pasted
 * `/r/CBN-XXXXXX` link, with or without the `?t=` query. Never throws and never touches the network.
 */
export function normalizeReportCode(input: string): string | null {
  let text = input.trim();
  const fromLink = text.match(/\/r\/([^/?#\s]+)/i);
  if (fromLink?.[1]) text = fromLink[1];
  // Whitespace inside a code is forgiven ("cbn abc 234"), but a line break means two things were pasted.
  if (/[\r\n]/.test(text)) return null;
  text = text.replace(/\s+/g, "").toUpperCase();
  const match = text.match(LOOSE_PATTERN);
  return match ? `CBN-${match[1]}` : null;
}
