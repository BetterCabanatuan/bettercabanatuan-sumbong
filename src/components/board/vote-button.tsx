"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * The board's signature control: the Philippine sun fills gold once you've said "Ako rin".
 * A toggle-like button with its own visual language, so it is not a shadcn Toggle variant.
 */
export function VoteButton({
  count,
  pressed,
  disabled,
  onPress,
  size = "default",
}: {
  count: number;
  pressed: boolean;
  disabled?: boolean;
  onPress: () => void;
  size?: "default" | "lg";
}) {
  const t = useTranslations("board");
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={t("meTooLabel", { count })}
      disabled={disabled || pressed}
      onClick={onPress}
      className={cn(
        "flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border font-semibold tabular-nums transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        size === "lg" ? "h-24 w-20 text-2xl" : "h-[72px] w-16 text-lg",
        pressed
          ? "border-transparent bg-sun text-sun-foreground"
          : "border-input bg-card text-foreground hover:border-sun hover:bg-sun/15",
        "disabled:cursor-default",
      )}
    >
      <svg viewBox="0 0 24 24" className={size === "lg" ? "size-6" : "size-5"} aria-hidden="true">
        <circle cx="12" cy="12" r="4" className={pressed ? "fill-current" : "fill-none stroke-muted-foreground"} strokeWidth="2" />
        <g className={pressed ? "stroke-current" : "stroke-muted-foreground"} strokeWidth="2" strokeLinecap="round">
          <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
        </g>
      </svg>
      <span className="leading-none">{count}</span>
      {size === "lg" && <span className="text-xs font-semibold">{t("meToo")}</span>}
    </button>
  );
}
