import { z } from "zod";
import { PERMISSIONS } from "@/lib/permissions";
import type { DigestChannel } from "@/lib/types";

/**
 * Schemas for the Volunteer console's forms. `ActionForm` checks a form against its schema
 * before calling the server action, and the action parses the same FormData again, so the
 * browser and the server agree on what is valid. Messages are shown to Volunteers as is.
 */

const STALE = "This page is out of date. Reload it and try again.";

export const DIGEST_CHANNELS: DigestChannel[] = ["letter", "text_line", "email", "in_person", "other"];

/** A missing field reads as "", like an empty input. */
const raw = (value: unknown) => (typeof value === "string" ? value : "");

function text(max: number, required?: string) {
  let schema = z.string().trim();
  if (required) schema = schema.min(1, required);
  return z.preprocess(raw, schema.max(max, `Keep this to ${max} characters or fewer.`));
}

/** Optional text: blank becomes null. */
const optionalText = (max: number) => text(max).transform((value) => value || null);

/** An id the page put in a hidden input or a select. */
const id = z.preprocess(raw, z.uuid(STALE));

/** A select the Volunteer must choose from. */
const choose = (message: string) => z.preprocess(raw, z.uuid(message));

/** A select or hidden id that may be blank: blank becomes null. */
const optionalId = z.preprocess(raw, z.union([z.literal(""), z.uuid(STALE)])).transform((value) => value || null);

const checkbox = z.preprocess((value) => value === "on", z.boolean());

const sortOrder = z.preprocess(
  (value) => (raw(value).trim() === "" ? 0 : Number(value)),
  z.number({ error: "Sort order must be a number." }).int("Sort order must be a whole number."),
);

const choiceLines = z.preprocess(raw, z.string()).transform((value) =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [value, label_en, label_fil] = line.split("|").map((part) => part.trim());
      return { value, label_en: label_en || value, label_fil: label_fil || label_en || value };
    }),
);

