import { localized } from "@/i18n/config";
import type { Category, Locale, Report } from "@/lib/types";

/** The headline a Report shows on the board: its own title, else Category plus landmark. */
export function reportTitle(
  report: Pick<Report, "title" | "landmark" | "public_code">,
  category: Category | undefined,
  locale: Locale,
): string {
  if (report.title) return report.title;
  const name = category ? localized(category, "name", locale) : report.public_code;
  return report.landmark ? `${name}: ${report.landmark}` : name;
}
