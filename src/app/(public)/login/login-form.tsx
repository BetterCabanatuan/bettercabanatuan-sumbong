"use client";

import { MailCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { type LoginState, sendMagicLink } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const t = useTranslations("login");
  const [state, action, pending] = useActionState<LoginState, FormData>(sendMagicLink, { status: "idle" });

  if (state.status === "sent") {
    return (
      <Alert className="transition-[opacity,scale] duration-200 ease-out starting:scale-98 starting:opacity-0 motion-reduce:starting:scale-100">
        <MailCheck />
        <AlertTitle>{t("sentTitle")}</AlertTitle>
        <AlertDescription>{t("sent", { email: state.email ?? "" })}</AlertDescription>
      </Alert>
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="next" value={next} />
      <FieldGroup>
        <Field data-invalid={state.status === "error" ? true : undefined}>
          <FieldLabel htmlFor="email">{t("email")}</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            // React resets the form after the action; this brings back what was typed on an error.
            defaultValue={state.email}
            className="h-11 text-base md:text-sm"
            aria-invalid={state.status === "error" ? true : undefined}
          />
          {state.status === "error" && <FieldError>{t("error")}</FieldError>}
        </Field>
        <Button type="submit" size="lg" className="h-11 text-base" disabled={pending}>
          {pending && <Spinner data-icon="inline-start" />}
          {t("submit")}
        </Button>
      </FieldGroup>
    </form>
  );
}
