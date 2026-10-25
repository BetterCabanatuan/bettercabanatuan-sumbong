"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizeReportCode } from "@/lib/report-code";

/**
 * Find a Report from its code or a pasted link. Client-side only: it never asks the server whether
 * a code exists, so it cannot be used to guess at unpublished Reports. The Report page decides what to show.
 */
export function CodeLookup({ className }: { className?: string }) {
  const t = useTranslations("board.lookup");
  const router = useRouter();
  const id = useId();
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);

  return (
    <form
      className={className}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const code = normalizeReportCode(value);
        if (!code) return setInvalid(true);
        // Keep the Reporter's private link parameters if a full link was pasted.
        const search = value.match(/\/r\/[^?#\s]*(\?[^#\s]*)/i)?.[1] ?? "";
        router.push(`/r/${code}${search}`);
      }}
    >
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {t("label")}
      </label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setInvalid(false);
          }}
          placeholder={t("placeholder")}
          aria-invalid={invalid}
          aria-describedby={`${id}-help`}
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          className="h-11 font-mono"
        />
        <Button type="submit" variant="outline" className="h-11 shrink-0 px-4">
          <Search data-icon="inline-start" />
          {t("submit")}
        </Button>
      </div>
      <p
        id={`${id}-help`}
        role={invalid ? "alert" : undefined}
        className={invalid ? "mt-1.5 text-sm text-destructive" : "mt-1.5 text-sm text-muted-foreground"}
      >
        {invalid ? t("invalid") : t("hint")}
      </p>
    </form>
  );
}
