import { ListChecks } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BlurFade } from "@/components/ui/blur-fade";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NumberTicker } from "@/components/ui/number-ticker";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NeedsYou } from "@/components/volunteer/needs-you";
import { can, requireVolunteer } from "@/lib/auth";
import { getOffices } from "@/lib/data";
import { env } from "@/lib/env";
import { STATUS_ORDER } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import type { ReportStatus } from "@/lib/types";

/** Sections arrive 60 ms apart, once; the rest of the console never animates on load. */
const STAGGER = 0.06;

export default async function VolunteerDashboard({ searchParams }: PageProps<"/v">) {
  const me = await requireVolunteer();
  const params = await searchParams;
  const supabase = await createClient();
  // One round trip: the counts, the oldest Report waiting for Review, and unsent Digests.
  const [{ data: rows }, offices, { data: oldest }, { count: drafts }] = await Promise.all([
    supabase.from("reports").select("status, office_id"),
    getOffices(),
    supabase
      .from("reports")
      .select("created_at")
      .eq("status", "pending_review")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase.from("digests").select("id", { count: "exact", head: true }).is("sent_at", null),
  ]);

  const byStatus = new Map<ReportStatus, number>();
  const waitingByOffice = new Map<string, number>();
  for (const row of rows ?? []) {
    byStatus.set(row.status, (byStatus.get(row.status) ?? 0) + 1);
    if ((row.status === "published" || row.status === "reopened") && row.office_id) {
      waitingByOffice.set(row.office_id, (waitingByOffice.get(row.office_id) ?? 0) + 1);
    }
  }
  const officeRows = offices.map((office) => ({ office, waiting: waitingByOffice.get(office.id) ?? 0 }));
  const withReports = officeRows.filter((r) => r.waiting > 0).sort((a, b) => b.waiting - a.waiting);
  const nothingWaiting = officeRows.filter((r) => r.waiting === 0);
  const canOpenDigests = can(me, "digests.view");
  const isFirstRun = (rows?.length ?? 0) === 0 && (can(me, "categories.edit") || can(me, "offices.edit"));

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-navy">Dashboard</h1>
        <p className="text-muted-foreground">Review new Reports first, then send this week’s Digests.</p>
      </div>
      {params.forbidden && (
        <Alert>
          <AlertDescription>Your role doesn’t include that page. Ask someone who manages users if you need it.</AlertDescription>
        </Alert>
      )}

      {isFirstRun && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="size-4" /> Before the first Report
            </CardTitle>
            <CardDescription>Nothing has been submitted yet. Three things to check first.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">
              <li>
                Share the public form link: <span className="font-mono">{env.siteUrl}/report</span>
              </li>
              {can(me, "offices.view") ? (
                <li>
                  <Link href="/v/settings/offices" className="text-primary underline underline-offset-4">
                    Check every Responsible Office has a way to be reached
                  </Link>
                </li>
              ) : (
                <li>Check every Responsible Office has a way to be reached</li>
              )}
              {can(me, "categories.view") ? (
                <li>
                  <Link href="/v/settings/categories" className="text-primary underline underline-offset-4">
                    Check the Categories residents will see
                  </Link>
                </li>
              ) : (
                <li>Check the Categories residents will see</li>
              )}
            </ol>
          </CardContent>
        </Card>
      )}

      <BlurFade direction="up" delay={0}>
        <NeedsYou
          permissions={me.permissions}
          pending={byStatus.get("pending_review") ?? 0}
          oldestPendingAt={oldest?.created_at ?? null}
          officesWaiting={waitingByOffice.size}
          drafts={drafts ?? 0}
        />
      </BlurFade>

      <BlurFade direction="up" delay={STAGGER}>
        <section aria-label="Reports by status" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {STATUS_ORDER.map((status) => {
            const tile = (
              <Card
                size="sm"
                className="h-full transition-[transform,background-color] duration-160 ease-out motion-safe:hover:-translate-y-0.5 hover:bg-muted/50"
              >
                <CardContent className="flex flex-col items-start gap-2">
                  <StatusBadge status={status} labels="en" />
                  <NumberTicker value={byStatus.get(status) ?? 0} className="text-3xl font-bold" />
                </CardContent>
              </Card>
            );
            const href =
              status === "pending_review"
                ? can(me, "reports.review") && "/v/review"
                : can(me, "reports.view") && `/v/reports?status=${status}`;
            return href ? (
              <Link key={status} href={href} className="block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                {tile}
              </Link>
            ) : (
              <div key={status}>{tile}</div>
            );
          })}
        </section>
      </BlurFade>

      <BlurFade direction="up" delay={STAGGER * 2}>
        <Card>
          <CardHeader>
            <CardTitle>Waiting for the next Digest</CardTitle>
            <CardDescription>Published and Reopened Reports per Responsible Office.</CardDescription>
            {canOpenDigests && (
              <CardAction>
                <Button variant="outline" nativeButton={false} render={<Link href="/v/digests" />}>
                  Go to Digests
                </Button>
              </CardAction>
            )}
          </CardHeader>
          {withReports.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Office</TableHead>
                  <TableHead className="pr-4 text-right">Waiting</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withReports.map(({ office, waiting }) => (
                  <TableRow key={office.id}>
                    <TableCell className="pl-4">
                      {canOpenDigests ? (
                        <Link
                          href={`/v/digests?office=${office.id}`}
                          className="font-medium text-primary underline-offset-4 hover:underline"
                        >
                          {office.short_name}
                        </Link>
                      ) : (
                        <span className="font-medium">{office.short_name}</span>
                      )}{" "}
                      <span className="text-muted-foreground">{office.name_en}</span>
                    </TableCell>
                    <TableCell className="pr-4 text-right font-semibold tabular-nums">{waiting}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {nothingWaiting.length > 0 && (
            <details className="px-4 text-sm text-muted-foreground">
              <summary className="cursor-pointer rounded-sm py-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                {nothingWaiting.length} {nothingWaiting.length === 1 ? "office has" : "offices have"} nothing waiting.
              </summary>
              <ul className="flex flex-col gap-1 py-2">
                {nothingWaiting.map(({ office }) => (
                  <li key={office.id}>
                    {office.short_name} <span>· {office.name_en}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Card>
      </BlurFade>
    </>
  );
}
