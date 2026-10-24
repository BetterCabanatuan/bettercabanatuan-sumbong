"use client";

import { ArrowLeft, Check, Copy, History, LocateFixed, Share2, TriangleAlert, Users } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { SubmitErrorCode } from "@/app/api/reports/route";
import { CategoryIcon } from "@/components/category-icon";
import { type LatLng, LocationPicker } from "@/components/map";
import { Turnstile } from "@/components/turnstile";
import { FollowForm } from "@/app/(public)/r/[code]/reporter-actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { localized } from "@/i18n/config";
import type { CategoryWithQuestions } from "@/lib/data";
import { saveDeviceReport } from "@/lib/device-reports";
import { clearDraft, loadDraft, saveDraftFields, saveDraftPhotos } from "@/lib/draft";
import { REPORT_LIMITS, type ReportField, reportFields, toReportFormData } from "@/lib/report-schema";
import type { CategoryQuestion, Locale } from "@/lib/types";
import { NearbyList, useNearbyReports } from "./nearby-check";
import { PhotoPicker } from "./photo-picker";

// "nearby" is shown only when open Reports of the same Category are close to the pin.
type Step = "location" | "category" | "nearby" | "details" | "review";
const STEPS: Step[] = ["location", "category", "nearby", "details", "review"];
// The step where each field is filled in, so a field that fails the schema can be shown there.
const FIELD_STEP: Record<ReportField, Step> = {
  lat: "location",
  lng: "location",
  landmark: "location",
  category_id: "category",
  answers: "category",
  title: "details",
  description: "details",
  email: "review",
  locale: "review",
};
// Fields with their own message under the input; any other failure falls back to errors.invalid_input.
type InlineField = "landmark" | "title" | "description" | "email";
const INLINE_FIELDS: ReportField[] = ["landmark", "title", "description", "email"];
const STEP_ENTER =
  "transition-[opacity,translate] duration-200 ease-out starting:translate-y-2 starting:opacity-0 motion-reduce:starting:translate-y-0";

type Done =
  | { kind: "submitted"; id: string; code: string; token: string; following: boolean }
  | { kind: "meToo"; code: string };

/** Where a restored draft picks up: the furthest step whose earlier steps are still complete. */
function resumeStep(saved: string, ready: { location: boolean; category: boolean; photos: boolean }): Step {
  if (!ready.location || saved === "location") return "location";
  if (!ready.category || saved === "category" || saved === "nearby") return "category";
  if (!ready.photos || saved === "details") return "details";
  return "review";
}

