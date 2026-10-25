"use client";

import { MailCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { suggestEmail } from "@/lib/email-typo";
import { emailAddress } from "@/lib/report-schema";
import { type LoginState, sendMagicLink } from "./actions";

// Supabase waits 60 seconds between emails to one address by default; its own limit is the real one.
const RESEND_AFTER_SECONDS = 60;

export function LoginForm({ next }: { next: string }) {
  const t = useTranslations("login");
  const [state, action, pending] = useActionState<LoginState, FormData>(sendMagicLink, { status: "idle" });
  // The same check the action makes, run first so a mistyped address never leaves the page.
  const [invalid, setInvalid] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  // The result the Reporter was looking at when they chose to change the address; a newer result ends it.
  const [editingFrom, setEditingFrom] = useState<LoginState | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const showError = invalid || state.reason === "invalid";

  if (state.status === "sent" && editingFrom !== state) {
    return (
      <div className="flex flex-col gap-4">
        <Alert className="transition-[opacity,scale] duration-200 ease-out starting:scale-98 starting:opacity-0 motion-reduce:starting:scale-100">
          <MailCheck />
          <AlertTitle>{t("sentTitle")}</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <p>{t("sent", { email: state.email ?? "" })}</p>
            <p>{t("spam")}</p>
            <p>{t("otherApp")}</p>
          </AlertDescription>
        </Alert>
        <div className="flex flex-col gap-2 sm:flex-row">
          <form action={action} className="flex-1">
            <input type="hidden" name="next" value={next} />
            <input type="hidden" name="email" value={state.email} />
            <ResendButton key={state.sentAt} pending={pending} />
          </form>
          <Button
            type="button"
            variant="ghost"
            size="lg"
            className="h-11 text-base motion-safe:active:scale-[0.97]"
            onClick={() => setEditingFrom(state)}
          >
            {t("wrong")}
          </Button>
        </div>
      </div>
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
      className="flex flex-col gap-4"
    >
      {(state.reason === "rate_limited" || state.reason === "failed") && (
        <Alert variant="destructive" className="bg-card">
          <AlertDescription>{state.reason === "rate_limited" ? t("rateLimited") : t("failed")}</AlertDescription>
        </Alert>
      )}
      <input type="hidden" name="next" value={next} />
      <FieldGroup>
        <Field data-invalid={showError ? true : undefined}>
          <FieldLabel htmlFor="email">{t("email")}</FieldLabel>
          <Input
            ref={input}
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            // React resets the form after the action; this brings back what was typed on an error.
            defaultValue={state.email}
            className="h-11 text-base md:text-sm"
            onChange={() => {
              setInvalid(false);
              setSuggestion(null);
            }}
            onBlur={(event) => setSuggestion(suggestEmail(event.target.value))}
            aria-invalid={showError ? true : undefined}
          />
          {showError && <FieldError>{t("error")}</FieldError>}
          {suggestion && (
            <Button
              type="button"
              variant="link"
              className="h-auto self-start p-0 text-sm"
              onClick={() => {
                if (input.current) input.current.value = suggestion;
                setSuggestion(null);
              }}
            >
              {t("didYouMean", { email: suggestion })}
            </Button>
          )}
        </Field>
        <Button type="submit" size="lg" className="h-11 text-base motion-safe:active:scale-[0.97]" disabled={pending}>
          {pending && <Spinner data-icon="inline-start" />}
          {t("submit")}
        </Button>
      </FieldGroup>
    </form>
  );
}

/** Send again, available once the countdown ends. Mount it anew (change `key`) to restart the countdown. */
function ResendButton({ pending }: { pending: boolean }) {
  const t = useTranslations("login");
  const [seconds, setSeconds] = useState(RESEND_AFTER_SECONDS);
  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  return (
    <Button
      type="submit"
      variant="outline"
      size="lg"
      className="h-11 w-full text-base tabular-nums motion-safe:active:scale-[0.97]"
      disabled={pending || seconds > 0}
    >
      {pending && <Spinner data-icon="inline-start" />}
      {seconds > 0 ? t("resendIn", { seconds }) : t("resend")}
    </Button>
  );
}
