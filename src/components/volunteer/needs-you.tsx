import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NumberTicker } from "@/components/ui/number-ticker";
import { formatAge } from "@/lib/age";
import type { Permission } from "@/lib/types";

interface Props {
  permissions: Permission[];
  /** Reports waiting for Review, and when the oldest of them was submitted. */
  pending: number;
  oldestPendingAt: string | null;
  /** Offices with Published or Reopened Reports waiting for a Digest. */
  officesWaiting: number;
  drafts: number;
}

function Item({ count, children, action }: { count: number; children: ReactNode; action?: ReactNode }) {
  return (
    <Card size="sm" className="h-full">
      <CardContent className="flex h-full flex-col items-start gap-3">
        <div className="flex items-baseline gap-3">
          <NumberTicker value={count} className="text-3xl font-bold text-navy" />
          <p className="text-sm">{children}</p>
        </div>
        {action && <div className="mt-auto">{action}</div>}
      </CardContent>
    </Card>
  );
}

/**
 * "Needs you": what to do now, one item per job the role may do. Review comes first and has the
 * filled button. Leaves room for "overdue" counts once Office Replies exist (docs/plans/after-forwarded.md).
 */
export function NeedsYou({ permissions, pending, oldestPendingAt, officesWaiting, drafts }: Props) {
  const has = (p: Permission) => permissions.includes(p);
  const showReview = has("reports.review");
  const showDigests = has("digests.add");
  const showDrafts = has("digests.view");
  if (!showReview && !showDigests && !showDrafts) return null;

  return (
    <section aria-labelledby="needs-you" className="flex flex-col gap-3">
      <h2 id="needs-you" className="text-lg font-semibold">
        Needs you
      </h2>
      <div className="grid gap-3 md:grid-cols-3">
        {showReview &&
          (pending > 0 ? (
            <Item
              count={pending}
              action={
                <Button nativeButton={false} render={<Link href="/v/review" />}>
                  Start Review
                </Button>
              }
            >
              {pending === 1 ? "Report" : "Reports"} waiting for Review.
              {oldestPendingAt && <> Oldest: {formatAge(oldestPendingAt)}.</>}
            </Item>
          ) : (
            <Card size="sm" className="h-full">
              <CardContent>
                <p className="text-sm">
                  <span className="font-semibold text-navy">Nothing waiting for Review.</span> Caught up.
                </p>
              </CardContent>
            </Card>
          ))}
        {showDigests && (
          <Item
            count={officesWaiting}
            action={
              officesWaiting > 0 ? (
                <Button variant="outline" nativeButton={false} render={<Link href="/v/digests" />}>
                  Open Digests
                </Button>
              ) : undefined
            }
          >
            {officesWaiting === 1 ? "office has" : "offices have"} Reports waiting for a Digest.
          </Item>
        )}
        {showDrafts && (
          <Item
            count={drafts}
            action={
              drafts > 0 ? (
                <Link href="/v/digests" className="text-sm text-primary underline underline-offset-4">
                  See Draft Digests
                </Link>
              ) : undefined
            }
          >
            Draft {drafts === 1 ? "Digest" : "Digests"} not sent yet.
          </Item>
        )}
      </div>
    </section>
  );
}
