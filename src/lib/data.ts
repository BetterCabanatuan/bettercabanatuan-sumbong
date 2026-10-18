import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Barangay,
  Category,
  CategoryQuestion,
  Report,
  ReportAnswer,
  ReportPhoto,
  ReportStatus,
  ResponsibleOffice,
} from "@/lib/types";

/** Supabase returns plain objects as errors; wrap them so stack traces and the dev overlay are readable. */
function dbError(context: string, error: { code?: string; message: string; hint?: string | null }): Error {
  const hint =
    error.code === "PGRST205" ? " The database schema is missing: run `npm run db:push` (see README)." : "";
  return new Error(`${context}: ${error.message}${error.code ? ` [${error.code}]` : ""}.${hint}`, { cause: error });
}

export type CategoryWithQuestions = Category & { questions: CategoryQuestion[] };

export async function getCategories({ includeInactive = false } = {}): Promise<CategoryWithQuestions[]> {
  const supabase = await createClient();
  let query = supabase.from("categories").select("*, questions:category_questions(*)").order("sort_order");
  if (!includeInactive) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw dbError("Loading categories", error);
  return (data as CategoryWithQuestions[]).map((c) => ({
    ...c,
    questions: c.questions
      .filter((q) => includeInactive || q.active)
      .sort((a, b) => a.sort_order - b.sort_order),
  }));
}

export async function getOffices({ includeInactive = false } = {}): Promise<ResponsibleOffice[]> {
  const supabase = await createClient();
  let query = supabase.from("responsible_offices").select("*").order("name_en");
  if (!includeInactive) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw dbError("Loading responsible offices", error);
  return data as ResponsibleOffice[];
}

export async function getBarangays(): Promise<Barangay[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("barangays").select("id, name, psgc").order("name");
  if (error) throw dbError("Loading barangays", error);
  return data as Barangay[];
}

export interface ReportFilters {
  statuses?: ReportStatus[];
  categoryId?: string;
  officeId?: string;
  barangayId?: number;
  limit?: number;
}

/** Reports visible to the caller (public ones for residents; all for Volunteers). */
export async function getReports(filters: ReportFilters = {}): Promise<Report[]> {
  const supabase = await createClient();
  let query = supabase
    .from("reports_view")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 500);
  if (filters.statuses?.length) query = query.in("status", filters.statuses);
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.officeId) query = query.eq("office_id", filters.officeId);
  if (filters.barangayId) query = query.eq("barangay_id", filters.barangayId);
  const { data, error } = await query;
  if (error) throw dbError("Loading reports", error);
  return data as Report[];
}

export async function getReportByCode(code: string, { asAdmin = false } = {}): Promise<Report | null> {
  const supabase = asAdmin ? createAdminClient() : await createClient();
  const { data, error } = await supabase
    .from("reports_view")
    .select("*")
    .eq("public_code", code.toUpperCase())
    .maybeSingle<Report>();
  if (error) throw dbError("Loading report", error);
  return data;
}

export async function getReportById(id: string): Promise<Report | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("reports_view").select("*").eq("id", id).maybeSingle<Report>();
  if (error) throw dbError("Loading report", error);
  return data;
}

export async function getReportDetails(reportId: string, { asAdmin = false } = {}) {
  const supabase = asAdmin ? createAdminClient() : await createClient();
  const [photos, answers] = await Promise.all([
    supabase.from("report_photos").select("*").eq("report_id", reportId).order("sort_order"),
    supabase.from("report_answers").select("*").eq("report_id", reportId).order("sort_order"),
  ]);
  if (photos.error) throw dbError("Loading report photos", photos.error);
  if (answers.error) throw dbError("Loading report answers", answers.error);
  return { photos: photos.data as ReportPhoto[], answers: answers.data as ReportAnswer[] };
}

export function byId<T extends { id: string | number }>(rows: T[]): Map<T["id"], T> {
  return new Map(rows.map((row) => [row.id, row]));
}
