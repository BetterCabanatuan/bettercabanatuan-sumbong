"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { requireCoordinator, requireVolunteer } from "@/lib/auth";
import { env } from "@/lib/env";
import { notifyFollowers } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { DigestChannel } from "@/lib/types";

export type VolunteerActionResult = { ok: true } | { ok: false; error: string };

function failure(error: { message: string } | null): VolunteerActionResult {
  return { ok: false, error: error?.message ?? "Something went wrong" };
}

const uuid = z.uuid();

// ---------------------------------------------------------------------------
// Review
// ---------------------------------------------------------------------------

export async function setPhotoReview(photoId: string, publicPath: string | null, hidden: boolean) {
  await requireVolunteer();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_photo_review", {
    p_photo_id: uuid.parse(photoId),
    p_public_path: publicPath,
    p_hidden: hidden,
  });
  if (error) return failure(error);
  revalidatePath("/v/review/[id]", "page");
  return { ok: true } as const;
}

export async function approveReport(reportId: string, form: FormData): Promise<VolunteerActionResult> {
  await requireVolunteer();
  const supabase = await createClient();

  const { data: photos } = await supabase
    .from("report_photos")
    .select("public_path, hidden")
    .eq("report_id", reportId)
    .eq("kind", "evidence");
  if ((photos ?? []).some((p) => !p.public_path && !p.hidden)) {
    return { ok: false, error: "Clear, blur or hide every photo before approving." };
  }

  const { error } = await supabase.rpc("review_approve", {
    p_report_id: uuid.parse(reportId),
    p_category_id: uuid.parse(form.get("category_id")),
    p_office_id: uuid.parse(form.get("office_id")),
    p_note: String(form.get("note") ?? "") || null,
  });
  if (error) return failure(error);

  after(() => notifyFollowers([reportId], "published"));
  revalidatePath("/v", "layout");
  redirect("/v/review?approved=1");
}

export async function rejectReport(reportId: string, form: FormData): Promise<VolunteerActionResult> {
  await requireVolunteer();
  const preset = String(form.get("preset") ?? "");
  const detail = String(form.get("reason") ?? "").trim();
  const reason = [preset, detail].filter(Boolean).join(": ");

  const supabase = await createClient();
  const { error } = await supabase.rpc("review_reject", { p_report_id: uuid.parse(reportId), p_reason: reason });
  if (error) return failure(error);

  after(() => notifyFollowers([reportId], "rejected"));
  revalidatePath("/v", "layout");
  redirect(form.get("from") === "review" ? "/v/review?rejected=1" : `/v/reports/${reportId}`);
}

// ---------------------------------------------------------------------------
// After forwarding
// ---------------------------------------------------------------------------

export async function resolveReport(
  reportId: string,
  input: { note?: string; afterPhoto?: { originalPath: string; publicPath: string } },
): Promise<VolunteerActionResult> {
  await requireVolunteer();
  const supabase = await createClient();

  if (input.afterPhoto) {
    const { error } = await supabase.rpc("add_after_photo", {
      p_report_id: uuid.parse(reportId),
      p_original_path: input.afterPhoto.originalPath,
      p_public_path: input.afterPhoto.publicPath,
    });
    if (error) return failure(error);
  }

  const { error } = await supabase.rpc("resolve_report", { p_report_id: reportId, p_note: input.note || null });
  if (error) return failure(error);

  after(() => notifyFollowers([reportId], "resolved"));
  revalidatePath("/v", "layout");
  revalidatePath(`/v/reports/${reportId}`);
  return { ok: true };
}

export async function misrouteReport(reportId: string, form: FormData): Promise<VolunteerActionResult> {
  await requireVolunteer();
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_misroute", {
    p_report_id: uuid.parse(reportId),
    p_new_office_id: uuid.parse(form.get("office_id")),
    p_note: String(form.get("note") ?? "") || null,
  });
  if (error) return failure(error);

  after(() => notifyFollowers([reportId], "misrouted"));
  revalidatePath(`/v/reports/${reportId}`);
  return { ok: true };
}

