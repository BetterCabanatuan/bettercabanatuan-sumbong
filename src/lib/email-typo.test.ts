import { describe, expect, it } from "vitest";
import { suggestEmail } from "./email-typo";

describe("suggestEmail", () => {
  it("fixes common gmail typos and keeps the local part", () => {
    expect(suggestEmail("Juan.Cruz@gmial.com")).toBe("Juan.Cruz@gmail.com");
    expect(suggestEmail("a@gamil.com")).toBe("a@gmail.com");
    expect(suggestEmail("a@gmal.com")).toBe("a@gmail.com");
    expect(suggestEmail("a@gmail.con")).toBe("a@gmail.com");
  });

  it("ignores case and surrounding spaces in the domain", () => {
    expect(suggestEmail("  a@GMIAL.COM ")).toBe("a@gmail.com");
  });

  it("leaves correct, unknown or incomplete addresses alone", () => {
    expect(suggestEmail("a@gmail.com")).toBeNull();
    expect(suggestEmail("a@cabanatuan.gov.ph")).toBeNull();
    expect(suggestEmail("@gmial.com")).toBeNull();
    expect(suggestEmail("gmial.com")).toBeNull();
    expect(suggestEmail("")).toBeNull();
  });
});
