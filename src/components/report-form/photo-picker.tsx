"use client";

import { Camera, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { toUploadableJpeg } from "@/lib/image";
import { MAX_PHOTOS } from "@/lib/storage";

export function PhotoPicker({ photos, onChange }: { photos: Blob[]; onChange: (photos: Blob[]) => void }) {
  const t = useTranslations("reportForm.photos");
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previews = useMemo(() => photos.map((p) => URL.createObjectURL(p)), [photos]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  async function add(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      const room = MAX_PHOTOS - photos.length;
      const converted = await Promise.all(Array.from(files).slice(0, room).map((f) => toUploadableJpeg(f)));
      onChange([...photos, ...converted]);
      if (files.length > room) setError(t("tooMany", { max: MAX_PHOTOS }));
    } catch {
      setError(t("unreadable"));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor="photos">{t("label")}</FieldLabel>
      <ul className="grid grid-cols-3 gap-2">
        {previews.map((url, i) => (
          <li key={url} className="relative aspect-square overflow-hidden rounded-lg bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
            <img src={url} alt={t("preview", { number: i + 1 })} className="size-full object-cover" />
            <Button
              type="button"
              size="icon-sm"
              variant="secondary"
              onClick={() => onChange(photos.filter((_, j) => j !== i))}
              className="absolute top-1.5 right-1.5 rounded-full"
              aria-label={t("remove", { number: i + 1 })}
            >
              <X />
            </Button>
          </li>
        ))}
        {photos.length < MAX_PHOTOS && (
          <li>
            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={busy}
              className="flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-input bg-card text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
            >
              {busy ? <Spinner /> : <Camera className="size-6" aria-hidden="true" />}
              {busy ? t("processing") : t("add")}
            </button>
          </li>
        )}
      </ul>
      <input
        ref={input}
        id="photos"
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(event) => add(event.target.files)}
      />
      <FieldDescription>{t("hint", { max: MAX_PHOTOS })}</FieldDescription>
      {error && <FieldError>{error}</FieldError>}
    </Field>
  );
}
