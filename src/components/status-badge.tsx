import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { STATUS_BADGE } from "@/lib/status";
import type { ReportStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StatusBadge({ status, className }: { status: ReportStatus; className?: string }) {
  const t = useTranslations("status");
  return <Badge className={cn(STATUS_BADGE[status], className)}>{t(status)}</Badge>;
}
