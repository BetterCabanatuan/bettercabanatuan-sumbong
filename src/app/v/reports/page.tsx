import { FileText, X } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { AutoSubmitForm } from "@/components/volunteer/auto-submit-form";
import { DataView } from "@/components/volunteer/data-view";
import { ListHeader } from "@/components/volunteer/list-header";
import { ReportSelection } from "@/components/volunteer/report-selection";
import { can, requirePermission } from "@/lib/auth";
import { byId, getBarangays, getCategories, getOffices, getReports } from "@/lib/data";
import { resolveView } from "@/lib/data-view";
import { parseReportFilters, reportFilterChips, reportFiltersToSearch } from "@/lib/report-filters";
import { STATUS_LABEL_EN, STATUS_ORDER } from "@/lib/status";

function day(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", { timeZone: "Asia/Manila" });
}

export default async function VolunteerReportsPage({ searchParams }: PageProps<"/v/reports">) {
  const me = await requirePermission("reports.view");
  const params = await searchParams;
  const view = resolveView("reports", params, await cookies());
  const filters = parseReportFilters(params);

  const [reports, categories, offices, barangays] = await Promise.all([
    getReports({ ...filters, limit: 300 }),
    getCategories({ includeInactive: true }),
    getOffices({ includeInactive: true }),
    getBarangays(),
  ]);
  const categoriesById = byId(categories);
  const officesById = byId(offices);
  const barangaysById = byId(barangays);
  const status = filters.statuses?.[0];
  const filtered = Boolean(status || filters.officeId || filters.barangayId);
  const chips = reportFilterChips(
    filters,
    {
      status: (s) => STATUS_LABEL_EN[s],
      office: (id) => officesById.get(id)?.short_name,
      barangay: (id) => barangaysById.get(id)?.name,
    },
    view,
  );

  return (
    <>
      <ListHeader
        title="Reports"
        screen="reports"
        view={view}
        exportHref={can(me, "reports.export") ? `/v/reports/export?${reportFiltersToSearch(filters)}` : null}
      />
      <AutoSubmitForm method="get" className="grid items-end gap-3 sm:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
        <input type="hidden" name="view" value={view} />
        <Field>
          <FieldLabel htmlFor="f-status">Status</FieldLabel>
          <NativeSelect id="f-status" name="status" defaultValue={status ?? ""}>
            <NativeSelectOption value="">All statuses</NativeSelectOption>
            {STATUS_ORDER.map((s) => (
              <NativeSelectOption key={s} value={s}>
                {STATUS_LABEL_EN[s]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="f-office">Responsible Office</FieldLabel>
          <NativeSelect id="f-office" name="office" defaultValue={filters.officeId ?? ""}>
            <NativeSelectOption value="">All offices</NativeSelectOption>
            {offices.map((o) => (
              <NativeSelectOption key={o.id} value={o.id}>
                {o.short_name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="f-barangay">Barangay</FieldLabel>
          <NativeSelect id="f-barangay" name="barangay" defaultValue={filters.barangayId ?? ""}>
            <NativeSelectOption value="">All barangays</NativeSelectOption>
            {barangays.map((b) => (
              <NativeSelectOption key={b.id} value={b.id}>
                {b.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </AutoSubmitForm>

      {chips.length > 0 && (
        <ul className="-mt-2 flex flex-wrap items-center gap-2" aria-label="Active filters">
          {chips.map((chip) => (
            <li key={chip.key}>
              <Link
                href={chip.href}
                aria-label={`Remove filter ${chip.label}`}
                className="inline-flex items-center gap-1.5 rounded-full border bg-card py-1 pr-2 pl-3 text-sm transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {chip.label}
                <X className="size-3.5 text-muted-foreground" />
              </Link>
            </li>
          ))}
          {chips.length > 1 && (
            <li>
              <Link
                href={`/v/reports?view=${view}`}
                className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                Clear all
              </Link>
            </li>
          )}
        </ul>
      )}

      <ReportSelection>
        <DataView
          selectable={{ id: (r) => r.id, code: (r) => r.public_code, label: (r) => `Select ${r.public_code}` }}
          view={view}
          items={reports}
          itemKey={(r) => r.id}
          titleLabel="Report"
          title={(r) => <span className="font-mono">{r.public_code}</span>}
          subtitle={(r) => r.title ?? categoriesById.get(r.category_id)?.name_en}
          href={(r) => (r.status === "pending_review" && can(me, "reports.review") ? `/v/review/${r.id}` : `/v/reports/${r.id}`)}
          badges={(r) => <StatusBadge status={r.status} labels="en" />}
          fields={[
            { key: "office", label: "Office", value: (r) => (r.office_id ? officesById.get(r.office_id)?.short_name : "—") },
            {
              key: "barangay",
              label: "Barangay",
              value: (r) => (r.barangay_id ? barangaysById.get(r.barangay_id)?.name : "—"),
            },
            { key: "submitted", label: "Submitted", value: (r) => day(r.created_at), hideInList: true },
            { key: "metoo", label: "Me Too", numeric: true, value: (r) => r.me_too_count },
          ]}
          empty={
            filtered
              ? {
                  title: "No Reports match these filters",
                  description: "Try a different Status, Office or Barangay.",
                  icon: FileText,
                  action: (
                    <Button variant="outline" nativeButton={false} render={<Link href="/v/reports" />}>
                      Clear filters
                    </Button>
                  ),
                }
              : {
                  title: "No Reports yet",
                  description: "Reports show up here once residents submit them from the public form.",
                  icon: FileText,
                  action: (
                    <Button variant="outline" nativeButton={false} render={<Link href="/report" />}>
                      Open the public form
                    </Button>
                  ),
                }
          }
        />
        {view === "table" && reports.length > 0 && (
          <p className="hidden text-xs text-muted-foreground md:block">
            Tick Reports to copy their codes. Press <kbd className="rounded border px-1 font-sans">?</kbd> for shortcuts.
          </p>
        )}
      </ReportSelection>
    </>
  );
}
