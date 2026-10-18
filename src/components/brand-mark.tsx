import { cn } from "@/lib/utils";

/** The Philippine sun on capitol navy: BetterCabanatuan's mark for Sumbong. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8 shrink-0", className)} aria-hidden="true">
      <rect width="32" height="32" rx="8" className="fill-navy" />
      <circle cx="16" cy="16" r="5" className="fill-sun" />
      <g className="stroke-sun" strokeWidth="2" strokeLinecap="round">
        <path d="M16 5v3M16 24v3M5 16h3M24 16h3M8.2 8.2l2.1 2.1M21.7 21.7l2.1 2.1M8.2 23.8l2.1-2.1M21.7 10.3l2.1-2.1" />
      </g>
    </svg>
  );
}

/** The thin blue-and-red flag stripe from bettercabanatuan.org. */
export function FlagStripe() {
  return (
    <div className="flex h-1" aria-hidden="true">
      <div className="flex-1 bg-primary" />
      <div className="flex-1 bg-flag" />
    </div>
  );
}
