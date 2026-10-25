import { describe, expect, it } from "vitest";
import { parseReportFilters, reportFilterChips, reportFiltersToSearch } from "./report-filters";

const names = {
  status: (s: string) => (s === "forwarded" ? "Forwarded" : s),
  office: (id: string) => (id === "o1" ? "CEO" : undefined),
  barangay: (id: number) => (id === 7 ? "Sangitan" : undefined),
};

describe("reportFilterChips", () => {
  it("makes no chips without filters", () => {
    expect(reportFilterChips({}, names)).toEqual([]);
  });

  it("links each chip to the list without that one filter", () => {
    const filters = parseReportFilters({ status: "forwarded", office: "o1", barangay: "7" });
    const chips = reportFilterChips(filters, names, "table");
    expect(chips.map((c) => c.label)).toEqual(["Status: Forwarded", "Office: CEO", "Barangay: Sangitan"]);
    expect(chips[0].href).toBe("/v/reports?office=o1&barangay=7&view=table");
    expect(chips[1].href).toBe("/v/reports?status=forwarded&barangay=7&view=table");
    expect(chips[2].href).toBe("/v/reports?status=forwarded&office=o1&view=table");
  });

  it("round-trips: following a chip parses back to the remaining filters", () => {
    const filters = parseReportFilters({ status: "forwarded", office: "o1" });
    const [status] = reportFilterChips(filters, names);
    const remaining = parseReportFilters(new URLSearchParams(status.href.split("?")[1]));
    expect(reportFiltersToSearch(remaining)).toBe("office=o1");
  });

  it("goes to the bare list when the last chip is removed", () => {
    const [chip] = reportFilterChips({ officeId: "o1" }, names);
    expect(chip.href).toBe("/v/reports");
  });
});
