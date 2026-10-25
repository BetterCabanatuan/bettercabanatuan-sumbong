export type BlockedStep = "location" | "category" | "nearby" | "details" | "review";

export type BlockedReason =
  | { kind: "pin" }
  | { kind: "category" }
  | { kind: "answer"; questionId: string; prompt: string }
  | { kind: "photo" }
  | { kind: "captcha" };

type Question = { id: string; required: boolean; prompt: string };

/** What stops the Reporter from leaving `step`, or null when they can go on. Only the first reason is given. */
export function blockedReason(
  step: BlockedStep,
  state: {
    hasPin: boolean;
    hasCategory: boolean;
    questions: Question[];
    answers: Record<string, string>;
    photoCount: number;
    hasCaptcha: boolean;
  },
): BlockedReason | null {
  switch (step) {
    case "location":
      return state.hasPin ? null : { kind: "pin" };
    case "category": {
      if (!state.hasCategory) return { kind: "category" };
      const missing = state.questions.find((q) => q.required && !state.answers[q.id]?.trim());
      return missing ? { kind: "answer", questionId: missing.id, prompt: missing.prompt } : null;
    }
    case "details":
      return state.photoCount > 0 ? null : { kind: "photo" };
    case "review":
      return state.hasCaptcha ? null : { kind: "captcha" };
    default:
      return null;
  }
}
