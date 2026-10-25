import { CircleCheck, CircleDashed } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Where a Digest is in its life, from state that already exists: it is a Draft until `sent_at`,
 * and the office's Proof of Receipt is optional. There is no "Printed" step because nothing records it.
 */
export function DigestProgress({ sent, hasProof }: { sent: boolean; hasProof: boolean }) {
  const steps = [
    { label: "Draft ready", done: true },
    { label: "Sent and logged", done: sent },
    { label: "Proof of Receipt", done: hasProof, optional: true },
  ];
  const hint = !sent
    ? "Print the letter, send it through the office’s channel, then log it below."
    : !hasProof
      ? "Logged. Upload the office’s Proof of Receipt when you have it."
      : "Logged, with Proof of Receipt.";

  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-4">
      <ol className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Digest progress">
        {steps.map((step, i) => (
          <li key={step.label} className={cn("flex items-center gap-2 text-sm", step.done ? "font-medium" : "text-muted-foreground")}>
            {step.done ? (
              <CircleCheck className="size-4 shrink-0 text-status-resolved-foreground" />
            ) : (
              <CircleDashed className="size-4 shrink-0" />
            )}
            <span>
              {i + 1}. {step.label}
              {step.optional && <span className="font-normal text-muted-foreground"> (optional)</span>}
              <span className="sr-only">{step.done ? ", done" : ", not done"}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}
