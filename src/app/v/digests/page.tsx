import Link from "next/link";
import { createDigest } from "@/app/v/actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActionForm, SubmitButton } from "@/components/volunteer/action-form";
import { byId, getBarangays, getOffices } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import type { Digest } from "@/lib/types";

export default async function DigestsPage({ searchParams }: PageProps<"/v/digests">) {
  const params = await searchParams;
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

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-navy">Digests</h1>
        <p className="max-w-3xl text-muted-foreground">
          Weekly per office, sooner for hazards. A draft takes every Published or Reopened Report for that office that is
          not already in another draft. Print the letter, send it through the office’s channel, then log the send.
        </p>
      </div>

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
                    <ActionForm action={createDigest}>
                      <input type="hidden" name="office_id" value={row.office} />
                      {row.barangay && <input type="hidden" name="barangay_id" value={row.barangay} />}
                      <SubmitButton variant="outline">Create draft</SubmitButton>
                    </ActionForm>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Card className="pb-0">
        <CardHeader>
          <CardTitle>Drafts and sent</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Status</TableHead>
              <TableHead>Office</TableHead>
              <TableHead>Reports</TableHead>
              <TableHead className="pr-4 text-right">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {digests
              .filter((d) => !officeFilter || d.office_id === officeFilter)
              .map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="pl-4">
                    <Link href={`/v/digests/${d.id}`}>
                      <Badge
                        className={
                          d.sent_at
                            ? "bg-status-resolved text-status-resolved-foreground"
                            : "bg-status-published text-status-published-foreground"
                        }
                      >
                        {d.sent_at ? "Sent" : "Draft"}
                      </Badge>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/v/digests/${d.id}`} className="font-medium text-primary underline">
                      {officesById.get(d.office_id)?.short_name}
                      {d.barangay_id && ` · Brgy. ${barangaysById.get(d.barangay_id)?.name}`}
                    </Link>
                  </TableCell>
                  <TableCell className="tabular-nums">{d.digest_reports[0]?.count ?? 0}</TableCell>
                  <TableCell className="pr-4 text-right text-muted-foreground">
                    {new Date(d.sent_at ?? d.created_at).toLocaleDateString("en-PH", { timeZone: "Asia/Manila" })}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
