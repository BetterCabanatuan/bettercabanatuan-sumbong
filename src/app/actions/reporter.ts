"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { saltedHash } from "@/lib/hashing";
import { notifyFollowers } from "@/lib/notify";
import { getClientIp, getOrCreateDeviceId } from "@/lib/request";
import { hasReporterAccess, type ReporterCredentials } from "@/lib/reporter-access";
import { createAdminClient } from "@/lib/supabase/admin";

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

const reopenInput = z.object({
  reportId: z.uuid(),
  note: z.string().trim().max(500).optional(),
  token: z.string().max(100).nullish(),
  followerId: z.uuid().nullish(),
  signature: z.string().max(100).nullish(),
});

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

const followInput = z.object({
  reportId: z.uuid(),
  email: z.email().max(254),
  token: z.string().max(100).nullish(),
  followerId: z.uuid().nullish(),
  signature: z.string().max(100).nullish(),
});

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
