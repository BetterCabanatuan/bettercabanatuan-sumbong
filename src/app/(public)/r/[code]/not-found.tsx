import { SearchX } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

/**
 * Shown for a wrong code and for a Report that isn't public, with exactly the same words, so the
 * page can't be used to find out which codes exist.
 */
export default async function ReportNotFound() {
  const t = await getTranslations("reportPage.notFound");
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-12">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchX />
          </EmptyMedia>
          <EmptyTitle>{t("title")}</EmptyTitle>
          <EmptyDescription>{t("body")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="flex-row flex-wrap justify-center">
          <Button nativeButton={false} render={<Link href="/me" />}>
            {t("myReports")}
          </Button>
          <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
            {t("home")}
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  );
}
