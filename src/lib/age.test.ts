import { describe, expect, it } from "vitest";
import { formatAge } from "./age";

const now = Date.parse("2026-10-25T12:00:00Z");
const ago = (ms: number) => new Date(now - ms).toISOString();
const HOUR = 3_600_000;

describe("formatAge", () => {
  it("says 'Under 1 hour' for fresh and future timestamps", () => {
    expect(formatAge(ago(5 * 60_000), now)).toBe("Under 1 hour");
    expect(formatAge(ago(-HOUR), now)).toBe("Under 1 hour");
  });

  it("uses hours up to two days", () => {
    expect(formatAge(ago(HOUR), now)).toBe("1 hour");
    expect(formatAge(ago(5 * HOUR), now)).toBe("5 hours");
    expect(formatAge(ago(47 * HOUR), now)).toBe("47 hours");
  });

  it("uses whole days from two days", () => {
    expect(formatAge(ago(48 * HOUR), now)).toBe("2 days");
    expect(formatAge(ago(12 * 24 * HOUR + 5 * HOUR), now)).toBe("12 days");
  });
});
