"use client";

import { useSyncExternalStore } from "react";

/**
 * Which Report is "in focus" between the list and the map on wide screens: the card under the
 * pointer or keyboard highlights its marker, and a marker click scrolls the list to its card.
 * A tiny external store keyed by Report id, so it stays out of the board's query layer.
 */
let hoveredId: string | null = null;
let selectedId: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setHoveredReport(id: string | null) {
  if (hoveredId === id) return;
  hoveredId = id;
  emit();
}

export function setSelectedReport(id: string | null) {
  selectedId = id;
  emit();
}

/** The id to highlight on the map: a hovered card wins over the last selected marker. */
export function useHighlightedReport(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => hoveredId ?? selectedId,
    () => null,
  );
}

export function useSelectedReport(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => selectedId,
    () => null,
  );
}
