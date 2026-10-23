import { cookies } from "next/headers";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { DataView } from "@/components/volunteer/data-view";
import { ListHeader } from "@/components/volunteer/list-header";
import { can, requirePermission } from "@/lib/auth";
import { byId, getBarangays, getCategories, getOffices, getReports } from "@/lib/data";
import { resolveView } from "@/lib/data-view";
import { parseReportFilters, reportFiltersToSearch } from "@/lib/report-filters";
import { STATUS_ORDER } from "@/lib/status";

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

  return (
    <>
      <ListHeader
        title="Reports"
        screen="reports"
        view={view}
        exportHref={can(me, "reports.export") ? `/v/reports/export?${reportFiltersToSearch(filters)}` : null}
      />
      <form method="get" className="grid items-end gap-3 sm:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
        <input type="hidden" name="view" value={view} />
        <Field>
          <FieldLabel htmlFor="f-status">Status</FieldLabel>
          <NativeSelect id="f-status" name="status" defaultValue={status ?? ""}>
            <NativeSelectOption value="">All statuses</NativeSelectOption>
            {STATUS_ORDER.map((s) => (
              <NativeSelectOption key={s} value={s}>
                {s.replace("_", " ")}
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
      </form>

      <DataView
        view={view}
        items={reports}
        itemKey={(r) => r.id}
        titleLabel="Report"
        title={(r) => <span className="font-mono">{r.public_code}</span>}
        subtitle={(r) => r.title ?? categoriesById.get(r.category_id)?.name_en}
        href={(r) =>
          r.status === "pending_review" && can(me, "reports.review") ? `/v/review/${r.id}` : `/v/reports/${r.id}`
        }
        badges={(r) => <StatusBadge status={r.status} />}
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
        empty="No Reports match."
      />
    </>
  );
}
