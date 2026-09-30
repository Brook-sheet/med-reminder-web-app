"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Monitor,
  Pill,
  Settings,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";

import { useChatNotifications } from "@/hooks/useChatNotifications";
import { useMonitoringRequestCount } from "@/hooks/useMonitoringRequestCount";
import { Spinner } from "@/components/ui/Spinner";
import { startRouteProgress } from "@/components/ui/RouteProgress";
import { Logo } from "@/components/brand/Logo";

interface NavbarProps {
  role: "patient" | "family";
}

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  exact?: boolean;
}

const ICON_SIZE = 22;
const ICON_STROKE = 1.75;

const Navbar = ({ role }: NavbarProps) => {
  const router = useRouter();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const { unreadCount } = useChatNotifications();
  const { pendingCount } = useMonitoringRequestCount(
    role === "patient"
  );

  // Close the mobile drawer when the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Prevent background scrolling while the mobile drawer is open.
  useEffect(() => {
    if (!open) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Close the mobile drawer with Escape.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const handleLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });

      startRouteProgress();
      router.push("/sign-in");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  };

  const closeSidebar = () => setOpen(false);

  const items: NavItem[] = [
    ...(role === "patient"
      ? [
          {
            href: "/",
            label: "Dashboard",
            icon: LayoutDashboard,
            exact: true,
          },
        ]
      : []),

    ...(role === "family"
      ? [
          {
            href: "/monitor",
            label: "Patient Monitoring",
            icon: Monitor,
          },
          {
            href: "/alerts",
            label: "Medication Alerts",
            icon: Bell,
          },
        ]
      : []),

    {
      href: "/chats",
      label: "Chats",
      icon: MessageCircle,
      badge: unreadCount,
    },

    ...(role === "patient"
      ? [
          {
            href: "/medicines",
            label: "Medicines",
            icon: Pill,
          },
          {
            href: "/history",
            label: "History",
            icon: History,
          },
        ]
      : []),

    {
      href: "/profile",
      label: "Profile",
      icon: UserRound,
    },

    {
      href: "/settings",
      label: "Settings",
      icon: Settings,
      badge: pendingCount,
    },
  ];

  const isActive = (item: NavItem) =>
    item.exact
      ? pathname === item.href
      : pathname === item.href ||
        pathname.startsWith(`${item.href}/`);

  return (
    <div>
      <header className="rx-mobile-topbar rx-brand-bar rx-brand-bar--edge fixed inset-x-0 top-0 z-30 flex items-center gap-3 border-b md:hidden print:hidden">
        <Link
          href={role === "family" ? "/monitor" : "/"}
          onClick={closeSidebar}
          className="flex min-w-0 flex-1 items-center rounded-xl py-1 transition-opacity duration-[var(--rx-duration-fast)] active:opacity-70"
        >
          <Logo size="sm" tone="inherit" priority />
        </Link>

        <button
          type="button"
          className="rx-press inline-flex shrink-0 items-center justify-center rounded-2xl border border-[var(--brand-surface-border)] bg-white/70 p-2 text-[var(--brand-surface-ink)] shadow-sm shadow-slate-900/5 hover:bg-white dark:bg-white/10 dark:hover:bg-white/20"
          onClick={() => setOpen((current) => !current)}
          aria-label="Toggle navigation menu"
          aria-expanded={open}
        >
          <span className="relative block h-6 w-6">
            <Menu
              strokeWidth={ICON_STROKE}
              className={`absolute inset-0 h-6 w-6 transition-all duration-[var(--rx-duration-base)] ease-[var(--rx-ease-out)] ${
                open
                  ? "rotate-90 scale-75 opacity-0"
                  : "rotate-0 scale-100 opacity-100"
              }`}
              aria-hidden="true"
            />

            <X
              strokeWidth={ICON_STROKE}
              className={`absolute inset-0 h-6 w-6 transition-all duration-[var(--rx-duration-base)] ease-[var(--rx-ease-out)] ${
                open
                  ? "rotate-0 scale-100 opacity-100"
                  : "-rotate-90 scale-75 opacity-0"
              }`}
              aria-hidden="true"
            />
          </span>
        </button>
      </header>

      <button
        type="button"
        tabIndex={open ? 0 : -1}
        aria-hidden={!open}
        className={`fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[2px] transition-opacity duration-[var(--rx-duration-base)] ease-[var(--rx-ease-standard)] md:hidden ${
          open
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
        aria-label="Close navigation menu"
        onClick={closeSidebar}
      />

      <aside
        className={`rx-drawer fixed top-0 z-50 h-screen w-72 overflow-hidden border-r border-border/70 bg-card/95 shadow-2xl shadow-slate-900/10 backdrop-blur-xl ${
          open ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
      >
        <div className="flex h-full flex-col gap-6 overflow-y-auto p-6">
          <div className="rx-brand-bar rx-animate-in flex shrink-0 flex-col gap-3 rounded-[28px] border p-5 transition-shadow duration-[var(--rx-duration-base)] hover:shadow-lg">
            <Logo
              size="lg"
              tone="inherit"
              orientation="vertical"
              priority
              className="[&>span:first-child]:transition-transform [&>span:first-child]:duration-[var(--rx-duration-slow)] [&>span:first-child]:ease-[var(--rx-ease-spring)] hover:[&>span:first-child]:scale-105"
            />
          </div>

          <nav className="rx-stagger shrink-0 space-y-2">
            {items.map((item) => {
              const active = isActive(item);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeSidebar}
                  aria-current={active ? "page" : undefined}
                  className={`group relative flex items-center gap-3 overflow-hidden rounded-3xl border px-4 py-3 transition-[background-color,border-color,color,transform] duration-[var(--rx-duration-base)] ease-[var(--rx-ease-standard)] active:scale-[0.98] ${
                    active
                      ? "border-primary/30 bg-primary/10 text-primary dark:border-primary/40 dark:bg-primary/15"
                      : "border-transparent text-slate-700 hover:translate-x-0.5 hover:border-slate-200 hover:bg-slate-100 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-900"
                  }`}
                >
                  <span
                    className={`absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-primary transition-all duration-[var(--rx-duration-slow)] ease-[var(--rx-ease-out)] ${
                      active
                        ? "opacity-100"
                        : "-translate-x-2 opacity-0"
                    }`}
                    aria-hidden="true"
                  />

                  <span className="relative inline-flex h-6 w-6 shrink-0 items-center justify-center transition-transform duration-[var(--rx-duration-base)] ease-[var(--rx-ease-spring)] group-hover:scale-110">
                    <Icon
                      width={ICON_SIZE}
                      height={ICON_SIZE}
                      strokeWidth={ICON_STROKE}
                      className="shrink-0"
                      aria-hidden="true"
                    />

                    {item.badge && item.badge > 0 ? (
                      <span
                        key={item.badge}
                        className="rx-pop-in absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm shadow-red-500/40"
                      >
                        {item.badge > 99 ? "99+" : item.badge}
                      </span>
                    ) : null}
                  </span>

                  <span className="font-semibold">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto shrink-0">
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              aria-busy={loggingOut}
              className="rx-press flex w-full items-center justify-center gap-3 rounded-3xl border border-transparent bg-red-600 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-red-600/30 hover:bg-red-700 hover:shadow-md hover:shadow-red-600/40 disabled:cursor-progress disabled:opacity-70"
            >
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center">
                {loggingOut ? (
                  <Spinner size="sm" label="Signing out" />
                ) : (
                  <LogOut
                    width={ICON_SIZE}
                    height={ICON_SIZE}
                    strokeWidth={ICON_STROKE}
                    aria-hidden="true"
                  />
                )}
              </span>

              {loggingOut ? "Signing out…" : "Logout"}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default Navbar;