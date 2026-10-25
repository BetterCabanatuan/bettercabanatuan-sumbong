import { STATUS_ORDER } from "@/lib/status";
import type { ReportStatus } from "@/lib/types";

/** The console Reports list's filters, shared by the page and its CSV export so both show the same Reports. */
export interface ReportListFilters {
  statuses?: ReportStatus[];
  officeId?: string;
  barangayId?: number;
}

type Params = Record<string, string | string[] | undefined> | URLSearchParams;

export function parseReportFilters(params: Params): ReportListFilters {
  const get = (key: string) => {
    const value = params instanceof URLSearchParams ? params.get(key) : params[key];
    return typeof value === "string" && value ? value : undefined;
  };
  const status = get("status");
  const barangay = Number(get("barangay"));
  return {
    statuses: STATUS_ORDER.includes(status as ReportStatus) ? [status as ReportStatus] : undefined,
    officeId: get("office"),
    barangayId: Number.isInteger(barangay) && barangay > 0 ? barangay : undefined,
  };
}

export function reportFiltersToSearch(filters: ReportListFilters): string {
  const search = new URLSearchParams();
  if (filters.statuses?.[0]) search.set("status", filters.statuses[0]);
  if (filters.officeId) search.set("office", filters.officeId);
  if (filters.barangayId) search.set("barangay", String(filters.barangayId));
  return search.toString();
}

export interface FilterChip {
  key: "status" | "office" | "barangay";
  /** "Status: Forwarded" */
  label: string;
  /** The same list with only this filter removed (and the chosen view kept). */
  href: string;
}

/**
 * The active filters as removable chips. Each chip links to the list without that one filter,
 * so removing a chip is a plain navigation and works without JavaScript.
 */
export function reportFilterChips(
  filters: ReportListFilters,
  names: {
    status: (status: ReportStatus) => string;
    office: (id: string) => string | undefined;
    barangay: (id: number) => string | undefined;
  },
  view?: string,
): FilterChip[] {
  const without = (omit: keyof ReportListFilters): string => {
    const search = new URLSearchParams(reportFiltersToSearch({ ...filters, [omit]: undefined }));
    if (view) search.set("view", view);
    const query = search.toString();
    return query ? `/v/reports?${query}` : "/v/reports";
  };
  const chips: FilterChip[] = [];
  const status = filters.statuses?.[0];
  if (status) chips.push({ key: "status", label: `Status: ${names.status(status)}`, href: without("statuses") });
  if (filters.officeId)
    chips.push({ key: "office", label: `Office: ${names.office(filters.officeId) ?? "Unknown"}`, href: without("officeId") });
  if (filters.barangayId) {
    chips.push({ key: "barangay", label: `Barangay: ${names.barangay(filters.barangayId) ?? "Unknown"}`, href: without("barangayId") });
  }
  return chips;
}
