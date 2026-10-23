"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMeToo } from "@/components/board/use-me-too";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";
import { createClient } from "@/lib/supabase/client";
import type { ReportStatus } from "@/lib/types";

export interface Nearby {
  id: string;
  public_code: string;
  status: ReportStatus;
  distance_m: number;
  me_too_count: number;
}

/**
 * "May nakapag-sumbong na ba nito?" Open Reports of the same Category within 100 m, so the
 * resident can add a Me Too instead of a second Report. The form fetches these while the
 * resident answers the Category Questions and shows its own step only when there are any.
 */
export function useNearbyReports(lat: number | undefined, lng: number | undefined, categoryId: string | undefined) {
  return useQuery({
    queryKey: ["nearby", lat?.toFixed(5), lng?.toFixed(5), categoryId],
    enabled: lat !== undefined && lng !== undefined && categoryId !== undefined,
    queryFn: async () => {
      const { data, error } = await createClient().rpc("nearby_reports", {
        p_lng: lng,
        p_lat: lat,
        p_radius_m: 100,
        p_category_id: categoryId,
      });
      if (error) throw error;
      return (data ?? []) as Nearby[];
    },
  });
}

export function NearbyList({ nearby, onMeToo }: { nearby: Nearby[]; onMeToo: (code: string) => void }) {
  const t = useTranslations("reportForm.nearby");
  const meToo = useMeToo();

  return (
    <ItemGroup className="gap-2">
      {nearby.map((report) => (
        <Item key={report.id} variant="outline" className="bg-card">
          <ItemContent>
            <ItemTitle>
              <Link href={`/r/${report.public_code}`} target="_blank" className="font-mono underline">
                {report.public_code}
              </Link>
              <StatusBadge status={report.status} />
            </ItemTitle>
            <ItemDescription>
              {t("distance", { meters: Math.round(report.distance_m) })}
              {report.me_too_count > 0 && ` · ${t("meToos", { count: report.me_too_count })}`}
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button
              className="bg-sun text-sun-foreground hover:bg-sun/80"
              disabled={meToo.isPending}
              onClick={() => meToo.mutate(report.id, { onSuccess: () => onMeToo(report.public_code) })}
            >
              {meToo.isPending && meToo.variables === report.id && <Spinner data-icon="inline-start" />}
              {t("meToo")}
            </Button>
          </ItemActions>
        </Item>
      ))}
    </ItemGroup>
  );
}
