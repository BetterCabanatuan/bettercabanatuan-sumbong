import { Building2, ClipboardCheck, FileText, LayoutDashboard, Mail, ShieldCheck, Tags, Users } from "lucide-react";
import type { Permission } from "@/lib/types";

/** Volunteer console navigation. Items with a permission show only to roles that have it. */
export type NavItem = {
  href: string;
  label: string;
  icon: typeof Tags;
  exact?: boolean;
  /** Which count to show beside the label: Reports waiting for Review, or offices waiting for a Digest. */
  badge?: "pending" | "digests";
  permission?: Permission;
  /** The letter after `G` in the go-to shortcut ("G then R"). */
  chord?: string;
};

export const WORK: NavItem[] = [
  { href: "/v", label: "Dashboard", icon: LayoutDashboard, exact: true, chord: "h" },
  { href: "/v/review", label: "Review", icon: ClipboardCheck, badge: "pending", permission: "reports.review", chord: "r" },
  { href: "/v/reports", label: "Reports", icon: FileText, permission: "reports.view", chord: "p" },
  { href: "/v/digests", label: "Digests", icon: Mail, badge: "digests", permission: "digests.view", chord: "d" },
];

export const SETTINGS: (NavItem & { permission: Permission })[] = [
  { href: "/v/settings/categories", label: "Categories", icon: Tags, permission: "categories.view" },
  { href: "/v/settings/offices", label: "Responsible Offices", icon: Building2, permission: "offices.view" },
  { href: "/v/settings/users", label: "Users", icon: Users, permission: "users.view" },
  { href: "/v/settings/roles", label: "Roles", icon: ShieldCheck, permission: "roles.view" },
];

