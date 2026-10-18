"use client";

import Link from "next/link";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { CategoryIcon } from "@/components/category-icon";
import { StatusBadge } from "@/components/status-badge";
import { localized } from "@/i18n/config";
import { reportTitle } from "@/lib/report-title";
import type { Locale, Report } from "@/lib/types";
import type { BoardLookups } from "./types";
import { useMeToo, useMyMeToos } from "./use-me-too";
import { VoteButton } from "./vote-button";

const VOTABLE = new Set(["published", "forwarded", "reopened"]);

export function ReportCard({ report, lookups }: { report: Report; lookups: BoardLookups }) {
  const t = useTranslations("board");
  const format = useFormatter();
  const locale = useLocale() as Locale;
  const meToo = useMeToo();
  const { data: mine } = useMyMeToos();

  const category = lookups.categories.find((c) => c.id === report.category_id);
  const barangay = lookups.barangays.find((b) => b.id === report.barangay_id);
  const office = lookups.offices.find((o) => o.id === report.office_id);
  const officeName = office ? localized(office, "name", locale) : "";
  const pressed = mine?.has(report.id) ?? false;

  const progress =
    report.status === "forwarded" && report.first_forwarded_at
      ? t("meta.forwarded", { office: officeName, when: format.relativeTime(new Date(report.first_forwarded_at)) })
      : report.status === "published"
        ? t("meta.published", { office: officeName })
        : report.status === "resolved" && report.resolved_at
          ? t("meta.resolved", { when: format.relativeTime(new Date(report.resolved_at)) })
          : report.status === "reopened"
            ? t("meta.reopened")
            : null;

  return (
    <article className="flex gap-4 rounded-xl border bg-card p-4 text-card-foreground">
      <VoteButton
        count={report.me_too_count}
        pressed={pressed}
        disabled={!VOTABLE.has(report.status) || meToo.isPending}
        onPress={() => meToo.mutate(report.id)}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={report.status} />
          {category && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <CategoryIcon icon={category.icon} className="size-3.5" />
              {localized(category, "name", locale)}
            </span>
          )}
        </div>
        <h2 className="text-base leading-snug font-semibold text-pretty sm:text-lg">
          <Link href={`/r/${report.public_code}`} className="hover:text-primary hover:underline">
            {reportTitle(report, category, locale)}
          </Link>
        </h2>
        <p className="text-sm text-muted-foreground">
          {[barangay && t("barangay", { name: barangay.name }), progress].filter(Boolean).join(" · ")}
        </p>
      </div>
    </article>
  );
}
