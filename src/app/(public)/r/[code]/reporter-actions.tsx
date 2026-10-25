"use client";

import { Copy, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { followByEmail, reopenAsFollower } from "@/app/actions/reporter";
import { useMeToo, useMyMeToos } from "@/components/board/use-me-too";
import { VoteButton } from "@/components/board/vote-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { ReporterCredentials } from "@/lib/reporter-access";
import { followInput, reopenInput } from "@/lib/reporter-schema";

const confirmationEnter =
  "transition-[opacity,scale] duration-200 ease-out starting:scale-98 starting:opacity-0 motion-reduce:starting:scale-100";

export function ThreadVote({ reportId, count, open }: { reportId: string; count: number; open: boolean }) {
  const meToo = useMeToo();
  const { data: mine } = useMyMeToos();
  const [current, setCurrent] = useState(count);
  const pressed = mine?.has(reportId) ?? false;

  return (
    <VoteButton
      size="lg"
      count={current}
      pressed={pressed}
      disabled={!open || meToo.isPending}
      onPress={() =>
        meToo.mutate(reportId, {
          onSuccess: (result) => setCurrent(result.count),
        })
      }
    />
  );
}

export function ShareCard({ url, title }: { url: string; title: string }) {
  const t = useTranslations("reportPage.share");
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Button
          variant="outline"
          className="h-10"
          onClick={async () => {
            await navigator.clipboard.writeText(url);
            toast.success(t("copied"));
          }}
        >
          <Copy data-icon="inline-start" />
          {t("copy")}
        </Button>
        <Button
          variant="outline"
          className="h-10"
          nativeButton={false}
          render={
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(title)}`}
              target="_blank"
              rel="noreferrer"
            />
          }
        >
          <Share2 data-icon="inline-start" />
          {t("facebook")}
        </Button>
      </CardContent>
    </Card>
  );
}

export function ReopenForm({ reportId, credentials }: { reportId: string; credentials: ReporterCredentials }) {
  const t = useTranslations("reportPage.reopen");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  if (done) {
    return (
      <Card className={confirmationEnter}>
        <CardHeader>
          <CardTitle>{t("done")}</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("lead")}</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor="reopen-note" className="sr-only">
              {t("placeholder")}
            </FieldLabel>
            <Textarea
              id="reopen-note"
              value={note}
              maxLength={500}
              onChange={(e) => {
                setNote(e.target.value);
                setError(null);
              }}
              placeholder={t("placeholder")}
              aria-invalid={error ? true : undefined}
            />
            {error && <FieldError>{t(`errors.${error}`)}</FieldError>}
          </Field>
        </FieldGroup>
      </CardContent>
      <CardFooter>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const input = { reportId, note, ...credentials };
              if (!reopenInput.safeParse(input).success) return setError("invalid_input");
              const result = await reopenAsFollower(input);
              if (result.ok) setDone(true);
              else setError(result.error);
            })
          }
        >
          {pending && <Spinner data-icon="inline-start" />}
          {t("submit")}
        </Button>
      </CardFooter>
    </Card>
  );
}

export function FollowForm({ reportId, credentials }: { reportId: string; credentials: ReporterCredentials }) {
  const t = useTranslations("reportPage.follow");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  if (done) {
    return (
      <Card className={confirmationEnter}>
        <CardHeader>
          <CardTitle>{t("done")}</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          id="follow-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const input = { reportId, email, ...credentials };
            if (!followInput.safeParse(input).success) return setError("invalid_email");
            startTransition(async () => {
              const result = await followByEmail(input);
              if (result.ok) setDone(true);
              else setError(result.error);
            });
          }}
        >
          <FieldGroup>
            <Field data-invalid={error ? true : undefined}>
              <FieldLabel htmlFor="follow-email">{t("email")}</FieldLabel>
              <Input
                id="follow-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                aria-invalid={error ? true : undefined}
              />
              {error && <FieldError>{t(`errors.${error}`)}</FieldError>}
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
      <CardFooter>
        <Button type="submit" form="follow-form" variant="outline" disabled={pending}>
          {pending && <Spinner data-icon="inline-start" />}
          {t("submit")}
        </Button>
      </CardFooter>
    </Card>
  );
}
