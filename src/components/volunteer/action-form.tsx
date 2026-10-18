"use client";

import { CircleCheck, TriangleAlert } from "lucide-react";
import { type ReactNode, useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { VolunteerActionResult } from "@/app/v/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/** A form bound to a Volunteer server action that shows its error or success message inline. */
export function ActionForm({
  action,
  children,
  className,
  success,
}: {
  action: (form: FormData) => Promise<VolunteerActionResult>;
  children: ReactNode;
  className?: string;
  success?: string;
}) {
  const [state, formAction] = useActionState<VolunteerActionResult | null, FormData>(
    (_previous, form) => action(form),
    null,
  );
  return (
    <form action={formAction} className={className}>
      {children}
      {state && !state.ok && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {state?.ok && success && (
        <Alert>
          <CircleCheck />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}
    </form>
  );
}

export function SubmitButton({
  children,
  variant = "default",
  className,
}: {
  children: ReactNode;
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending} className={className}>
      {pending && <Spinner data-icon="inline-start" />}
      {children}
    </Button>
  );
}
