import "server-only";
import { getBarangays, getCategories, getOffices } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import type { Digest, Report, ReportPhoto } from "@/lib/types";

/** A Digest with everything needed to review, print or send it. */
export async function getDigestBundle(digestId: string) {
  const supabase = await createClient();
  const { data: digest } = await supabase.from("digests").select("*").eq("id", digestId).maybeSingle<Digest>();
  if (!digest) return null;

  const { data: links } = await supabase.from("digest_reports").select("report_id").eq("digest_id", digestId);
  const reportIds = (links ?? []).map((l) => l.report_id as string);

  const [reports, photos, categories, offices, barangays, sender] = await Promise.all([
    reportIds.length
      ? supabase.from("reports_view").select("*").in("id", reportIds).order("created_at")
      : Promise.resolve({ data: [] }),
    reportIds.length
      ? supabase.from("report_photos").select("*").in("report_id", reportIds).order("sort_order")
      : Promise.resolve({ data: [] }),
    getCategories({ includeInactive: true }),
    getOffices({ includeInactive: true }),
    getBarangays(),
    digest.sent_by
      ? supabase.from("volunteers").select("display_name").eq("user_id", digest.sent_by).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    digest,
    reports: (reports.data ?? []) as Report[],
    photos: (photos.data ?? []) as ReportPhoto[],
    office: offices.find((o) => o.id === digest.office_id)!,
    barangay: barangays.find((b) => b.id === digest.barangay_id) ?? null,
    categories,
    barangays,
    senderName: (sender.data?.display_name as string | undefined) ?? null,
  };
}
