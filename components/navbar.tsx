"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { GiHamburgerMenu } from "react-icons/gi";
import { MdOutlineSpaceDashboard } from "react-icons/md";
import { CiPill, CiSettings, CiLogout } from "react-icons/ci";
import { GoHistory } from "react-icons/go";

const Navbar = () => {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/sign-in");
    router.refresh();
  };

  const closeSidebar = () => setOpen(false);

  return (
    <div>
      <button
        type="button"
        className="absolute top-4 right-4 inline-flex items-center justify-center rounded-2xl border border-border/80 bg-card p-2 text-slate-700 shadow-sm shadow-slate-900/5 transition hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-slate-600 dark:hover:bg-slate-900 z-30 md:hidden"
        onClick={() => setOpen((current) => !current)}
        aria-label="Toggle navigation menu"
      >
        <GiHamburgerMenu className="h-6 w-6" aria-hidden="true" />
      </button>

      {open && (
        <button
          type="button"
          className="fixed inset-0 z-10 bg-slate-950/40 md:hidden"
          aria-label="Close navigation menu"
          onClick={closeSidebar}
        />
      )}

      <aside
        className={`fixed top-0 z-20 h-screen w-72 overflow-hidden border-r border-border/70 bg-card/95 shadow-2xl shadow-slate-900/10 backdrop-blur-xl transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
      >
        <div className="flex h-full flex-col gap-6 p-6">
          <div className="flex flex-col gap-3 rounded-[28px] border border-border/70 bg-background/90 p-5 shadow-sm shadow-slate-900/5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl md:h-12 md:w-12">
              <Image
                src="/icon.png"
                alt="Med App Reminder Logo"
                width={48}
                height={48}
                className="h-full w-full object-contain"
                priority
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Med App Reminder</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Health-first medication tracking.</p>
            </div>
          </div>

          <nav className="space-y-3">
            <Link
              href="/"
              onClick={closeSidebar}
              className="flex items-center gap-3 rounded-3xl border border-transparent px-4 py-3 text-slate-700 transition hover:border-slate-200 hover:bg-slate-100 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-900"
            >
            <MdOutlineSpaceDashboard className="h-6 w-6" />
            <span className="font-semibold">Dashboard</span>
          </Link>
          <Link
            href="/medicines"
            onClick={closeSidebar}
            className="flex items-center gap-3 rounded-3xl border border-transparent px-4 py-3 text-slate-700 transition hover:border-slate-200 hover:bg-slate-100 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-900"
          >
            <CiPill className="h-6 w-6" />
            <span className="font-semibold">Medicines</span>
          </Link>
          <Link
            href="/history"
            onClick={closeSidebar}
            className="flex items-center gap-3 rounded-3xl border border-transparent px-4 py-3 text-slate-700 transition hover:border-slate-200 hover:bg-slate-100 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-900"
          >
            <GoHistory className="h-6 w-6" />
            <span className="font-semibold">History</span>
          </Link>
          <Link
            href="/settings"
            onClick={closeSidebar}
            className="flex items-center gap-3 rounded-3xl border border-transparent px-4 py-3 text-slate-700 transition hover:border-slate-200 hover:bg-slate-100 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-900"
          >
            <CiSettings className="h-6 w-6" />
            <span className="font-semibold">Settings</span>
          </Link>
        </nav>

          <div className="mt-auto">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-3xl border border-transparent bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              <CiLogout className="h-5 w-5" />
              Logout
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default Navbar;