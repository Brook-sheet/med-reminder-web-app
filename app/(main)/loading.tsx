import { SkeletonStats, SkeletonList, Skeleton } from "@/components/ui/Skeleton";

/**
 * Route-level loading for every page inside (main).
 *
 * Next.js streams this in automatically during navigation, so users always
 * see the same content-shaped placeholder instead of a blank screen.
 */
export default function MainLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="rx-fade-in mx-auto w-full max-w-7xl px-1 pb-10"
    >
      <span className="sr-only">Loading page</span>

      <div className="mb-8 flex flex-col gap-3">
        <Skeleton className="h-8 w-64 max-w-[70%]" />
        <Skeleton className="h-4 w-80 max-w-[85%]" />
      </div>

      <SkeletonStats className="mb-8" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-[28px] border border-border/70 bg-card p-6 shadow-lg shadow-slate-900/5 lg:col-span-2">
          <Skeleton className="mb-5 h-4 w-40" />
          <SkeletonList rows={4} />
        </div>

        <div className="rounded-[28px] border border-border/70 bg-card p-6 shadow-lg shadow-slate-900/5">
          <Skeleton className="mb-5 h-4 w-32" />
          <SkeletonList rows={3} />
        </div>
      </div>
    </div>
  );
}