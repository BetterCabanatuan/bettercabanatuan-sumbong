import { can, getVolunteer } from "@/lib/auth";
import { csvResponse, toCsv } from "@/lib/csv";
import { byId, getBarangays, getCategories, getOffices, getReports } from "@/lib/data";
import { env } from "@/lib/env";
import { parseReportFilters } from "@/lib/report-filters";

/**
 * The console Reports list as CSV, with the same filters as the screen. Only what a Report
 * viewer already sees: no Reporter or Follower contact details, which never leave the database.
 */
export async function GET(request: Request) {
  const volunteer = await getVolunteer();
  if (!volunteer || !can(volunteer, "reports.export") || !can(volunteer, "reports.view")) {
    return new Response("Your role does not allow exporting Reports.", { status: 403 });
  }

  const filters = parseReportFilters(new URL(request.url).searchParams);
  const [reports, categories, offices, barangays] = await Promise.all([
    getReports({ ...filters, limit: 5000 }),
    getCategories({ includeInactive: true }),
    getOffices({ includeInactive: true }),
    getBarangays(),
  ]);
  const categoriesById = byId(categories);
  const officesById = byId(offices);
  const barangaysById = byId(barangays);

  const rows = reports.map((r) => [
    r.public_code,
    r.status,
    r.title,
    categoriesById.get(r.category_id)?.name_en,
    r.office_id ? officesById.get(r.office_id)?.short_name : null,
    r.barangay_id ? barangaysById.get(r.barangay_id)?.name : null,
    r.landmark,
    r.description,
    r.lat,
    r.lng,
    r.me_too_count,
    r.created_at,
    r.published_at,
    r.first_forwarded_at,
    r.resolved_at,
    r.reopened_at,
    r.rejection_reason,
    new URL(`/r/${r.public_code}`, env.siteUrl).toString(),
  ]);
  return csvResponse(
    "reports",
    toCsv(
      [
        "code", "status", "title", "category", "office", "barangay", "landmark", "description", "lat", "lng",
        "me_too", "submitted_at", "published_at", "first_forwarded_at", "resolved_at", "reopened_at",
        "rejection_reason", "public_url",
      ],
      rows,
    ),
  );
}
