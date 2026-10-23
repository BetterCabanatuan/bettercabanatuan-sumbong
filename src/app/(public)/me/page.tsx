import { Inbox } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { DeviceReports } from "@/components/me/device-reports";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import { getCurrentUser } from "@/lib/auth";
import { getBarangays, getCategories } from "@/lib/data";
import { reportTitle } from "@/lib/report-title";
import { createClient } from "@/lib/supabase/server";
import type { Locale, Report } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("me");
  return { title: t("title"), robots: { index: false } };
}

/** Reports saved on this device (no account needed), plus the ones followed with an account. */
export default async function MyReportsPage() {
  const user = await getCurrentUser();
  const t = await getTranslations("me");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-navy">{t("title")}</h1>
          {user && <p className="text-sm text-muted-foreground">{t("signedInAs", { email: user.email ?? "" })}</p>}
        </div>
        {user && (
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="outline">
              {t("signOut")}
            </Button>
          </form>
        )}
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">{t("deviceTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("deviceLead")}</p>
        </div>
        <DeviceReports />
      </section>

      {user ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{t("accountTitle")}</h2>
          <AccountReports userId={user.id} />
        </section>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t("signInTitle")}</CardTitle>
            <CardDescription>{t("signInLead")}</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button nativeButton={false} render={<Link href="/login?next=/me" />}>
              {t("signIn")}
            </Button>
          </CardFooter>
        </Card>
      )}
    </main>
  );
}

async function AccountReports({ userId }: { userId: string }) {
  const supabase = await createClient();
  const { data: follows } = await supabase.from("report_followers").select("report_id").eq("user_id", userId);
  const ids = (follows ?? []).map((f) => f.report_id as string);
  const { data } = ids.length
    ? await supabase.from("reports_view").select("*").in("id", ids).order("created_at", { ascending: false })
    : { data: [] };
  const reports = (data ?? []) as Report[];

  const [t, locale, categories, barangays] = await Promise.all([
    getTranslations("me"),
    getLocale() as Promise<Locale>,
    getCategories({ includeInactive: true }),
    getBarangays(),
  ]);

  if (reports.length === 0) {
    return (
      <Empty className="border bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Inbox />
          </EmptyMedia>
          <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
          <EmptyDescription>{t("empty")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button nativeButton={false} render={<Link href="/report" />}>
            {t("cta")}
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <ItemGroup className="gap-3">
      {reports.map((report) => (
        <Item key={report.id} variant="outline" className="bg-card" render={<Link href={`/r/${report.public_code}`} />}>
          <ItemContent>
            <ItemTitle>
              {reportTitle(report, categories.find((c) => c.id === report.category_id), locale)}
              <StatusBadge status={report.status} />
            </ItemTitle>
            <ItemDescription>
              <span className="font-mono">{report.public_code}</span>
              {report.barangay_id && ` · Brgy. ${barangays.find((b) => b.id === report.barangay_id)?.name ?? ""}`}
            </ItemDescription>
          </ItemContent>
        </Item>
      ))}
    </ItemGroup>
  );
}
