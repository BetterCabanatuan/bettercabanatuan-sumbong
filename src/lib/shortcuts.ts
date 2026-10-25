import { SETTINGS, WORK } from "@/components/volunteer/nav";
import type { Permission } from "@/lib/types";

/** How long after `G` the second key of a go-to chord still counts. */
export const CHORD_TIMEOUT_MS = 1500;

export interface KeyLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  isComposing?: boolean;
  target?: { tagName?: string; isContentEditable?: boolean } | null;
}

/** An element the user types into: single-key shortcuts must never fire from here. */
export function isTypingTarget(target: KeyLike["target"]): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName?.toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export interface Destination {
  href: string;
  label: string;
  chord: string;
  group: "Work" | "Settings";
}

/** The pages this role may open, with their go-to letter. Only destinations the role has permission for. */
export function destinationsFor(permissions: Permission[]): Destination[] {
  const allowed = (item: { permission?: Permission }) => !item.permission || permissions.includes(item.permission);
  const out: Destination[] = [];
  for (const item of WORK) {
    if (allowed(item) && item.chord) out.push({ href: item.href, label: item.label, chord: item.chord, group: "Work" });
  }
  for (const item of SETTINGS) {
    if (allowed(item)) out.push({ href: item.href, label: item.label, chord: "", group: "Settings" });
  }
  return out;
}

export type ShortcutAction = { type: "go"; href: string } | { type: "help" } | { type: "palette" };

export interface ShortcutState {
  /** When `G` was pressed, or null if no chord is waiting for its second key. */
  armedAt: number | null;
}

/**
 * One step of the global shortcut machine, with no DOM in it so it can be tested.
 * `?` opens help, Cmd/Ctrl+K the palette, `G` then a letter goes to a page the role may open.
 * Anything typed into a field, held with Ctrl/Meta/Alt (except Cmd/Ctrl+K) or mid-IME is ignored.
 */
export function stepShortcuts(
  state: ShortcutState,
  event: KeyLike,
  now: number,
  destinations: Destination[],
): { state: ShortcutState; action: ShortcutAction | null; handled: boolean } {
  const idle: ShortcutState = { armedAt: null };
  const key = event.key.toLowerCase();

  if ((event.metaKey || event.ctrlKey) && !event.altKey && key === "k") {
    return { state: idle, action: { type: "palette" }, handled: true };
  }
  if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target)) {
    return { state: state, action: null, handled: false };
  }
  if (event.key === "?") return { state: idle, action: { type: "help" }, handled: true };

  const armed = state.armedAt !== null && now - state.armedAt <= CHORD_TIMEOUT_MS;
  if (armed) {
    const target = destinations.find((d) => d.chord === key);
    // Any key ends the chord, whether or not it matched.
    return target
      ? { state: idle, action: { type: "go", href: target.href }, handled: true }
      : { state: idle, action: null, handled: false };
  }
  if (key === "g" && !event.shiftKey) return { state: { armedAt: now }, action: null, handled: false };
  return { state: idle, action: null, handled: false };
}
