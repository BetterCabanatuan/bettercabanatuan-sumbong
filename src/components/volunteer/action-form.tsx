"use client";

import { CircleCheck, TriangleAlert } from "lucide-react";
import {
  createContext,
  type FormEvent,
  type ReactNode,
  startTransition,
  use,
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useFormStatus } from "react-dom";
import type { VolunteerActionResult } from "@/app/v/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { checkVolunteerForm, type FieldErrors, type VolunteerForm } from "@/lib/volunteer-forms";

const PendingContext = createContext(false);
const FieldErrorsContext = createContext<{ fields: FieldErrors; show: (name: string) => () => void }>({
  fields: {},
  show: () => () => {},
});

/**
 * A form bound to a Volunteer server action that shows its error or success message inline.
 * With `schema`, the form is checked against that schema (src/lib/volunteer-forms.ts) before
 * the action is called; the action checks it again. Problems with a field show at its
 * `<ActionFieldError name>`, and any without one show in the alert.
 */
export function ActionForm({
  action,
  schema,
  children,
  className,
  success,
}: {
  action: (form: FormData) => Promise<VolunteerActionResult>;
  schema?: VolunteerForm;
  children: ReactNode;
  className?: string;
  success?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<VolunteerActionResult | null, FormData>(
    async (_previous, form) => {
      if (schema) {
        const checked = checkVolunteerForm(schema, form);
        if (!checked.ok) return checked;
      }
      const result = await action(form);
      if (result.ok) formRef.current?.reset();
      return result;
    },
    null,
  );
  const fields = useMemo(() => (state && !state.ok && state.fields) || {}, [state]);

  // Names that have an <ActionFieldError> in this form.
  const [shown, setShown] = useState<ReadonlySet<string>>(new Set());
  const show = useCallback((name: string) => {
    setShown((current) => new Set(current).add(name));
    return () =>
      setShown((current) => {
        const next = new Set(current);
        next.delete(name);
        return next;
      });
  }, []);
  const unshown = Object.entries(fields).filter(([name]) => !shown.has(name));
  const message = !state || state.ok ? null : state.fields ? unshown.map(([, error]) => error).join(" ") : state.error;

  // The inputs are uncontrolled, so mark them here and move focus to the first one to fix.
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    let first: HTMLElement | null = null;
    for (const element of Array.from(form.elements) as HTMLInputElement[]) {
      if (!element.name || element.type === "hidden") continue;
      const invalid = element.name in fields;
      if (invalid) element.setAttribute("aria-invalid", "true");
      else element.removeAttribute("aria-invalid");
      if (invalid && !first) first = element;
    }
    first?.focus();
  }, [fields]);

  // Submitting through onSubmit instead of `action` stops React from clearing the fields
  // when the action returns an error, so the Volunteer can fix it and try again.
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter);
    startTransition(() => formAction(form));
  }
  return (
    <form ref={formRef} onSubmit={submit} noValidate={!!schema} className={className}>
      <PendingContext value={pending}>
        <FieldErrorsContext value={{ fields, show }}>{children}</FieldErrorsContext>
      </PendingContext>
      {message && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertDescription>{message}</AlertDescription>
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

/** The problem with one field of the surrounding `ActionForm`, if it has one. */
export function ActionFieldError({ name }: { name: string }) {
  const { fields, show } = use(FieldErrorsContext);
  useEffect(() => show(name), [name, show]);
  return <FieldError>{fields[name]}</FieldError>;
}
