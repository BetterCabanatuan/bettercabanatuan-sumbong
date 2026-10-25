import { cn } from "cn"

/**
 * A placeholder block. With motion allowed, a soft highlight sweeps across it (transform only);
 * with reduced motion it is a still block.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "relative overflow-hidden rounded-md bg-muted motion-safe:after:absolute motion-safe:after:inset-0 motion-safe:after:animate-shimmer motion-safe:after:bg-gradient-to-r motion-safe:after:from-transparent motion-safe:after:via-background/60 motion-safe:after:to-transparent motion-safe:after:content-['']",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
