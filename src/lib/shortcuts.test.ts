import { describe, expect, it } from "vitest";
import { destinationsFor, isTypingTarget, stepShortcuts, type KeyLike, type ShortcutState } from "./shortcuts";

const full = destinationsFor(["reports.view", "reports.review", "digests.view", "categories.view"]);
const readOnly = destinationsFor(["reports.view"]);
const idle: ShortcutState = { armedAt: null };
const press = (state: ShortcutState, event: KeyLike, now = 0, dests = full) => stepShortcuts(state, event, now, dests);

describe("destinationsFor", () => {
  it("offers only pages the role may open", () => {
    expect(readOnly.map((d) => d.href)).toEqual(["/v", "/v/reports"]);
    expect(full.map((d) => d.href)).toEqual(["/v", "/v/review", "/v/reports", "/v/digests", "/v/settings/categories"]);
  });
});

describe("stepShortcuts", () => {
  it("goes to a page on G then its letter", () => {
    const armed = press(idle, { key: "g" }, 100);
    expect(armed.state.armedAt).toBe(100);
    const go = press(armed.state, { key: "r" }, 400);
    expect(go.action).toEqual({ type: "go", href: "/v/review" });
    expect(go.state.armedAt).toBeNull();
  });

  it("does nothing for a destination the role cannot open", () => {
    const armed = press(idle, { key: "g" }, 0, readOnly);
    expect(press(armed.state, { key: "r" }, 100, readOnly).action).toBeNull();
    expect(press(armed.state, { key: "p" }, 100, readOnly).action).toEqual({ type: "go", href: "/v/reports" });
  });

  it("forgets G after the timeout and after a non-matching key", () => {
    const armed = press(idle, { key: "g" }, 0);
    expect(press(armed.state, { key: "r" }, 5000).action).toBeNull();
    const wrong = press(armed.state, { key: "x" }, 100);
    expect(wrong.state.armedAt).toBeNull();
    expect(press(wrong.state, { key: "r" }, 200).action).toBeNull();
  });

  it("ignores keys typed into fields", () => {
    for (const tagName of ["INPUT", "TEXTAREA", "SELECT"]) {
      expect(isTypingTarget({ tagName })).toBe(true);
      expect(press(idle, { key: "?", target: { tagName } }).action).toBeNull();
      expect(press({ armedAt: 0 }, { key: "r", target: { tagName } }, 10).action).toBeNull();
    }
    expect(isTypingTarget({ tagName: "DIV", isContentEditable: true })).toBe(true);
    expect(isTypingTarget({ tagName: "BUTTON" })).toBe(false);
  });

  it("never intercepts browser or OS shortcuts", () => {
    expect(press({ armedAt: 0 }, { key: "r", metaKey: true }, 10).action).toBeNull();
    expect(press({ armedAt: 0 }, { key: "r", ctrlKey: true }, 10).action).toBeNull();
    expect(press(idle, { key: "?", altKey: true }).action).toBeNull();
    expect(press(idle, { key: "g", metaKey: true }).state.armedAt).toBeNull();
  });

  it("opens help on ? and the palette on Cmd/Ctrl+K, even from a field", () => {
    expect(press(idle, { key: "?", shiftKey: true }).action).toEqual({ type: "help" });
    expect(press(idle, { key: "k", metaKey: true }).action).toEqual({ type: "palette" });
    expect(press(idle, { key: "K", ctrlKey: true, target: { tagName: "INPUT" } }).action).toEqual({ type: "palette" });
    expect(press(idle, { key: "k" }).action).toBeNull();
  });

  it("ignores IME composition", () => {
    expect(press(idle, { key: "?", isComposing: true }).action).toBeNull();
  });
});
