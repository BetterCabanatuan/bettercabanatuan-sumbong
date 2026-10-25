export interface BoardStats {
  /** Reports published in the last 7 days. */
  newThisWeek: number;
  /** Reports resolved in the last 30 days. */
  resolvedThisMonth: number;
}

export interface ActivityStrip {
  /** Shown only when at least 1; null otherwise. */
  week: number | null;
  month: number | null;
}

/**
 * The honesty rule for the board's activity strip: a number shows only when it is 1 or more,
 * and the strip itself only when at least one number shows. Never "0 resolved".
 * Returns null when there is nothing worth saying.
 */
export function activityStrip(stats: BoardStats | null): ActivityStrip | null {
  if (!stats) return null;
  const pick = (n: number) => (Number.isFinite(n) && n >= 1 ? Math.floor(n) : null);
  const week = pick(stats.newThisWeek);
  const month = pick(stats.resolvedThisMonth);
  return week === null && month === null ? null : { week, month };
}
