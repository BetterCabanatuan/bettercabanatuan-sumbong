import { CircleCheck, CircleX, Eye, Megaphone, RotateCcw, Send, type LucideIcon } from "lucide-react";
import type { ReportStatus } from "@/lib/types";

/** Badge classes per status (theme tokens in globals.css). Labels live in messages under `status`. */
export const STATUS_BADGE: Record<ReportStatus, string> = {
  pending_review: "bg-status-review text-status-review-foreground border-status-review-foreground/20",
  rejected: "bg-status-rejected text-status-rejected-foreground border-status-rejected-foreground/20",
  published: "bg-status-published text-status-published-foreground border-status-published-foreground/20",
  forwarded: "bg-status-forwarded text-status-forwarded-foreground border-status-forwarded-foreground/20",
  resolved: "bg-status-resolved text-status-resolved-foreground border-status-resolved-foreground/20",
  reopened: "bg-status-reopened text-status-reopened-foreground border-status-reopened-foreground/20",
};

/** A status is never shown by colour alone: each one also has its own icon (WCAG 1.4.1). */
export const STATUS_ICON: Record<ReportStatus, LucideIcon> = {
  pending_review: Eye,
  published: Megaphone,
  forwarded: Send,
  resolved: CircleCheck,
  reopened: RotateCcw,
  rejected: CircleX,
};

/**
 * English labels for the Volunteer console, which is English-only whatever language a visitor chose.
 * Kept here, not read from `messages/en.json`, so client bundles don't pull the whole file in;
 * `status.test.ts` keeps the two in step.
 */
export const STATUS_LABEL_EN: Record<ReportStatus, string> = {
  pending_review: "In review",
  rejected: "Not published",
  published: "Published",
  forwarded: "Forwarded",
  resolved: "Resolved",
  reopened: "Reopened",
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
