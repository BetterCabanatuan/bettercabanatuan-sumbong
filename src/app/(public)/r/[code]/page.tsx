import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { CategoryIcon } from "@/components/category-icon";
import { ReportsMap } from "@/components/map";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { localized } from "@/i18n/config";
import { getBarangays, getCategories, getOffices, getReportByCode, getReportDetails } from "@/lib/data";
import { env } from "@/lib/env";
import { reportTitle } from "@/lib/report-title";
import { hasReporterAccess, type ReporterCredentials } from "@/lib/reporter-access";
import { ORIGINALS_BUCKET, publicPhotoUrl } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { type Locale, OPEN_STATUSES, PUBLIC_STATUSES, type Report } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FollowForm, ReopenForm, ShareCard, ThreadVote } from "./reporter-actions";
import { Timeline, type TimelineItem } from "./timeline";

const REOPEN_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function withinReopenWindow(resolvedAt: string | null) {
  return resolvedAt !== null && Date.now() - new Date(resolvedAt).getTime() < REOPEN_WINDOW_MS;
}

function daysSince(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS));
}

function param(value: string | string[] | undefined) {
  return typeof value === "string" ? value : null;
}

export async function generateMetadata({ params }: PageProps<"/r/[code]">): Promise<Metadata> {
  const { code } = await params;
  return { title: code.toUpperCase(), robots: { index: false } };
}

