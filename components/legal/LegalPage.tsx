import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";

export const SUPPORT_EMAIL = "rxboxteam@gmail.com";
export const POLICY_UPDATED = "October 5, 2026";

interface LegalPageProps {
  title: string;
  description: string;
  children: ReactNode;
  showUpdated?: boolean;
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">
        {title}
      </h2>

      <div className="space-y-3 text-sm leading-7 text-slate-600 sm:text-base">
        {children}
      </div>
    </section>
  );
}

export default function LegalPage({
  title,
  description,
  children,
  showUpdated = true,
}: LegalPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-sky-50 to-blue-50 text-slate-900">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/about"
            className="flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-600"
          >
            <Image
              src="/brand/rx-box-mark.png"
              alt=""
              width={48}
              height={48}
              className="h-12 w-12 shrink-0 object-contain"
            />

            <span className="min-w-0">
              <span className="block text-lg font-bold tracking-tight">
                Rx Box
              </span>
              <span className="block text-xs font-medium text-slate-500">
                Smart Pillbox
              </span>
            </span>
          </Link>

          <Link
            href="/sign-in"
            className="rounded-full border border-sky-200 bg-white px-5 py-2.5 text-sm font-semibold text-sky-700 shadow-sm transition-colors hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-600"
          >
            Sign in
          </Link>
        </header>

        <main className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
          <div className="border-b border-slate-100 bg-gradient-to-br from-white to-sky-50 px-6 py-8 sm:px-10">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-sky-700">
              Rx Box: Smart Pillbox
            </p>

            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {title}
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
              {description}
            </p>

            {showUpdated && (
              <p className="mt-4 text-xs text-slate-500">
                Last updated: {POLICY_UPDATED}
              </p>
            )}
          </div>

          <div className="space-y-8 px-6 py-8 sm:px-10 sm:py-10">
            {children}
          </div>
        </main>

        <footer className="px-2 pb-4 pt-6 text-center text-xs leading-6 text-slate-500">
          <nav
            aria-label="Information and policies"
            className="flex flex-wrap justify-center gap-x-5 gap-y-2"
          >
            <Link href="/about" className="hover:text-sky-700 hover:underline">
              About Rx Box
            </Link>
            <Link href="/privacy" className="hover:text-sky-700 hover:underline">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-sky-700 hover:underline">
              Terms of Service
            </Link>
          </nav>

          <p className="mt-3">
            Questions?{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="break-all font-medium text-sky-700 hover:underline"
            >
              {SUPPORT_EMAIL}
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}