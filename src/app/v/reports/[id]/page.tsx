import Link from "next/link";
import { notFound } from "next/navigation";
import { misrouteReport, rejectReport, reopenReport } from "@/app/v/actions";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { ActionFieldError, ActionForm, SubmitButton } from "@/components/volunteer/action-form";
import { ReportFacts } from "@/components/volunteer/report-facts";
import { ResolveForm } from "@/components/volunteer/resolve-form";
import { can, requireVolunteer } from "@/lib/auth";
import { byId, getBarangays, getCategories, getOffices, getReportById, getReportDetails } from "@/lib/data";
import { publicPhotoUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { PUBLIC_STATUSES, type ReportEvent } from "@/lib/types";

export default async function VolunteerReportPage({ params }: PageProps<"/v/reports/[id]">) {
  const { id } = await params;
  const me = await requireVolunteer();
  const report = await getReportById(id);
  if (!report) notFound();

  const supabase = await createClient();
  const [details, categories, offices, barangays, { data: events }, { data: volunteers }] = await Promise.all([
    getReportDetails(report.id),
    getCategories({ includeInactive: true }),
    getOffices({ includeInactive: true }),
    getBarangays(),
    supabase.from("report_events").select("*").eq("report_id", report.id).order("created_at"),
    supabase.from("volunteers").select("user_id, display_name"),
  ]);
  const officesById = byId(offices);
  const names = new Map((volunteers ?? []).map((v) => [v.user_id as string, v.display_name as string]));
  const office = report.office_id ? officesById.get(report.office_id) : undefined;
  const publicPhotos = details.photos.filter((p) => p.public_path && !p.hidden);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-2xl font-bold text-navy">{report.public_code}</h1>
        <StatusBadge status={report.status} />
        <Button variant="link" nativeButton={false} render={<Link href={`/r/${report.public_code}`} />}>
          Public page
        </Button>
      </div>
      <p className="text-muted-foreground">
        Responsible Office: <span className="font-medium text-foreground">{office ? `${office.name_en} (${office.short_name})` : "—"}</span>
      </p>

      <ReportFacts
        report={report}
        category={categories.find((c) => c.id === report.category_id)}
        barangay={barangays.find((b) => b.id === report.barangay_id)}
        answers={details.answers}
      />

      {publicPhotos.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {publicPhotos.map((p) => (
            <li key={p.id} className="relative aspect-square overflow-hidden rounded-lg bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element -- Supabase storage URL */}
              <img src={publicPhotoUrl(p.public_path!)} alt="" className="size-full object-cover" />
              {p.kind === "after" && (
                <span className="absolute bottom-1 left-1 rounded bg-navy px-1.5 text-xs text-navy-foreground">after</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {can(me, "reports.edit") && ["published", "forwarded", "reopened"].includes(report.status) && (
          <ResolveForm reportId={report.id} />
        )}

        {can(me, "reports.edit") && report.status === "forwarded" && (
          <Card>
            <ActionForm
              schema="misroute"
              action={misrouteReport.bind(null, report.id)}
              className="contents"
              success="Reassigned. It will go out in the new office's next Digest."
            >
              <CardHeader>
                <CardTitle>Misroute</CardTitle>
                <CardDescription>
                  The office says this is not theirs. Reassign it; it returns to Published for the right office’s next Digest.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="misroute-office">Correct Responsible Office</FieldLabel>
                    <NativeSelect id="misroute-office" name="office_id" required defaultValue="">
                      <NativeSelectOption value="" disabled>
                        Choose an office
                      </NativeSelectOption>
                      {offices
                        .filter((o) => o.active && o.id !== report.office_id)
                        .map((o) => (
                          <NativeSelectOption key={o.id} value={o.id}>
                            {o.name_en} ({o.short_name})
                          </NativeSelectOption>
                        ))}
                    </NativeSelect>
                    <ActionFieldError name="office_id" />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="misroute-note">What did the office say?</FieldLabel>
                    <Textarea id="misroute-note" name="note" maxLength={500} />
                    <ActionFieldError name="note" />
                  </Field>
                </FieldGroup>
              </CardContent>
              <CardFooter>
                <SubmitButton variant="outline">Reassign</SubmitButton>
              </CardFooter>
            </ActionForm>
          </Card>
        )}

        {can(me, "reports.edit") && report.status === "resolved" && (
          <Card>
            <ActionForm schema="reopen" action={reopenReport.bind(null, report.id)} className="contents" success="Reopened.">
              <CardHeader>
                <CardTitle>Reopen</CardTitle>
              </CardHeader>
              <CardContent>
                <Field>
                  <FieldLabel htmlFor="reopen-note">Why is it not fixed?</FieldLabel>
                  <Textarea id="reopen-note" name="note" maxLength={500} required />
                  <ActionFieldError name="note" />
                </Field>
              </CardContent>
              <CardFooter>
                <SubmitButton variant="outline">Reopen</SubmitButton>
              </CardFooter>
            </ActionForm>
          </Card>
        )}

        {can(me, "reports.archive") && PUBLIC_STATUSES.includes(report.status) && (
          <Card>
            <ActionForm schema="reject" action={rejectReport.bind(null, report.id)} className="contents">
              <input type="hidden" name="preset" value="Taken down" />
              <CardHeader>
                <CardTitle>Take down</CardTitle>
                <CardDescription>Removes it from the public board (e.g. a privacy problem found later).</CardDescription>
              </CardHeader>
              <CardContent>
                <Field>
                  <FieldLabel htmlFor="takedown-reason">Reason</FieldLabel>
                  <Textarea id="takedown-reason" name="reason" maxLength={500} required />
                  <ActionFieldError name="reason" />
                </Field>
              </CardContent>
              <CardFooter>
                <SubmitButton variant="destructive">Take down</SubmitButton>
              </CardFooter>
            </ActionForm>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="ml-1 flex flex-col gap-3 border-l-2 pl-4">
            {((events ?? []) as ReportEvent[]).map((event) => (
              <li key={event.id}>
                <span className="font-medium">{describeEvent(event, officesById)}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {new Date(event.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}
                  {event.actor_id && ` · ${names.get(event.actor_id) ?? "Volunteer"}`}
                </span>
                {event.note && <p className="text-muted-foreground">“{event.note}”</p>}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </>
  );
}

function describeEvent(event: ReportEvent, offices: Map<string, { short_name: string }>) {
  const office = (id: string | null) => (id ? (offices.get(id)?.short_name ?? "?") : "none");
  switch (event.kind) {
    case "submitted":
      return "Submitted";
    case "status_changed":
      return `${event.from_status?.replace("_", " ")} → ${event.to_status?.replace("_", " ")}`;
    case "office_changed":
      return `Office ${office(event.previous_office_id)} → ${office(event.office_id)}`;
    case "category_changed":
      return "Category changed";
    case "misrouted":
      return `Misroute: ${office(event.previous_office_id)} → ${office(event.office_id)}`;
    default:
      return "Note";
  }
}
