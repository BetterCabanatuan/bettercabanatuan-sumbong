"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Check, EyeOff, Undo2 } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { setPhotoReview } from "@/app/v/actions";
import { canvasToJpeg } from "@/lib/image";
import { PUBLIC_BUCKET } from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Pixelates a region so faces and plate numbers can't be recovered (blur can be partly reversed). */
function pixelate(context: CanvasRenderingContext2D, image: HTMLImageElement, box: Box) {
  const block = Math.max(16, Math.round(Math.min(box.w, box.h) / 4));
  const smallW = Math.max(1, Math.round(box.w / block));
  const smallH = Math.max(1, Math.round(box.h / block));
  const scratch = document.createElement("canvas");
  scratch.width = smallW;
  scratch.height = smallH;
  scratch.getContext("2d")!.drawImage(image, box.x, box.y, box.w, box.h, 0, 0, smallW, smallH);
  context.imageSmoothingEnabled = false;
  context.drawImage(scratch, 0, 0, smallW, smallH, box.x, box.y, box.w, box.h);
  context.imageSmoothingEnabled = true;
}

/**
 * Review step for one evidence photo: drag boxes over faces or plate numbers, then publish a
 * redacted copy to the public bucket, publish as-is, or hide the photo entirely.
 */
export function PhotoRedactor({
  photoId,
  reportId,
  originalUrl,
  publicUrl,
  hidden,
}: {
  photoId: string;
  reportId: string;
  originalUrl: string;
  publicUrl: string | null;
  hidden: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const image = useRef<HTMLImageElement | null>(null);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [draft, setDraft] = useState<Box | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(!publicUrl && !hidden);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      image.current = img;
      draw([]);
    };
    img.onerror = () => setError("Could not load the original photo.");
    img.src = originalUrl;
  }, [originalUrl]);

  // `editing` too: "Review again" mounts a fresh canvas that needs the photo drawn on it.
  useEffect(() => {
    draw(draft ? [...boxes, draft] : boxes);
  }, [boxes, draft, editing]);

  function draw(regions: Box[]) {
    const img = image.current;
    const el = canvas.current;
    if (!img || !el) return;
    el.width = img.naturalWidth;
    el.height = img.naturalHeight;
    const context = el.getContext("2d")!;
    context.drawImage(img, 0, 0);
    for (const box of regions) pixelate(context, img, normalize(box));
  }

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const scale = event.currentTarget.width / rect.width;
    return { x: (event.clientX - rect.left) * scale, y: (event.clientY - rect.top) * scale };
  }

  function publish(redact: boolean) {
    startTransition(async () => {
      setError(null);
      try {
        if (!redact) draw([]);
        const blob = await canvasToJpeg(canvas.current!, 0.85);
        // A new path each time: re-uploading to the same one could leave the old, unredacted
        // copy in browser and CDN caches. setPhotoReview deletes the previous file.
        const path = `${reportId}/${photoId}-${Date.now()}.jpg`;
        const { error: uploadError } = await createClient()
          .storage.from(PUBLIC_BUCKET)
          .upload(path, blob, { contentType: "image/jpeg" });
        if (uploadError) throw uploadError;
        const result = await setPhotoReview(photoId, path, false);
        if (!result.ok) throw new Error(result.error);
        setEditing(false);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  function hide() {
    startTransition(async () => {
      const result = await setPhotoReview(photoId, null, true);
      if (result.ok) setEditing(false);
      else setError(result.error);
    });
  }

  if (!editing) {
    return (
      <Card size="sm" className={hidden ? undefined : "pt-0"}>
        {!hidden && publicUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- Supabase storage URL
          <img src={publicUrl} alt="Public copy" className="max-h-72 w-full object-contain bg-muted" />
        )}
        <CardContent>
          {hidden ? (
            <p className="flex items-center gap-2 font-medium">
              <EyeOff className="size-4" /> Hidden from the public
            </p>
          ) : (
            <p className="flex items-center gap-2 font-medium text-status-resolved-foreground">
              <Check className="size-4" /> Public copy saved
            </p>
          )}
        </CardContent>
        <CardFooter>
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Review again
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-3">
        <p className="text-muted-foreground">
          Drag over every face, plate number, house number or name. Those areas are pixelated in the public copy.
        </p>
        <canvas
          ref={canvas}
          className="w-full touch-none rounded-lg bg-muted"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            start.current = point(event);
          }}
          onPointerMove={(event) => {
            if (!start.current) return;
            const p = point(event);
            setDraft({ x: start.current.x, y: start.current.y, w: p.x - start.current.x, h: p.y - start.current.y });
          }}
          onPointerUp={() => {
            if (draft && Math.abs(draft.w) > 8 && Math.abs(draft.h) > 8) setBoxes((b) => [...b, draft]);
            setDraft(null);
            start.current = null;
          }}
        />
        {error && <p className="text-destructive">{error}</p>}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        <Button size="sm" disabled={boxes.length === 0 || pending} onClick={() => publish(true)}>
          {pending && <Spinner data-icon="inline-start" />}
          Publish with {boxes.length} area{boxes.length === 1 ? "" : "s"} pixelated
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => publish(false)}>
          Nothing to hide: publish as is
        </Button>
        <Button size="sm" variant="ghost" disabled={boxes.length === 0 || pending} onClick={() => setBoxes((b) => b.slice(0, -1))}>
          <Undo2 data-icon="inline-start" />
          Undo
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={hide}>
          <EyeOff data-icon="inline-start" />
          Hide photo
        </Button>
      </CardFooter>
    </Card>
  );
}

function normalize(box: Box): Box {
  return {
    x: Math.round(box.w < 0 ? box.x + box.w : box.x),
    y: Math.round(box.h < 0 ? box.y + box.h : box.y),
    w: Math.round(Math.abs(box.w)),
    h: Math.round(Math.abs(box.h)),
  };
}
