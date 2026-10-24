import { z } from "zod";

/** Text limits for a new Report. The form's inputs use them as maxLength; the schema enforces them. */
export const REPORT_LIMITS = {
  title: 120,
  landmark: 200,
  description: 2000,
  answer: 500,
  answers: 20,
  email: 254,
} as const;

/** An email address as people type it: surrounding spaces don't count. */
export const emailAddress = z.string().trim().pipe(z.email().max(REPORT_LIMITS.email));

/** A new Report's fields. The form checks them before sending and the API checks them again. */
export const reportFields = z.object({
  category_id: z.uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  title: z.string().trim().max(REPORT_LIMITS.title).optional().default(""),
  landmark: z.string().trim().max(REPORT_LIMITS.landmark).optional().default(""),
  description: z.string().trim().max(REPORT_LIMITS.description).optional().default(""),
  email: z
    .union([z.literal(""), z.email().max(REPORT_LIMITS.email)])
    .optional()
    .default(""),
  locale: z.string().optional(),
  answers: z
    .array(z.object({ question_id: z.uuid(), value: z.string().trim().max(REPORT_LIMITS.answer) }))
    .max(REPORT_LIMITS.answers)
    .optional()
    .default([]),
});

export type ReportFieldsInput = z.input<typeof reportFields>;
export type ReportFields = z.output<typeof reportFields>;
export type ReportField = keyof ReportFields;

/** The multipart body the form posts to /api/reports. */
export function toReportFormData(fields: ReportFields, photos: Blob[], captcha: string | null): FormData {
  const form = new FormData();
  form.set("category_id", fields.category_id);
  form.set("lat", String(fields.lat));
  form.set("lng", String(fields.lng));
  form.set("title", fields.title);
  form.set("landmark", fields.landmark);
  form.set("description", fields.description);
  form.set("email", fields.email);
  if (fields.locale) form.set("locale", fields.locale);
  form.set("answers", JSON.stringify(fields.answers));
  photos.forEach((photo, i) => form.append("photos", photo, `photo-${i + 1}.jpg`));
  if (captcha) form.set("cf-turnstile-response", captcha);
  return form;
}

/** Reads the fields back out of that body, ready for `reportFields.safeParse`. */
export function fromReportFormData(form: FormData): unknown {
  const text = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value : undefined;
  };
  const number = (name: string) => {
    const value = text(name);
    return value ? Number(value) : undefined;
  };
  let answers: unknown;
  try {
    answers = JSON.parse(text("answers") ?? "[]");
  } catch {
    answers = null;
  }
  return {
    category_id: text("category_id"),
    lat: number("lat"),
    lng: number("lng"),
    title: text("title"),
    landmark: text("landmark"),
    description: text("description"),
    email: text("email"),
    locale: text("locale"),
    answers,
  };
}
