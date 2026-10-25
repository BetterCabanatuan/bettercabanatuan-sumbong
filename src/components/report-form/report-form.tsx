"use client";

import { ArrowLeft, Check, Copy, History, LocateFixed, Phone, Share2, TriangleAlert, Users } from "lucide-react";
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
import { type BlockedReason, blockedReason } from "@/lib/report-blocked";
import { REPORT_LIMITS, type ReportField, reportFields, toReportFormData } from "@/lib/report-schema";
import { cn } from "@/lib/utils";
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
// The step to send the Reporter back to for each error the API can return about their input.
const ERROR_STEP: Partial<Record<SubmitErrorCode, "location" | "category" | "details">> = {
  outside_city: "location",
  photos_required: "details",
  invalid_photo: "details",
  missing_answer: "category",
  invalid_answer: "category",
  unknown_category: "category",
};
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
  const [captchaFailed, setCaptchaFailed] = useState(false);
  // Which step the Reporter pressed Next on while blocked, and how many times (replays the nudge).
  const [tries, setTries] = useState<{ step: Step | null; n: number }>({ step: null, n: 0 });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<SubmitErrorCode | null>(null);
  const [invalid, setInvalid] = useState<Partial<Record<InlineField, boolean>>>({});
  const [done, setDone] = useState<Done | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [restored, setRestored] = useState(false);

  // Start each step at its top; on phones the Next button sits far down the previous step.
  // Compare with the step we last saw instead of skipping "the first run": React strict mode runs
  // effects twice in development, and a skipped-once flag then scrolled past the page title on load.
  const top = useRef<HTMLDivElement>(null);
  const errorAlert = useRef<HTMLDivElement>(null);
  const mapBox = useRef<HTMLDivElement>(null);
  const categoryBox = useRef<HTMLDivElement>(null);
  const captchaBox = useRef<HTMLDivElement>(null);
  const shownStep = useRef(step);
  useEffect(() => {
    if (shownStep.current === step) return;
    shownStep.current = step;
    top.current?.scrollIntoView({ block: "start" });
  }, [step]);

  const category = categories.find((c) => c.id === categoryId);
  const nearby = useNearbyReports(location?.lat, location?.lng, category?.id);
  const matches = nearby.data ?? [];

  const reason = blockedReason(step, {
    hasPin: !!location,
    hasCategory: !!category,
    questions: (category?.questions ?? []).map((q) => ({
      id: q.id,
      required: q.required,
      prompt: localized(q, "prompt", locale),
    })),
    answers,
    photoCount: photos.length,
    hasCaptcha: !!captcha,
  });
  // Next stays enabled; pressing it while something is missing says what and moves focus there.
  const tried = reason !== null && tries.step === step;
  const blocked = reason && { message: blockedMessage(reason) };
  function blockedMessage(r: BlockedReason) {
    return r.kind === "answer" ? t("blocked.answer", { prompt: r.prompt }) : t(`blocked.${r.kind}`);
  }
  function focusReason(r: BlockedReason) {
    const target =
      r.kind === "pin"
        ? mapBox.current?.querySelector<HTMLElement>(".leaflet-container")
        : r.kind === "category"
          ? categoryBox.current?.querySelector<HTMLElement>('[role="radio"]')
          : r.kind === "answer"
            ? document.getElementById(`q-${r.questionId}`)
            : r.kind === "photo"
              ? document.getElementById("photo-camera")
              : null;
    if (target) target.focus();
    else if (r.kind === "captcha") captchaBox.current?.scrollIntoView({ block: "center" });
  }
  function tryNext() {
    setTries((current) => ({ step, n: current.step === step ? current.n + 1 : 1 }));
    if (reason) focusReason(reason);
  }

  // Turnstile can sit on "checking" for good on a bad connection; offer a retry after 15 seconds.
  useEffect(() => {
    if (step !== "review" || captcha) return;
    const timer = setTimeout(() => setCaptchaFailed(true), 15_000);
    return () => clearTimeout(timer);
  }, [step, captcha, captchaReset]);

  // A failed submit shows its alert above the fold; bring the reader to it and say so in the title.
  useEffect(() => {
    if (!submitError) return;
    errorAlert.current?.focus();
    errorAlert.current?.scrollIntoView({ block: "center" });
    const title = document.title;
    document.title = `${t("errorTitle")}${title}`;
    return () => {
      document.title = title;
    };
  }, [submitError, t]);

  function retryCaptcha() {
    setCaptchaFailed(false);
    setCaptchaReset((n) => n + 1);
  }

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
      const target = body.error && ERROR_STEP[body.error];
      if (target) setStep(target);
    } catch {
      setSubmitError("server_error");
    } finally {
      setSubmitting(false);
      setCaptcha(null);
      setCaptchaReset((n) => n + 1);
    }
  }

  if (done) return <DoneView done={done} onAnother={() => { startOver(); setDone(null); window.scrollTo({ top: 0 }); }} />;

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

      {step === "location" && (
        <Alert variant="destructive" className="bg-card">
          <TriangleAlert />
          <AlertTitle>{t("emergency.title")}</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-2">
            <p>{t("emergency.body")}</p>
            <Button variant="outline" size="lg" className="h-11" nativeButton={false} render={<a href="tel:09088811010" />}>
              <Phone data-icon="inline-start" />
              {t("emergency.call")}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {step === "location" && hydrated && !restored && (
        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">{t("intro.ready")}</p>
          <p>
            {t("intro.volunteer")}{" "}
            <Link href="/about" className="text-primary underline">
              {t("intro.how")}
            </Link>
          </p>
        </div>
      )}

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
        <Alert ref={errorAlert} tabIndex={-1} variant="destructive" className="bg-card outline-none">
          <TriangleAlert />
          <AlertDescription className="flex flex-col items-start gap-2">
            <p>{t(`errors.${submitError}`)}</p>
            {ERROR_STEP[submitError] && ERROR_STEP[submitError] !== step && (
              <Button type="button" variant="outline" size="sm" onClick={() => setStep(ERROR_STEP[submitError]!)}>
                {t("gotoStep", { step: t(`steps.${ERROR_STEP[submitError]}`) })}
              </Button>
            )}
          </AlertDescription>
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
            <div
              ref={mapBox}
              className={cn("h-80 overflow-hidden rounded-xl border bg-card", tried && reason?.kind === "pin" && "border-destructive")}
            >
              <LocationPicker value={location} onChange={setLocation} className="size-full" />
            </div>
            <p className="text-sm text-muted-foreground">{location ? t("location.adjust") : t("location.tap")}</p>
            <Field data-invalid={invalid.landmark}>
              <FieldLabel htmlFor="landmark">
                {t("location.landmark")} <span className="font-normal text-muted-foreground">{t("optional")}</span>
              </FieldLabel>
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
          <StepNav onNext={() => setStep("category")} blocked={blocked} tried={tried} tryKey={tries.n} onTry={tryNext} />
        </FieldSet>
      )}

      {step === "category" && location && (
        <FieldSet className={STEP_ENTER}>
          <StepHeading title={t("category.title")} />
          <RadioGroup
            ref={categoryBox}
            value={categoryId ?? ""}
            onValueChange={(value) => {
              setCategoryId(value as string);
              setAnswers({});
            }}
            aria-label={t("category.title")}
            aria-invalid={tried && reason?.kind === "category" ? true : undefined}
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
                  invalid={tried && reason?.kind === "answer" && reason.questionId === q.id}
                  onChange={(value) => setAnswers((a) => ({ ...a, [q.id]: value }))}
                />
              ))}
            </FieldGroup>
          )}
          <StepNav
            onBack={back}
            onNext={() => setStep(matches.length > 0 ? "nearby" : "details")}
            blocked={blocked}
            tried={tried}
            tryKey={tries.n}
            onTry={tryNext}
            nextPending={!reason && nearby.isLoading}
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
            <PhotoPicker photos={photos} onChange={setPhotos} invalid={tried && reason?.kind === "photo"} />
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
          <StepNav onBack={back} onNext={() => setStep("review")} blocked={blocked} tried={tried} tryKey={tries.n} onTry={tryNext} />
        </FieldSet>
      )}

      {step === "review" && location && category && (
        <FieldSet className={STEP_ENTER}>
          <StepHeading title={t("review.title")} lead={`${t("review.lead")} ${t("review.commit")}`} />
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
            <div ref={captchaBox}>
              <Turnstile
                siteKey={turnstileSiteKey}
                language={locale === "fil" ? "tl" : "en"}
                onToken={(token) => {
                  setCaptcha(token);
                  if (token) setCaptchaFailed(false);
                }}
                onFail={() => setCaptchaFailed(true)}
                resetKey={captchaReset}
              />
            </div>
          </FieldGroup>
          {!captcha && (
            <div
              key={captchaFailed ? "failed" : tried ? `tried-${tries.n}` : "checking"}
              role={captchaFailed || tried ? "alert" : "status"}
              className={cn(
                "flex items-center gap-2 text-sm",
                captchaFailed || tried ? "text-destructive" : "text-muted-foreground",
                tried && !captchaFailed && "motion-safe:animate-nudge",
              )}
            >
              {captchaFailed ? (
                <>
                  <span>{t("captcha.failed")}</span>
                  <Button type="button" variant="outline" size="sm" onClick={retryCaptcha}>
                    {t("captcha.retry")}
                  </Button>
                </>
              ) : (
                <>
                  <Spinner className="shrink-0" />
                  <span>{tried && blocked ? blocked.message : t("captcha.checking")}</span>
                </>
              )}
            </div>
          )}
          <div className="flex gap-2">
            {back && (
              <Button type="button" variant="outline" size="lg" className="h-12" onClick={back}>
                <ArrowLeft data-icon="inline-start" />
                {t("back")}
              </Button>
            )}
            <Button
              type="button"
              size="lg"
              className="h-12 flex-1 text-base motion-safe:active:scale-[0.97]"
              disabled={submitting}
              aria-busy={!captcha || submitting}
              onClick={() => (blocked ? tryNext() : submit())}
            >
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
  blocked,
  tried,
  tryKey,
  onTry,
  nextPending,
  nextLabel,
}: {
  onBack?: () => void;
  onNext: () => void;
  /** What is missing, or null. Next stays enabled: pressing it then calls `onTry` instead of `onNext`. */
  blocked?: { message: string } | null;
  tried?: boolean;
  tryKey?: number;
  onTry?: () => void;
  nextPending?: boolean;
  nextLabel?: string;
}) {
  const t = useTranslations("reportForm");
  return (
    <div className="flex flex-col gap-2">
      {tried && blocked && (
        // A new key each press replays the nudge.
        <p key={tryKey} role="alert" className="text-sm text-destructive motion-safe:animate-nudge">
          {blocked.message}
        </p>
      )}
      <div className="flex gap-2">
        {onBack && (
          <Button type="button" variant="outline" size="lg" className="h-12 motion-safe:active:scale-[0.97]" onClick={onBack}>
            <ArrowLeft data-icon="inline-start" />
            {t("back")}
          </Button>
        )}
        <Button
          type="button"
          size="lg"
          className="h-12 flex-1 text-base motion-safe:active:scale-[0.97]"
          aria-busy={nextPending || undefined}
          onClick={() => {
            if (blocked) onTry?.();
            else if (!nextPending) onNext();
          }}
        >
          {nextPending && <Spinner data-icon="inline-start" />}
          {nextLabel ?? t("next")}
        </Button>
      </div>
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
  invalid,
  onChange,
}: {
  question: CategoryQuestion;
  locale: Locale;
  value: string;
  invalid?: boolean;
  onChange: (value: string) => void;
}) {
  const t = useTranslations("reportForm");
  const prompt = localized(question, "prompt", locale);
  const optional = question.required ? null : <span className="font-normal text-muted-foreground"> {t("optional")}</span>;

  if (question.kind === "text") {
    return (
      <Field data-invalid={invalid || undefined}>
        <FieldLabel htmlFor={`q-${question.id}`}>
          {prompt}
          {optional}
        </FieldLabel>
        <Input
          id={`q-${question.id}`}
          value={value}
          maxLength={REPORT_LIMITS.answer}
          aria-invalid={invalid || undefined}
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
        {options.map((option, i) => (
          <ToggleGroupItem key={option.value} id={i === 0 ? `q-${question.id}` : undefined} value={option.value} className="h-11 px-4">
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </FieldSet>
  );
}

function DoneView({ done, onAnother }: { done: Done; onAnother: () => void }) {
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
          {/* The stroke draws itself once; with reduced motion it is simply there. */}
          <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12.5 9.5 17 19 7.5" pathLength="1" strokeDasharray="1" className="motion-safe:animate-draw" />
          </svg>
        </span>
        <h2 className="text-xl font-bold text-navy">{t("title")}</h2>
        <p className="font-mono text-3xl font-medium tracking-wider transition-[opacity,translate] delay-60 duration-300 ease-out starting:translate-y-1.5 starting:opacity-0 motion-reduce:starting:translate-y-0">{done.code}</p>
        <p className="text-muted-foreground">{t("lead")}</p>
      </div>
      <section aria-labelledby="done-next" className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <h3 id="done-next" className="text-sm font-semibold text-navy">
          {t("nextTitle")}
        </h3>
        <ol className="flex flex-col gap-3 text-sm">
          {(["next1", "next2", "next3"] as const).map((key, i) => (
            <li
              key={key}
              className="flex gap-3 motion-safe:animate-rise-in"
              style={{ animationDelay: `${240 + i * 40}ms` }}
            >
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-navy" aria-hidden="true">
                {i + 1}
              </span>
              <span className="pt-0.5">{t(key)}</span>
            </li>
          ))}
        </ol>
        {done.following && <p className="text-sm text-muted-foreground">{t("updatesEmail")}</p>}
        <p className="text-sm text-muted-foreground">{t("volunteer")}</p>
      </section>
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
      <Button size="lg" className="h-12 text-base motion-safe:active:scale-[0.97]" nativeButton={false} render={<Link href={`/r/${done.code}?t=${done.token}`} />}>
        {t("viewReport", { code: done.code })}
      </Button>
      <Button type="button" variant="outline" size="lg" className="h-12 text-base motion-safe:active:scale-[0.97]" onClick={onAnother}>
        {t("another")}
      </Button>
    </div>
  );
}
