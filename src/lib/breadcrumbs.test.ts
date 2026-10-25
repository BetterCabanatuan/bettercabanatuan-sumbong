import { describe, expect, it } from "vitest";
import { consoleCrumbs } from "./breadcrumbs";

const labels = (path: string) => consoleCrumbs(path).map((c) => c.label);

describe("consoleCrumbs", () => {
  it("names the dashboard", () => {
    expect(labels("/v")).toEqual(["Dashboard"]);
  });

  it("builds Settings / Roles / Edit", () => {
    expect(labels("/v/settings/roles/3f2a")).toEqual(["Settings", "Roles", "Edit"]);
    expect(labels("/v/settings/roles/new")).toEqual(["Settings", "Roles", "New"]);
  });

  it("names a Report or Digest by its parent list", () => {
    expect(labels("/v/review/abc")).toEqual(["Review", "Report"]);
    expect(labels("/v/reports/abc")).toEqual(["Reports", "Report"]);
    expect(labels("/v/digests/abc/letter")).toEqual(["Digests", "Digest", "Letter"]);
  });

  it("links each crumb to its own path", () => {
    expect(consoleCrumbs("/v/settings/offices/9").map((c) => c.href)).toEqual([
      "/v/settings",
      "/v/settings/offices",
      "/v/settings/offices/9",
    ]);
  });

  it("returns nothing outside the console", () => {
    expect(consoleCrumbs("/report")).toEqual([]);
  });
});
