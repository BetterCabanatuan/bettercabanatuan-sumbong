export interface Crumb {
  label: string;
  href: string;
}

const LABELS: Record<string, string> = {
  review: "Review",
  reports: "Reports",
  digests: "Digests",
  settings: "Settings",
  categories: "Categories",
  offices: "Responsible Offices",
  users: "Users",
  roles: "Roles",
  new: "New",
  letter: "Letter",
  export: "Export",
};

/** Under Settings an id means editing that row; elsewhere it means one Report or Digest. */
const SETTINGS_AREAS = new Set(["categories", "offices", "users", "roles"]);

/** "/v/settings/roles/abc" -> Settings / Roles / Edit. The dashboard is just "Dashboard". */
export function consoleCrumbs(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] !== "v") return [];
  const rest = segments.slice(1);
  if (rest.length === 0) return [{ label: "Dashboard", href: "/v" }];

  return rest.map((segment, i) => {
    const href = `/v/${rest.slice(0, i + 1).join("/")}`;
    const known = LABELS[segment];
    if (known) return { label: known, href };
    const parent = rest[i - 1];
    if (parent && SETTINGS_AREAS.has(parent)) return { label: "Edit", href };
    if (parent === "review") return { label: "Report", href };
    if (parent === "reports") return { label: "Report", href };
    if (parent === "digests") return { label: "Digest", href };
    return { label: "Details", href };
  });
}
