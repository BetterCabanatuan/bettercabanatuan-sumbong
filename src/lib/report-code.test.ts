import { describe, expect, it } from "vitest";
import { normalizeReportCode } from "./report-code";

describe("normalizeReportCode", () => {
  it("accepts a clean code", () => {
    expect(normalizeReportCode("CBN-ABC234")).toBe("CBN-ABC234");
  });

  it("upper-cases and trims", () => {
    expect(normalizeReportCode("  cbn-abc234 ")).toBe("CBN-ABC234");
  });

  it("ignores spaces inside the code and a missing dash or prefix", () => {
    expect(normalizeReportCode("cbn abc 234")).toBe("CBN-ABC234");
    expect(normalizeReportCode("CBNABC234")).toBe("CBN-ABC234");
    expect(normalizeReportCode("abc234")).toBe("CBN-ABC234");
  });

  it("extracts the code from a pasted link, with or without the private token", () => {
    expect(normalizeReportCode("https://sumbong.example/r/CBN-ABC234")).toBe("CBN-ABC234");
    expect(normalizeReportCode("https://sumbong.example/r/cbn-abc234?t=secret&f=1#top")).toBe("CBN-ABC234");
    expect(normalizeReportCode("/r/CBN-ABC234/")).toBe("CBN-ABC234");
  });

  it("rejects the wrong length", () => {
    expect(normalizeReportCode("CBN-ABC23")).toBeNull();
    expect(normalizeReportCode("CBN-ABC2345")).toBeNull();
    expect(normalizeReportCode("")).toBeNull();
  });

  it("rejects characters the generator never uses", () => {
    expect(normalizeReportCode("CBN-ABC0I1")).toBeNull();
    expect(normalizeReportCode("CBN-OOOOOO")).toBeNull();
  });

  it("rejects junk and SQL-looking input", () => {
    expect(normalizeReportCode("'; drop table reports; --")).toBeNull();
    expect(normalizeReportCode("CBN-ABC234' or '1'='1")).toBeNull();
    expect(normalizeReportCode("https://sumbong.example/about")).toBeNull();
    expect(normalizeReportCode("CBN-ABC234\nCBN-ABC235")).toBeNull();
  });
});
