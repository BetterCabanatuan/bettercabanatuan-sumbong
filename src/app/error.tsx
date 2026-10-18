"use client";

import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

// May render outside the i18n provider, so the copy is bilingual inline.
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-12">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TriangleAlert />
          </EmptyMedia>
          <EmptyTitle>Nagkaproblema · Something went wrong</EmptyTitle>
          <EmptyDescription>Pakisubukan ulit sa ilang sandali. Please try again in a moment.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={reset}>Subukan ulit · Try again</Button>
        </EmptyContent>
      </Empty>
    </main>
  );
}
