import { after, NextResponse } from "next/server";
import { isLocale } from "@/i18n/config";
import { getCurrentUser } from "@/lib/auth";
import { generateToken, saltedHash, sha256 } from "@/lib/hashing";
import { stripJpegMetadata } from "@/lib/jpeg";
import { notifyFollowers } from "@/lib/notify";
import { fromReportFormData, reportFields } from "@/lib/report-schema";
import { getClientIp, getOrCreateDeviceId } from "@/lib/request";
import { MAX_PHOTO_BYTES, MAX_PHOTOS, ORIGINALS_BUCKET } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTurnstile } from "@/lib/turnstile";

/** Error codes the report form knows how to explain (messages: reportForm.errors.*). */
export type SubmitErrorCode =
  | "invalid_input"
  | "captcha_failed"
  | "invalid_photo"
  | "photos_required"
  | "outside_city"
  | "rate_limited"
  | "missing_answer"
  | "invalid_answer"
  | "unknown_category"
  | "server_error";

const KNOWN_DB_ERRORS = new Set<SubmitErrorCode>([
  "photos_required",
  "outside_city",
  "rate_limited",
  "missing_answer",
  "invalid_answer",
  "unknown_category",
]);

function fail(code: SubmitErrorCode, status = 400) {
  return NextResponse.json({ error: code }, { status });
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("invalid_input");
  }

  const ip = await getClientIp();
  if (!(await verifyTurnstile(form.get("cf-turnstile-response") as string | null, ip))) {
    return fail("captcha_failed", 403);
  }

  const parsed = reportFields.safeParse(fromReportFormData(form));
  if (!parsed.success) return fail("invalid_input");
  const input = parsed.data;

  const files = form.getAll("photos").filter((v): v is File => v instanceof File && v.size > 0);
  if (files.length < 1 || files.length > MAX_PHOTOS) return fail("photos_required");

  const photos: Uint8Array[] = [];
  for (const file of files) {
    if (file.size > MAX_PHOTO_BYTES) return fail("invalid_photo");
    const stripped = stripJpegMetadata(new Uint8Array(await file.arrayBuffer()));
    if (!stripped) return fail("invalid_photo");
    photos.push(stripped);
  }

  const admin = createAdminClient();
  const reportId = crypto.randomUUID();
  const paths = photos.map((_, i) => `${reportId}/${i + 1}.jpg`);

  for (let i = 0; i < photos.length; i++) {
    const { error } = await admin.storage
      .from(ORIGINALS_BUCKET)
      .upload(paths[i], photos[i], { contentType: "image/jpeg", upsert: false });
    if (error) {
      console.error("[reports] photo upload failed", error);
      await admin.storage.from(ORIGINALS_BUCKET).remove(paths.slice(0, i));
      return fail("server_error", 500);
    }
  }

  const user = await getCurrentUser();
  const deviceId = await getOrCreateDeviceId();
  const token = generateToken();
  const email = input.email || user?.email || null;

  const { data, error } = await admin
    .rpc("submit_report", {
      p_id: reportId,
      p_category_id: input.category_id,
      p_lng: input.lng,
      p_lat: input.lat,
      p_landmark: input.landmark,
      p_description: input.description,
      p_answers: input.answers,
      p_photo_paths: paths,
      p_tracking_token_hash: await sha256(token),
      p_ip_hash: ip ? await saltedHash("ip", ip) : null,
      p_device_hash: await saltedHash("device", deviceId),
      p_email: email,
      p_user_id: user?.id ?? null,
      p_locale: isLocale(input.locale) ? input.locale : "fil",
      p_title: input.title,
    })
    .single<{ public_code: string }>();

  if (error || !data?.public_code) {
    await admin.storage.from(ORIGINALS_BUCKET).remove(paths);
    const code = error?.message as SubmitErrorCode | undefined;
    if (code && KNOWN_DB_ERRORS.has(code)) return fail(code, code === "rate_limited" ? 429 : 400);
    console.error("[reports] submit_report failed", error);
    return fail("server_error", 500);
  }

  if (email) after(() => notifyFollowers([reportId], "submitted", { trackingToken: token }));

  return NextResponse.json({ id: reportId, code: data.public_code, token }, { status: 201 });
}
