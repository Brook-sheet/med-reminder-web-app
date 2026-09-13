import * as React from "react";

import { cn } from "@/lib/utils";

export type SpinnerSize = "xs" | "sm" | "md" | "lg" | "xl";

export interface SpinnerProps
  extends Omit<React.ComponentProps<"span">, "children"> {
  /** xs: dense chips · sm: buttons/inline · md: cards · lg: sections · xl: full page */
  size?: SpinnerSize;
  /** Screen-reader text. Set to null when a visible label already exists. */
  label?: string | null;
}

/**
 * The ONLY spinner in the system.
 *
 * It inherits `currentColor`, so it always matches the text it sits next to —
 * put it inside a button, a link, a card, anywhere, and it stays on-brand.
 */
function Spinner({
  size = "sm",
  label = "Loading",
  className,
  ...props
}: SpinnerProps) {
  return (
    <span
      data-slot="spinner"
      data-size={size}
      role="status"
      aria-live="polite"
      className={cn("rx-spinner align-[-0.125em]", className)}
      {...props}
    >
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}

export { Spinner };
export default Spinner;