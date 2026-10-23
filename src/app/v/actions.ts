"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { createElement } from "react";
import { render } from "react-email";
import { z } from "zod";
import VolunteerInvite from "@/emails/volunteer-invite";
import { requirePermission } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { notifyFollowers } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { PERMISSIONS } from "@/lib/permissions";
import { PUBLIC_BUCKET } from "@/lib/storage";
import type { DigestChannel } from "@/lib/types";

export type VolunteerActionResult = { ok: true } | { ok: false; error: string };

// Readable text for the errors the roles and user-management functions raise.
const ERRORS: Record<string, string> = {
  cannot_change_own_access: "You can't change your own role or access. Ask another Coordinator.",
  role_exceeds_yours: "You can only give, change or remove a role whose permissions you have yourself.",
  last_administrator: "Someone active must keep a role with “Edit roles”, or nobody could manage roles again.",
  role_in_use: "Give everyone with this role, and every pending invitation, another role first.",
  role_name_taken: "Another role already has that name.",
  name_required: "Give the role a name.",
  invalid_email: "Enter a valid email address.",
  unknown_role: "Choose a role.",
  no_status_change: "This Report already has that status. Someone else may have just changed it; reload the page.",
  reopen_window_closed: "A Report can only be reopened within 30 days of being Resolved.",
  sent_before_draft: "The send time can't be earlier than the day this Digest was drafted.",
};

function failure(error: { message: string } | null): VolunteerActionResult {
  return { ok: false, error: (error && ERRORS[error.message]) ?? error?.message ?? "Something went wrong" };
}

const uuid = z.uuid();

async function removePublicFiles(supabase: Awaited<ReturnType<typeof createClient>>, paths: string[]) {
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(PUBLIC_BUCKET).remove(paths);
  if (error) console.error("[photos] could not delete public copies", paths, error.message);
}

// ---------------------------------------------------------------------------
// Review
// ---------------------------------------------------------------------------

export async function setPhotoReview(photoId: string, publicPath: string | null, hidden: boolean) {
  await requirePermission("reports.review");
  const supabase = await createClient();
  const { data: previous, error } = await supabase.rpc("set_photo_review", {
    p_photo_id: uuid.parse(photoId),
    p_public_path: publicPath,
    p_hidden: hidden,
  });
  if (error) return failure(error);
  // The public bucket keeps serving a file until it is deleted, so hiding or replacing a copy removes the old one.
  if (typeof previous === "string" && previous !== publicPath) await removePublicFiles(supabase, [previous]);
  revalidatePath("/v/review/[id]", "page");
  return { ok: true } as const;
}

export async function approveReport(reportId: string, form: FormData): Promise<VolunteerActionResult> {
  await requirePermission("reports.review");
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_approve", {
    p_report_id: uuid.parse(reportId),
    p_category_id: uuid.parse(form.get("category_id")),
    p_office_id: uuid.parse(form.get("office_id")),
    p_note: String(form.get("note") ?? "") || null,
  });
  if (error?.message === "photos_not_cleared") {
    return { ok: false, error: "Clear, blur or hide every photo before approving." };
  }
  if (error) return failure(error);

  after(() => notifyFollowers([reportId], "published"));
  revalidatePath("/v", "layout");
  redirect("/v/review?approved=1");
}

/** Rejects a Report in Review, or takes down a published one (Archive). */
export async function rejectReport(reportId: string, form: FormData): Promise<VolunteerActionResult> {
  await requirePermission(form.get("from") === "review" ? "reports.review" : "reports.archive");
  const preset = String(form.get("preset") ?? "");
  const detail = String(form.get("reason") ?? "").trim();
  const reason = [preset, detail].filter(Boolean).join(": ");

  const supabase = await createClient();
  // Read the public copies first: review_reject clears their paths.
  const { data: photos } = await supabase
    .from("report_photos")
    .select("public_path")
    .eq("report_id", uuid.parse(reportId))
    .not("public_path", "is", null);
  const { error } = await supabase.rpc("review_reject", { p_report_id: reportId, p_reason: reason });
  if (error) return failure(error);
  await removePublicFiles(supabase, (photos ?? []).map((p) => p.public_path as string));

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
  await requirePermission("reports.edit");
  const supabase = await createClient();
  // One call, so the "after" photo is only attached if the Report actually resolves.
  const { error } = await supabase.rpc("resolve_report", {
    p_report_id: uuid.parse(reportId),
    p_note: input.note || null,
    p_after_original_path: input.afterPhoto?.originalPath ?? null,
    p_after_public_path: input.afterPhoto?.publicPath ?? null,
  });
  if (error) return failure(error);

  after(() => notifyFollowers([reportId], "resolved"));
  revalidatePath("/v", "layout");
  revalidatePath(`/v/reports/${reportId}`);
  return { ok: true };
}

