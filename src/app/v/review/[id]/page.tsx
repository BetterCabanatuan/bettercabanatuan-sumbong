import { notFound } from "next/navigation";
import { approveReport, rejectReport } from "@/app/v/actions";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PhotoRedactor } from "@/components/volunteer/photo-redactor";
import { ReportFacts } from "@/components/volunteer/report-facts";
import { ReviewDecision } from "@/components/volunteer/review-decision";
import { getBarangays, getCategories, getOffices, getReportById, getReportDetails } from "@/lib/data";
import { ORIGINALS_BUCKET, publicPhotoUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

export default async function ReviewReportPage({ params }: PageProps<"/v/review/[id]">) {
  const { id } = await params;
  const report = await getReportById(id);
  if (!report) notFound();

  const [details, categories, offices, barangays] = await Promise.all([
    getReportDetails(report.id),
    getCategories({ includeInactive: true }),
    getOffices(),
    getBarangays(),
  ]);
  const evidence = details.photos.filter((p) => p.kind === "evidence");
  const { data: signed } = await (await createClient()).storage
    .from(ORIGINALS_BUCKET)
    .createSignedUrls(
      evidence.map((p) => p.original_path),
      60 * 60,
    );
  const category = categories.find((c) => c.id === report.category_id);
  const pendingPhotos = evidence.filter((p) => !p.public_path && !p.hidden).length;
  const isPending = report.status === "pending_review";

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-2xl font-bold text-navy">{report.public_code}</h1>
        <StatusBadge status={report.status} />
      </div>
      {!isPending && (
        <Alert>
          <AlertDescription>This Report was already reviewed.</AlertDescription>
        </Alert>
      )}

      {/* Evidence on the left; the decision stays in view beside it while you work through the photos. */}
      <div className={isPending ? "grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]" : "flex flex-col gap-6"}>
        <div className="flex min-w-0 flex-col gap-6">
          <ReportFacts
            report={report}
            category={category}
            barangay={barangays.find((b) => b.id === report.barangay_id)}
            answers={details.answers}
            className={isPending ? "lg:grid-cols-1" : undefined}
          />

          <section id="photos" className="flex scroll-mt-20 flex-col gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold">
                Photos{" "}
                <span className="font-normal text-muted-foreground">
                  {evidence.length - pendingPhotos} of {evidence.length} cleared
                </span>
              </h2>
              <p className="text-sm text-muted-foreground">Publish each photo (with any areas pixelated) or hide it before you approve.</p>
            </div>
            <div className={isPending ? "grid gap-4" : "grid gap-4 lg:grid-cols-2"}>
              {evidence.map((photo, i) => (
                <PhotoRedactor
                  key={photo.id}
                  photoId={photo.id}
                  reportId={report.id}
                  originalUrl={signed?.[i]?.signedUrl ?? ""}
                  publicUrl={photo.public_path ? publicPhotoUrl(photo.public_path) : null}
                  hidden={photo.hidden}
                />
              ))}
            </div>
          </section>
        </div>

        {isPending && (
          <aside className="lg:sticky lg:top-16">
            <ReviewDecision
              approve={approveReport.bind(null, report.id)}
              reject={rejectReport.bind(null, report.id)}
              categories={categories}
              offices={offices}
              categoryId={report.category_id}
              suggestedOfficeId={report.suggested_office_id}
              photos={{ total: evidence.length, pending: pendingPhotos }}
            />
          </aside>
        )}
      </div>
    </>
  );
}
