import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getOffices } from "@/lib/data";
import { STATUS_ORDER } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import type { ReportStatus } from "@/lib/types";

export default async function VolunteerDashboard({ searchParams }: PageProps<"/v">) {
  const params = await searchParams;
  const supabase = await createClient();
  const [{ data: rows }, offices] = await Promise.all([supabase.from("reports").select("status, office_id"), getOffices()]);

  const byStatus = new Map<ReportStatus, number>();
  const waitingByOffice = new Map<string, number>();
  for (const row of rows ?? []) {
    byStatus.set(row.status, (byStatus.get(row.status) ?? 0) + 1);
    if ((row.status === "published" || row.status === "reopened") && row.office_id) {
      waitingByOffice.set(row.office_id, (waitingByOffice.get(row.office_id) ?? 0) + 1);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-navy">Dashboard</h1>
        <p className="text-muted-foreground">Review new Reports first, then send this week’s Digests.</p>
      </div>
      {params.coordinator_only && (
        <Alert>
          <AlertDescription>That page is for Coordinators only.</AlertDescription>
        </Alert>
      )}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {STATUS_ORDER.map((status) => (
          <Link key={status} href={status === "pending_review" ? "/v/review" : `/v/reports?status=${status}`}>
            <Card size="sm" className="h-full transition-colors hover:bg-muted/50">
              <CardContent className="flex flex-col items-start gap-2">
                <StatusBadge status={status} />
                <span className="text-3xl font-bold tabular-nums">{byStatus.get(status) ?? 0}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Waiting for the next Digest</CardTitle>
          <CardDescription>Published and Reopened Reports per Responsible Office.</CardDescription>
          <CardAction>
            <Button variant="outline" nativeButton={false} render={<Link href="/v/digests" />}>
              Go to Digests
            </Button>
          </CardAction>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Office</TableHead>
              <TableHead className="pr-4 text-right">Waiting</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {offices.map((office) => (
              <TableRow key={office.id}>
                <TableCell className="pl-4">
                  {office.name_en} <span className="text-muted-foreground">({office.short_name})</span>
                </TableCell>
                <TableCell className="pr-4 text-right font-semibold tabular-nums">{waitingByOffice.get(office.id) ?? 0}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
