import { describe, expect, it } from "vitest";
import { activityStrip } from "./board-stats";

describe("activityStrip", () => {
  it("shows nothing when both counts are zero", () => {
    expect(activityStrip({ newThisWeek: 0, resolvedThisMonth: 0 })).toBeNull();
  });

  it("shows nothing when the counts could not be loaded", () => {
    expect(activityStrip(null)).toBeNull();
  });

  it("drops a zero but keeps the other number", () => {
    expect(activityStrip({ newThisWeek: 4, resolvedThisMonth: 0 })).toEqual({ week: 4, month: null });
    expect(activityStrip({ newThisWeek: 0, resolvedThisMonth: 1 })).toEqual({ week: null, month: 1 });
  });

  it("shows both when both are at least 1", () => {
    expect(activityStrip({ newThisWeek: 12, resolvedThisMonth: 3 })).toEqual({ week: 12, month: 3 });
  });

  it("ignores negative or non-finite values", () => {
    expect(activityStrip({ newThisWeek: -2, resolvedThisMonth: Number.NaN })).toBeNull();
  });
});