export const volunteerForms = {
  approve: z.object({
    category_id: id,
    office_id: choose("Choose a Responsible Office."),
    note: optionalText(500),
  }),

  /** Reject in Review (from = "review", a preset reason is required) or Take down (a written reason is). */
  reject: z
    .object({ from: z.preprocess(raw, z.string()), preset: text(200), reason: text(500) })
    .superRefine((value, ctx) => {
      if (value.from === "review" && !value.preset) {
        ctx.addIssue({ code: "custom", path: ["preset"], message: "Pick a reason." });
      }
      if (value.from !== "review" && !value.reason) {
        ctx.addIssue({ code: "custom", path: ["reason"], message: "Give a reason." });
      }
    })
    .transform(({ from, preset, reason }) => ({
      fromReview: from === "review",
      reason: [preset, reason].filter(Boolean).join(": "),
    })),

  resolve: z.object({ note: optionalText(500) }),

  misroute: z.object({
    office_id: choose("Choose the correct office."),
    note: optionalText(500),
  }),

  reopen: z.object({ note: text(500, "Say why it is not fixed.") }),

  createDigest: z.object({
    office_id: id,
    barangay_id: z.preprocess((value) => (raw(value) ? Number(value) : null), z.number().int(STALE).nullable()),
  }),

  sendDigest: z
    .object({
      channel: z.preprocess(raw, z.enum(DIGEST_CHANNELS, "Choose how it was sent.")),
      channel_detail: optionalText(300),
      // <input type="datetime-local"> has no zone; Volunteers work in Manila time.
      sent_at: z.preprocess(
        raw,
        z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Enter a date and time.")]),
      ),
    })
    .transform(({ sent_at, ...rest }) => ({
      ...rest,
      sentAt: sent_at ? new Date(`${sent_at}:00+08:00`) : new Date(),
    }))
    .refine((value) => value.sentAt.getTime() <= Date.now() + 60_000, {
      path: ["sent_at"],
      message: "The send time can't be in the future.",
    }),

  category: z.object({
    id: optionalId,
    slug: z.preprocess(
      (value) => raw(value).trim().toLowerCase(),
      z
        .string()
        .min(1, "Give it a slug.")
        .max(60, "Keep this to 60 characters or fewer.")
        .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single dashes."),
    ),
    name_en: text(120, "Give it an English name."),
    name_fil: text(120, "Give it a Filipino name."),
    description_en: optionalText(2000),
    description_fil: optionalText(2000),
    urgent_notice_en: optionalText(2000),
    urgent_notice_fil: optionalText(2000),
    icon: z.preprocess((value) => raw(value) || "circle-alert", z.string()),
    default_office_id: optionalId,
    sort_order: sortOrder,
  }),

  question: z
    .object({
      id: optionalId,
      category_id: id,
      prompt_en: text(300, "Write the question in English."),
      prompt_fil: text(300, "Write the question in Filipino."),
      kind: z.preprocess(raw, z.enum(["text", "yes_no", "choice"], "Choose an answer type.")),
      choices: choiceLines,
      required: checkbox,
      active: checkbox,
      sort_order: sortOrder,
    })
    .transform((value) => ({ ...value, choices: value.kind === "choice" ? value.choices : [] }))
    .superRefine((value, ctx) => {
      if (value.kind !== "choice") return;
      if (value.choices.length < 2) {
        ctx.addIssue({ code: "custom", path: ["choices"], message: "A choice question needs at least 2 options." });
      } else if (value.choices.some((choice) => !choice.value)) {
        ctx.addIssue({ code: "custom", path: ["choices"], message: "Every line needs a value before the first |." });
      }
    }),

  office: z.object({
    id: optionalId,
    short_name: text(30, "Give it a short name."),
    name_en: text(200, "Give it an English name."),
    name_fil: text(200, "Give it a Filipino name."),
    scope: z.preprocess(raw, z.enum(["citywide", "per_barangay"], "Choose a scope.")),
    channel: text(2000, "Say how a Digest reaches this office."),
    letter_addressee: optionalText(500),
    letter_attention: optionalText(200),
    email: z
      .preprocess((value) => raw(value).trim(), z.union([z.literal(""), z.email("Enter a valid email address.").max(254)]))
      .transform((value) => value || null),
    phone: optionalText(100),
    address: optionalText(500),
  }),

  invite: z.object({
    email: z.preprocess((value) => raw(value).trim().toLowerCase(), z.email("Enter a valid email address.").max(254)),
    display_name: optionalText(100),
    role_id: choose("Choose a role."),
  }),

  /** "none" removes console access. */
  userAccess: z.object({
    user_id: id,
    role_id: z.preprocess(raw, z.union([z.literal("none"), z.uuid("Choose a role.")])).transform((value) =>
      value === "none" ? null : value,
    ),
  }),

  role: z.object({
    id: optionalId,
    name: text(60, "Give the role a name."),
    description: optionalText(300),
    permissions: z.preprocess((value) => (value === undefined ? [] : [value].flat()), z.array(z.enum(PERMISSIONS))),
  }),
};

export type VolunteerForm = keyof typeof volunteerForms;
export type VolunteerFormData<F extends VolunteerForm> = z.output<(typeof volunteerForms)[F]>;
/** The first problem with each field, by input name. */
export type FieldErrors = Record<string, string>;

/** Form fields by name; a name sent more than once (checkboxes) becomes a list. */
export function formValues(form: FormData): Record<string, string | string[]> {
  const values: Record<string, string | string[]> = {};
  for (const key of new Set(form.keys())) {
    const all = form.getAll(key).filter((value): value is string => typeof value === "string");
    values[key] = all.length > 1 ? all : (all[0] ?? "");
  }
  return values;
}

export function checkVolunteerForm<F extends VolunteerForm>(
  name: F,
  form: FormData,
): { ok: true; data: VolunteerFormData<F> } | { ok: false; error: string; fields: FieldErrors } {
  const result = (volunteerForms[name] as unknown as z.ZodType<VolunteerFormData<F>>).safeParse(formValues(form));
  if (result.success) return { ok: true, data: result.data };
  const fields: FieldErrors = {};
  for (const issue of result.error.issues) fields[String(issue.path[0] ?? "")] ??= issue.message;
  return { ok: false, error: result.error.issues[0].message, fields };
}
