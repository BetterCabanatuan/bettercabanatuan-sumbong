"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { setLocale } from "@/i18n/actions";
import { finishRouteProgress, startRouteProgress } from "@/lib/route-progress";

export function LanguageToggle() {
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // The locale lives in a cookie, so the URL never changes; the transition ending is the only
  // thing the top progress bar can wait for.
  useEffect(() => {
    if (!pending) finishRouteProgress();
  }, [pending]);

  return (
    <ToggleGroup
      value={[locale]}
      onValueChange={(value) => {
        const next = value[0];
        if (!next || next === locale) return;
        startRouteProgress();
        startTransition(async () => {
          await setLocale(next);
          router.refresh();
        });
      }}
      variant="outline"
      size="sm"
      spacing={0}
      aria-label="Wika / Language"
      aria-busy={pending}
    >
      <ToggleGroupItem value="fil" aria-label="Filipino">
        FIL
      </ToggleGroupItem>
      <ToggleGroupItem value="en" aria-label="English">
        EN
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
