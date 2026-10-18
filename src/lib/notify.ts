import "server-only";
import { createTranslator } from "next-intl";
import { escapeHtml, sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { followerSignature } from "@/lib/reporter-access";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Locale } from "@/lib/types";
import en from "@/messages/en.json";
import fil from "@/messages/fil.json";

const MESSAGES = { en, fil } as const;

/** What happened to a Report, from the Follower's point of view. */
export type Notice = "submitted" | "published" | "rejected" | "forwarded" | "resolved" | "reopened" | "misrouted";

interface FollowerRow {
  id: string;
  email: string | null;
  locale: Locale;
  report: {
    public_code: string;
    rejection_reason: string | null;
    category: { name_en: string; name_fil: string } | null;
    office: { name_en: string; name_fil: string } | null;
  };
}

/**
 * Emails every Follower of the given Reports. Never throws: a failed notification must not
 * undo the Volunteer action that triggered it. Call it from `after()`.
 */
export async function notifyFollowers(reportIds: string[], notice: Notice, options: { trackingToken?: string } = {}) {
  if (reportIds.length === 0) return;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("report_followers")
      .select(
        "id, email, locale, report:reports!inner(public_code, rejection_reason, category:categories(name_en, name_fil), office:responsible_offices!reports_office_id_fkey(name_en, name_fil))",
      )
      .in("report_id", reportIds)
      .not("email", "is", null);
    if (error) throw error;

    for (const follower of data as unknown as FollowerRow[]) {
      if (!follower.email) continue;
      await sendEmail(await buildEmail(follower, notice, options.trackingToken));
    }
  } catch (error) {
    console.error(`[notify] ${notice} for ${reportIds.join(",")} failed`, error);
  }
}

async function buildEmail(follower: FollowerRow, notice: Notice, trackingToken?: string) {
  const locale: Locale = follower.locale === "en" ? "en" : "fil";
  const t = createTranslator({ locale, messages: MESSAGES[locale], namespace: "email" });
  const { report } = follower;

  const link = new URL(`/r/${report.public_code}`, env.siteUrl);
  if (trackingToken) {
    link.searchParams.set("t", trackingToken);
  } else {
    link.searchParams.set("f", follower.id);
    link.searchParams.set("s", await followerSignature(follower.id));
  }

  const values = {
    code: report.public_code,
    category: (locale === "en" ? report.category?.name_en : report.category?.name_fil) ?? "",
    office: (locale === "en" ? report.office?.name_en : report.office?.name_fil) ?? "",
    reason: report.rejection_reason ?? "",
  };
  const subject = t(`${notice}.subject`, values);
  const body = t(`${notice}.body`, values);
  const cta = t("cta");
  const footer = t("footer");

  return {
    to: follower.email!,
    subject,
    text: `${body}\n\n${cta}: ${link}\n\n${footer}`,
    html: `<div style="font-family:Inter,Arial,sans-serif;font-size:16px;line-height:1.5;color:#1f2933;max-width:560px">
<p>${escapeHtml(body)}</p>
<p><a href="${escapeHtml(link.toString())}" style="display:inline-block;background:#005df5;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">${escapeHtml(cta)}</a></p>
<p style="color:#6b7280;font-size:13px">${escapeHtml(footer)}</p>
</div>`,
  };
}
