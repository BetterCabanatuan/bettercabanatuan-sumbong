import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("quotes commas, quotes and line breaks, and starts with a byte-order mark", () => {
    const csv = toCsv(["code", "note"], [["CBN-1", 'He said "deep", near the store\nsecond line']]);
    expect(csv).toBe('﻿code,note\r\nCBN-1,"He said ""deep"", near the store\nsecond line"\r\n');
  });

  it("stops text from running as a spreadsheet formula", () => {
    const csv = toCsv(["description"], [["=HYPERLINK(\"http://x\")"], ["-1"], ["@SUM(A1)"]]);
    expect(csv.split("\r\n").slice(1, 4)).toEqual(['"\'=HYPERLINK(""http://x"")"', "'-1", "'@SUM(A1)"]);
  });

  it("leaves numbers and empty cells alone", () => {
    expect(toCsv(["n", "x"], [[-3, null]])).toBe("﻿n,x\r\n-3,\r\n");
  });
});
