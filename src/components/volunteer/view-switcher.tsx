"use client";

import { LayoutGrid, List, Table2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DATA_VIEWS, type DataViewMode, viewCookieName } from "@/lib/data-view";

const ICONS = { table: Table2, list: List, grid: LayoutGrid } as const;
const LABELS = { table: "Table", list: "List", grid: "Grid" } as const;

/**
 * Switches a console list between table, list and grid. The choice goes into the URL
 * (so it can be shared) and a cookie (so the screen opens the same way next time).
 */
export function ViewSwitcher({ screen, view }: { screen: string; view: DataViewMode }) {
  const router = useRouter();
  const pathname = usePathname();

  function choose(next: DataViewMode) {
    document.cookie = `${viewCookieName(screen)}=${next}; path=/v; max-age=31536000; samesite=lax`;
    const params = new URLSearchParams(window.location.search);
    params.set("view", next);
    router.replace(`${pathname}?${params}`, { scroll: false });
  }

  return (
    <ToggleGroup
      variant="outline"
      size="sm"
      spacing={0}
      value={[view]}
      onValueChange={(value) => {
        const next = value[0] as DataViewMode | undefined;
        if (next && next !== view) choose(next);
      }}
      aria-label="Layout"
    >
      {DATA_VIEWS.map((mode) => {
        const Icon = ICONS[mode];
        return (
          <Tooltip key={mode}>
            <TooltipTrigger render={<ToggleGroupItem value={mode} aria-label={LABELS[mode]} />}>
              <Icon />
            </TooltipTrigger>
            <TooltipContent>{LABELS[mode]}</TooltipContent>
          </Tooltip>
        );
      })}
    </ToggleGroup>
  );
}
