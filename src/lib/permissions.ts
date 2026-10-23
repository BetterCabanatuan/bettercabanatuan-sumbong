import type { Permission, PermissionAction, PermissionArea } from "@/lib/types";

/**
 * The permission matrix's rows and columns, in display order. Which cells exist comes
 * from the `permissions` table (supabase/migrations/20261020000100_permission_matrix.sql):
 * only actions the console really has, so there is no "Delete Reports".
 */
export const PERMISSION_AREAS: { key: PermissionArea; label: string }[] = [
  { key: "reports", label: "Reports" },
  { key: "digests", label: "Digests" },
  { key: "categories", label: "Categories" },
  { key: "offices", label: "Responsible Offices" },
  { key: "users", label: "Users" },
  { key: "roles", label: "Roles" },
];

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
