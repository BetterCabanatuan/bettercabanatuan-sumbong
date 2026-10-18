import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Volunteer } from "@/lib/types";

export interface CurrentUser {
  id: string;
  email: string | null;
}

/** The signed-in user (Reporter account or Volunteer), or null. Verified against Supabase Auth. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
});

export const getVolunteer = cache(async (): Promise<(Volunteer & { email: string | null }) | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("volunteers")
    .select("user_id, display_name, role, active, created_at")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle<Volunteer>();
  return data ? { ...data, email: user.email } : null;
});

export async function requireVolunteer(nextPath = "/v") {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  const volunteer = await getVolunteer();
  if (!volunteer) redirect("/login?denied=1");
  return volunteer;
}

export async function requireCoordinator() {
  const volunteer = await requireVolunteer();
  if (volunteer.role !== "coordinator") redirect("/v?coordinator_only=1");
  return volunteer;
}
