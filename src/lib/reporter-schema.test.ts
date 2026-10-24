import { describe, expect, it } from "vitest";
import { emailAddress } from "./report-schema";
import { followInput, reopenInput } from "./reporter-schema";

const reportId = "7f1c3c4e-2b8a-4d6e-9a1f-0c2d3e4f5a6b";

describe("reporter inputs", () => {
  it("ignores spaces around an email and rejects a partial one", () => {
    expect(emailAddress.parse(" juan@example.org ")).toBe("juan@example.org");
    expect(followInput.safeParse({ reportId, email: "juan@" }).success).toBe(false);
    expect(followInput.safeParse({ reportId, email: "juan@example.org", token: "abc" }).success).toBe(true);
  });

  it("limits a reopen note to 500 characters", () => {
    expect(reopenInput.safeParse({ reportId, note: "x".repeat(500) }).success).toBe(true);
    expect(reopenInput.safeParse({ reportId, note: "x".repeat(501) }).success).toBe(false);
  });
});
