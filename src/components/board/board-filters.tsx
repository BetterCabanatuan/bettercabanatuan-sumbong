"use client";

import { SlidersHorizontal } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { localized } from "@/i18n/config";
import {
  BOARD_VIEWS,
  type BoardFilters,
  type BoardMode,
  type BoardView,
  boardFiltersToSearch,
  parseBoardMode,
} from "@/lib/board";
import type { Locale } from "@/lib/types";
import { CategoryIcon } from "@/components/category-icon";
import type { BoardLookups } from "./types";

// Shared by every board control (the filter rail and sheet, the sort and view toggles): the URL,
// and so `filters`, only catches up once a navigation commits. Building on the latest request
// stops a quick second change from dropping the first.
let requested: { filters: BoardFilters; mode: BoardMode } | null = null;

export function useBoardNavigation(filters: BoardFilters) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const mode = parseBoardMode({ mode: searchParams.get("mode") ?? undefined });
  useEffect(() => {
    requested = null;
  }, [filters, mode]);
  /** `mode` rides along with the filters in the URL, but is not one of them (see `BoardMode`). */
  const update = (patch: Partial<BoardFilters> & { mode?: BoardMode }) => {
    const { mode: nextMode, ...filterPatch } = patch;
    const base = requested ?? { filters, mode };
    const next = { filters: { ...base.filters, ...filterPatch }, mode: nextMode ?? base.mode };
    requested = next;
    const url = `${pathname}${boardFiltersToSearch(next.filters, next.mode)}`;
    if (Object.keys(filterPatch).length === 0) {
      // Only the view changed: the server has nothing new to render, so update the URL in place
      // (Next syncs `useSearchParams`) and the switch is instant.
      window.history.replaceState(null, "", url);
      requested = null;
      return;
    }
    startTransition(() => router.replace(url, { scroll: false }));
  };
  return { update, pending, mode };
}

function FilterControls({ filters, lookups }: { filters: BoardFilters; lookups: BoardLookups }) {
  const t = useTranslations("board");
  const locale = useLocale() as Locale;
  const { update } = useBoardNavigation(filters);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1" role="group" aria-label={t("filters.status")}>
        <p className="mb-1 text-sm font-semibold">{t("filters.status")}</p>
        {(Object.keys(BOARD_VIEWS) as BoardView[]).map((view) => (
          <Button
            key={view}
            variant={filters.view === view ? "secondary" : "ghost"}
            aria-pressed={filters.view === view}
            className="justify-start"
            onClick={() => update({ view })}
          >
            {t(`view.${view}`)}
          </Button>
        ))}
      </div>
      <Separator />
      <div className="flex flex-col gap-1" role="group" aria-label={t("filters.category")}>
        <p className="mb-1 text-sm font-semibold">{t("filters.category")}</p>
        <Button
          variant={filters.category === null ? "secondary" : "ghost"}
          aria-pressed={filters.category === null}
          className="justify-start"
          onClick={() => update({ category: null })}
        >
          {t("filters.allCategories")}
        </Button>
        {lookups.categories.map((category) => (
          <Button
            key={category.id}
            variant={filters.category === category.slug ? "secondary" : "ghost"}
            aria-pressed={filters.category === category.slug}
            className="justify-start"
            onClick={() => update({ category: category.slug })}
          >
            <CategoryIcon icon={category.icon} data-icon="inline-start" />
            {localized(category, "name", locale)}
          </Button>
        ))}
      </div>
      <Separator />
      <Field>
        <FieldLabel htmlFor="board-barangay">{t("filters.barangay")}</FieldLabel>
        <NativeSelect
          id="board-barangay"
          value={filters.barangay ?? ""}
          onChange={(event) => update({ barangay: event.target.value ? Number(event.target.value) : null })}
        >
          <NativeSelectOption value="">{t("filters.allBarangays")}</NativeSelectOption>
          {lookups.barangays.map((b) => (
            <NativeSelectOption key={b.id} value={b.id}>
              {b.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
    </div>
  );
}

/** Desktop: a left rail. */
export function BoardFilterRail({ filters, lookups }: { filters: BoardFilters; lookups: BoardLookups }) {
  const t = useTranslations("board");
  return (
    <aside className="hidden w-56 shrink-0 lg:block lg:group-data-[mode=map]/board:hidden" aria-label={t("filters.title")}>
      <div className="sticky top-24">
        <FilterControls filters={filters} lookups={lookups} />
      </div>
    </aside>
  );
}

/** Phone and tablet: the same controls in a sheet. */
/** `always` keeps the button on wide screens too, for when the left rail is hidden (the map view). */
export function BoardFilterSheet({
  filters,
  lookups,
  always = false,
}: {
  filters: BoardFilters;
  lookups: BoardLookups;
  always?: boolean;
}) {
  const t = useTranslations("board");
  const active = (filters.view !== "open" ? 1 : 0) + (filters.category ? 1 : 0) + (filters.barangay ? 1 : 0);
  return (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" className={always ? undefined : "lg:hidden"} />}>
        <SlidersHorizontal data-icon="inline-start" />
        {active ? t("filters.buttonActive", { count: active }) : t("filters.button")}
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85svh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("filters.title")}</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-6">
          <FilterControls filters={filters} lookups={lookups} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
