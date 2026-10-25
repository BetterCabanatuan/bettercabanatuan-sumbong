import { describe, expect, it } from "vitest";
import { blockedReason } from "./report-blocked";

const base = {
  hasPin: true,
  hasCategory: true,
  questions: [] as { id: string; required: boolean; prompt: string }[],
  answers: {} as Record<string, string>,
  photoCount: 1,
  hasCaptcha: true,
};

describe("blockedReason", () => {
  it("asks for a pin first", () => {
    expect(blockedReason("location", { ...base, hasPin: false })).toEqual({ kind: "pin" });
    expect(blockedReason("location", base)).toBeNull();
  });

  it("asks for a Category, then for the first unanswered required question", () => {
    expect(blockedReason("category", { ...base, hasCategory: false })).toEqual({ kind: "category" });
    const questions = [
      { id: "a", required: false, prompt: "Optional?" },
      { id: "b", required: true, prompt: "How deep?" },
      { id: "c", required: true, prompt: "Which lane?" },
    ];
    expect(blockedReason("category", { ...base, questions, answers: { c: "left" } })).toEqual({
      kind: "answer",
      questionId: "b",
      prompt: "How deep?",
    });
    expect(blockedReason("category", { ...base, questions, answers: { b: "deep", c: "left" } })).toBeNull();
  });

  it("treats a blank answer as missing", () => {
    const questions = [{ id: "b", required: true, prompt: "How deep?" }];
    expect(blockedReason("category", { ...base, questions, answers: { b: "  " } })?.kind).toBe("answer");
  });

  it("needs a photo on details and a captcha token on review", () => {
    expect(blockedReason("details", { ...base, photoCount: 0 })).toEqual({ kind: "photo" });
    expect(blockedReason("review", { ...base, hasCaptcha: false })).toEqual({ kind: "captcha" });
    expect(blockedReason("review", base)).toBeNull();
  });

  it("never blocks the nearby step", () => {
    expect(blockedReason("nearby", { ...base, hasPin: false, photoCount: 0 })).toBeNull();
  });
});
