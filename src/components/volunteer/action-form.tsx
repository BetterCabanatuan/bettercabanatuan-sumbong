"use client";

import { CircleCheck, TriangleAlert } from "lucide-react";
import { createContext, type FormEvent, type ReactNode, startTransition, use, useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";
import type { VolunteerActionResult } from "@/app/v/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

const PendingContext = createContext(false);

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
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<VolunteerActionResult | null, FormData>(
    async (_previous, form) => {
      const result = await action(form);
      if (result.ok) formRef.current?.reset();
      return result;
    },
    null,
  );
  // Submitting through onSubmit instead of `action` stops React from clearing the fields
  // when the action returns an error, so the Volunteer can fix it and try again.
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter);
    startTransition(() => formAction(form));
  }
  return (
    <form ref={formRef} onSubmit={submit} className={className}>
      <PendingContext value={pending}>{children}</PendingContext>
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
  disabled,
  className,
}: {
  children: ReactNode;
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
  disabled?: boolean;
  className?: string;
}) {
  const { pending: formPending } = useFormStatus();
  const pending = use(PendingContext) || formPending;
  return (
    <Button type="submit" variant={variant} disabled={disabled || pending} className={className}>
      {pending && <Spinner data-icon="inline-start" />}
      {children}
    </Button>
  );
}
