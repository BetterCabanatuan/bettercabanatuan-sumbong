"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Inbox } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { type MapReport, ReportsMap } from "@/components/map";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { BOARD_SORTS, type BoardSort, boardListOptions, boardMapOptions, parseBoardFilters } from "@/lib/board";
import { reportTitle } from "@/lib/report-title";
import { STATUS_MARKER } from "@/lib/status";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/lib/types";
import { BoardFilterSheet, useBoardNavigation } from "./board-filters";
import { ReportCard } from "./report-card";
import type { BoardLookups } from "./types";

type Mode = "list" | "map";

/**
 * The feedback board. Filters live in the URL; TanStack Query owns the data: the first page
 * arrives hydrated from the server, later pages load as you scroll.
 */
export function Board({ lookups }: { lookups: BoardLookups }) {
  const t = useTranslations("board");
  const searchParams = useSearchParams();
  const filters = useMemo(() => parseBoardFilters(Object.fromEntries(searchParams.entries())), [searchParams]);
  const categoryId = lookups.categories.find((c) => c.slug === filters.category)?.id ?? null;
  const supabase = useMemo(() => createClient(), []);
  const { update } = useBoardNavigation(filters);
  const [mode, setMode] = useState<Mode>("list");

  return (
    <section className="flex min-w-0 flex-1 flex-col gap-4" aria-label={t("listLabel")}>
      <div className="flex flex-wrap items-center gap-2">
        {/* On phones the sort options scroll inside their own row instead of widening the page. */}
        <div className="-mx-4 w-[calc(100%+2rem)] [scrollbar-width:none] overflow-x-auto px-4 sm:mx-0 sm:w-auto sm:px-0">
          <ToggleGroup
            value={[filters.sort]}
            onValueChange={(value) => value[0] && update({ sort: value[0] as BoardSort })}
            variant="outline"
            spacing={0}
            aria-label={t("sort.label")}
          >
            {BOARD_SORTS.map((sort) => (
              <ToggleGroupItem key={sort} value={sort}>
                {t(`sort.${sort}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <BoardFilterSheet filters={filters} lookups={lookups} />
          <ToggleGroup
            value={[mode]}
            onValueChange={(value) => value[0] && setMode(value[0] as Mode)}
            variant="outline"
            spacing={0}
            aria-label={t("mode.label")}
          >
            <ToggleGroupItem value="list">{t("mode.list")}</ToggleGroupItem>
            <ToggleGroupItem value="map">{t("mode.map")}</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {mode === "list" ? (
        <BoardList supabase={supabase} filters={filters} categoryId={categoryId} lookups={lookups} />
      ) : (
        <BoardMap supabase={supabase} filters={filters} categoryId={categoryId} lookups={lookups} />
      )}
    </section>
  );
}

type QueryProps = {
  supabase: ReturnType<typeof createClient>;
  filters: ReturnType<typeof parseBoardFilters>;
  categoryId: string | null;
  lookups: BoardLookups;
};

function BoardList({ supabase, filters, categoryId, lookups }: QueryProps) {
  const t = useTranslations("board");
  const query = useInfiniteQuery(boardListOptions(supabase, filters, categoryId));
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  // Load the next page when the end of the list scrolls into view.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[106px] rounded-xl" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>{t("error.title")}</EmptyTitle>
          <EmptyDescription>{t("error.description")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" onClick={() => query.refetch()}>
            {t("error.retry")}
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  const reports = query.data.pages.flatMap((page) => page.items);
  if (reports.length === 0) {
    return (
      <Empty className="border bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Inbox />
          </EmptyMedia>
          <EmptyTitle>{t("empty.title")}</EmptyTitle>
          <EmptyDescription>{t("empty.description")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button nativeButton={false} render={<Link href="/report" />}>
            {t("empty.cta")}
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3">
        {reports.map((report) => (
          <li key={report.id}>
            <ReportCard report={report} lookups={lookups} />
          </li>
        ))}
      </ul>
      <div ref={sentinel} />
      {hasNextPage && (
        <Button variant="outline" className="self-center" disabled={isFetchingNextPage} onClick={() => fetchNextPage()}>
          {isFetchingNextPage && <Spinner data-icon="inline-start" />}
          {t("loadMore")}
        </Button>
      )}
    </div>
  );
}

function BoardMap({ supabase, filters, categoryId, lookups }: QueryProps) {
  const tStatus = useTranslations("status");
  const locale = useLocale() as Locale;
  const query = useQuery(boardMapOptions(supabase, filters, categoryId));

  const markers: MapReport[] = (query.data ?? []).map((point) => ({
    id: point.id,
    code: point.public_code,
    lat: point.lat,
    lng: point.lng,
    color: STATUS_MARKER[point.status],
    title: reportTitle(
      { title: point.title, landmark: null, public_code: point.public_code },
      lookups.categories.find((c) => c.id === point.category_id),
      locale,
    ),
    statusLabel: tStatus(point.status),
  }));

  return (
    <div className="h-[65svh] min-h-80 overflow-hidden rounded-xl border bg-card" aria-busy={query.isPending}>
      {query.isPending ? (
        <Skeleton className="size-full rounded-none" />
      ) : (
        <ReportsMap reports={markers} className="size-full" />
      )}
    </div>
  );
}
