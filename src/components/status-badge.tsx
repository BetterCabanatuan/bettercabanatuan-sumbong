import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { STATUS_BADGE, STATUS_ICON, STATUS_LABEL_EN } from "@/lib/status";
import type { ReportStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * A status with its icon and label. Residents see their language; the Volunteer console passes
 * `labels="en"` because its screens are English-only.
 */
export function StatusBadge({ status, labels, className }: { status: ReportStatus; labels?: "en"; className?: string }) {
  const t = useTranslations("status");
  const Icon = STATUS_ICON[status];
  return (
    <Badge className={cn(STATUS_BADGE[status], className)}>
      <Icon data-icon="inline-start" aria-hidden="true" />
      {labels === "en" ? STATUS_LABEL_EN[status] : t(status)}
    </Badge>
  );
}
