"use client";
// components/notifications/NotificationBell.tsx

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import {
  Bell,
  X,
  Trash2,
  Trash,
} from "lucide-react";

interface NotificationItem {
  _id: string;
  type:
    | "upcoming_reminder"
    | "due_alarm"
    | "intake_confirmed"
    | "adherence_alert"
    | "monitoring_request"
    | "monitoring_approved"
    | "monitoring_declined"
    | "monitoring_revoked"
    | "chat_request"
    | "chat_request_accepted"
    | "chat_request_declined";
  title: string;
  message: string;
  medicineName?: string;
  riskLevel?:
    | "Low"
    | "Moderate"
    | "High";
  adherenceRate?: number;
  read: boolean;
  createdAt: string;
}

interface DeletedNotification {
  id: string;
  data: NotificationItem;
  fading?: boolean;
}

const TYPE_ICON: Record<
  string,
  string
> = {
  upcoming_reminder: "Reminder",
  due_alarm: "Due",
  intake_confirmed: "Confirmed",
  adherence_alert: "Alert",
  monitoring_request: "Monitoring",
  monitoring_approved: "Monitoring",
  monitoring_declined: "Monitoring",
  monitoring_revoked: "Monitoring",
  chat_request: "Chat",
  chat_request_accepted: "Chat",
  chat_request_declined: "Chat",
};

const RISK_COLOR: Record<
  string,
  string
> = {
  Low: "text-green-600",
  Moderate: "text-yellow-600",
  High: "text-red-600",
};

function formatTime(
  dateStr: string
): string {
  const date = new Date(dateStr);
  const now = new Date();

  const diffMs =
    now.getTime() - date.getTime();

  const diffMins = Math.floor(
    diffMs / 60000
  );

  const diffHours = Math.floor(
    diffMins / 60
  );

  const diffDays = Math.floor(
    diffHours / 24
  );

  if (diffMins < 1) {
    return "Just now";
  }

  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }

  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  return `${diffDays}d ago`;
}

interface RiskAndTimeProps {
  riskLevel?:
    | "Low"
    | "Moderate"
    | "High";
  adherenceRate?: number;
  createdAt: string;
}

const RiskAndTime: React.FC<
  RiskAndTimeProps
> = ({
  riskLevel,
  adherenceRate,
  createdAt,
}) => {
  const getRiskText = () => {
    if (
      !riskLevel &&
      adherenceRate == null
    ) {
      return "";
    }

    if (
      riskLevel &&
      adherenceRate != null
    ) {
      return `${riskLevel} Risk · ${adherenceRate}% adherence`;
    }

    if (riskLevel) {
      return `${riskLevel} Risk`;
    }

    if (adherenceRate != null) {
      return `${adherenceRate}% adherence`;
    }

    return "";
  };

  const riskColor = riskLevel
    ? RISK_COLOR[riskLevel]
    : "text-slate-500 dark:text-slate-400";

  const riskText = getRiskText();

  return (
    <div className="flex flex-col gap-1 text-[11px] text-slate-500 dark:text-slate-400">
      {riskText && (
        <span
          className={`font-medium ${riskColor}`}
        >
          {riskText}
        </span>
      )}

      <span>
        {formatTime(createdAt)}
      </span>
    </div>
  );
};

