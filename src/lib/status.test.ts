import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import { STATUS_BADGE, STATUS_ICON, STATUS_LABEL_EN, STATUS_ORDER } from "./status";

describe("status", () => {
  it("keeps the console's English labels in step with messages/en.json", () => {
    expect(STATUS_LABEL_EN).toEqual(en.status);
  });

  it("gives every status a badge, an icon and a label", () => {
    for (const status of STATUS_ORDER) {
      expect(STATUS_BADGE[status]).toBeTruthy();
      expect(STATUS_ICON[status]).toBeTruthy();
      expect(STATUS_LABEL_EN[status]).toBeTruthy();
    }
  });
});
