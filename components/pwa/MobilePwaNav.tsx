"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ChevronRight,
  LogOut,
  MoreHorizontal,
  X,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  exact?: boolean;
}

interface Props {
  role: "patient" | "family";
  items: NavItem[];
  loggingOut: boolean;
  onLogout: () => Promise<void>;
}

function Badge({ count }: { count?: number }) {
  if (!count || count < 1) return null;

  return (
    <span className="rx-pwa-badge">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export default function MobilePwaNav({
  role,
  items,
  loggingOut,
  onLogout,
}: Props) {
  const pathname = usePathname();

  const [openedPath, setOpenedPath] =
    useState<string | null>(null);

  const open = openedPath === pathname;

  const setOpen = useCallback(
    (value: boolean) =>
      setOpenedPath(value ? pathname : null),
    [pathname],
  );

  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const nav = useRef<HTMLElement>(null);

  const paths =
    role === "patient"
      ? ["/", "/medicines", "/history", "/chats"]
      : ["/monitor", "/alerts", "/chats"];

  const destinations = paths.flatMap((path) =>
    items.filter((item) => item.href === path),
  );

  const account = items.filter((item) =>
    ["/profile", "/settings"].includes(item.href),
  );

  const active = (item: NavItem) =>
    item.exact
      ? pathname === item.href
      : pathname === item.href ||
        pathname.startsWith(`${item.href}/`);

  // The native modal dialog makes the rest of the document inert
  // and traps focus.
  useEffect(() => {
    if (!open) return;

    const element = dialog.current;
    if (!element) return;

    const opener = trigger.current;
    const overflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    element.showModal();
    element.querySelector<HTMLButtonElement>("button")?.focus();

    const mobile = window.matchMedia(
      "(max-width: 767px)",
    );

    const standalone = window.matchMedia(
      "(display-mode: standalone)",
    );

    const closeOutsidePwa = () => {
      const ios = (
        navigator as Navigator & {
          standalone?: boolean;
        }
      ).standalone;

      if (
        !mobile.matches ||
        !(standalone.matches || ios)
      ) {
        setOpen(false);
      }
    };

    mobile.addEventListener(
      "change",
      closeOutsidePwa,
    );

    standalone.addEventListener(
      "change",
      closeOutsidePwa,
    );

    return () => {
      element.close();
      document.body.style.overflow = overflow;

      mobile.removeEventListener(
        "change",
        closeOutsidePwa,
      );

      standalone.removeEventListener(
        "change",
        closeOutsidePwa,
      );

      if (
        opener?.isConnected &&
        opener.getClientRects().length
      ) {
        opener.focus();
      }
    };
  }, [open, setOpen]);

  useEffect(() => {
    const element = nav.current;
    if (!element) return;

    const root = document.documentElement;

    const header =
      document.querySelector<HTMLElement>(
        ".rx-mobile-topbar",
      );

    const measure = () => {
      root.style.setProperty(
        "--rx-pwa-nav-height",
        `${element.getBoundingClientRect().height}px`,
      );

      if (header) {
        root.style.setProperty(
          "--rx-pwa-header-height",
          `${header.getBoundingClientRect().height}px`,
        );
      }
    };

    const observer = new ResizeObserver(measure);

    observer.observe(element);

    if (header) {
      observer.observe(header);
    }

    measure();

    // Active chats already manage their visual viewport.
    // Also hide the bar when another page's text field is focused
    // and the software keyboard opens.
    const viewport = window.visualViewport;

    const keyboard = () => {
      const editable =
        document.activeElement?.matches(
          "input, textarea, [contenteditable='true']",
        );

      const shrunk =
        viewport &&
        viewport.scale === 1 &&
        window.innerHeight - viewport.height > 120;

      root.toggleAttribute(
        "data-rx-keyboard",
        Boolean(editable && shrunk),
      );
    };

    viewport?.addEventListener("resize", keyboard);
    document.addEventListener("focusin", keyboard);
    document.addEventListener("focusout", keyboard);

    return () => {
      observer.disconnect();

      root.style.removeProperty(
        "--rx-pwa-nav-height",
      );

      root.style.removeProperty(
        "--rx-pwa-header-height",
      );

      root.removeAttribute("data-rx-keyboard");

      viewport?.removeEventListener(
        "resize",
        keyboard,
      );

      document.removeEventListener(
        "focusin",
        keyboard,
      );

      document.removeEventListener(
        "focusout",
        keyboard,
      );
    };
  }, []);

  return (
    <>
      <nav
        ref={nav}
        className="rx-pwa-nav"
        aria-label="Main navigation"
      >
        {destinations.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={
                active(item) ? "page" : undefined
              }
            >
              <span className="rx-pwa-icon">
                <Icon
                  size={23}
                  strokeWidth={1.75}
                  aria-hidden="true"
                />

                <Badge count={item.badge} />
              </span>

              <span>{item.label}</span>
            </Link>
          );
        })}

        <button
          ref={trigger}
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls="rx-pwa-more"
          data-active={open || account.some(active)}
        >
          <span className="rx-pwa-icon">
            <MoreHorizontal
              size={23}
              aria-hidden="true"
            />

            <Badge
              count={account.reduce(
                (sum, item) =>
                  sum + (item.badge || 0),
                0,
              )}
            />
          </span>

          <span>More</span>
        </button>
      </nav>

      <dialog
        ref={dialog}
        id="rx-pwa-more"
        className="rx-pwa-sheet"
        aria-labelledby="rx-pwa-more-title"
        onCancel={() => setOpen(false)}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (
            event.target !== event.currentTarget
          ) {
            return;
          }

          const rect =
            event.currentTarget.getBoundingClientRect();

          if (
            event.clientY < rect.top ||
            event.clientY > rect.bottom ||
            event.clientX < rect.left ||
            event.clientX > rect.right
          ) {
            setOpen(false);
          }
        }}
      >
        <div className="rx-pwa-sheet-heading">
          <h2 id="rx-pwa-more-title">More</h2>

          <button
            type="button"
            aria-label="Close More menu"
            onClick={() => setOpen(false)}
          >
            <X aria-hidden="true" />
          </button>
        </div>

        <nav aria-label="Account navigation">
          {account.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={
                  active(item) ? "page" : undefined
                }
              >
                <span className="rx-pwa-icon">
                  <Icon aria-hidden="true" />
                  <Badge count={item.badge} />
                </span>

                <span>{item.label}</span>

                <ChevronRight
                  className="ml-auto"
                  size={18}
                  aria-hidden="true"
                />
              </Link>
            );
          })}

          <button
            type="button"
            className="rx-pwa-logout"
            disabled={loggingOut}
            aria-busy={loggingOut}
            onClick={() => {
              void onLogout();
            }}
          >
            <LogOut aria-hidden="true" />

            <span>
              {loggingOut
                ? "Signing out…"
                : "Logout"}
            </span>
          </button>
        </nav>
      </dialog>
    </>
  );
}