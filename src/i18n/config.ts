import type { Locale } from "@/lib/types";

export const LOCALES: Locale[] = ["fil", "en"];
export const DEFAULT_LOCALE: Locale = "fil";
export const LOCALE_COOKIE = "locale";

export function isLocale(value: unknown): value is Locale {
  return value === "fil" || value === "en";
}

/** Picks the localized variant of a bilingual column pair, e.g. name_en / name_fil. */
export function localized(row: object, key: string, locale: Locale): string {
  const record = row as Record<string, unknown>;
  const value = record[`${key}_${locale}`] ?? record[`${key}_en`];
  return typeof value === "string" ? value : "";
}
