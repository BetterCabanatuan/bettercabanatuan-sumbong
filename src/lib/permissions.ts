import type { Permission, PermissionAction, PermissionArea } from "@/lib/types";

/**
 * The permission matrix's rows and columns, in display order. Which cells exist comes
 * from the `permissions` table (supabase/migrations/20261020000100_permission_matrix.sql):
 * only actions the console really has, so there is no "Delete Reports".
 */
export type PermissionGroup = "work" | "setup" | "access";

export const PERMISSION_GROUPS: { key: PermissionGroup; label: string }[] = [
  { key: "work", label: "Work" },
  { key: "setup", label: "Setup" },
  { key: "access", label: "Access" },
];

export const PERMISSION_AREAS: { key: PermissionArea; label: string; group: PermissionGroup }[] = [
  { key: "reports", label: "Reports", group: "work" },
  { key: "digests", label: "Digests", group: "work" },
  { key: "categories", label: "Categories", group: "setup" },
  { key: "offices", label: "Responsible Offices", group: "setup" },
  { key: "users", label: "Users", group: "access" },
  { key: "roles", label: "Roles", group: "access" },
];

/** Actions that remove or hide things; the matrix sets their columns apart. */
export const RISKY_ACTIONS: readonly PermissionAction[] = ["delete", "archive"];

export const PERMISSION_ACTIONS: { key: PermissionAction; label: string }[] = [
  { key: "view", label: "View" },
  { key: "add", label: "Add" },
  { key: "edit", label: "Edit" },
  { key: "delete", label: "Delete" },
  { key: "archive", label: "Archive" },
  { key: "print", label: "Print" },
  { key: "export", label: "Export" },
  { key: "review", label: "Review" },
  { key: "send", label: "Send" },
];

export const PERMISSIONS = [
  "reports.view",
  "reports.review",
  "reports.edit",
  "reports.archive",
  "reports.export",
  "digests.view",
  "digests.add",
  "digests.edit",
  "digests.delete",
  "digests.send",
  "digests.print",
  "digests.export",
  "categories.view",
  "categories.add",
  "categories.edit",
  "categories.archive",
  "offices.view",
  "offices.add",
  "offices.edit",
  "offices.archive",
  "users.view",
  "users.add",
  "users.edit",
  "users.archive",
  "users.export",
  "roles.view",
  "roles.add",
  "roles.edit",
  "roles.delete",
] as const satisfies readonly Permission[];