export default async function ReportPage({ params, searchParams }: PageProps<"/r/[code]">) {
  const { code } = await params;
  const query = await searchParams;
  const credentials: ReporterCredentials = {
    token: param(query.t),
    followerId: param(query.f),
    signature: param(query.s),
  };

  let report: Report | null = await getReportByCode(code);
  let isReporter = false;
  if (report) {
    isReporter = await hasReporterAccess(report.id, credentials);
  } else {
    // Not public (or not found): only its Reporter may see it.
    const hidden = await getReportByCode(code, { asAdmin: true });
    if (hidden && (await hasReporterAccess(hidden.id, credentials))) {
      report = hidden;
      isReporter = true;
    }
  }
  if (!report) notFound();

  const isPublic = PUBLIC_STATUSES.includes(report.status);
  const [t, format, locale, categories, offices, barangays, details] = await Promise.all([
    getTranslations("reportPage"),
    getFormatter(),
    getLocale() as Promise<Locale>,
    getCategories({ includeInactive: true }),
    getOffices({ includeInactive: true }),
    getBarangays(),
    getReportDetails(report.id, { asAdmin: isReporter && !isPublic }),
  ]);

  const category = categories.find((c) => c.id === report.category_id);
  const office = offices.find((o) => o.id === report.office_id);
  const officeName = office ? localized(office, "name", locale) : "";
  const barangay = barangays.find((b) => b.id === report.barangay_id);
  const title = reportTitle(report, category, locale);

  // Public visitors see Volunteer-cleared copies; the Reporter of a not-yet-public Report sees their own originals.
  const photos: { url: string; after: boolean }[] = [];
  if (isPublic) {
    for (const photo of details.photos) {
      if (photo.public_path && !photo.hidden) photos.push({ url: publicPhotoUrl(photo.public_path), after: photo.kind === "after" });
    }
  } else {
    const { data } = await createAdminClient()
      .storage.from(ORIGINALS_BUCKET)
      .createSignedUrls(
        details.photos.map((p) => p.original_path),
        60 * 60,
      );
    for (const item of data ?? []) if (item.signedUrl) photos.push({ url: item.signedUrl, after: false });
  }

  let hasFollowerEmail = true;
  if (isReporter) {
    const { count } = await createAdminClient()
      .from("report_followers")
      .select("id", { count: "exact", head: true })
      .eq("report_id", report.id)
      .not("email", "is", null);
    hasFollowerEmail = (count ?? 0) > 0;
  }
  const canReopen = isReporter && report.status === "resolved" && withinReopenWindow(report.resolved_at);

  const date = (value: string) => format.dateTime(new Date(value), { month: "short", day: "numeric", year: "numeric" });
  // Newest first. `office` marks what happened once Volunteers handed it to the Responsible Office.
  const updates = [
    report.status === "reopened" &&
      report.reopened_at && {
        key: "reopened",
        kind: "reopened",
        office: true,
        title: t("timeline.reopened"),
        date: date(report.reopened_at),
      },
    report.status === "resolved" &&
      report.resolved_at && {
        key: "resolved",
        kind: "resolved",
        office: true,
        title: t("timeline.resolved"),
        date: date(report.resolved_at),
      },
    report.first_forwarded_at && {
      key: "forwarded",
      kind: "forwarded",
      office: true,
      title: t("timeline.forwarded", { office: officeName }),
      body: t("timeline.forwardedBody"),
      date: date(report.first_forwarded_at),
    },
    report.me_too_count > 0 && {
      key: "meToo",
      kind: "meToo",
      title: t("timeline.meToo", { count: report.me_too_count }),
    },
    report.published_at && {
      key: "published",
      kind: "published",
      title: t("timeline.published"),
      body: t("timeline.publishedBody"),
      date: date(report.published_at),
    },
    { key: "submitted", kind: "submitted", title: t("timeline.submitted"), date: date(report.created_at) },
  ].filter(Boolean) as TimelineItem[];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
      <Button variant="ghost" nativeButton={false} render={<Link href="/" />} className="self-start">
        <ChevronLeft data-icon="inline-start" />
        {t("back")}
      </Button>

      <header className="flex items-start gap-4 sm:gap-5">
        <ThreadVote reportId={report.id} count={report.me_too_count} open={OPEN_STATUSES.includes(report.status)} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <StatusBadge status={report.status} />
            {category && (
              <span className="inline-flex items-center gap-1">
                <CategoryIcon icon={category.icon} className="size-4" />
                {localized(category, "name", locale)}
              </span>
            )}
            <span className="font-mono text-xs">{report.public_code}</span>
          </div>
          <h1 className="text-2xl leading-tight font-bold text-balance text-navy sm:text-3xl">{title}</h1>
          <p className="text-sm text-muted-foreground">
            {t("reportedOn", { date: date(report.created_at) })}
            {barangay && ` · ${t("barangayName", { name: barangay.name })}`}
          </p>
        </div>
      </header>

      <Alert className="bg-card">
        <AlertDescription>{t(`statusExplainer.${report.status}`, { office: officeName })}</AlertDescription>
      </Alert>
      {report.status === "rejected" && isReporter && report.rejection_reason && (
        <Alert variant="destructive" className="bg-card">
          <AlertDescription>{t("rejectionReason", { reason: report.rejection_reason })}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col items-start gap-6 lg:flex-row">
        <section className="flex w-full min-w-0 flex-1 flex-col gap-6">
          <Card className="pt-0">
            {photos.length > 0 ? (
              <div className={cn("grid gap-0.5", photos.length > 1 && "grid-cols-2")}>
                {photos.map((photo, i) => (
                  <a key={photo.url} href={photo.url} target="_blank" rel="noreferrer" className="relative block aspect-[4/3] bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element -- Supabase storage URL */}
                    <img src={photo.url} alt={t("photoAlt", { number: i + 1 })} className="size-full object-cover" loading="lazy" />
                    {photo.after && (
                      <span className="absolute bottom-2 left-2 rounded-md bg-navy px-2 py-0.5 text-xs font-semibold text-navy-foreground">
                        {t("afterPhoto")}
                      </span>
                    )}
                  </a>
                ))}
              </div>
            ) : (
              <div className="flex aspect-[3/1] items-center justify-center bg-muted px-4 text-center text-sm text-muted-foreground">
                {t("noPhotos")}
              </div>
            )}
            <CardContent className="flex flex-col gap-4 text-base leading-relaxed">
              {report.description && <p className="whitespace-pre-line">{report.description}</p>}
              {(details.answers.length > 0 || report.landmark) && (
                <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
                  {report.landmark && (
                    <div>
                      <dt className="text-muted-foreground">{t("landmark")}</dt>
                      <dd className="font-semibold">{report.landmark}</dd>
                    </div>
                  )}
                  {details.answers.map((a) => (
                    <div key={a.prompt_en}>
                      <dt className="text-muted-foreground">{localized(a, "prompt", locale)}</dt>
                      <dd className="font-semibold">{answerLabel(a.value, a.question_id, category, locale, t)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </CardContent>
          </Card>

          <section className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold">{t("timeline.title")}</h2>
            <Timeline items={updates} officePhaseLabel={t("timeline.officePhase")} />
          </section>

          {isReporter && canReopen && <ReopenForm reportId={report.id} credentials={credentials} />}
          {isReporter && !hasFollowerEmail && report.status !== "rejected" && (
            <FollowForm reportId={report.id} credentials={credentials} />
          )}
        </section>

        <aside className="flex w-full flex-col gap-4 lg:w-80 lg:shrink-0">
          {office && isPublic && (
            <Card size="sm">
              <CardHeader>
                <CardDescription>{t("office")}</CardDescription>
                <CardTitle>{officeName}</CardTitle>
              </CardHeader>
              {report.status === "forwarded" && report.first_forwarded_at && (
                <CardContent className="text-muted-foreground">
                  {t("waitingDays", { days: daysSince(report.first_forwarded_at) })}
                </CardContent>
              )}
            </Card>
          )}
          <Card size="sm" className="pt-0">
            <div className="h-48">
              <ReportsMap
                className="size-full"
                legend={false}
                reports={[
                  {
                    id: report.id,
                    code: report.public_code,
                    lat: report.lat,
                    lng: report.lng,
                    status: report.status,
                    title,
                    categoryIcon: category?.icon ?? "circle-alert",
                  },
                ]}
              />
            </div>
            <CardHeader>
              <CardTitle>{barangay ? t("barangayName", { name: barangay.name }) : t("cabanatuan")}</CardTitle>
              {report.landmark && <CardDescription>{report.landmark}</CardDescription>}
            </CardHeader>
          </Card>
          {isPublic && <ShareCard url={`${env.siteUrl}/r/${report.public_code}`} title={title} />}
        </aside>
      </div>
    </main>
  );
}

function answerLabel(
  value: string,
  questionId: string | null,
  category: Awaited<ReturnType<typeof getCategories>>[number] | undefined,
  locale: Locale,
  t: Awaited<ReturnType<typeof getTranslations<"reportPage">>>,
) {
  const question = category?.questions.find((q) => q.id === questionId);
  if (question?.kind === "yes_no") return value === "yes" ? t("yes") : t("no");
  const choice = question?.choices.find((c) => c.value === value);
  if (choice) return locale === "en" ? choice.label_en : choice.label_fil;
  return value;
}
