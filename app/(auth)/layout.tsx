"use client";

import React from "react";
import Image from "next/image";

export default function Formlayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-100 to-sky-50 text-slate-900">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.14),transparent_25%),radial-gradient(circle_at_bottom_right,_rgba(125,211,252,0.16),transparent_18%)]" />
      <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-10">
        <header className="mb-8 flex flex-col sm:flex-row items-center gap-3 rounded-[28px] border border-slate-200/90 bg-white/90 px-4 py-3 shadow-sm backdrop-blur-md">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl flex-shrink-0 sm:h-12 sm:w-12">
            <Image
              src="/icon.png"
              alt="Med App Reminder Logo"
              width={48}
              height={48}
              className="h-full w-full object-contain"
              priority
            />
          </div>
          <div className="space-y-1 text-center sm:text-left">
            <p className="text-base sm:text-lg font-semibold tracking-tight">Med App Reminder</p>
            <p className="text-xs sm:text-sm text-slate-500">A calm and clear reminder experience for your medication routine</p>
          </div>
        </header>
        <main className="w-full max-w-md">{children}</main>
      </div>
    </div>
  );
}

