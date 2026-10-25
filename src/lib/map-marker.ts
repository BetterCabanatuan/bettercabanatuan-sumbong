import type { ReportStatus } from "@/lib/types";

/** One shape per status, so a marker is never told apart by colour alone (WCAG 1.4.1). */
export type MarkerShape = "circle" | "square" | "diamond" | "ring";

export const MARKER_SHAPE: Record<ReportStatus, MarkerShape> = {
  published: "circle",
  forwarded: "square",
  reopened: "diamond",
  resolved: "ring",
  pending_review: "ring",
  rejected: "square",
};

/** Resolved Reports recede so open problems read first. */
export const MARKER_OPACITY: Record<ReportStatus, number> = {
  published: 1,
  forwarded: 1,
  reopened: 1,
  pending_review: 1,
  rejected: 1,
  resolved: 0.6,
};

/** The map's tiles are always light, so the ring stays the light-theme `--navy` in dark mode too. */
export const MARKER_RING = "#002e6e";
export const MARKER_OUTLINE = "#ffffff";
export const MARKER_SIZE = 34;

const C = MARKER_SIZE / 2;

/** The marker's outline at a given half-size, as an SVG element string. */
function outlineShape(shape: MarkerShape, half: number, attrs: string): string {
  switch (shape) {
    case "square":
      return `<rect x="${C - half}" y="${C - half}" width="${half * 2}" height="${half * 2}" rx="${Math.max(2, half / 4)}" ${attrs}/>`;
    case "diamond": {
      const d = half * 1.12;
      return `<polygon points="${C},${C - d} ${C + d},${C} ${C},${C + d} ${C - d},${C}" stroke-linejoin="round" ${attrs}/>`;
    }
    default:
      return `<circle cx="${C}" cy="${C}" r="${half}" ${attrs}/>`;
  }
}

/**
 * The marker as inline SVG: navy ring (1px), white outline (2px), then the status fill, with the
 * category glyph (inner SVG markup in a 24-unit box) in the centre. A `ring` status is white with
 * a thick coloured band and a coloured glyph; the rest are solid with a white glyph.
 */
export function markerSvg({ shape, color, glyph }: { shape: MarkerShape; color: string; glyph: string }): string {
  const solid = shape !== "ring";
  const base = shape === "diamond" ? 12 : shape === "square" ? 11.5 : 12.5;
  const parts = [
    outlineShape(shape, base + 3, `fill="${MARKER_RING}"`),
    outlineShape(shape, base + 2, `fill="${MARKER_OUTLINE}"`),
    solid
      ? outlineShape(shape, base, `fill="${color}"`)
      : `<circle cx="${C}" cy="${C}" r="${base - 2}" fill="${MARKER_OUTLINE}" stroke="${color}" stroke-width="4"/>`,
  ];
  const size = 15;
  const stroke = solid ? MARKER_OUTLINE : color;
  parts.push(
    `<g transform="translate(${C - size / 2} ${C - size / 2}) scale(${size / 24})" fill="none" stroke="${stroke}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>`,
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MARKER_SIZE} ${MARKER_SIZE}" width="${MARKER_SIZE}" height="${MARKER_SIZE}" aria-hidden="true" focusable="false">${parts.join("")}</svg>`;
}

/** Cluster bubble size class by how many Reports it holds. */
export function clusterSize(count: number): "sm" | "md" | "lg" {
  return count < 10 ? "sm" : count < 100 ? "md" : "lg";
}