export function ReportForm({
  categories,
  turnstileSiteKey,
  signedInEmail,
}: {
  categories: CategoryWithQuestions[];
  turnstileSiteKey: string;
  signedInEmail: string | null;
}) {
  const t = useTranslations("reportForm");
  const locale = useLocale() as Locale;

  const [step, setStep] = useState<Step>("location");
  const [location, setLocation] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [landmark, setLandmark] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<Blob[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState(signedInEmail ?? "");
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<SubmitErrorCode | null>(null);
  const [invalid, setInvalid] = useState<Partial<Record<InlineField, boolean>>>({});
  const [done, setDone] = useState<Done | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [restored, setRestored] = useState(false);

  // Start each step at its top; on phones the Next button sits far down the previous step.
  const top = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    top.current?.scrollIntoView({ block: "start" });
  }, [step]);

  const category = categories.find((c) => c.id === categoryId);
  const missingAnswer = category?.questions.some((q) => q.required && !answers[q.id]?.trim());
  const nearby = useNearbyReports(location?.lat, location?.lng, category?.id);
  const matches = nearby.data ?? [];

  // Pick up an unfinished Report left on this device.
  useEffect(() => {
    let cancelled = false;
    loadDraft().then((draft) => {
      if (cancelled) return;
      if (draft && (draft.location || draft.photos.length > 0)) {
        const saved = categories.find((c) => c.id === draft.categoryId);
        const savedAnswers = saved ? draft.answers : {};
        setLocation(draft.location);
        setLandmark(draft.landmark);
        setCategoryId(saved?.id ?? null);
        setAnswers(savedAnswers);
        setTitle(draft.title);
        setDescription(draft.description);
        setPhotos(draft.photos);
        setStep(
          resumeStep(draft.step, {
            location: draft.location !== null,
            category: !!saved && !saved.questions.some((q) => q.required && !savedAnswers[q.id]?.trim()),
            photos: draft.photos.length > 0,
          }),
        );
        setRestored(true);
      }
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [categories]);

  // Keep the draft up to date once there is something worth keeping.
  useEffect(() => {
    if (!hydrated || done || (!location && photos.length === 0)) return;
    saveDraftFields({ step, location, landmark, categoryId, answers, title, description });
  }, [hydrated, done, step, location, landmark, categoryId, answers, title, description, photos.length]);
  useEffect(() => {
    if (hydrated && !done) void saveDraftPhotos(photos);
  }, [hydrated, done, photos]);

  function startOver() {
    void clearDraft();
    setLocation(null);
    setLandmark("");
    setCategoryId(null);
    setAnswers({});
    setPhotos([]);
    setTitle("");
    setDescription("");
    setSubmitError(null);
    setInvalid({});
    setRestored(false);
    setStep("location");
  }

  function finishWithMeToo(code: string) {
    void clearDraft();
    setDone({ kind: "meToo", code });
  }

  function locate() {
    if (!navigator.geolocation) {
      setLocationError(t("location.unsupported"));
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocationError(t("location.denied"));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  function fieldError(field: InlineField) {
    if (!invalid[field]) return null;
    return field === "email" ? t("fieldErrors.email") : t("fieldErrors.tooLong", { max: REPORT_LIMITS[field] });
  }

  function edited(field: InlineField) {
    if (invalid[field]) setInvalid((current) => ({ ...current, [field]: false }));
  }

  async function submit() {
    if (!location || !category) return;
    setSubmitError(null);

    const parsed = reportFields.safeParse({
      category_id: category.id,
      lat: location.lat,
      lng: location.lng,
      title,
      landmark,
      description,
      email: email.trim(),
      locale,
      answers: Object.entries(answers)
        .filter(([, value]) => value.trim())
        .map(([question_id, value]) => ({ question_id, value })),
    });
    if (!parsed.success) {
      const failed = new Set(parsed.error.issues.map((issue) => issue.path[0] as ReportField));
      setInvalid(Object.fromEntries(INLINE_FIELDS.filter((f) => failed.has(f)).map((f) => [f, true])));
      if ([...failed].some((f) => !INLINE_FIELDS.includes(f))) setSubmitError("invalid_input");
      const first = STEPS.find((candidate) => [...failed].some((f) => FIELD_STEP[f] === candidate));
      if (first) setStep(first);
      return;
    }

    setSubmitting(true);
    const form = toReportFormData(parsed.data, photos, captcha);

    try {
      const response = await fetch("/api/reports", { method: "POST", body: form });
      const body = (await response.json()) as { id?: string; code?: string; token?: string; error?: SubmitErrorCode };
      if (response.ok && body.id && body.code && body.token) {
        saveDeviceReport(body.code, body.token);
        void clearDraft();
        setDone({
          kind: "submitted",
          id: body.id,
          code: body.code,
          token: body.token,
          following: Boolean(parsed.data.email || signedInEmail),
        });
        window.scrollTo({ top: 0 });
        return;
      }
      setSubmitError(body.error ?? "server_error");
      if (body.error === "outside_city") setStep("location");
    } catch {
      setSubmitError("server_error");
    } finally {
      setSubmitting(false);
      setCaptcha(null);
      setCaptchaReset((n) => n + 1);
    }
  }

  if (done) return <DoneView done={done} />;

  const steps = STEPS.filter((s) => s !== "nearby" || matches.length > 0 || step === "nearby");
  const stepIndex = steps.indexOf(step);
  const back = stepIndex > 0 ? () => setStep(steps[stepIndex - 1]) : undefined;

  return (
    <div ref={top} className="flex scroll-mt-24 flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">
          {t("progress", { step: stepIndex + 1, total: steps.length })}
        </p>
        <Progress value={((stepIndex + 1) / steps.length) * 100} aria-label={t("progress", { step: stepIndex + 1, total: steps.length })} />
      </div>

      {restored && (
        <Alert className="bg-card">
          <History />
          <AlertDescription className="flex flex-col items-start gap-2">
            <p>{t("draft.restored")}</p>
            <Button type="button" variant="outline" size="sm" onClick={startOver}>
              {t("draft.startOver")}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {submitError && (
        <Alert variant="destructive" className="bg-card">
          <TriangleAlert />
          <AlertDescription>{t(`errors.${submitError}`)}</AlertDescription>
        </Alert>
      )}

      {step === "location" && (
        <FieldSet className={STEP_ENTER}>
          <StepHeading title={t("location.title")} lead={t("location.lead")} />
          <FieldGroup>
            <Button type="button" variant="outline" size="lg" className="h-11" disabled={locating} onClick={locate}>
              {locating ? <Spinner data-icon="inline-start" /> : <LocateFixed data-icon="inline-start" />}
              {t("location.useMine")}
            </Button>
            {locationError && <p className="text-sm text-destructive">{locationError}</p>}
            <div className="h-80 overflow-hidden rounded-xl border bg-card">
              <LocationPicker value={location} onChange={setLocation} className="size-full" />
            </div>
            <p className="text-sm text-muted-foreground">{location ? t("location.adjust") : t("location.tap")}</p>
            <Field data-invalid={invalid.landmark}>
              <FieldLabel htmlFor="landmark">{t("location.landmark")}</FieldLabel>
              <Input
                id="landmark"
                value={landmark}
                maxLength={REPORT_LIMITS.landmark}
                aria-invalid={invalid.landmark}
                onChange={(e) => {
                  setLandmark(e.target.value);
                  edited("landmark");
                }}
                placeholder={t("location.landmarkPlaceholder")}
                className="h-11 text-base md:text-sm"
              />
              <FieldDescription>{t("location.landmarkHint")}</FieldDescription>
              <FieldError>{fieldError("landmark")}</FieldError>
            </Field>
          </FieldGroup>
          <StepNav onNext={() => setStep("category")} nextDisabled={!location} />
        </FieldSet>
      )}

      {step === "category" && location && (
        <FieldSet className={STEP_ENTER}>
          <StepHeading title={t("category.title")} />
          <RadioGroup
            value={categoryId ?? ""}
            onValueChange={(value) => {
              setCategoryId(value as string);
              setAnswers({});
            }}
            aria-label={t("category.title")}
            className="grid-cols-1 sm:grid-cols-2"
          >
            {categories.map((c) => (
              <FieldLabel key={c.id} htmlFor={`category-${c.id}`} className="bg-card">
                <Field orientation="horizontal">
                  <CategoryIcon icon={c.icon} className="size-5 shrink-0 text-primary" />
                  <FieldContent>
                    <FieldTitle>{localized(c, "name", locale)}</FieldTitle>
                    {localized(c, "description", locale) && (
                      <FieldDescription>{localized(c, "description", locale)}</FieldDescription>
                    )}
                  </FieldContent>
                  <RadioGroupItem value={c.id} id={`category-${c.id}`} />
                </Field>
              </FieldLabel>
            ))}
          </RadioGroup>

          {category && (
            <FieldGroup>
              {localized(category, "urgent_notice", locale) && (
                <Alert variant="destructive" className="bg-card">
                  <TriangleAlert />
                  <AlertTitle>{t("urgent")}</AlertTitle>
                  <AlertDescription>{localized(category, "urgent_notice", locale)}</AlertDescription>
                </Alert>
              )}
              {category.questions.map((q) => (
                <QuestionField
                  key={q.id}
                  question={q}
                  locale={locale}
                  value={answers[q.id] ?? ""}
                  onChange={(value) => setAnswers((a) => ({ ...a, [q.id]: value }))}
                />
              ))}
            </FieldGroup>
          )}
          <StepNav
            onBack={back}
            onNext={() => setStep(matches.length > 0 ? "nearby" : "details")}
            nextDisabled={!category || missingAnswer || nearby.isLoading}
            nextPending={!!category && nearby.isLoading}
          />
        </FieldSet>
      )}

      {step === "nearby" && (
        <FieldSet className={STEP_ENTER}>
          <StepHeading title={t("nearby.title")} lead={t("nearby.lead")} />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="size-4" aria-hidden="true" />
            {t("nearby.count", { count: matches.length })}
          </div>
          <NearbyList nearby={matches} onMeToo={finishWithMeToo} />
          <StepNav onBack={back} onNext={() => setStep("details")} nextLabel={t("nearby.continue")} />
        </FieldSet>
      )}

      {step === "details" && (
        <FieldSet className={STEP_ENTER}>
          <StepHeading title={t("details.title")} lead={t("details.lead")} />
          <FieldGroup>
            <PhotoPicker photos={photos} onChange={setPhotos} />
            <Field data-invalid={invalid.title}>
              <FieldLabel htmlFor="title">
                {t("details.titleLabel")} <span className="font-normal text-muted-foreground">{t("optional")}</span>
              </FieldLabel>
              <Input
                id="title"
                value={title}
                maxLength={REPORT_LIMITS.title}
                aria-invalid={invalid.title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  edited("title");
                }}
                placeholder={t("details.titlePlaceholder")}
                className="h-11 text-base md:text-sm"
              />
              <FieldDescription>{t("details.titleHint")}</FieldDescription>
              <FieldError>{fieldError("title")}</FieldError>
            </Field>
            <Field data-invalid={invalid.description}>
              <FieldLabel htmlFor="description">
                {t("details.description")} <span className="font-normal text-muted-foreground">{t("optional")}</span>
              </FieldLabel>
              <Textarea
                id="description"
                value={description}
                maxLength={REPORT_LIMITS.description}
                rows={4}
                aria-invalid={invalid.description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  edited("description");
                }}
                className="text-base md:text-sm"
              />
              <FieldDescription>{t("details.descriptionHint")}</FieldDescription>
              <FieldError>{fieldError("description")}</FieldError>
            </Field>
          </FieldGroup>
          <StepNav onBack={back} onNext={() => setStep("review")} nextDisabled={photos.length === 0} />
        </FieldSet>
      )}

      {step === "review" && location && category && (
        <FieldSet className={STEP_ENTER}>
          <StepHeading title={t("review.title")} lead={t("review.lead")} />
          <dl className="flex flex-col divide-y rounded-xl border bg-card">
            <SummaryRow label={t("review.location")} onEdit={() => setStep("location")}>
              {landmark.trim() || t("review.pinOnly")}
            </SummaryRow>
            <SummaryRow label={t("review.category")} onEdit={() => setStep("category")}>
              <span className="flex items-center gap-2 font-semibold">
                <CategoryIcon icon={category.icon} className="size-4 shrink-0 text-primary" />
                {localized(category, "name", locale)}
              </span>
              {category.questions
                .filter((q) => answers[q.id]?.trim())
                .map((q) => (
                  <span key={q.id} className="block text-muted-foreground">
                    {localized(q, "prompt", locale)}{" "}
                    <span className="font-medium text-foreground">{answerLabel(q, answers[q.id], locale, t)}</span>
                  </span>
                ))}
            </SummaryRow>
            <SummaryRow label={t("review.photos")} onEdit={() => setStep("details")}>
              <PhotoThumbs photos={photos} />
            </SummaryRow>
            <SummaryRow label={t("review.details")} onEdit={() => setStep("details")}>
              {title.trim() || description.trim() ? (
                <>
                  {title.trim() && <span className="block font-semibold">{title.trim()}</span>}
                  {description.trim() && <span className="block whitespace-pre-line">{description.trim()}</span>}
                </>
              ) : (
                <span className="text-muted-foreground">{t("review.noDetails")}</span>
              )}
            </SummaryRow>
          </dl>
          <FieldGroup>
            <FieldSet>
              <FieldLegend variant="label">{t("contact.title")}</FieldLegend>
              <FieldDescription>{t("contact.lead")}</FieldDescription>
            </FieldSet>
            <Field data-invalid={invalid.email}>
              <FieldLabel htmlFor="email">{t("contact.email")}</FieldLabel>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                maxLength={REPORT_LIMITS.email}
                aria-invalid={invalid.email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  edited("email");
                }}
                onBlur={() => setInvalid((current) => ({ ...current, email: !reportFields.shape.email.safeParse(email.trim()).success }))}
                className="h-11 text-base md:text-sm"
              />
              <FieldDescription>{t("contact.emailHint")}</FieldDescription>
              <FieldError>{fieldError("email")}</FieldError>
            </Field>
            <Alert className="bg-card">
              <AlertDescription>
                {t.rich("contact.privacy", {
                  link: (chunks) => (
                    <Link href="/privacy" className="text-primary underline" target="_blank">
                      {chunks}
                    </Link>
                  ),
                })}
              </AlertDescription>
            </Alert>
            <Turnstile
              siteKey={turnstileSiteKey}
              language={locale === "fil" ? "tl" : "en"}
              onToken={setCaptcha}
              resetKey={captchaReset}
            />
          </FieldGroup>
          <div className="flex gap-2">
            {back && (
              <Button type="button" variant="outline" size="lg" className="h-12" onClick={back}>
                <ArrowLeft data-icon="inline-start" />
                {t("back")}
              </Button>
            )}
            <Button type="button" size="lg" className="h-12 flex-1 text-base" disabled={!captcha || submitting} onClick={submit}>
              {submitting && <Spinner data-icon="inline-start" />}
              {t("submit")}
            </Button>
          </div>
        </FieldSet>
      )}
    </div>
  );
}

function StepHeading({ title, lead }: { title: string; lead?: string }) {
  return (
    <FieldLegend className="flex flex-col gap-1">
      <span className="text-xl font-bold text-navy">{title}</span>
      {lead && <span className="text-sm font-normal text-muted-foreground">{lead}</span>}
    </FieldLegend>
  );
}

function StepNav({
  onBack,
  onNext,
  nextDisabled,
  nextPending,
  nextLabel,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  nextPending?: boolean;
  nextLabel?: string;
}) {
  const t = useTranslations("reportForm");
  return (
    <div className="flex gap-2">
      {onBack && (
        <Button type="button" variant="outline" size="lg" className="h-12" onClick={onBack}>
          <ArrowLeft data-icon="inline-start" />
          {t("back")}
        </Button>
      )}
      <Button type="button" size="lg" className="h-12 flex-1 text-base" disabled={nextDisabled} onClick={onNext}>
        {nextPending && <Spinner data-icon="inline-start" />}
        {nextLabel ?? t("next")}
      </Button>
    </div>
  );
}

function SummaryRow({ label, onEdit, children }: { label: string; onEdit: () => void; children: ReactNode }) {
  const t = useTranslations("reportForm.review");
  return (
    <div className="flex items-start gap-3 p-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <dt className="text-sm text-muted-foreground">{label}</dt>
        <dd className="text-sm break-words">{children}</dd>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={onEdit} aria-label={t("editLabel", { section: label })}>
        {t("edit")}
      </Button>
    </div>
  );
}

function PhotoThumbs({ photos }: { photos: Blob[] }) {
  const t = useTranslations("reportForm.photos");
  const urls = useMemo(() => photos.map((p) => URL.createObjectURL(p)), [photos]);
  return (
    <span className="mt-1 flex gap-2">
      {photos.map((photo, i) => (
        // eslint-disable-next-line @next/next/no-img-element -- local blob preview
        <img
          key={urls[i]}
          src={urls[i]}
          alt={t("preview", { number: i + 1 })}
          onLoad={() => URL.revokeObjectURL(urls[i])}
          className="size-16 rounded-md bg-muted object-cover"
        />
      ))}
    </span>
  );
}

function answerLabel(
  question: CategoryQuestion,
  value: string,
  locale: Locale,
  t: ReturnType<typeof useTranslations<"reportForm">>,
) {
  if (question.kind === "yes_no") return value === "yes" ? t("yes") : t("no");
  const choice = question.choices.find((c) => c.value === value);
  if (choice) return locale === "en" ? choice.label_en : choice.label_fil;
  return value;
}

function QuestionField({
  question,
  locale,
  value,
  onChange,
}: {
  question: CategoryQuestion;
  locale: Locale;
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations("reportForm");
  const prompt = localized(question, "prompt", locale);
  const optional = question.required ? null : <span className="font-normal text-muted-foreground"> {t("optional")}</span>;

  if (question.kind === "text") {
    return (
      <Field>
        <FieldLabel htmlFor={`q-${question.id}`}>
          {prompt}
          {optional}
        </FieldLabel>
        <Input
          id={`q-${question.id}`}
          value={value}
          maxLength={REPORT_LIMITS.answer}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 text-base md:text-sm"
        />
      </Field>
    );
  }

  const options =
    question.kind === "yes_no"
      ? [
          { value: "yes", label: t("yes") },
          { value: "no", label: t("no") },
        ]
      : question.choices.map((c) => ({ value: c.value, label: locale === "en" ? c.label_en : c.label_fil }));

  return (
    <FieldSet>
      <FieldLegend variant="label">
        {prompt}
        {optional}
      </FieldLegend>
      <ToggleGroup
        value={value ? [value] : []}
        onValueChange={(next) => onChange(next[0] ?? "")}
        variant="outline"
        className="flex-wrap"
        aria-label={prompt}
      >
        {options.map((option) => (
          <ToggleGroupItem key={option.value} value={option.value} className="h-11 px-4">
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </FieldSet>
  );
}

function DoneView({ done }: { done: Done }) {
  const t = useTranslations("reportForm.done");

  if (done.kind === "meToo") {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-sun text-sun-foreground transition-[opacity,scale] duration-400 ease-out starting:scale-80 starting:opacity-0 motion-reduce:duration-200 motion-reduce:starting:scale-100">
          <Check className="size-7" aria-hidden="true" />
        </span>
        <h2 className="text-xl font-bold text-navy">{t("meTooTitle")}</h2>
        <p className="text-muted-foreground">{t("meTooLead")}</p>
        <Button variant="link" nativeButton={false} render={<Link href={`/r/${done.code}`} />}>
          {t("viewReport", { code: done.code })}
        </Button>
      </div>
    );
  }

  const trackingUrl = `${window.location.origin}/r/${done.code}?t=${done.token}`;
  const canShare = typeof navigator.share === "function";
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-status-resolved text-status-resolved-foreground transition-[opacity,scale] duration-400 ease-out starting:scale-80 starting:opacity-0 motion-reduce:duration-200 motion-reduce:starting:scale-100">
          <Check className="size-7" aria-hidden="true" />
        </span>
        <h2 className="text-xl font-bold text-navy">{t("title")}</h2>
        <p className="font-mono text-3xl font-medium tracking-wider transition-[opacity,translate] delay-60 duration-300 ease-out starting:translate-y-1.5 starting:opacity-0 motion-reduce:starting:translate-y-0">{done.code}</p>
        <p className="text-muted-foreground">{t("lead")}</p>
      </div>
      <Alert className="bg-card">
        <AlertTitle>{t("saveLink")}</AlertTitle>
        <AlertDescription className="flex flex-col gap-3">
          <code className="block rounded-md bg-muted p-2 text-xs break-all">{trackingUrl}</code>
          <Button
            variant="outline"
            onClick={async () => {
              await navigator.clipboard.writeText(trackingUrl);
              toast.success(t("copied"));
            }}
          >
            <Copy data-icon="inline-start" />
            {t("copy")}
          </Button>
          {canShare && (
            <Button
              variant="outline"
              onClick={() =>
                navigator.share({ title: t("shareTitle", { code: done.code }), url: trackingUrl }).catch(() => {
                  // Closing the share sheet rejects; nothing to do.
                })
              }
            >
              <Share2 data-icon="inline-start" />
              {t("share")}
            </Button>
          )}
          <p>
            {t.rich("savedHere", {
              link: (chunks) => (
                <Link href="/me" className="text-primary underline">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </AlertDescription>
      </Alert>
      {!done.following && <FollowForm reportId={done.id} credentials={{ token: done.token }} />}
      <Button size="lg" className="h-12 text-base" nativeButton={false} render={<Link href={`/r/${done.code}?t=${done.token}`} />}>
        {t("viewReport", { code: done.code })}
      </Button>
    </div>
  );
}
