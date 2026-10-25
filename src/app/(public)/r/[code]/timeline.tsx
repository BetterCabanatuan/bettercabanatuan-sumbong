import { FilePlus2, HandHeart, type LucideIcon } from "lucide-react";
import { Fragment } from "react";
import { STATUS_BADGE, STATUS_ICON } from "@/lib/status";
import type { ReportStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export type TimelineKind = ReportStatus | "submitted" | "meToo";

export interface TimelineItem {
  key: string;
  kind: TimelineKind;
  title: string;
  /** Already formatted for the visitor's language. */
  date?: string;
  body?: string;
  /** Happened with the Responsible Office rather than with Volunteers. */
  office?: boolean;
}

const BADGE: Record<TimelineKind, { icon: LucideIcon; classes: string }> = {
  submitted: {
    icon: FilePlus2,
    classes: "bg-muted text-muted-foreground border-border",
  },
  meToo: {
    icon: HandHeart,
    classes: "bg-sun text-sun-foreground border-sun-foreground/20",
  },
  pending_review: {
    icon: STATUS_ICON.pending_review,
    classes: STATUS_BADGE.pending_review,
  },
  rejected: { icon: STATUS_ICON.rejected, classes: STATUS_BADGE.rejected },
  published: { icon: STATUS_ICON.published, classes: STATUS_BADGE.published },
  forwarded: { icon: STATUS_ICON.forwarded, classes: STATUS_BADGE.forwarded },
  resolved: { icon: STATUS_ICON.resolved, classes: STATUS_BADGE.resolved },
  reopened: { icon: STATUS_ICON.reopened, classes: STATUS_BADGE.reopened },
};

/**
 * A Report's history, newest first: an icon badge on a rail (the same icons as the status badges,
 * so a status is never told by colour alone), a break where the story moves to the Responsible
 * Office, and the "Me too" milestone set smaller so a count of 40 doesn't compete with "Forwarded".
 * The badges are decorative; each title already says what happened.
 */
export function Timeline({
  items,
  officePhaseLabel,
}: {
  items: TimelineItem[];
  officePhaseLabel: string;
}) {
  const firstOffice = items.findIndex((item) => item.office);
  return (
    <ol className="ml-2 flex flex-col gap-5 border-l-2 pl-6">
      {items.map((item, index) => {
        const { icon: Icon, classes } = BADGE[item.kind];
        const minor = item.kind === "meToo";
        return (
          <Fragment key={item.key}>
            {index === firstOffice && (
              <li
                aria-hidden="true"
                className="flex items-center gap-2 text-xs font-medium text-muted-foreground"
              >
                <span className="h-px w-4 bg-border" />
                {officePhaseLabel}
                <span className="h-px flex-1 bg-border" />
              </li>
            )}
            <li className="relative">
              <span
                aria-hidden="true"
                // The first eight badges arrive one after another; the rest are simply there.
                className={cn(
                  "absolute grid place-items-center rounded-full border ring-4 ring-background",
                  classes,
                  minor ? "-left-[35px] size-5" : "-left-[37px] size-6",
                  index < 8 && "motion-safe:animate-rise-in",
                  minor ? "top-0" : "-top-0.5",
                )}
                style={
                  index < 8 ? { animationDelay: `${index * 50}ms` } : undefined
                }
              >
                <Icon className={minor ? "size-3" : "size-3.5"} />
              </span>
              <p
                className={cn(
                  "text-sm",
                  minor && "text-xs text-muted-foreground",
                )}
              >
                <span className={minor ? "font-medium" : "font-semibold"}>
                  {item.title}
                </span>
                {item.date && (
                  <span className="text-muted-foreground"> · {item.date}</span>
                )}
              </p>
              {item.body && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.body}
                </p>
              )}
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
