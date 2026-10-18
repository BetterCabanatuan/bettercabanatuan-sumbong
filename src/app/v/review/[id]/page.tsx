import { notFound } from "next/navigation";
import { approveReport, rejectReport } from "@/app/v/actions";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { ActionForm, SubmitButton } from "@/components/volunteer/action-form";
import { PhotoRedactor } from "@/components/volunteer/photo-redactor";
import { ReportFacts } from "@/components/volunteer/report-facts";
import { getBarangays, getCategories, getOffices, getReportById, getReportDetails } from "@/lib/data";
import { ORIGINALS_BUCKET, publicPhotoUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

const REJECT_PRESETS = [
  "Outside Cabanatuan City",
  "Not a public-space problem",
  "Photo does not show the problem",
  "Accuses or identifies a private person",
  "Abusive or spam",
  "Emergency: referred to CDRRMO/CELCOR hotline",
];

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

      <ReportFacts
        report={report}
        category={category}
        barangay={barangays.find((b) => b.id === report.barangay_id)}
        answers={details.answers}
      />

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Photos ({evidence.length})</h2>
          <p className="text-sm text-muted-foreground">Each photo must be published (with any areas pixelated) or hidden before you approve.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
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

      {isPending && (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <Card>
            <ActionForm action={approveReport.bind(null, report.id)} className="contents">
              <CardHeader>
                <CardTitle>Approve and publish</CardTitle>
                <CardDescription>The Report goes on the public board and into the office’s next Digest.</CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="category_id">Category</FieldLabel>
                    <NativeSelect id="category_id" name="category_id" defaultValue={report.category_id}>
                      {categories.map((c) => (
                        <NativeSelectOption key={c.id} value={c.id}>
                          {c.name_en}
                          {c.active ? "" : " (inactive)"}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="office_id">Responsible Office</FieldLabel>
                    <NativeSelect id="office_id" name="office_id" defaultValue={report.suggested_office_id ?? ""} required>
                      <NativeSelectOption value="" disabled>
                        Choose an office
                      </NativeSelectOption>
                      {offices.map((o) => (
                        <NativeSelectOption key={o.id} value={o.id}>
                          {o.name_en} ({o.short_name}){o.id === report.suggested_office_id ? " · suggested" : ""}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                    <FieldDescription>
                      Pre-selected from the Category. Change it if the location says otherwise (a national highway goes to DPWH).
                    </FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="approve-note">Internal note (optional)</FieldLabel>
                    <Textarea id="approve-note" name="note" maxLength={500} />
                  </Field>
                  {pendingPhotos > 0 && (
                    <Alert>
                      <AlertDescription>
                        {pendingPhotos} photo{pendingPhotos === 1 ? "" : "s"} still need review.
                      </AlertDescription>
                    </Alert>
                  )}
                </FieldGroup>
              </CardContent>
              <CardFooter>
                <SubmitButton>Approve</SubmitButton>
              </CardFooter>
            </ActionForm>
          </Card>

          <Card>
            <ActionForm action={rejectReport.bind(null, report.id)} className="contents">
              <input type="hidden" name="from" value="review" />
              <CardHeader>
                <CardTitle>Reject</CardTitle>
                <CardDescription>The Reporter sees the reason if they left contact details.</CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="preset">Reason</FieldLabel>
                    <NativeSelect id="preset" name="preset" defaultValue={REJECT_PRESETS[1]}>
                      {REJECT_PRESETS.map((preset) => (
                        <NativeSelectOption key={preset} value={preset}>
                          {preset}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="reason">Details (optional)</FieldLabel>
                    <Textarea id="reason" name="reason" maxLength={500} />
                  </Field>
                </FieldGroup>
              </CardContent>
              <CardFooter>
                <SubmitButton variant="destructive">Reject</SubmitButton>
              </CardFooter>
            </ActionForm>
          </Card>
        </div>
      )}
    </>
  );
}
