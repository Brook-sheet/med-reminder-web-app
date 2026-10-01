"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/Logo";

export default function FormLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const pathname = usePathname();

  const brandingInsideCard =
    pathname === "/sign-in" || pathname === "/sign-up";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-100 to-sky-50 text-slate-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.14),transparent_25%),radial-gradient(circle_at_bottom_right,_rgba(125,211,252,0.16),transparent_18%)]" />

      <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-10">
        {!brandingInsideCard && (
          <header className="mb-8 flex max-w-xl flex-col items-center gap-3 rounded-[28px] border border-slate-200/90 bg-white/90 px-5 py-4 shadow-sm backdrop-blur-md sm:flex-row">
            <Logo
              size="lg"
              priority
              className="flex-col items-center gap-3 text-center sm:flex-row sm:items-center sm:gap-4 sm:text-left"
            />
          </header>
        )}

        <main className="w-full max-w-md">{children}</main>
      </div>
    </div>
  );
}