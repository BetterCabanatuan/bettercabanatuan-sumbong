import { describe, expect, it } from "vitest";
import { clusterSize, MARKER_OPACITY, MARKER_SHAPE, markerSvg } from "./map-marker";
import { STATUS_MARKER, STATUS_ORDER } from "./status";

describe("map markers", () => {
  it("gives each public status its own shape", () => {
    const publicStatuses = ["published", "forwarded", "reopened", "resolved"] as const;
    expect(new Set(publicStatuses.map((s) => MARKER_SHAPE[s])).size).toBe(4);
  });

  it("covers every status with a shape, a colour and an opacity", () => {
    for (const status of STATUS_ORDER) {
      expect(MARKER_SHAPE[status]).toBeTruthy();
      expect(STATUS_MARKER[status]).toMatch(/^#[0-9a-f]{6}$/);
      expect(MARKER_OPACITY[status]).toBeGreaterThan(0);
    }
  });

  it("dims only resolved Reports, to 60%", () => {
    expect(MARKER_OPACITY.resolved).toBe(0.6);
    for (const status of STATUS_ORDER.filter((s) => s !== "resolved")) expect(MARKER_OPACITY[status]).toBe(1);
  });

  it("draws the navy ring, white outline and fill for each shape", () => {
    for (const shape of ["circle", "square", "diamond", "ring"] as const) {
      const svg = markerSvg({ shape, color: "#0052bc", glyph: '<path d="M0 0"/>' });
      expect(svg).toContain("#002e6e");
      expect(svg).toContain("#ffffff");
      expect(svg).toContain("#0052bc");
      expect(svg).toContain('aria-hidden="true"');
    }
  });

  it("buckets cluster sizes", () => {
    expect(clusterSize(2)).toBe("sm");
    expect(clusterSize(10)).toBe("md");
    expect(clusterSize(150)).toBe("lg");
  });
});
