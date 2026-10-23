"use client";

import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { useMemo, useSyncExternalStore } from "react";
import { getDeviceReports } from "@/app/actions/reporter";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type DeviceReport,
  deviceReportsSnapshot,
  forgetDeviceReport,
  readDeviceReports,
  subscribeDeviceReports,
} from "@/lib/device-reports";

/** Reports sent from this browser, found again through the Tracking Links saved at submit. */
export function DeviceReports() {
  const t = useTranslations("me");
  const format = useFormatter();
  // The snapshot is the raw stored string, so it stays referentially stable between changes.
  const raw = useSyncExternalStore(subscribeDeviceReports, deviceReportsSnapshot, () => null);
  const saved = useMemo<DeviceReport[] | null>(() => (raw === null ? null : readDeviceReports()), [raw]);

  const { data, isPending, isError } = useQuery({
    queryKey: ["device-reports", saved?.map((r) => r.code).join(",")],
    enabled: !!saved?.length,
    queryFn: () => getDeviceReports(saved!.map(({ code, token }) => ({ code, token }))),
  });

  if (saved === null || (saved.length > 0 && isPending)) {
    return (
      <div className="flex flex-col gap-3" aria-label={t("deviceLoading")}>
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  // The saved links are still on the device; don't make a failed lookup look like an empty list.
  if (isError) {
    return <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">{t("deviceError")}</p>;
  }

  const found = new Map((data ?? []).map((r) => [r.code, r]));
  const reports = saved.filter((r) => found.has(r.code));
  if (reports.length === 0) {
    return <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">{t("deviceEmpty")}</p>;
  }

  return (
    <ItemGroup className="gap-3">
      {reports.map(({ code, token }) => {
        const report = found.get(code)!;
        return (
          <Item key={code} variant="outline" className="bg-card">
            <ItemContent>
              <ItemTitle>
                <Link href={`/r/${code}?t=${encodeURIComponent(token)}`} className="hover:underline">
                  {report.title}
                </Link>
                <StatusBadge status={report.status} />
              </ItemTitle>
              <ItemDescription>
                <span className="font-mono">{code}</span>
                {" · "}
                {format.dateTime(new Date(report.createdAt), { month: "short", day: "numeric", year: "numeric" })}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("forget", { code })}
                onClick={() => forgetDeviceReport(code)}
              >
                <X />
              </Button>
            </ItemActions>
          </Item>
        );
      })}
    </ItemGroup>
  );
}
