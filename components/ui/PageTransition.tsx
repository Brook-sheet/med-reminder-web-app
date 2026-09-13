"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Fades + lifts each route in on arrival.
 *
 * Keyed on the pathname so the animation replays on every navigation while
 * the surrounding layout (sidebar, bells) stays perfectly still.
 */
export default function PageTransition({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <div key={pathname} className={cn("rx-page-enter", className)}>
      {children}
    </div>
  );
}