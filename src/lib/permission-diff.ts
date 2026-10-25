import { PERMISSION_ACTIONS, PERMISSION_AREAS, PERMISSION_GROUPS } from "@/lib/permissions";
import type { Permission, PermissionAction, PermissionArea } from "@/lib/types";

/** Pure rules of the role editor's permission matrix, kept apart from the component so they can be tested. */

export function splitPermission(key: Permission): { area: PermissionArea; action: PermissionAction } {
  const [area, action] = key.split(".");
  return { area: area as PermissionArea, action: action as PermissionAction };
}

/** Display order: by area, then by action column. Unknown keys sort last. */
export function sortPermissions(keys: Iterable<Permission>): Permission[] {
  const rank = (key: Permission) => {
    const { area, action } = splitPermission(key);
    const areaIndex = PERMISSION_AREAS.findIndex((a) => a.key === area);
    const actionIndex = PERMISSION_ACTIONS.findIndex((a) => a.key === action);
    return (areaIndex < 0 ? 99 : areaIndex) * 100 + (actionIndex < 0 ? 99 : actionIndex);
  };
  return [...keys].sort((a, b) => rank(a) - rank(b));
}

/**
 * Checks or unchecks cells. Any action turns its area's View on (you can't edit what you can't
 * open); unchecking View clears the whole row. `universe` is every cell that exists.
 */
export function togglePermissions(
  current: ReadonlySet<Permission>,
  keys: readonly Permission[],
  on: boolean,
  universe: readonly Permission[],
): Set<Permission> {
  const next = new Set(current);
  for (const key of keys) {
    const { area, action } = splitPermission(key);
    if (on) {
      next.add(key);
      next.add(`${area}.view` as Permission);
    } else if (action === "view") {
      for (const other of universe) if (splitPermission(other).area === area) next.delete(other);
    } else {
      next.delete(key);
    }
  }
  return next;
}

export function sameSet(a: ReadonlySet<Permission>, b: ReadonlySet<Permission>): boolean {
  return a.size === b.size && [...a].every((key) => b.has(key));
}

/** What changed from `saved` to `next`, each list in display order. */
export function diffPermissions(
  saved: Iterable<Permission>,
  next: Iterable<Permission>,
): { added: Permission[]; removed: Permission[] } {
  const before = new Set(saved);
  const after = new Set(next);
  return {
    added: sortPermissions([...after].filter((key) => !before.has(key))),
    removed: sortPermissions([...before].filter((key) => !after.has(key))),
  };
}

/** "Export Reports": the action and area labels, so the wording is the same for every cell. */
export function permissionName(key: Permission): string {
  const { area, action } = splitPermission(key);
  const actionLabel = PERMISSION_ACTIONS.find((a) => a.key === action)?.label ?? action;
  const areaLabel = PERMISSION_AREAS.find((a) => a.key === area)?.label ?? area;
  return `${actionLabel} ${areaLabel}`;
}

/** The pending-changes sentence, or "" when nothing changed. `people` is how many active people hold the role. */
export function describeChanges(diff: { added: Permission[]; removed: Permission[] }, people = 0): string {
  const parts: string[] = [];
  if (diff.added.length > 0) parts.push(`Adding: ${diff.added.map(permissionName).join(", ")}.`);
  if (diff.removed.length > 0) parts.push(`Removing: ${diff.removed.map(permissionName).join(", ")}.`);
  if (parts.length === 0) return "";
  if (people > 0) parts.push(`This affects ${people} ${people === 1 ? "person" : "people"} now.`);
  return parts.join(" ");
}

/**
 * "This role cannot: delete Digests, archive Reports, and 4 more." Built from the cells that
 * exist but are unchecked, in area order. Null when the role can do everything.
 */
export function cannotSummary(
  selected: ReadonlySet<Permission>,
  universe: readonly Permission[],
  limit = 3,
): string | null {
  const missing = sortPermissions(universe.filter((key) => !selected.has(key)));
  if (missing.length === 0) return null;
  const phrase = (key: Permission) => {
    const { area, action } = splitPermission(key);
    const actionLabel = PERMISSION_ACTIONS.find((a) => a.key === action)?.label ?? action;
    const areaLabel = PERMISSION_AREAS.find((a) => a.key === area)?.label ?? area;
    return `${actionLabel.toLowerCase()} ${areaLabel}`;
  };
  const shown = missing.slice(0, limit).map(phrase);
  const rest = missing.length - shown.length;
  return `This role cannot: ${shown.join(", ")}${rest > 0 ? `, and ${rest} more` : ""}.`;
}

/** Areas present in the matrix, in the Work, Setup, Access bands. Empty bands are left out. */
export function groupAreas(present: readonly PermissionArea[]) {
  return PERMISSION_GROUPS.map((group) => ({
    ...group,
    areas: PERMISSION_AREAS.filter((area) => area.group === group.key && present.includes(area.key)),
  })).filter((group) => group.areas.length > 0);
}
