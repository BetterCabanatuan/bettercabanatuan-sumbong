import { describe, expect, it } from "vitest";
import { safeNextPath } from "./redirect";

describe("safeNextPath", () => {
  it("keeps same-site paths with their query", () => {
    expect(safeNextPath("/v/review?tab=new")).toBe("/v/review?tab=new");
    expect(safeNextPath("/r/CBN-ABC234")).toBe("/r/CBN-ABC234");
  });

  it("refuses anything that would leave the site", () => {
    for (const next of ["//evil.com", "/\\evil.com", "/\t/evil.com", "/\n/evil.com", "https://evil.com", "evil.com"]) {
      expect(safeNextPath(next, "/me")).toBe("/me");
    }
  });

  it("refuses paths whose dot segments collapse into another site", () => {
    for (const next of ["/.//evil.com", "/a/..//evil.com", "/%2e//evil.com", "/./\\evil.com", "//./evil.com"]) {
      expect(safeNextPath(next, "/me")).toBe("/me");
    }
    expect(safeNextPath("/v/../me")).toBe("/me");
  });

  it("falls back when there is no value", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath(undefined, "/me")).toBe("/me");
  });
});
