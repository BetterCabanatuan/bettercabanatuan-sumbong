"use client";

import { ArrowLeft, Check, Copy, LocateFixed, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { SubmitErrorCode } from "@/app/api/reports/route";
import { CategoryIcon } from "@/components/category-icon";
import { type LatLng, LocationPicker } from "@/components/map";
import { Turnstile } from "@/components/turnstile";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
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
import type { CategoryQuestion, Locale } from "@/lib/types";
import { NearbyCheck } from "./nearby-check";
import { PhotoPicker } from "./photo-picker";

type Step = "location" | "category" | "details" | "contact";
const STEPS: Step[] = ["location", "category", "details", "contact"];
const STEP_ENTER =
  "transition-[opacity,translate] duration-200 ease-out starting:translate-y-2 starting:opacity-0 motion-reduce:starting:translate-y-0";

type Done = { kind: "submitted"; code: string; token: string } | { kind: "meToo"; code: string };

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
  const [done, setDone] = useState<Done | null>(null);

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

  async function submit() {
    if (!location || !category) return;
    setSubmitting(true);
    setSubmitError(null);

    const form = new FormData();
    form.set("category_id", category.id);
    form.set("lat", String(location.lat));
    form.set("lng", String(location.lng));
    form.set("title", title);
    form.set("landmark", landmark);
    form.set("description", description);
    form.set("email", email.trim());
    form.set("locale", locale);
    form.set(
      "answers",
      JSON.stringify(
        Object.entries(answers)
          .filter(([, value]) => value.trim())
          .map(([question_id, value]) => ({ question_id, value })),
      ),
    );
    photos.forEach((photo, i) => form.append("photos", photo, `photo-${i + 1}.jpg`));
    if (captcha) form.set("cf-turnstile-response", captcha);

    try {
      const response = await fetch("/api/reports", { method: "POST", body: form });
      const body = (await response.json()) as { code?: string; token?: string; error?: SubmitErrorCode };
      if (response.ok && body.code && body.token) {
        setDone({ kind: "submitted", code: body.code, token: body.token });
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

  const stepIndex = STEPS.indexOf(step);
  const back = stepIndex > 0 ? () => setStep(STEPS[stepIndex - 1]) : undefined;

  return (
    <div ref={top} className="flex scroll-mt-24 flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">
          {t("progress", { step: stepIndex + 1, total: STEPS.length })}
        </p>
        <Progress value={((stepIndex + 1) / STEPS.length) * 100} aria-label={t("progress", { step: stepIndex + 1, total: STEPS.length })} />
      </div>

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
            <Field>
              <FieldLabel htmlFor="landmark">{t("location.landmark")}</FieldLabel>
              <Input
                id="landmark"
                value={landmark}
                maxLength={200}
                onChange={(e) => setLandmark(e.target.value)}
                placeholder={t("location.landmarkPlaceholder")}
                className="h-11 text-base md:text-sm"
              />
              <FieldDescription>{t("location.landmarkHint")}</FieldDescription>
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
              <NearbyCheck
                lat={location.lat}
                lng={location.lng}
                categoryId={category.id}
                onMeToo={(code) => setDone({ kind: "meToo", code })}
              />
            </FieldGroup>
          )}
          <StepNav onBack={back} onNext={() => setStep("details")} nextDisabled={!category || missingAnswer} />
        </FieldSet>
      )}

      {step === "details" && (
        <FieldSet className={STEP_ENTER}>
          <StepHeading title={t("details.title")} lead={t("details.lead")} />
          <FieldGroup>
            <PhotoPicker photos={photos} onChange={setPhotos} />
            <Field>
              <FieldLabel htmlFor="title">
                {t("details.titleLabel")} <span className="font-normal text-muted-foreground">{t("optional")}</span>
              </FieldLabel>
              <Input
                id="title"
                value={title}
                maxLength={120}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("details.titlePlaceholder")}
                className="h-11 text-base md:text-sm"
              />
              <FieldDescription>{t("details.titleHint")}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="description">{t("details.description")}</FieldLabel>
              <Textarea
                id="description"
                value={description}
                maxLength={2000}
                rows={4}
                onChange={(e) => setDescription(e.target.value)}
                className="text-base md:text-sm"
              />
              <FieldDescription>{t("details.descriptionHint")}</FieldDescription>
            </Field>
          </FieldGroup>
          <StepNav onBack={back} onNext={() => setStep("contact")} nextDisabled={photos.length === 0} />
        </FieldSet>
      )}

      {step === "contact" && (
        <FieldSet className={STEP_ENTER}>
          <StepHeading title={t("contact.title")} lead={t("contact.lead")} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email">{t("contact.email")}</FieldLabel>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 text-base md:text-sm"
              />
              <FieldDescription>{t("contact.emailHint")}</FieldDescription>
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

function StepNav({ onBack, onNext, nextDisabled }: { onBack?: () => void; onNext: () => void; nextDisabled?: boolean }) {
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
        {t("next")}
      </Button>
    </div>
  );
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
          maxLength={500}
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
        </AlertDescription>
      </Alert>
      <Button size="lg" className="h-12 text-base" nativeButton={false} render={<Link href={`/r/${done.code}?t=${done.token}`} />}>
        {t("viewReport", { code: done.code })}
      </Button>
    </div>
  );
}