const NotificationBell: React.FC =
  () => {
    const [isOpen, setIsOpen] =
      useState(false);

    const [
      notifications,
      setNotifications,
    ] = useState<
      NotificationItem[]
    >([]);

    const [
      unreadCount,
      setUnreadCount,
    ] = useState(0);

    const [loading, setLoading] =
      useState(false);

    const [
      expandedId,
      setExpandedId,
    ] = useState<string | null>(
      null
    );

    const [
      deletedNotifications,
      setDeletedNotifications,
    ] = useState<
      Map<
        string,
        DeletedNotification
      >
    >(new Map());

    const deletedTimeoutsRef =
      useRef<
        Map<
          string,
          NodeJS.Timeout
        >
      >(new Map());

    const panelRef =
      useRef<HTMLDivElement>(null);

    const fetchNotifications =
      useCallback(async () => {
        try {
          const response =
            await fetch(
              "/api/notifications"
            );

          const data =
            await response.json();

          if (data.success) {
            setNotifications(
              data.data.notifications
            );

            setUnreadCount(
              data.data.unreadCount
            );
          }
        } catch (error) {
          console.error(
            "Failed to fetch notifications:",
            error
          );
        }
      }, []);

    useEffect(() => {
      void fetchNotifications();

      const interval =
        setInterval(
          fetchNotifications,
          30000
        );

      return () =>
        clearInterval(interval);
    }, [fetchNotifications]);

    useEffect(() => {
      if (
        !isOpen ||
        unreadCount === 0
      ) {
        return;
      }

      const markAllRead =
        async () => {
          try {
            await fetch(
              "/api/notifications",
              {
                method: "PATCH",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body: JSON.stringify({
                  action:
                    "markAllRead",
                }),
              }
            );

            setUnreadCount(0);

            const updatedNotifications =
              notifications.map(
                (notification) => ({
                  ...notification,
                  read: true,
                })
              );

            setNotifications(
              updatedNotifications
            );
          } catch (error) {
            console.error(
              "Failed to mark notifications as read:",
              error
            );
          }
        };

      void markAllRead();
    }, [
      isOpen,
      unreadCount,
      notifications,
    ]);

    useEffect(() => {
      const handleClick = (
        event: MouseEvent
      ) => {
        if (
          panelRef.current &&
          !panelRef.current.contains(
            event.target as Node
          )
        ) {
          setIsOpen(false);
        }
      };

      if (isOpen) {
        document.addEventListener(
          "mousedown",
          handleClick
        );
      }

      return () => {
        document.removeEventListener(
          "mousedown",
          handleClick
        );
      };
    }, [isOpen]);

    useEffect(() => {
      return () => {
        const copy = new Map(
          deletedTimeoutsRef.current
        );

        copy.forEach((timeout) =>
          clearTimeout(timeout)
        );

        deletedTimeoutsRef.current =
          new Map();
      };
    }, []);

    const removeDeletedEntry =
      useCallback((id: string) => {
        setNotifications(
          (previous) =>
            previous.filter(
              (notification) =>
                notification._id !==
                id
            )
        );

        setDeletedNotifications(
          (previous) => {
            const updated =
              new Map(previous);

            updated.delete(id);

            return updated;
          }
        );
      }, []);

    const finalizeDelete =
      useCallback(
        async (id: string) => {
          try {
            await fetch(
              "/api/notifications",
              {
                method: "PATCH",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body:
                  JSON.stringify({
                    action: "delete",
                    notificationId: id,
                  }),
              }
            );
          } catch (error) {
            console.error(
              "Failed to permanently delete notification:",
              error
            );
          }

          deletedTimeoutsRef.current.delete(
            id
          );

          setDeletedNotifications(
            (previous) => {
              const updated =
                new Map(previous);

              const entry =
                updated.get(id);

              if (entry) {
                updated.set(id, {
                  ...entry,
                  fading: true,
                });
              }

              return updated;
            }
          );

          setTimeout(
            () =>
              removeDeletedEntry(id),
            220
          );
        },
        [removeDeletedEntry]
      );

    const handleDeleteWithUndo = (
      id: string
    ) => {
      const notification =
        notifications.find(
          (item) => item._id === id
        );

      if (!notification) {
        return;
      }

      if (
        deletedTimeoutsRef.current.has(
          id
        )
      ) {
        return;
      }

      const timeout = setTimeout(
        () => {
          void finalizeDelete(id);
        },
        4000
      );

      deletedTimeoutsRef.current.set(
        id,
        timeout
      );

      const deleted:
        DeletedNotification = {
        id,
        data: notification,
        fading: false,
      };

      setDeletedNotifications(
        (previous) =>
          new Map(previous).set(
            id,
            deleted
          )
      );
    };

    const handleUndo = (
      id: string
    ) => {
      const deleted =
        deletedNotifications.get(id);

      if (!deleted) {
        return;
      }

      const timeout =
        deletedTimeoutsRef.current.get(
          id
        );

      if (timeout) {
        clearTimeout(timeout);

        deletedTimeoutsRef.current.delete(
          id
        );
      }

      setDeletedNotifications(
        (previous) => {
          const updated =
            new Map(previous);

          updated.delete(id);

          return updated;
        }
      );

      if (expandedId === id) {
        setExpandedId(null);
      }
    };

    const handleDeleteAll =
      async () => {
        if (
          !confirm(
            "Delete all notifications?"
          )
        ) {
          return;
        }

        setLoading(true);

        try {
          await fetch(
            "/api/notifications",
            {
              method: "PATCH",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                action: "deleteAll",
              }),
            }
          );

          setNotifications([]);
          setUnreadCount(0);

          Array.from(
            deletedTimeoutsRef.current.values()
          ).forEach((timeout) =>
            clearTimeout(timeout)
          );

          deletedTimeoutsRef.current =
            new Map();

          setDeletedNotifications(
            new Map()
          );
        } catch (error) {
          console.error(
            "Failed to delete all notifications:",
            error
          );
        } finally {
          setLoading(false);
        }
      };

    return (
      <div
        className="fixed bottom-6 right-6 z-100"
        ref={panelRef}
      >
        {isOpen && (
          <div className="absolute bottom-16 right-0 flex max-h-150 w-[min(92vw,24rem)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-center justify-between rounded-t-2xl bg-linear-to-r from-blue-600 to-blue-700 px-4 py-3 text-white">
              <span className="text-sm font-semibold">
                Notifications
              </span>

              <div className="flex items-center gap-2">
                {notifications.length >
                  0 && (
                  <button
                    type="button"
                    onClick={() => {
                      void handleDeleteAll();
                    }}
                    disabled={loading}
                    title="Delete all"
                    className="transition-colors hover:text-red-200 disabled:opacity-50"
                  >
                    <Trash className="h-4 w-4" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() =>
                    setIsOpen(false)
                  }
                  className="transition-colors hover:text-blue-100"
                  aria-label="Close notifications"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {notifications.length ===
              0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
                  <Bell className="mb-2 h-10 w-10 opacity-30" />

                  <p className="text-sm">
                    No notifications yet
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {notifications.map(
                    (notification) => {
                      const deleted =
                        deletedNotifications.get(
                          notification._id
                        );

                      if (deleted) {
                        return (
                          <div
                            key={
                              deleted.id
                            }
                            className={`flex w-full items-center justify-between gap-3 px-4 py-3 transition-all duration-200 ${
                              deleted.fading
                                ? "scale-95 opacity-0"
                                : "opacity-100"
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="text-sm text-slate-500 dark:text-slate-400">
                                Notification
                                removed
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                handleUndo(
                                  deleted.id
                                )
                              }
                              className="px-2 py-1 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                              aria-label="Undo delete"
                            >
                              Undo
                            </button>
                          </div>
                        );
                      }

                      const isExpanded =
                        expandedId ===
                        notification._id;

                      const bgClass =
                        notification.read
                          ? ""
                          : "bg-blue-50 dark:bg-blue-900/20";

                      return (
                        <button
                          key={
                            notification._id
                          }
                          type="button"
                          onClick={() =>
                            setExpandedId(
                              isExpanded
                                ? null
                                : notification._id
                            )
                          }
                          className={`w-full cursor-pointer border-none bg-transparent px-4 py-3 text-left transition-all duration-200 ${bgClass} hover:bg-gray-50 dark:hover:bg-gray-800`}
                          aria-pressed={
                            isExpanded
                          }
                          title="Click to expand notification"
                        >
                          <div className="flex flex-col gap-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <div className="flex items-center gap-2">
                                  <p className="wrap-break-word text-sm font-semibold text-slate-900 dark:text-white">
                                    {
                                      notification.title
                                    }
                                  </p>

                                  <span className="shrink-0 whitespace-nowrap text-[8px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                    {TYPE_ICON[
                                      notification
                                        .type
                                    ] ??
                                      "Notification"}
                                  </span>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={(
                                  event
                                ) => {
                                  event.stopPropagation();

                                  handleDeleteWithUndo(
                                    notification._id
                                  );
                                }}
                                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-500 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-red-900/20 dark:hover:text-red-300"
                                title="Delete (undo available)"
                                aria-label="Delete notification"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            <div className="flex min-w-0 flex-1 flex-col gap-2">
                              <p
                                className={`text-xs text-slate-500 transition-all dark:text-slate-400 ${
                                  isExpanded
                                    ? "line-clamp-none"
                                    : "line-clamp-2"
                                }`}
                              >
                                {
                                  notification.message
                                }
                              </p>

                              <RiskAndTime
                                riskLevel={
                                  notification.riskLevel
                                }
                                adherenceRate={
                                  notification.adherenceRate
                                }
                                createdAt={
                                  notification.createdAt
                                }
                              />
                            </div>
                          </div>
                        </button>
                      );
                    }
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() =>
            setIsOpen(
              (previous) => !previous
            )
          }
          className="relative flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-all hover:scale-105 hover:bg-blue-700 active:scale-95 dark:bg-blue-500 dark:hover:bg-blue-600"
          aria-label="Notifications"
        >
          <Bell className="h-6 w-6" />

          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
              {unreadCount > 9
                ? "9+"
                : unreadCount}
            </span>
          )}
        </button>
      </div>
    );
  };

export default NotificationBell;