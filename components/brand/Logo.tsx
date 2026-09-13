import Image from "next/image";

import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------
   Single source of truth for Rx Box branding.

   Every logo in the system renders through this file. To swap the artwork
   later, replace the two files in /public/brand and change nothing else.
------------------------------------------------------------------------- */

export const BRAND_NAME = "Rx Box: Smart Pillbox";
export const BRAND_MARK_SRC = "/brand/rx-box-mark.png";
export const BRAND_LOCKUP_SRC = "/brand/rx-box-logo.png";

export type LogoSize = "xs" | "sm" | "md" | "lg";

/** Box size per step. `px` drives the intrinsic request; @2x keeps it sharp. */
const MARK: Record<LogoSize, { box: string; px: number }> = {
  xs: { box: "h-7 w-7", px: 28 },
  sm: { box: "h-9 w-9", px: 36 },
  md: { box: "h-11 w-11", px: 44 },
  lg: { box: "h-12 w-12 md:h-14 md:w-14", px: 56 },
};

const WORDMARK: Record<LogoSize, string> = {
  xs: "text-xs",
  sm: "text-sm",
  md: "text-sm",
  lg: "text-base sm:text-lg",
};

export interface LogoMarkProps {
  size?: LogoSize;
  /** White rounded backdrop — use on coloured surfaces like the brand bar. */
  chip?: boolean;
  className?: string;
  priority?: boolean;
}

export function LogoMark({
  size = "md",
  chip = false,
  className,
  priority = false,
}: LogoMarkProps) {
  const { box, px } = MARK[size];

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        box,
        chip &&
          "rounded-xl bg-white p-1.5 shadow-sm shadow-slate-950/15 ring-1 ring-white/70",
        className
      )}
    >
      <Image
        src={BRAND_MARK_SRC}
        alt=""
        width={px * 2}
        height={px * 2}
        sizes={`${px}px`}
        className="h-full w-full object-contain"
        priority={priority}
      />
    </span>
  );
}

export interface LogoProps extends LogoMarkProps {
  /** Text colour. `inherit` lets a branded surface set its own ink. */
  tone?: "default" | "inverted" | "inherit";
  orientation?: "horizontal" | "vertical";
  showWordmark?: boolean;
}

export function Logo({
  size = "md",
  chip = false,
  tone = "default",
  orientation = "horizontal",
  showWordmark = true,
  className,
  priority = false,
}: LogoProps) {
  return (
    <span
      className={cn(
        "inline-flex min-w-0",
        orientation === "horizontal"
          ? "flex-row items-center gap-2.5"
          : "flex-col items-start gap-3",
        className
      )}
    >
      <LogoMark size={size} chip={chip} priority={priority} />

      {showWordmark ? (
        <span
          className={cn(
            "truncate font-semibold leading-snug tracking-tight",
            WORDMARK[size],
            tone === "inverted" && "text-white",
            tone === "default" && "text-slate-900 dark:text-slate-100"
          )}
        >
          {BRAND_NAME}
        </span>
      ) : (
        <span className="sr-only">{BRAND_NAME}</span>
      )}
    </span>
  );
}

export default Logo;