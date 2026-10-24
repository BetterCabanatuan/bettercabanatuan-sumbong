"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getCategories } from "@/lib/data";
import { safeEqual, saltedHash, sha256 } from "@/lib/hashing";
import { notifyFollowers } from "@/lib/notify";
import { getClientIp, getOrCreateDeviceId } from "@/lib/request";
import { hasReporterAccess, type ReporterCredentials } from "@/lib/reporter-access";
import { reportTitle } from "@/lib/report-title";
import { followInput, reopenInput } from "@/lib/reporter-schema";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Locale, Report, ReportStatus } from "@/lib/types";

export type ActionResult = { ok: true; meTooCount?: number } | { ok: false; error: string };

export async function addMeToo(reportId: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(reportId).success) return { ok: false, error: "invalid_input" };
  const deviceHash = await saltedHash("device", await getOrCreateDeviceId());
  const ip = await getClientIp();
  const user = await getCurrentUser();

  const { data, error } = await createAdminClient().rpc("add_me_too", {
    p_report_id: reportId,
    p_device_hash: deviceHash,
    p_user_id: user?.id ?? null,
    p_ip_hash: ip ? await saltedHash("ip", ip) : null,
  });
  if (error) {
    const known = ["not_open", "rate_limited"];
    return { ok: false, error: known.includes(error.message) ? error.message : "server_error" };
  }
  return { ok: true, meTooCount: data as number };
}

/** Report ids this browser has already said "Ako rin" to (by device, not account). */
export async function getMyMeToos(): Promise<string[]> {
  const deviceHash = await saltedHash("device", await getOrCreateDeviceId());
  const { data } = await createAdminClient()
    .from("me_toos")
    .select("report_id")
    .eq("device_hash", deviceHash)
    .order("created_at", { ascending: false })
    .limit(500);
  return (data ?? []).map((row) => row.report_id as string);
}

/** A Follower says a Resolved Report is not actually fixed. */
export async function reopenAsFollower(input: z.input<typeof reopenInput>): Promise<ActionResult> {
  const parsed = reopenInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const { reportId, note, ...credentials } = parsed.data;

  if (!(await hasReporterAccess(reportId, credentials as ReporterCredentials))) {
    return { ok: false, error: "not_allowed" };
  }

  const { error } = await createAdminClient().rpc("reopen_by_follower", {
    p_report_id: reportId,
    p_note: note ? `Follower: ${note}` : null,
  });
  if (error) {
    const known = ["not_resolved", "reopen_window_closed"];
    return { ok: false, error: known.includes(error.message) ? error.message : "server_error" };
  }

  after(() => notifyFollowers([reportId], "reopened"));
  revalidatePath("/r/[code]", "page");
  return { ok: true };
}

const MAX_FOLLOWER_EMAILS = 3;

/** Lets a Reporter who submitted without contact details add an email later. */
export async function followByEmail(input: z.input<typeof followInput>): Promise<ActionResult> {
  const parsed = followInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_email" };
  const { reportId, email, ...credentials } = parsed.data;

  if (!(await hasReporterAccess(reportId, credentials as ReporterCredentials))) {
    return { ok: false, error: "not_allowed" };
  }

  const admin = createAdminClient();
  // A Tracking Link is meant for one Reporter; it shouldn't turn into a way to email many addresses.
  const { count } = await admin
    .from("report_followers")
    .select("id", { count: "exact", head: true })
    .eq("report_id", reportId)
    .not("email", "is", null);
  if ((count ?? 0) >= MAX_FOLLOWER_EMAILS) return { ok: false, error: "too_many_followers" };

  const locale = await getLocale();
  const { error } = await admin
    .from("report_followers")
    .insert({ report_id: reportId, email: email.toLowerCase(), locale: locale === "en" ? "en" : "fil" });
  if (error && error.code !== "23505") return { ok: false, error: "server_error" };
  return { ok: true };
}

const deviceReportsInput = z
  .array(z.object({ code: z.string().regex(/^CBN-[2-9A-HJ-NP-Z]{6}$/), token: z.string().min(1).max(100) }))
  .max(50);

export interface DeviceReportSummary {
  code: string;
  title: string;
  status: ReportStatus;
  createdAt: string;
}

/**
 * Status of the Reports saved on this device (/me). Each one is returned only if its saved
 * Tracking Link still matches, so a list of guessed codes reveals nothing.
 */
export async function getDeviceReports(input: z.input<typeof deviceReportsInput>): Promise<DeviceReportSummary[]> {
  const parsed = deviceReportsInput.safeParse(input);
  if (!parsed.success || parsed.data.length === 0) return [];

  const admin = createAdminClient();
  const { data: reports } = await admin
    .from("reports_view")
    .select("*")
    .in(
      "public_code",
      parsed.data.map((r) => r.code),
    );
  if (!reports?.length) return [];

  const { data: secrets } = await admin
    .from("report_secrets")
    .select("report_id, tracking_token_hash")
    .in(
      "report_id",
      (reports as Report[]).map((r) => r.id),
    );
  const hashes = new Map((secrets ?? []).map((s) => [s.report_id as string, s.tracking_token_hash as string]));

  const [categories, locale] = await Promise.all([getCategories({ includeInactive: true }), getLocale() as Promise<Locale>]);
  const byCode = new Map((reports as Report[]).map((r) => [r.public_code, r]));
  const result: DeviceReportSummary[] = [];
  for (const saved of parsed.data) {
    const report = byCode.get(saved.code);
    const hash = report && hashes.get(report.id);
    if (!report || !hash || !safeEqual(hash, await sha256(saved.token))) continue;
    result.push({
      code: report.public_code,
      title: reportTitle(report, categories.find((c) => c.id === report.category_id), locale),
      status: report.status,
      createdAt: report.created_at,
    });
  }
  return result;
}
