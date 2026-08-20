"use client";

import React, {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
} from "lucide-react";

export type ToastType =
  | "success"
  | "error"
  | "warning"
  | "info";

export interface ToastProps {
  type: ToastType;
  message: string;
  duration?: number;
  onClose: () => void;
}

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
  onClose?: () => void;
}

const DEFAULT_DURATION: Record<
  ToastType,
  number
> = {
  success: 4000,
  info: 4500,
  warning: 5000,
  error: 6500,
};

let items: ToastItem[] = [];

const listeners = new Set<() => void>();
const EMPTY_TOASTS: ToastItem[] = [];

function emit() {
  listeners.forEach((listener) => {
    listener();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return items;
}

function addToast(item: ToastItem) {
  const duplicate = items.find(
    (existing) =>
      existing.type === item.type &&
      existing.message === item.message
  );

  if (duplicate) {
    item.onClose?.();
    return duplicate.id;
  }

  const nextItems = [...items, item];

  const removedItems =
    nextItems.length > 5
      ? nextItems.slice(0, -5)
      : [];

  items = nextItems.slice(-5);

  emit();

  removedItems.forEach((removed) => {
    removed.onClose?.();
  });

  return item.id;
}

function removeToast(id: string) {
  const item = items.find(
    (current) => current.id === id
  );

  items = items.filter(
    (current) => current.id !== id
  );

  emit();
  item?.onClose?.();
}

function createToast(
  type: ToastType,
  message: string,
  duration = DEFAULT_DURATION[type]
) {
  const cleanMessage = message.trim();

  if (!cleanMessage) return "";

  const id =
    `toast-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`;

  return addToast({
    id,
    type,
    message: cleanMessage,
    duration,
  });
}

export const toast = {
  success: (
    message: string,
    duration?: number
  ) =>
    createToast(
      "success",
      message,
      duration
    ),

  error: (
    message: string,
    duration?: number
  ) =>
    createToast(
      "error",
      message,
      duration
    ),

  warning: (
    message: string,
    duration?: number
  ) =>
    createToast(
      "warning",
      message,
      duration
    ),

  info: (
    message: string,
    duration?: number
  ) =>
    createToast(
      "info",
      message,
      duration
    ),

  dismiss: removeToast,
};

const styles: Record<
  ToastType,
  {
    icon: React.ReactNode;
    accent: string;
    iconBox: string;
    title: string;
  }
> = {
  success: {
    icon: (
      <CheckCircle2 className="h-5 w-5" />
    ),
    accent: "border-l-emerald-500",
    iconBox:
      "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300",
    title: "Success",
  },

  error: {
    icon: (
      <AlertCircle className="h-5 w-5" />
    ),
    accent: "border-l-red-500",
    iconBox:
      "bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-300",
    title: "Error",
  },

  warning: {
    icon: (
      <AlertTriangle className="h-5 w-5" />
    ),
    accent: "border-l-amber-500",
    iconBox:
      "bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300",
    title: "Attention",
  },

  info: {
    icon: (
      <Info className="h-5 w-5" />
    ),
    accent: "border-l-blue-500",
    iconBox:
      "bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300",
    title: "Information",
  },
};

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const config = styles[item.type];

  useEffect(() => {
    const timer = window.setTimeout(
      () => onDismiss(item.id),
      item.duration
    );

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    item.duration,
    item.id,
    onDismiss,
  ]);

  return (
    <div
      role={
        item.type === "error" ||
        item.type === "warning"
          ? "alert"
          : "status"
      }
      className={`pointer-events-auto flex w-full items-start gap-3 rounded-2xl border border-border/80 border-l-4 ${config.accent} bg-card/95 p-3.5 text-card-foreground shadow-xl shadow-slate-900/15 backdrop-blur-xl animate-in fade-in slide-in-from-top-3 duration-200`}
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${config.iconBox}`}
      >
        {config.icon}
      </div>

      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-sm font-semibold leading-5 text-slate-900 dark:text-slate-100">
          {config.title}
        </p>

        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-5 text-slate-600 dark:text-slate-300">
          {item.message}
        </p>
      </div>

      <button
        type="button"
        onClick={() => {
          onDismiss(item.id);
        }}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ToastProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const toastItems =
    useSyncExternalStore(
      subscribe,
      getSnapshot,
      () => EMPTY_TOASTS
    );

  const [leavingIds, setLeavingIds] =
    useState<Set<string>>(new Set());

  const handleDismiss = useCallback(
    (id: string) => {
      setLeavingIds(
        (current) =>
          new Set(current).add(id)
      );

      window.setTimeout(() => {
        removeToast(id);

        setLeavingIds((current) => {
          const next =
            new Set(current);

          next.delete(id);

          return next;
        });
      }, 180);
    },
    []
  );

  return (
    <>
      {children}

      <div
        className="pointer-events-none fixed inset-x-4 top-4 z-[200] flex flex-col items-end gap-2.5 sm:left-auto sm:right-5 sm:top-5 sm:w-full sm:max-w-sm"
        aria-live="polite"
        aria-relevant="additions removals"
      >
        {toastItems.map((item) => (
          <div
            key={item.id}
            className={`w-full transition-all duration-200 ${
              leavingIds.has(item.id)
                ? "translate-x-3 opacity-0"
                : "translate-x-0 opacity-100"
            }`}
          >
            <ToastCard
              item={item}
              onDismiss={
                handleDismiss
              }
            />
          </div>
        ))}
      </div>
    </>
  );
}

/**
 * Backward-compatible bridge for existing Toast call sites.
 */
const Toast: React.FC<ToastProps> = ({
  type,
  message,
  duration,
  onClose,
}) => {
  const generatedId = useId();

  const idRef = useRef(
    `toast-${generatedId}`
  );

  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const id = idRef.current;

    addToast({
      id,
      type,
      message: message.trim(),
      duration:
        duration ??
        DEFAULT_DURATION[type],
      onClose: () => {
        onCloseRef.current();
      },
    });

    return () => {
      if (
        items.some(
          (item) => item.id === id
        )
      ) {
        items = items.filter(
          (item) => item.id !== id
        );

        emit();
      }
    };
  }, [
    duration,
    message,
    type,
  ]);

  return null;
};

export default Toast;