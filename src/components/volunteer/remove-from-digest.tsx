"use client";

import { useTransition } from "react";
import { removeFromDigest } from "@/app/v/actions";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function RemoveFromDigest({ digestId, reportId }: { digestId: string; reportId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(async () => void (await removeFromDigest(digestId, reportId)))}
    >
      {pending && <Spinner data-icon="inline-start" />}
      Remove
    </Button>
  );
}