export async function reopenReport(reportId: string, form: FormData): Promise<VolunteerActionResult> {
  await requireVolunteer();
  const supabase = await createClient();
  const { error } = await supabase.rpc("reopen_report", {
    p_report_id: uuid.parse(reportId),
    p_note: String(form.get("note") ?? "") || null,
  });
  if (error) return failure(error);

  after(() => notifyFollowers([reportId], "reopened"));
  revalidatePath(`/v/reports/${reportId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Digests
// ---------------------------------------------------------------------------

export async function createDigest(form: FormData): Promise<VolunteerActionResult> {
  await requireVolunteer();
  const barangay = form.get("barangay_id");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_digest", {
    p_office_id: uuid.parse(form.get("office_id")),
    p_barangay_id: barangay ? Number(barangay) : null,
  });
  if (error) return failure(error);
  redirect(`/v/digests/${data}`);
}

export async function removeFromDigest(digestId: string, reportId: string): Promise<VolunteerActionResult> {
  await requireVolunteer();
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_from_digest", { p_digest_id: digestId, p_report_id: reportId });
  if (error) return failure(error);
  revalidatePath(`/v/digests/${digestId}`);
  return { ok: true };
}

export async function discardDigest(digestId: string): Promise<VolunteerActionResult> {
  await requireVolunteer();
  const supabase = await createClient();
  const { error } = await supabase.rpc("discard_digest", { p_digest_id: uuid.parse(digestId) });
  if (error) return failure(error);
  redirect("/v/digests");
}

const CHANNELS: DigestChannel[] = ["letter", "text_line", "email", "in_person", "other"];

export async function sendDigest(digestId: string, form: FormData): Promise<VolunteerActionResult> {
  await requireVolunteer();
  const channel = z.enum(CHANNELS).parse(form.get("channel"));
  const sentAt = String(form.get("sent_at") ?? "");
  // <input type="datetime-local"> has no zone; Volunteers work in Manila time.
  const sentAtIso = sentAt ? new Date(`${sentAt}:00+08:00`).toISOString() : new Date().toISOString();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("send_digest", {
    p_digest_id: uuid.parse(digestId),
    p_channel: channel,
    p_channel_detail: String(form.get("channel_detail") ?? "") || null,
    p_sent_at: sentAtIso,
  });
  if (error) return failure(error);

  const reportIds = ((data ?? []) as unknown[]).map((row) =>
    typeof row === "string" ? row : (Object.values(row as object)[0] as string),
  );
  after(() => notifyFollowers(reportIds, "forwarded"));
  revalidatePath("/v", "layout");
  return { ok: true };
}

export async function setDigestProof(digestId: string, path: string): Promise<VolunteerActionResult> {
  await requireVolunteer();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_digest_proof", { p_digest_id: uuid.parse(digestId), p_path: path });
  if (error) return failure(error);
  revalidatePath(`/v/digests/${digestId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Coordinator settings
// ---------------------------------------------------------------------------

function bilingual<K extends string>(form: FormData, key: K) {
  return {
    [`${key}_en`]: String(form.get(`${key}_en`) ?? "").trim() || null,
    [`${key}_fil`]: String(form.get(`${key}_fil`) ?? "").trim() || null,
  } as Record<`${K}_en` | `${K}_fil`, string | null>;
}

export async function saveCategory(form: FormData): Promise<VolunteerActionResult> {
  await requireCoordinator();
  const id = String(form.get("id") ?? "");
  const row = {
    slug: String(form.get("slug") ?? "").trim().toLowerCase(),
    ...bilingual(form, "name"),
    ...bilingual(form, "description"),
    ...bilingual(form, "urgent_notice"),
    icon: String(form.get("icon") ?? "circle-alert"),
    default_office_id: String(form.get("default_office_id") ?? "") || null,
    sort_order: Number(form.get("sort_order") ?? 0) || 0,
    active: form.get("active") === "on",
  };
  if (!row.name_en || !row.name_fil) return { ok: false, error: "Both names are required." };

  const supabase = await createClient();
  const { data, error } = id
    ? await supabase.from("categories").update(row).eq("id", id).select("id").single()
    : await supabase.from("categories").insert(row).select("id").single();
  if (error) return failure(error);
  revalidatePath("/", "layout");
  redirect(`/v/settings/categories/${data.id}?saved=1`);
}

export async function saveQuestion(form: FormData): Promise<VolunteerActionResult> {
  await requireCoordinator();
  const id = String(form.get("id") ?? "");
  const kind = z.enum(["text", "yes_no", "choice"]).parse(form.get("kind"));
  const choices =
    kind === "choice"
      ? String(form.get("choices") ?? "")
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => {
            const [value, label_en, label_fil] = line.split("|").map((part) => part.trim());
            return { value, label_en: label_en || value, label_fil: label_fil || label_en || value };
          })
      : [];
  if (kind === "choice" && choices.length < 2) return { ok: false, error: "A choice question needs at least 2 options." };

  const row = {
    category_id: uuid.parse(form.get("category_id")),
    prompt_en: String(form.get("prompt_en") ?? "").trim(),
    prompt_fil: String(form.get("prompt_fil") ?? "").trim(),
    kind,
    choices,
    required: form.get("required") === "on",
    sort_order: Number(form.get("sort_order") ?? 0) || 0,
    active: form.get("active") === "on",
  };
  if (!row.prompt_en || !row.prompt_fil) return { ok: false, error: "Both prompts are required." };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("category_questions").update(row).eq("id", id)
    : await supabase.from("category_questions").insert(row);
  if (error) return failure(error);
  revalidatePath(`/v/settings/categories/${row.category_id}`);
  return { ok: true };
}

export async function saveOffice(form: FormData): Promise<VolunteerActionResult> {
  await requireCoordinator();
  const id = String(form.get("id") ?? "");
  const text = (key: string) => String(form.get(key) ?? "").trim() || null;
  const row = {
    short_name: text("short_name"),
    ...bilingual(form, "name"),
    scope: z.enum(["citywide", "per_barangay"]).parse(form.get("scope")),
    channel: text("channel"),
    letter_addressee: text("letter_addressee"),
    letter_attention: text("letter_attention"),
    email: text("email"),
    phone: text("phone"),
    address: text("address"),
    active: form.get("active") === "on",
  };
  if (!row.short_name || !row.name_en || !row.name_fil || !row.channel) {
    return { ok: false, error: "Short name, both names and the channel are required." };
  }

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("responsible_offices").update(row).eq("id", id)
    : await supabase.from("responsible_offices").insert(row);
  if (error) return failure(error);
  revalidatePath("/v/settings/offices");
  redirect("/v/settings/offices?saved=1");
}

export async function inviteVolunteer(form: FormData): Promise<VolunteerActionResult> {
  const coordinator = await requireCoordinator();
  const email = z.email().safeParse(String(form.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { ok: false, error: "Enter a valid email address." };
  const displayName = String(form.get("display_name") ?? "").trim() || email.data.split("@")[0];
  const role = z.enum(["volunteer", "coordinator"]).parse(form.get("role") ?? "volunteer");

  // Inviting needs the Auth admin API, so this one step uses the service role.
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email.data, {
    redirectTo: `${env.siteUrl}/auth/confirm?next=/v`,
  });

  let userId = data?.user?.id;
  if (error) {
    // Already has an account (e.g. a Reporter): look it up and grant the role.
    const { data: existing } = await admin.rpc("find_user_id_by_email", { p_email: email.data });
    if (!existing) return failure(error);
    userId = existing as string;
  }

  const { error: insertError } = await admin
    .from("volunteers")
    .upsert({ user_id: userId, display_name: displayName, role, active: true, invited_by: coordinator.user_id });
  if (insertError) return failure(insertError);

  revalidatePath("/v/settings/volunteers");
  return { ok: true };
}

export async function updateVolunteer(form: FormData): Promise<VolunteerActionResult> {
  const coordinator = await requireCoordinator();
  const userId = uuid.parse(form.get("user_id"));
  if (userId === coordinator.user_id) return { ok: false, error: "You can't change your own role or access." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("volunteers")
    .update({
      role: z.enum(["volunteer", "coordinator"]).parse(form.get("role")),
      active: form.get("active") === "on",
    })
    .eq("user_id", userId);
  if (error) return failure(error);
  revalidatePath("/v/settings/volunteers");
  return { ok: true };
}
