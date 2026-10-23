import { can, getVolunteer } from "@/lib/auth";
import { csvResponse, toCsv } from "@/lib/csv";
import { byId, getBarangays, getOffices } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import type { Digest } from "@/lib/types";

/** Every Digest (drafts and sent) as CSV, optionally for one office like the screen. */
export async function GET(request: Request) {
  const volunteer = await getVolunteer();
  if (!volunteer || !can(volunteer, "digests.export") || !can(volunteer, "digests.view")) {
    return new Response("Your role does not allow exporting Digests.", { status: 403 });
  }

  const office = new URL(request.url).searchParams.get("office");
  const supabase = await createClient();
  let query = supabase.from("digests").select("*, digest_reports(count)").order("created_at", { ascending: false }).limit(5000);
  if (office) query = query.eq("office_id", office);
  const [{ data, error }, offices, barangays] = await Promise.all([query, getOffices({ includeInactive: true }), getBarangays()]);
  if (error) return new Response(error.message, { status: 500 });
  const officesById = byId(offices);
  const barangaysById = byId(barangays);

  const rows = ((data ?? []) as (Digest & { digest_reports: { count: number }[] })[]).map((d) => [
    d.id,
    officesById.get(d.office_id)?.short_name,
    d.barangay_id ? barangaysById.get(d.barangay_id)?.name : null,
    d.sent_at ? "sent" : "draft",
    d.digest_reports[0]?.count ?? 0,
    d.created_at,
    d.sent_at,
    d.channel,
    d.channel_detail,
    d.proof_photo_path ? "yes" : "no",
  ]);
  return csvResponse(
    "digests",
    toCsv(
      ["id", "office", "barangay", "status", "reports", "created_at", "sent_at", "channel", "channel_detail", "proof_of_receipt"],
      rows,
    ),
  );
}
