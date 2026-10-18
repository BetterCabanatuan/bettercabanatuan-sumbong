import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ReportForm } from "@/components/report-form/report-form";
import { getCurrentUser } from "@/lib/auth";
import { getCategories } from "@/lib/data";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("reportForm");
  return { title: t("pageTitle") };
}

export default async function NewReportPage() {
  const [t, categories, user] = await Promise.all([getTranslations("reportForm"), getCategories(), getCurrentUser()]);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-6">
      <h1 className="text-2xl font-bold text-navy sm:text-3xl">{t("pageTitle")}</h1>
      <ReportForm
        categories={categories}
        turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""}
        signedInEmail={user?.email ?? null}
      />
    </main>
  );
}
