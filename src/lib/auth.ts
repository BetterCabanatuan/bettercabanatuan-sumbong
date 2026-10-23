import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Permission, Volunteer } from "@/lib/types";

export interface CurrentUser {
  id: string;
  email: string | null;
}

export interface VolunteerAccess extends Volunteer {
  email: string | null;
  role_name: string;
  permissions: Permission[];
}

/** The signed-in user (Reporter account or Volunteer), or null. Verified against Supabase Auth. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
});

type VolunteerRow = Volunteer & { roles: { name: string; role_permissions: { permission: Permission }[] } | null };

/** The signed-in Volunteer with their role's permissions, or null for anyone without console access. */
export const getVolunteer = cache(async (): Promise<VolunteerAccess | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("volunteers")
    .select("user_id, display_name, role_id, active, created_at, roles(name, role_permissions(permission))")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle<VolunteerRow>();
  if (!data?.roles) return null;
  const { roles, ...volunteer } = data;
  return {
    ...volunteer,
    email: user.email,
    role_name: roles.name,
    permissions: roles.role_permissions.map((p) => p.permission),
  };
});

export async function requireVolunteer(nextPath = "/v") {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  const volunteer = await getVolunteer();
  if (!volunteer) redirect("/login?denied=1");
  return volunteer;
}

/**
 * The app-side mirror of the database's `require_permission`: sends Volunteers without it back to the dashboard.
 * With several permissions, any one of them is enough (the database then checks the exact one).
 */
export async function requirePermission(...permissions: [Permission, ...Permission[]]) {
  const volunteer = await requireVolunteer();
  if (!permissions.some((p) => volunteer.permissions.includes(p))) redirect("/v?forbidden=1");
  return volunteer;
}

/** Whether a Volunteer's role has a permission; for showing or hiding controls. */
export function can(volunteer: { permissions: Permission[] }, permission: Permission) {
  return volunteer.permissions.includes(permission);
}
