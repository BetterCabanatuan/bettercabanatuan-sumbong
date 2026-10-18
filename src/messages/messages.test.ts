import { describe, expect, it } from "vitest";
import en from "./en.json";
import fil from "./fil.json";

function keys(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) return [`${prefix}[${value.length}]`];
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
  }
  return [prefix];
}

describe("messages", () => {
  it("has the same keys in Filipino and English", () => {
    expect(keys(fil).sort()).toEqual(keys(en).sort());
  });
});
