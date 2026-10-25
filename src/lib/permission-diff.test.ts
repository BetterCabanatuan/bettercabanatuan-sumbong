import { describe, expect, it } from "vitest";
import {
  cannotSummary,
  describeChanges,
  diffPermissions,
  groupAreas,
  sameSet,
  sortPermissions,
  togglePermissions,
} from "@/lib/permission-diff";
import { PERMISSIONS } from "@/lib/permissions";
import type { Permission } from "@/lib/types";

const universe: readonly Permission[] = PERMISSIONS;
const set = (...keys: Permission[]) => new Set<Permission>(keys);

describe("togglePermissions", () => {
  it("turns View on when any action is checked", () => {
    const next = togglePermissions(set(), ["digests.send"], true, universe);
    expect(next).toEqual(set("digests.send", "digests.view"));
  });

  it("clears the whole row when View is unchecked, and leaves other rows alone", () => {
    const current = set("digests.view", "digests.add", "digests.send", "reports.view");
    const next = togglePermissions(current, ["digests.view"], false, universe);
    expect(next).toEqual(set("reports.view"));
  });

  it("unchecks a single non-View action without touching View", () => {
    const next = togglePermissions(set("digests.view", "digests.add"), ["digests.add"], false, universe);
    expect(next).toEqual(set("digests.view"));
  });

  it("checking a whole column adds View in every row it touches", () => {
    const next = togglePermissions(set(), ["reports.export", "digests.export"], true, universe);
    expect(next).toEqual(set("reports.export", "reports.view", "digests.export", "digests.view"));
  });

  it("does not change the set it was given", () => {
    const current = set("reports.view");
    togglePermissions(current, ["reports.edit"], true, universe);
    expect(current).toEqual(set("reports.view"));
  });
});

describe("diffPermissions and describeChanges", () => {
  it("lists additions and removals in display order", () => {
    const diff = diffPermissions(
      set("reports.view", "digests.view", "digests.send"),
      set("reports.view", "reports.export", "digests.view"),
    );
    expect(diff).toEqual({ added: ["reports.export"], removed: ["digests.send"] });
    expect(describeChanges(diff)).toBe("Adding: Export Reports. Removing: Send Digests.");
  });

  it("says nothing when nothing changed", () => {
    const diff = diffPermissions(set("reports.view"), set("reports.view"));
    expect(describeChanges(diff, 4)).toBe("");
  });

  it("adds how many people it affects", () => {
    const diff = diffPermissions(set(), set("reports.view"));
    expect(describeChanges(diff, 3)).toBe("Adding: View Reports. This affects 3 people now.");
    expect(describeChanges(diff, 1)).toContain("1 person now");
  });

  it("sameSet compares members, not order", () => {
    expect(sameSet(set("reports.view", "digests.view"), set("digests.view", "reports.view"))).toBe(true);
    expect(sameSet(set("reports.view"), set("digests.view"))).toBe(false);
  });
});

describe("cannotSummary", () => {
  it("is null when every cell is checked", () => {
    expect(cannotSummary(new Set(universe), universe)).toBeNull();
  });

  it("names the first three missing cells in area order and counts the rest", () => {
    const everything = new Set(universe);
    for (const key of ["reports.archive", "digests.delete", "roles.delete", "users.export", "offices.add"] as const)
      everything.delete(key);
    expect(cannotSummary(everything, universe)).toBe(
      "This role cannot: archive Reports, delete Digests, add Responsible Offices, and 2 more.",
    );
  });

  it("lists all of them when there are three or fewer", () => {
    const everything = new Set(universe);
    everything.delete("roles.delete");
    expect(cannotSummary(everything, universe)).toBe("This role cannot: delete Roles.");
  });
});

describe("grouping and order", () => {
  it("groups areas as Work, Setup, Access", () => {
    const groups = groupAreas(["roles", "reports", "offices", "digests", "users", "categories"]);
    expect(groups.map((g) => [g.label, g.areas.map((a) => a.key)])).toEqual([
      ["Work", ["reports", "digests"]],
      ["Setup", ["categories", "offices"]],
      ["Access", ["users", "roles"]],
    ]);
  });

  it("leaves out a band with no areas", () => {
    expect(groupAreas(["reports"]).map((g) => g.key)).toEqual(["work"]);
  });

  it("sorts permissions by area then action column", () => {
    expect(sortPermissions(["roles.view", "digests.send", "reports.export", "digests.view"])).toEqual([
      "reports.export",
      "digests.view",
      "digests.send",
      "roles.view",
    ]);
  });
});
