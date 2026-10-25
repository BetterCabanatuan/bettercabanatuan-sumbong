const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function unit(value: number, name: "hour" | "day") {
  return new Intl.NumberFormat("en", { style: "unit", unit: name, unitDisplay: "long" }).format(value);
}

/**
 * How long ago something happened, as plain words for the console: "Under 1 hour", "5 hours", "3 days".
 * Hours up to two days, then whole days. No threshold or colour: the domain has no "overdue" yet.
 */
export function formatAge(iso: string, now: number = Date.now()): string {
  const elapsed = Math.max(0, now - new Date(iso).getTime());
  if (elapsed < HOUR) return "Under 1 hour";
  if (elapsed < 2 * DAY) return unit(Math.floor(elapsed / HOUR), "hour");
  return unit(Math.floor(elapsed / DAY), "day");
}
