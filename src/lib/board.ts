import type { SupabaseClient } from "@supabase/supabase-js";
import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import type { Report, ReportStatus } from "@/lib/types";

/** The feedback board's views, sorts and filters. Shared by the server prefetch and the browser. */
export const BOARD_VIEWS = {
  open: ["published", "forwarded", "reopened"],
  resolved: ["resolved"],
  all: ["published", "forwarded", "reopened", "resolved"],
} satisfies Record<string, ReportStatus[]>;
export type BoardView = keyof typeof BOARD_VIEWS;

export const BOARD_SORTS = ["top", "new", "active"] as const;
export type BoardSort = (typeof BOARD_SORTS)[number];

export interface BoardFilters {
  view: BoardView;
  sort: BoardSort;
  category: string | null;
  barangay: number | null;
}

export const PAGE_SIZE = 20;

/** Parses board filters from URL search params, falling back to the defaults. */
export function parseBoardFilters(params: Record<string, string | string[] | undefined>): BoardFilters {
  const one = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : null);
  const view = one("view");
  const sort = one("sort");
  const barangay = Number(one("barangay"));
  return {
    view: view && view in BOARD_VIEWS ? (view as BoardView) : "open",
    sort: BOARD_SORTS.includes(sort as BoardSort) ? (sort as BoardSort) : "top",
    category: one("category"),
    barangay: Number.isInteger(barangay) && barangay > 0 ? barangay : null,
  };
}

export function boardFiltersToSearch(filters: BoardFilters): string {
  const search = new URLSearchParams();
  if (filters.view !== "open") search.set("view", filters.view);
  if (filters.sort !== "top") search.set("sort", filters.sort);
  if (filters.category) search.set("category", filters.category);
  if (filters.barangay) search.set("barangay", String(filters.barangay));
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export interface BoardPage {
  items: Report[];
  nextOffset: number | null;
}

/** One page of public Reports. `categoryId` is the resolved id for `filters.category` (a slug). */
export async function fetchBoardPage(
  supabase: SupabaseClient,
  filters: BoardFilters,
  categoryId: string | null,
  offset: number,
): Promise<BoardPage> {
  let query = supabase.from("reports_view").select("*").in("status", BOARD_VIEWS[filters.view]);
  if (categoryId) query = query.eq("category_id", categoryId);
  if (filters.barangay) query = query.eq("barangay_id", filters.barangay);

  if (filters.sort === "top") {
    query = query.order("me_too_count", { ascending: false }).order("created_at", { ascending: false });
  } else if (filters.sort === "active") {
    query = query.order("last_activity_at", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  // Ask for one extra row to know whether another page exists.
  const { data, error } = await query.range(offset, offset + PAGE_SIZE);
  if (error) throw new Error(`Loading the board: ${error.message}`);
  const rows = (data ?? []) as Report[];
  return {
    items: rows.slice(0, PAGE_SIZE),
    nextOffset: rows.length > PAGE_SIZE ? offset + PAGE_SIZE : null,
  };
}

export interface MapPoint {
  id: string;
  public_code: string;
  category_id: string;
  title: string | null;
  lat: number;
  lng: number;
  status: ReportStatus;
}

export async function fetchMapPoints(
  supabase: SupabaseClient,
  filters: BoardFilters,
  categoryId: string | null,
): Promise<MapPoint[]> {
  let query = supabase
    .from("reports_view")
    .select("id, public_code, category_id, title, lat, lng, status")
    .in("status", BOARD_VIEWS[filters.view])
    .order("created_at", { ascending: false })
    .limit(1000);
  if (categoryId) query = query.eq("category_id", categoryId);
  if (filters.barangay) query = query.eq("barangay_id", filters.barangay);
  const { data, error } = await query;
  if (error) throw new Error(`Loading the map: ${error.message}`);
  return (data ?? []) as MapPoint[];
}

export const boardKeys = {
  all: ["board"] as const,
  list: (filters: BoardFilters) => ["board", "list", filters] as const,
  map: (filters: BoardFilters) => ["board", "map", filters] as const,
  myMeToos: ["board", "my-me-toos"] as const,
};

/** Query options; the caller supplies the Supabase client (server or browser) and the category id. */
export function boardListOptions(supabase: SupabaseClient, filters: BoardFilters, categoryId: string | null) {
  return infiniteQueryOptions({
    queryKey: boardKeys.list(filters),
    queryFn: ({ pageParam }) => fetchBoardPage(supabase, filters, categoryId, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset,
    staleTime: 30_000,
  });
}

export function boardMapOptions(supabase: SupabaseClient, filters: BoardFilters, categoryId: string | null) {
  return queryOptions({
    queryKey: boardKeys.map(filters),
    queryFn: () => fetchMapPoints(supabase, filters, categoryId),
    staleTime: 60_000,
  });
}
