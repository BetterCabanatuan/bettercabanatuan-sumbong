"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { subscribeRouteProgress } from "@/lib/route-progress";
import { cn } from "@/lib/utils";

/** A navigation faster than this never shows the bar, so prefetched routes do not flash it. */
const SHOW_DELAY = 150;
/** How long the bar takes to creep one step toward 90% while the next route renders. */
const CREEP_STEP = 320;
const FINISH_MS = 180;
const FADE_MS = 200;
/** A navigation that never settles must not leave the bar on screen. */
const TIMEOUT = 10_000;

type Phase = "idle" | "loading" | "finishing";

/** Whether this click will be handled by the router as a client navigation. */
function startsNavigation(event: MouseEvent) {
  if (event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (!(anchor instanceof HTMLAnchorElement)) return false;
  if (anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return false;
  const next = new URL(anchor.href, location.href);
  // Off-site links (mailto:, tel:, Facebook share) load outside the app.
  if (next.origin !== location.origin) return false;
  // A hash or the URL we are already on does not need a new route.
  return next.pathname !== location.pathname || next.search !== location.search;
}

/**
 * The thin line across the top of the viewport while the next route renders. It starts with any
 * Link click, and the router only changes the URL once the new route has committed, so that is
 * when it finishes. Moves without a Link report themselves through `src/lib/route-progress.ts`.
 */
export function RouteProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [phase, setPhase] = useState<Phase>("idle");
  const [width, setWidth] = useState(0);
  const running = useRef(false);
  const shown = useRef(false);
  const timers = useRef<number[]>([]);
  const reduceMotion = useRef(false);

  useEffect(() => {
    reduceMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const clearTimers = useCallback(() => {
    for (const timer of timers.current) window.clearTimeout(timer);
    timers.current = [];
  }, []);

  const finish = useCallback(() => {
    if (!running.current) return;
    running.current = false;
    clearTimers();
    // The route committed before the bar was even due: nothing to show.
    if (!shown.current) return;
    shown.current = false;
    setPhase("finishing");
    setWidth(100);
    // Fill first, then fade out over the flag stripe, and only then rewind out of sight.
    timers.current.push(
      window.setTimeout(() => setPhase("idle"), FINISH_MS + FADE_MS),
      window.setTimeout(() => setWidth(0), FINISH_MS + FADE_MS + 50),
    );
  }, [clearTimers]);

  const begin = useCallback(() => {
    if (running.current) return;
    running.current = true;
    clearTimers();
    timers.current.push(
      window.setTimeout(() => {
        shown.current = true;
        setPhase("loading");
        setWidth(12);
      }, SHOW_DELAY),
      window.setTimeout(finish, TIMEOUT),
    );
  }, [clearTimers, finish]);

  // The bar creeps toward 90% while the route renders, so it never looks stuck or finished early.
  useEffect(() => {
    if (phase !== "loading") return;
    if (reduceMotion.current) {
      setWidth(100);
      return;
    }
    const timer = window.setInterval(() => {
      setWidth((current) => (current >= 90 ? current : current + (90 - current) * 0.16));
    }, CREEP_STEP);
    return () => window.clearInterval(timer);
  }, [phase]);

  // The URL catches up when the new route commits; that is the end of the navigation.
  useEffect(() => {
    finish();
  }, [pathname, search, finish]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (startsNavigation(event)) begin();
    };
    const unsubscribe = subscribeRouteProgress((event) => (event === "start" ? begin() : finish()));

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", begin);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", begin);
      unsubscribe();
      clearTimers();
    };
  }, [begin, finish, clearTimers]);

  return (
    <div data-slot="route-progress" aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-50 h-1 no-print">
      <div
        className={cn(
          "h-full bg-sun ease-out transition-[width,opacity] motion-reduce:transition-none",
          phase === "idle" ? "opacity-0" : "opacity-100",
        )}
        style={{
          width: `${width}%`,
          transitionDuration: phase === "finishing" ? `${FINISH_MS}ms, ${FADE_MS}ms` : `${CREEP_STEP + 80}ms, 150ms`,
        }}
      />
    </div>
  );
}
