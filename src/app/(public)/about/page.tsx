import { Plus, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { ReportStatus } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("about");
  return { title: t("title") };
}

const FLOW: ReportStatus[] = ["pending_review", "published", "forwarded", "resolved"];

export default async function AboutPage() {
  const t = await getTranslations("about");
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-navy sm:text-3xl">{t("title")}</h1>
        <p className="text-lg text-muted-foreground">{t("intro")}</p>
      </div>
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t("howTitle")}</h2>
        <ol className="ml-2 flex flex-col gap-6 border-l-2 pl-6">
          {FLOW.map((status) => (
            <li key={status} className="relative flex flex-col gap-2">
              <span aria-hidden="true" className="absolute top-1 -left-[33px] size-4 rounded-full bg-primary ring-4 ring-background" />
              <StatusBadge status={status} />
              <p>{t(`steps.${status}`)}</p>
            </li>
          ))}
        </ol>
      </section>
      <Alert className="bg-card">
        <AlertDescription>{t("unofficial")}</AlertDescription>
      </Alert>
      <Alert variant="destructive" className="bg-card">
        <TriangleAlert />
        <AlertDescription className="font-medium">{t("emergency")}</AlertDescription>
      </Alert>
      <Button size="lg" className="h-12 self-start px-6 text-base" nativeButton={false} render={<Link href="/report" />}>
        <Plus data-icon="inline-start" />
        {t("cta")}
      </Button>
    </main>
  );
}
