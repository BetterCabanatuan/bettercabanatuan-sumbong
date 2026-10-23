"use client";

import { Camera, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { toUploadableJpeg } from "@/lib/image";
import { MAX_PHOTOS } from "@/lib/storage";

// Stable per-Blob keys: adding or removing a photo mints new object URLs, but must not remount
// (and replay the entrance of) the thumbnails that stayed.
const keys = new WeakMap<Blob, number>();
let nextKey = 0;
function keyOf(photo: Blob) {
  let key = keys.get(photo);
  if (key === undefined) keys.set(photo, (key = nextKey++));
  return key;
}

export function PhotoPicker({ photos, onChange }: { photos: Blob[]; onChange: (photos: Blob[]) => void }) {
  const t = useTranslations("reportForm.photos");
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Each URL is revoked once its thumbnail has loaded. Revoking in an effect cleanup broke the
  // previews under StrictMode, which runs the cleanup before the images load.
  const urls = useMemo(() => photos.map((p) => URL.createObjectURL(p)), [photos]);

  // Converting takes a moment; a photo removed meanwhile must stay removed.
  const latest = useRef(photos);
  useEffect(() => {
    latest.current = photos;
  }, [photos]);

  async function add(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      const room = MAX_PHOTOS - photos.length;
      const converted = await Promise.all(Array.from(files).slice(0, room).map((f) => toUploadableJpeg(f)));
      onChange([...latest.current, ...converted].slice(0, MAX_PHOTOS));
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
        {photos.map((photo, i) => (
          <li
            key={keyOf(photo)}
            className="relative aspect-square overflow-hidden rounded-lg bg-muted transition-[opacity,scale] duration-200 ease-out starting:scale-96 starting:opacity-0 motion-reduce:starting:scale-100"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
            <img
              src={urls[i]}
              alt={t("preview", { number: i + 1 })}
              onLoad={() => URL.revokeObjectURL(urls[i])}
              className="size-full object-cover"
            />
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
