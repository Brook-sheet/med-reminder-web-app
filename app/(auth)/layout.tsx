"use client";

import React from "react";
import Image from "next/image";

export default function FormLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-100 to-sky-50 text-slate-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.14),transparent_25%),radial-gradient(circle_at_bottom_right,_rgba(125,211,252,0.16),transparent_18%)]" />

      <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-10">
        <header className="mb-8 flex max-w-xl flex-col items-center gap-3 rounded-[28px] border border-slate-200/90 bg-white/90 px-5 py-4 shadow-sm backdrop-blur-md sm:flex-row">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center sm:h-14 sm:w-14">
            <Image
              src="/icon.png"
              alt="Rx Box: Smart Pillbox logo"
              width={56}
              height={56}
              sizes="56px"
              className="h-full w-full object-contain"
              priority
            />
          </div>

          <div className="text-center sm:text-left">
            <p className="text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
              Rx Box: Smart Pillbox
            </p>
          </div>
        </header>

        <main className="w-full max-w-md">
          {children}
        </main>
      </div>
    </div>
  );
}