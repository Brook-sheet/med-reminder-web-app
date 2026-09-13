import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Base skeleton block. Compose it — don't restyle the shimmer.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("rx-skeleton", className)}
      {...props}
    />
  );
}

/** Multi-line text placeholder. Last line is intentionally short. */
function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex w-full flex-col gap-2", className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn("h-3.5", index === lines - 1 ? "w-2/5" : "w-full")}
        />
      ))}
    </div>
  );
}

/** Card-shaped placeholder matching the app's 28px card radius. */
function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-[28px] border border-border/70 bg-card p-6 shadow-lg shadow-slate-900/5",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <Skeleton className="h-11 w-11 rounded-2xl" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-3.5 w-1/3" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
      <SkeletonText lines={2} />
    </div>
  );
}

/** Repeating rows — schedules, history, chats, alerts. */
function SkeletonList({
  rows = 4,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn("flex flex-col gap-3", className)}
    >
      <span className="sr-only">Loading items</span>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/60 p-4"
        >
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Stat tiles across the top of dashboards. */
function SkeletonStats({
  count = 3,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("grid grid-cols-1 gap-6 md:grid-cols-3", className)}
      role="status"
      aria-busy="true"
    >
      <span className="sr-only">Loading statistics</span>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="rounded-[28px] border border-border/70 bg-card p-6 shadow-lg shadow-slate-900/5"
        >
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-4 h-8 w-28" />
          <Skeleton className="mt-3 h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

export { Skeleton, SkeletonText, SkeletonCard, SkeletonList, SkeletonStats };
export default Skeleton;