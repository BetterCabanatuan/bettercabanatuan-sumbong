export const DATA_VIEWS = ["table", "list", "grid"] as const;
export type DataViewMode = (typeof DATA_VIEWS)[number];

export function viewCookieName(screen: string) {
  return `v-view-${screen}`;
}

/** The layout a console list should open in: `?view=` first, then the remembered choice, then the default. */
export function resolveView(
  screen: string,
  searchParams: Record<string, string | string[] | undefined>,
  cookies: { get(name: string): { value: string } | undefined },
  fallback: DataViewMode = "table",
): DataViewMode {
  const asked = searchParams.view;
  if (typeof asked === "string" && (DATA_VIEWS as readonly string[]).includes(asked)) return asked as DataViewMode;
  const remembered = cookies.get(viewCookieName(screen))?.value;
  if (remembered && (DATA_VIEWS as readonly string[]).includes(remembered)) return remembered as DataViewMode;
  return fallback;
}
