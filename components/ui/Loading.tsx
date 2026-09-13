import * as React from "react";

import { cn } from "@/lib/utils";
import { Spinner, type SpinnerSize } from "@/components/ui/Spinner";

/* -------------------------------------------------------------------------
   One loading vocabulary for the whole app.

   PageLoader     → a whole route/page has nothing to show yet
   SectionLoader  → one card/panel inside a populated page
   InlineLoader   → a single line of text (search, counters, "checking…")
   LoadingOverlay → content already exists and is being refreshed
   ProgressBar    → indeterminate work at the top edge of a surface
   LoadingBoundary→ tiny helper for list bodies

   Anything that needs "please wait" uses one of these. No exceptions.
------------------------------------------------------------------------- */

export interface LoaderProps {
  label?: string;
  className?: string;
  /** Hide the text label but keep it for screen readers. */
  hideLabel?: boolean;
}

function LoaderBody({
  size,
  label,
  hideLabel,
}: {
  size: SpinnerSize;
  label: string;
  hideLabel?: boolean;
}) {
  return (
    <>
      <Spinner size={size} label={hideLabel ? label : null} className="text-primary" />
      {hideLabel ? null : (
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
      )}
    </>
  );
}

/** Full-page / full-route loading state. */
function PageLoader({
  label = "Loading…",
  className,
  hideLabel,
}: LoaderProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn(
        "rx-fade-in flex min-h-[60vh] w-full flex-col items-center justify-center gap-4 px-6 text-center",
        className
      )}
    >
      <LoaderBody size="xl" label={label} hideLabel={hideLabel} />
    </div>
  );
}

/** Loading state for a single card, panel or column. */
function SectionLoader({
  label = "Loading…",
  className,
  hideLabel,
}: LoaderProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn(
        "rx-fade-in flex min-h-[180px] w-full flex-col items-center justify-center gap-3 px-4 text-center",
        className
      )}
    >
      <LoaderBody size="lg" label={label} hideLabel={hideLabel} />
    </div>
  );
}

/** Single-line loading state that sits in the flow of text. */
function InlineLoader({
  label = "Loading…",
  className,
  hideLabel,
}: LoaderProps) {
  return (
    <span
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn(
        "rx-fade-in inline-flex items-center gap-2 text-sm text-muted-foreground",
        className
      )}
    >
      <Spinner size="sm" label={hideLabel ? label : null} />
      {hideLabel ? null : <span>{label}</span>}
    </span>
  );
}

/**
 * Sits over content that is already on screen while it refreshes.
 * Parent must be `relative` (and ideally carry the same border radius).
 */
function LoadingOverlay({
  show,
  label = "Updating…",
  className,
  hideLabel,
}: LoaderProps & { show: boolean }) {
  if (!show) return null;

  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn("rx-loading-overlay", className)}
    >
      <Spinner size="lg" label={hideLabel ? label : null} className="text-primary" />
      {hideLabel ? null : (
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {label}
        </p>
      )}
    </div>
  );
}

/** Indeterminate bar — pin it to the top edge of a card or table. */
function ProgressBar({
  show = true,
  className,
  label = "Loading",
}: {
  show?: boolean;
  className?: string;
  label?: string;
}) {
  if (!show) return null;

  return (
    <div
      role="progressbar"
      aria-busy="true"
      aria-label={label}
      className={cn("rx-progress", className)}
    />
  );
}

/**
 * Convenience wrapper for list/table bodies so every list behaves the same:
 * loading → skeleton/spinner, empty → message, otherwise → children.
 */
function LoadingBoundary({
  loading,
  isEmpty,
  emptyState,
  fallback,
  children,
  className,
}: {
  loading: boolean;
  isEmpty?: boolean;
  emptyState?: React.ReactNode;
  fallback?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  if (loading) {
    return <div className={className}>{fallback ?? <SectionLoader />}</div>;
  }

  if (isEmpty && emptyState) {
    return <div className={cn("rx-fade-in", className)}>{emptyState}</div>;
  }

  return <div className={cn("rx-fade-in", className)}>{children}</div>;
}

export {
  PageLoader,
  SectionLoader,
  InlineLoader,
  LoadingOverlay,
  ProgressBar,
  LoadingBoundary,
};
export { Spinner };