import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { byId, getBarangays, getCategories, getOffices, getReports } from "@/lib/data";
import { STATUS_ORDER } from "@/lib/status";
import type { ReportStatus } from "@/lib/types";

export default async function VolunteerReportsPage({ searchParams }: PageProps<"/v/reports">) {
  const params = await searchParams;
  const status = STATUS_ORDER.includes(params.status as ReportStatus) ? (params.status as ReportStatus) : undefined;
  const officeId = typeof params.office === "string" && params.office ? params.office : undefined;
  const barangayId = typeof params.barangay === "string" && params.barangay ? Number(params.barangay) : undefined;

  const [reports, categories, offices, barangays] = await Promise.all([
    getReports({ statuses: status ? [status] : undefined, officeId, barangayId, limit: 300 }),
    getCategories({ includeInactive: true }),
    getOffices({ includeInactive: true }),
    getBarangays(),
  ]);
  const categoriesById = byId(categories);
  const officesById = byId(offices);
  const barangaysById = byId(barangays);

  return (
    <>
      <h1 className="text-2xl font-bold text-navy">Reports</h1>
      <form method="get" className="grid items-end gap-3 sm:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
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
          <NativeSelect id="f-office" name="office" defaultValue={officeId ?? ""}>
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
          <NativeSelect id="f-barangay" name="barangay" defaultValue={barangayId ?? ""}>
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

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Code</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Office</TableHead>
              <TableHead>Barangay</TableHead>
              <TableHead className="pr-4 text-right">Me Too</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="pl-4 font-mono">
                  <Link
                    href={r.status === "pending_review" ? `/v/review/${r.id}` : `/v/reports/${r.id}`}
                    className="text-primary underline"
                  >
                    {r.public_code}
                  </Link>
                </TableCell>
                <TableCell>
                  <StatusBadge status={r.status} />
                </TableCell>
                <TableCell className="max-w-72 truncate">{r.title ?? categoriesById.get(r.category_id)?.name_en}</TableCell>
                <TableCell>{r.office_id ? officesById.get(r.office_id)?.short_name : "—"}</TableCell>
                <TableCell>{r.barangay_id ? barangaysById.get(r.barangay_id)?.name : "—"}</TableCell>
                <TableCell className="pr-4 text-right tabular-nums">{r.me_too_count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {reports.length === 0 && <p className="p-4 text-center text-muted-foreground">No Reports match.</p>}
      </Card>
    </>
  );
}
