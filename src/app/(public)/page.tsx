import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { Plus, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Board } from "@/components/board/board";
import { BoardFilterRail } from "@/components/board/board-filters";
import { CodeLookup } from "@/components/board/code-lookup";
import type { BoardLookups } from "@/components/board/types";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { boardListOptions, parseBoardFilters, parseBoardMode } from "@/lib/board";
import { activityStrip } from "@/lib/board-stats";
import { getBarangays, getBoardStats, getCategories, getOffices } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

/** "{n} new this week · {m} resolved this month", or nothing when there is nothing true worth saying. */
async function ActivityStrip() {
  const strip = activityStrip(await getBoardStats());
  if (!strip) return null;
  const t = await getTranslations("board.stats");
  const parts = [
    strip.week !== null && t("week", { count: strip.week }),
    strip.month !== null && t("month", { count: strip.month }),
  ].filter(Boolean);
  return (
    <p aria-label={t("label")} className="text-sm font-medium text-navy">
      {parts.join(" · ")}
    </p>
  );
}

export default async function BoardPage({ searchParams }: PageProps<"/">) {
  const query = await searchParams;
  const filters = parseBoardFilters(query);
  // The map view gives the list and the map the full width, so the side columns step aside.
  const wide = parseBoardMode(query) === "map";
  const [t, categories, barangays, offices, supabase] = await Promise.all([
    getTranslations("board"),
    getCategories(),
    getBarangays(),
    getOffices({ includeInactive: true }),
    createClient(),
  ]);
  const lookups: BoardLookups = {
    categories,
    barangays,
    offices: offices.map(({ id, short_name, name_en, name_fil }) => ({ id, short_name, name_en, name_fil })),
  };
  const categoryId = categories.find((c) => c.slug === filters.category)?.id ?? null;

  // First page renders on the server; the browser's TanStack Query cache picks it up.
  const queryClient = new QueryClient();
  await queryClient.prefetchInfiniteQuery(boardListOptions(supabase, filters, categoryId));

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-6 pb-28 md:pb-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex max-w-2xl flex-col gap-1.5">
          <h1 className="text-2xl font-bold text-navy sm:text-3xl">{t("title")}</h1>
          <p className="text-muted-foreground">{t("lead")}</p>
          {/* Streams in after the first paint, so the two counts never delay the board. */}
          <Suspense fallback={null}>
            <ActivityStrip />
          </Suspense>
        </div>
        <Button size="lg" nativeButton={false} render={<Link href="/report" />} className="hidden h-11 px-5 text-base md:inline-flex">
          <Plus data-icon="inline-start" />
          {t("cta")}
        </Button>
      </div>

      {/* Below xl the right-hand column is gone, so the emergency line and the steps move up here. */}
      <div className={cn("flex flex-col gap-3", !wide && "xl:hidden")}>
        <Alert variant="destructive" role="note" className="bg-card">
          <TriangleAlert />
          <AlertDescription>
            <a href="tel:09088811010" className="font-semibold underline underline-offset-2">
              {t("emergency.short")}
            </a>
          </AlertDescription>
        </Alert>
        <div className="grid items-start gap-3 md:grid-cols-2">
          <CodeLookup />
          <Accordion className="rounded-lg border bg-card px-3 md:mt-[1.625rem]">
            <AccordionItem value="how" className="border-b-0">
              <AccordionTrigger className="items-center py-3 text-sm">{t("how.toggle")}</AccordionTrigger>
              <AccordionContent>
                <ol className="flex list-decimal flex-col gap-2 pb-1 pl-5 text-muted-foreground">
                  <li>{t("how.step1")}</li>
                  <li>{t("how.step2")}</li>
                  <li>{t("how.step3")}</li>
                  <li>{t("how.step4")}</li>
                </ol>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>

      <div className="flex items-start gap-6">
        {!wide && <BoardFilterRail filters={filters} lookups={lookups} />}
        <HydrationBoundary state={dehydrate(queryClient)}>
          <Suspense fallback={<Skeleton className="h-96 flex-1 rounded-xl" />}>
            <Board lookups={lookups} />
          </Suspense>
        </HydrationBoundary>
        {!wide && (
          <aside className="hidden w-72 shrink-0 flex-col gap-4 xl:flex">
            <CodeLookup />
            <Card className="bg-navy text-navy-foreground ring-0">
              <CardHeader>
                <CardTitle>{t("how.title")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-navy-foreground/85">
                  <li>{t("how.step1")}</li>
                  <li>{t("how.step2")}</li>
                  <li>{t("how.step3")}</li>
                  <li>{t("how.step4")}</li>
                </ol>
              </CardContent>
            </Card>
            <Alert variant="destructive" className="bg-card">
              <TriangleAlert />
              <AlertTitle>{t("emergency.title")}</AlertTitle>
              <AlertDescription>{t("emergency.body")}</AlertDescription>
            </Alert>
          </aside>
        )}
      </div>

      <div className="no-print fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
        <Button size="lg" nativeButton={false} render={<Link href="/report" />} className="h-12 w-full text-base">
          <Plus data-icon="inline-start" />
          {t("cta")}
        </Button>
      </div>
    </main>
  );
}
