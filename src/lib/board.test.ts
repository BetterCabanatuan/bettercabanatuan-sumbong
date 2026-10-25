import { describe, expect, it } from "vitest";
import { boardFiltersToSearch, parseBoardFilters, parseBoardMode } from "./board";

describe("board mode in the URL", () => {
  it("reads ?mode=map and falls back to the list", () => {
    expect(parseBoardMode({ mode: "map" })).toBe("map");
    expect(parseBoardMode({ mode: "list" })).toBe("list");
    expect(parseBoardMode({ mode: "satellite" })).toBe("list");
    expect(parseBoardMode({})).toBe("list");
  });

  it("writes the mode beside the filters and leaves the list URL clean", () => {
    const filters = parseBoardFilters({ sort: "new", barangay: "3" });
    expect(boardFiltersToSearch(filters)).toBe("?sort=new&barangay=3");
    expect(boardFiltersToSearch(filters, "map")).toBe("?mode=map&sort=new&barangay=3");
    expect(boardFiltersToSearch(parseBoardFilters({}), "map")).toBe("?mode=map");
  });

  it("keeps the mode out of the filters, so query keys don't change when it does", () => {
    expect(parseBoardFilters({ mode: "map" })).toEqual(parseBoardFilters({}));
  });
});
