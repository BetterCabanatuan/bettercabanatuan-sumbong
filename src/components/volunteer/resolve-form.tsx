"use client";

import { useState, useTransition } from "react";
import { resolveReport } from "@/app/v/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { toUploadableJpeg } from "@/lib/image";
import { ORIGINALS_BUCKET, PUBLIC_BUCKET } from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";
import { volunteerForms } from "@/lib/volunteer-forms";

/** Marks a Report Resolved, ideally with an "after" photo that becomes public. */
export function ResolveForm({ reportId }: { reportId: string }) {
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    // Same check as resolveReport, before an "after" photo is uploaded for nothing.
    const checked = volunteerForms.resolve.safeParse({ note });
    if (!checked.success) return setError(checked.error.issues[0].message);
    startTransition(async () => {
      setError(null);
      try {
        let afterPhoto: { originalPath: string; publicPath: string } | undefined;
        if (file) {
          const jpeg = await toUploadableJpeg(file);
          const name = `${reportId}/after-${crypto.randomUUID()}.jpg`;
          const supabase = createClient();
          for (const bucket of [ORIGINALS_BUCKET, PUBLIC_BUCKET]) {
            const { error: uploadError } = await supabase.storage
              .from(bucket)
              .upload(name, jpeg, { contentType: "image/jpeg" });
            if (uploadError) throw uploadError;
          }
          afterPhoto = { originalPath: name, publicPath: name };
        }
        const result = await resolveReport(reportId, { note, afterPhoto });
        if (!result.ok) setError(result.error);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mark Resolved</CardTitle>
        <CardDescription>Followers are emailed and can reopen it within 30 days.</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="after-photo">“After” photo (recommended)</FieldLabel>
            <Input id="after-photo" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <FieldDescription>Becomes public. Make sure it shows no faces or plate numbers.</FieldDescription>
          </Field>
          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor="resolve-note">How do you know it is fixed?</FieldLabel>
            <Textarea id="resolve-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
            {error && <FieldError>{error}</FieldError>}
          </Field>
        </FieldGroup>
      </CardContent>
      <CardFooter>
        <Button onClick={submit} disabled={pending}>
          {pending && <Spinner data-icon="inline-start" />}
          Mark Resolved
        </Button>
      </CardFooter>
    </Card>
  );
}
