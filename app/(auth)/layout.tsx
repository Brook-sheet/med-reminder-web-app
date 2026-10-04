"use client";

import React from "react";
import Link from "next/link";
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

        <footer className="mt-6 w-full max-w-md px-2 text-center">
          <nav
            aria-label="Information and policies"
            className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-slate-500"
          >
            <Link
              href="/about"
              className="rounded transition-colors hover:text-sky-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-600"
            >
              About Rx Box
            </Link>

            <Link
              href="/privacy"
              className="rounded transition-colors hover:text-sky-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-600"
            >
              Privacy Policy
            </Link>

            <Link
              href="/terms"
              className="rounded transition-colors hover:text-sky-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-600"
            >
              Terms of Service
            </Link>
          </nav>
        </footer>
      </div>
    </div>
  );
}