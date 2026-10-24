import { cookies } from "next/headers";
import { createDigest } from "@/app/v/actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { ActionForm, SubmitButton } from "@/components/volunteer/action-form";
import { DataView } from "@/components/volunteer/data-view";
import { ListHeader } from "@/components/volunteer/list-header";
import { can, requirePermission } from "@/lib/auth";
import { byId, getBarangays, getOffices } from "@/lib/data";
import { resolveView } from "@/lib/data-view";
import { createClient } from "@/lib/supabase/server";
import type { Digest } from "@/lib/types";

function day(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", { timeZone: "Asia/Manila" });
}

export default async function DigestsPage({ searchParams }: PageProps<"/v/digests">) {
  const me = await requirePermission("digests.view");
  const params = await searchParams;
  const view = resolveView("digests", params, await cookies());
  const officeFilter = typeof params.office === "string" ? params.office : undefined;

  const supabase = await createClient();
  const [offices, barangays, { data: waiting }, { data: digestRows }] = await Promise.all([
    getOffices(),
    getBarangays(),
    supabase.from("reports").select("office_id, barangay_id").in("status", ["published", "reopened"]),
    supabase.from("digests").select("*, digest_reports(count)").order("created_at", { ascending: false }).limit(100),
  ]);
  const barangaysById = byId(barangays);
  const officesById = byId(offices);
  const digests = (digestRows ?? []) as (Digest & { digest_reports: { count: number }[] })[];

  // Waiting Reports per office, and per barangay for per-barangay offices.
  const ready = new Map<string, { office: string; barangay: number | null; count: number }>();
  for (const row of waiting ?? []) {
    const office = officesById.get(row.office_id);
    if (!office) continue;
    const barangay = office.scope === "per_barangay" ? row.barangay_id : null;
    const key = `${row.office_id}:${barangay ?? ""}`;
    const entry = ready.get(key) ?? { office: row.office_id, barangay, count: 0 };
    entry.count += 1;
    ready.set(key, entry);
  }
  const readyRows = [...ready.values()].filter((r) => !officeFilter || r.office === officeFilter);
  const listed = digests.filter((d) => !officeFilter || d.office_id === officeFilter);

  return (
    <>
      <ListHeader
        title="Digests"
        description="Weekly per office, sooner for hazards. A draft takes every Published or Reopened Report for that office that is not already in another draft. Print the letter, send it through the office’s channel, then log the send."
        screen="digests"
        view={view}
        exportHref={can(me, "digests.export") ? `/v/digests/export${officeFilter ? `?office=${officeFilter}` : ""}` : null}
      />

      <Card className="pb-0">
        <CardHeader>
          <CardTitle>Ready to send</CardTitle>
          <CardDescription>Reports waiting per Responsible Office.</CardDescription>
        </CardHeader>
        {readyRows.length === 0 ? (
          <p className="px-4 pb-4 text-muted-foreground">Nothing waiting.</p>
        ) : (
          <Table>
            <TableBody>
              {readyRows.map((row) => (
                <TableRow key={`${row.office}:${row.barangay}`}>
                  <TableCell className="pl-4">
                    <span className="font-medium">{officesById.get(row.office)?.name_en}</span>
                    {row.barangay && <span> · Brgy. {barangaysById.get(row.barangay)?.name}</span>}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{row.count} waiting</TableCell>
                  <TableCell className="pr-4 text-right">
                    {can(me, "digests.add") && (
                      <ActionForm schema="createDigest" action={createDigest}>
                        <input type="hidden" name="office_id" value={row.office} />
                        {row.barangay && <input type="hidden" name="barangay_id" value={row.barangay} />}
                        <SubmitButton variant="outline">Create draft</SubmitButton>
                      </ActionForm>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <section className="flex flex-col gap-3" aria-labelledby="digests-heading">
        <h2 id="digests-heading" className="text-lg font-semibold">
          Drafts and sent
        </h2>
        <DataView
          view={view}
          items={listed}
          itemKey={(d) => d.id}
          titleLabel="Office"
          title={(d) => (
            <>
              {officesById.get(d.office_id)?.short_name}
              {d.barangay_id && ` · Brgy. ${barangaysById.get(d.barangay_id)?.name}`}
            </>
          )}
          subtitle={(d) => officesById.get(d.office_id)?.name_en}
          href={(d) => `/v/digests/${d.id}`}
          badges={(d) => (
            <Badge
              className={
                d.sent_at
                  ? "bg-status-resolved text-status-resolved-foreground"
                  : "bg-status-published text-status-published-foreground"
              }
            >
              {d.sent_at ? "Sent" : "Draft"}
            </Badge>
          )}
          fields={[
            { key: "reports", label: "Reports", numeric: true, value: (d) => d.digest_reports[0]?.count ?? 0 },
            { key: "date", label: "Date", value: (d) => day(d.sent_at ?? d.created_at) },
            { key: "channel", label: "Sent via", value: (d) => d.channel?.replace("_", " ") ?? "—", hideInList: true },
          ]}
          empty="No Digests yet."
        />
      </section>
    </>
  );
}
