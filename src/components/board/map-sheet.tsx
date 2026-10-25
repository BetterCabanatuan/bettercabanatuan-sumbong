"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { CategoryIcon } from "@/components/category-icon";
import type { MapReport } from "@/components/map";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

/**
 * On phones a tapped marker opens a short bottom sheet instead of a popup. It is not modal: the
 * map behind stays in view and keeps working, and the sheet closes with a swipe down or Esc.
 */
export function MapSheet({ report, onClose }: { report: MapReport | null; onClose: () => void }) {
  const t = useTranslations("board");
  return (
    <Drawer open={report !== null} onOpenChange={(open) => !open && onClose()} modal={false} showSwipeHandle>
      <DrawerContent>
        {report && (
          <>
            <DrawerHeader className="items-start gap-2 text-left">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <StatusBadge status={report.status} />
                {report.categoryName && (
                  <span className="inline-flex items-center gap-1">
                    <CategoryIcon icon={report.categoryIcon} className="size-3.5" />
                    {report.categoryName}
                  </span>
                )}
              </div>
              <DrawerTitle className="text-base leading-snug font-semibold text-balance">{report.title}</DrawerTitle>
              <DrawerDescription className="text-left">
                {[
                  report.barangay && t("barangay", { name: report.barangay }),
                  typeof report.meToo === "number" && t("meTooLabel", { count: report.meToo }),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </DrawerDescription>
            </DrawerHeader>
            <DrawerFooter className="pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <Button size="lg" className="h-11" nativeButton={false} render={<Link href={`/r/${report.code}`} />}>
                {t("map.reportLink", { code: report.code })}
              </Button>
            </DrawerFooter>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
