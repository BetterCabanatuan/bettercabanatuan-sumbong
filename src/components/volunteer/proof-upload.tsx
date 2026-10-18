"use client";

import { useState, useTransition } from "react";
import { setDigestProof } from "@/app/v/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { toUploadableJpeg } from "@/lib/image";
import { PROOFS_BUCKET } from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";

export function ProofUpload({ digestId }: { digestId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor="proof">Proof of Receipt</FieldLabel>
      <Input id="proof" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <FieldDescription>A photo of the “received” stamp or signature on your copy of the letter.</FieldDescription>
      {error && <FieldError>{error}</FieldError>}
      <Button
        variant="outline"
        className="self-start"
        disabled={!file || pending}
        onClick={() =>
          startTransition(async () => {
            try {
              const path = `${digestId}/${crypto.randomUUID()}.jpg`;
              const { error: uploadError } = await createClient()
                .storage.from(PROOFS_BUCKET)
                .upload(path, await toUploadableJpeg(file!), { contentType: "image/jpeg" });
              if (uploadError) throw uploadError;
              const result = await setDigestProof(digestId, path);
              if (!result.ok) setError(result.error);
            } catch (e) {
              setError((e as Error).message);
            }
          })
        }
      >
        {pending && <Spinner data-icon="inline-start" />}
        Upload
      </Button>
    </Field>
  );
}
