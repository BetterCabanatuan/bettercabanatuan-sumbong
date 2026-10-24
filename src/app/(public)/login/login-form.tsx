"use client";

import { MailCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { emailAddress } from "@/lib/report-schema";
import { type LoginState, sendMagicLink } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const t = useTranslations("login");
  const [state, action, pending] = useActionState<LoginState, FormData>(sendMagicLink, { status: "idle" });
  // The same check the action makes, run first so a mistyped address never leaves the page.
  const [invalid, setInvalid] = useState(false);
  const showError = invalid || state.status === "error";

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
    <form
      action={action}
      noValidate
      onSubmit={(event) => {
        const ok = emailAddress.safeParse(new FormData(event.currentTarget).get("email")).success;
        setInvalid(!ok);
        if (!ok) event.preventDefault();
      }}
    >
      <input type="hidden" name="next" value={next} />
      <FieldGroup>
        <Field data-invalid={showError ? true : undefined}>
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
            onChange={() => setInvalid(false)}
            aria-invalid={showError ? true : undefined}
          />
          {showError && <FieldError>{t("error")}</FieldError>}
        </Field>
        <Button type="submit" size="lg" className="h-11 text-base" disabled={pending}>
          {pending && <Spinner data-icon="inline-start" />}
          {t("submit")}
        </Button>
      </FieldGroup>
    </form>
  );
}