export async function misrouteReport(reportId: string, form: FormData): Promise<VolunteerActionResult> {
  await requirePermission("reports.edit");
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
  await requirePermission("reports.edit");
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
  await requirePermission("digests.add");
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
  await requirePermission("digests.edit");
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_from_digest", { p_digest_id: digestId, p_report_id: reportId });
  if (error) return failure(error);
  revalidatePath(`/v/digests/${digestId}`);
  return { ok: true };
}

export async function discardDigest(digestId: string): Promise<VolunteerActionResult> {
  await requirePermission("digests.delete");
  const supabase = await createClient();
  const { error } = await supabase.rpc("discard_digest", { p_digest_id: uuid.parse(digestId) });
  if (error) return failure(error);
  redirect("/v/digests");
}

const CHANNELS: DigestChannel[] = ["letter", "text_line", "email", "in_person", "other"];

export async function sendDigest(digestId: string, form: FormData): Promise<VolunteerActionResult> {
  await requirePermission("digests.send");
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
  await requirePermission("digests.send");
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

/** Creates (Add) or changes (Edit) a Category. Archiving is `setCategoryActive`. */
export async function saveCategory(form: FormData): Promise<VolunteerActionResult> {
  const id = String(form.get("id") ?? "");
  await requirePermission(id ? "categories.edit" : "categories.add");
  const row = {
    slug: String(form.get("slug") ?? "").trim().toLowerCase(),
    ...bilingual(form, "name"),
    ...bilingual(form, "description"),
    ...bilingual(form, "urgent_notice"),
    icon: String(form.get("icon") ?? "circle-alert"),
    default_office_id: String(form.get("default_office_id") ?? "") || null,
    sort_order: Number(form.get("sort_order") ?? 0) || 0,
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

/** Archives (deactivates) or restores a Category. */
export async function setCategoryActive(id: string, active: boolean): Promise<VolunteerActionResult> {
  await requirePermission("categories.archive");
  const supabase = await createClient();
  const { error } = await supabase.from("categories").update({ active }).eq("id", uuid.parse(id));
  if (error) return failure(error);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveQuestion(form: FormData): Promise<VolunteerActionResult> {
  await requirePermission("categories.edit");
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

/** Creates (Add) or changes (Edit) a Responsible Office. Archiving is `setOfficeActive`. */
export async function saveOffice(form: FormData): Promise<VolunteerActionResult> {
  const id = String(form.get("id") ?? "");
  await requirePermission(id ? "offices.edit" : "offices.add");
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
  };
  if (!row.short_name || !row.name_en || !row.name_fil || !row.channel) {
    return { ok: false, error: "Short name, both names and the channel are required." };
  }

  const supabase = await createClient();
  const { data, error } = id
    ? await supabase.from("responsible_offices").update(row).eq("id", id).select("id").single()
    : await supabase.from("responsible_offices").insert(row).select("id").single();
  if (error) return failure(error);
  revalidatePath("/v/settings/offices", "layout");
  redirect(`/v/settings/offices/${data.id}?saved=1`);
}

/** Archives (deactivates) or restores a Responsible Office. */
export async function setOfficeActive(id: string, active: boolean): Promise<VolunteerActionResult> {
  await requirePermission("offices.archive");
  const supabase = await createClient();
  const { error } = await supabase.from("responsible_offices").update({ active }).eq("id", uuid.parse(id));
  if (error) return failure(error);
  revalidatePath("/v/settings/offices", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Users and roles
// ---------------------------------------------------------------------------

export async function inviteVolunteer(form: FormData): Promise<VolunteerActionResult> {
  await requirePermission("users.add");
  const email = z.email().safeParse(String(form.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { ok: false, error: ERRORS.invalid_email };

  const roleId = uuid.parse(form.get("role_id"));
  const supabase = await createClient();
  const { data: applied, error } = await supabase.rpc("invite_volunteer", {
    p_email: email.data,
    p_role_id: roleId,
    p_display_name: String(form.get("display_name") ?? "").trim() || null,
  });
  if (error) return failure(error);
  revalidatePath("/v/settings/users");
  if (applied) return { ok: true };

  // No confirmed account yet: the Volunteer Invitation waits until they confirm the
  // address, which this email's link does.
  const sent = await sendInvitationEmail(email.data, roleId);
  if (!sent) {
    return {
      ok: false,
      error: "The invitation is saved, but its email could not be sent. They can still sign in at /login with this address.",
    };
  }
  return { ok: true };
}

/**
 * Emails a one-time link to /auth/confirm. The link is built here from the token hash
 * because Supabase's own invitation email returns the session in the URL fragment,
 * which the server-side confirm route can't read.
 */
async function sendInvitationEmail(email: string, roleId: string): Promise<boolean> {
  const admin = createAdminClient();
  let { data, error } = await admin.auth.admin.generateLink({ type: "invite", email });
  if (error?.code === "email_exists") {
    // An account that never confirmed its address: signing in confirms it.
    ({ data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email }));
  }
  if (error || !data.properties) {
    console.error("[invite] generateLink failed", error?.message);
    return false;
  }

  const link = new URL("/auth/confirm", env.siteUrl);
  link.searchParams.set("token_hash", data.properties.hashed_token);
  link.searchParams.set("type", data.properties.verification_type);
  link.searchParams.set("next", "/v");
  const loginUrl = new URL("/login", env.siteUrl).toString();

  const { data: role } = await admin.from("roles").select("name").eq("id", roleId).single();
  const roleName = role?.name ?? "Volunteer";
  return sendEmail({
    to: email,
    subject: "You’re invited to volunteer on Sumbong · BetterCabanatuan",
    text: `You’re invited to volunteer as ${roleName}. Sign in with this link to confirm your email address; your access starts as soon as you do.\n\n${link}\n\nThe link works once and expires after an hour. After that, sign in at ${loginUrl} with this address and the invitation still applies.`,
    html: await render(createElement(VolunteerInvite, { roleName, link: link.toString(), loginUrl })),
  });
}

export async function cancelInvitation(email: string): Promise<VolunteerActionResult> {
  await requirePermission("users.add");
  const supabase = await createClient();
  const { error } = await supabase.from("volunteer_invitations").delete().eq("email", email);
  if (error) return failure(error);
  revalidatePath("/v/settings/users");
  return { ok: true };
}

/**
 * Gives an account a role (Add), changes it (Edit), or removes console access when "none" is chosen (Archive).
 * The database decides which of the three applies.
 */
export async function setUserAccess(form: FormData): Promise<VolunteerActionResult> {
  await requirePermission("users.add", "users.edit", "users.archive");
  const roleId = String(form.get("role_id") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_user_access", {
    p_user_id: uuid.parse(form.get("user_id")),
    p_role_id: roleId === "none" ? null : uuid.parse(roleId),
  });
  if (error) return failure(error);
  revalidatePath("/v/settings/users");
  return { ok: true };
}

/** Creates (Add) or changes (Edit) a role and its permissions. */
export async function saveRole(form: FormData): Promise<VolunteerActionResult> {
  const id = String(form.get("id") ?? "");
  await requirePermission(id ? "roles.edit" : "roles.add");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_role", {
    p_role_id: id ? uuid.parse(id) : null,
    p_name: String(form.get("name") ?? "").trim(),
    p_description: String(form.get("description") ?? "").trim() || null,
    p_permissions: z.array(z.enum(PERMISSIONS)).parse(form.getAll("permissions")),
  });
  if (error) return failure(error);
  revalidatePath("/v", "layout");
  redirect(`/v/settings/roles/${data}?saved=1`);
}

export async function deleteRole(roleId: string): Promise<VolunteerActionResult> {
  await requirePermission("roles.delete");
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_role", { p_role_id: uuid.parse(roleId) });
  if (error) return failure(error);
  revalidatePath("/v/settings/roles", "layout");
  redirect("/v/settings/roles?deleted=1");
}
