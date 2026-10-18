import type { ReportStatus } from "@/lib/types";

/** Badge classes per status (theme tokens in globals.css). Labels live in messages under `status`. */
export const STATUS_BADGE: Record<ReportStatus, string> = {
  pending_review: "bg-status-review text-status-review-foreground",
  rejected: "bg-status-rejected text-status-rejected-foreground",
  published: "bg-status-published text-status-published-foreground",
  forwarded: "bg-status-forwarded text-status-forwarded-foreground",
  resolved: "bg-status-resolved text-status-resolved-foreground",
  reopened: "bg-status-reopened text-status-reopened-foreground",
};

/** Map marker fill per status (Leaflet needs a literal color). */
export const STATUS_MARKER: Record<ReportStatus, string> = {
  pending_review: "#6b7280",
  rejected: "#a50e26",
  published: "#c2410c",
  forwarded: "#0052bc",
  resolved: "#0b6b3a",
  reopened: "#5b2ea6",
};

export const STATUS_ORDER: ReportStatus[] = [
  "pending_review",
  "published",
  "forwarded",
  "resolved",
  "reopened",
  "rejected",
];
