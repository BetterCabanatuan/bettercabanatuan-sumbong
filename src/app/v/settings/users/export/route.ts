import { can, getVolunteer } from "@/lib/auth";
import { csvResponse, toCsv } from "@/lib/csv";
import { createClient } from "@/lib/supabase/server";
import type { UserAccount } from "@/lib/types";

/** The Users list as CSV, with the same search and "Volunteers / All accounts" choice as the screen. */
export async function GET(request: Request) {
  const volunteer = await getVolunteer();
  if (!volunteer || !can(volunteer, "users.export") || !can(volunteer, "users.view")) {
    return new Response("Your role does not allow exporting users.", { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_users", {
    p_search: params.get("q")?.trim() || null,
    p_staff_only: params.get("show") !== "all",
    p_limit: 1000,
    p_offset: 0,
  });
  if (error) return new Response(error.message, { status: 500 });

  const rows = ((data ?? []) as UserAccount[]).map((account) => [
    account.email,
    account.display_name,
    account.role_name,
    account.active ? "yes" : "no",
    account.created_at,
    account.last_sign_in_at,
  ]);
  return csvResponse(
    "users",
    toCsv(["email", "display_name", "role", "console_access", "joined_at", "last_sign_in_at"], rows),
  );
}
