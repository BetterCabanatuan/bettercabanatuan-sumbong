import { ReportsMap } from "@/components/map";
import { Card, CardContent } from "@/components/ui/card";
import { STATUS_MARKER } from "@/lib/status";
import type { Barangay, Category, Report, ReportAnswer } from "@/lib/types";

/** The facts of a Report as Volunteers see them (English labels). */
export function ReportFacts({
  report,
  category,
  barangay,
  answers,
}: {
  report: Report;
  category?: Category;
  barangay?: Barangay;
  answers: ReportAnswer[];
}) {
  const rows: [string, string][] = [
    ["Title", report.title ?? "—"],
    ["Category", category?.name_en ?? "Unknown"],
    ["Barangay", barangay?.name ?? "Not tagged"],
    ["Landmark", report.landmark ?? "—"],
    ["Coordinates", `${report.lat.toFixed(6)}, ${report.lng.toFixed(6)}`],
    ["Submitted", new Date(report.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })],
    ["Me Too", String(report.me_too_count)],
    ...answers.map((a): [string, string] => [a.prompt_en, a.value]),
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card size="sm">
        <CardContent>
          <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-4 gap-y-2">
            {rows.map(([term, value]) => (
              <div key={term} className="contents">
                <dt className="text-muted-foreground">{term}</dt>
                <dd className="break-words">{value}</dd>
              </div>
            ))}
          </dl>
          {report.description && (
            <div className="mt-4 flex flex-col gap-1 border-t pt-4">
              <p className="text-muted-foreground">Description</p>
              <p className="whitespace-pre-line">{report.description}</p>
            </div>
          )}
        </CardContent>
      </Card>
      <Card size="sm" className="min-h-72 py-0">
        <ReportsMap
          className="size-full min-h-72"
          reports={[
            {
              id: report.id,
              code: report.public_code,
              lat: report.lat,
              lng: report.lng,
              color: STATUS_MARKER[report.status],
              title: report.title ?? category?.name_en ?? report.public_code,
              statusLabel: report.status,
            },
          ]}
        />
      </Card>
    </div>
  );
}
