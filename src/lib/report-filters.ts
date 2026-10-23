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
