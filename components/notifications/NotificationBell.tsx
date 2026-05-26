"use client";
// components/notifications/NotificationBell.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, X, Trash2, Trash } from 'lucide-react';

interface NotificationItem {
  _id: string;
  type: 'upcoming_reminder' | 'due_alarm' | 'intake_confirmed' | 'adherence_alert';
  title: string;
  message: string;
  medicineName?: string;
  riskLevel?: 'Low' | 'Moderate' | 'High';
  adherenceRate?: number;
  read: boolean;
  createdAt: string;
}

interface DeletedNotification {
  id: string;
  data: NotificationItem;
  fading?: boolean;
}

const TYPE_ICON: Record<string, string> = {
  upcoming_reminder: 'Reminder',
  due_alarm: 'Due',
  intake_confirmed: 'Confirmed',
  adherence_alert: 'Alert',
};

const RISK_COLOR: Record<string, string> = {
  Low: 'text-green-600',
  Moderate: 'text-yellow-600',
  High: 'text-red-600',
};

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

interface RiskAndTimeProps {
  riskLevel?: 'Low' | 'Moderate' | 'High';
  adherenceRate?: number;
  createdAt: string;
}

const RiskAndTime: React.FC<RiskAndTimeProps> = ({ riskLevel, adherenceRate, createdAt }) => {
  const getRiskText = () => {
    if (!riskLevel && adherenceRate == null) return '';
    if (riskLevel && adherenceRate != null) {
      return `${riskLevel} Risk · ${adherenceRate}% adherence`;
    }
    if (riskLevel) return `${riskLevel} Risk`;
    if (adherenceRate != null) return `${adherenceRate}% adherence`;
    return '';
  };

  const riskColor = riskLevel ? RISK_COLOR[riskLevel] : 'text-slate-500 dark:text-slate-400';
  const riskText = getRiskText();

  return (
    <div className="flex flex-col gap-1 text-[11px] text-slate-500 dark:text-slate-400">
      {riskText && <span className={`font-medium ${riskColor}`}>{riskText}</span>}
      <span>{formatTime(createdAt)}</span>
    </div>
  );
};

const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletedNotifications, setDeletedNotifications] = useState<Map<string, DeletedNotification>>(new Map());
  const deletedTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      const data = await res.json();
      if (data.success) {
        setNotifications(data.data.notifications);
        setUnreadCount(data.data.unreadCount);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Mark all as read when panel opens
  useEffect(() => {
    if (!isOpen || unreadCount === 0) return;

    const markAllRead = async () => {
      try {
        await fetch('/api/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'markAllRead' }),
        });
        setUnreadCount(0);
        const updatedNotifications = notifications.map((n) => ({
          ...n,
          read: true,
        }));
        setNotifications(updatedNotifications);
      } catch (err) {
        console.error('Failed to mark notifications as read:', err);
      }
    };

    void markAllRead();
  }, [isOpen, unreadCount, notifications]);

  // Close panel when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleClick);
    };
  }, [isOpen]);

  // Clean up undo timeouts on unmount (copy ref to avoid mutation race)
  useEffect(() => {
    return () => {
      const copy = new Map(deletedTimeoutsRef.current);
      copy.forEach((timeout) => clearTimeout(timeout));
      deletedTimeoutsRef.current = new Map();
    };
  }, []);

  const removeDeletedEntry = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n._id !== id));
    setDeletedNotifications((prev) => {
      const updated = new Map(prev);
      updated.delete(id);
      return updated;
    });
  }, []);

  const finalizeDelete = useCallback(async (id: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', notificationId: id }),
      });
    } catch (err) {
      console.error('Failed to permanently delete notification:', err);
    }

    // remove timeout tracking
    deletedTimeoutsRef.current.delete(id);

    // set fading state
    setDeletedNotifications((prev) => {
      const updated = new Map(prev);
      const entry = updated.get(id);
      if (entry) updated.set(id, { ...entry, fading: true });
      return updated;
    });

    // after fade, remove from notifications list
    setTimeout(() => removeDeletedEntry(id), 220);
  }, [removeDeletedEntry]);

  const handleDeleteWithUndo = (id: string) => {
    const notification = notifications.find((n) => n._id === id);
    if (!notification) return;

    if (deletedTimeoutsRef.current.has(id)) return;

    const timeout = setTimeout(() => {
      void finalizeDelete(id);
    }, 4000);

    deletedTimeoutsRef.current.set(id, timeout);
    const deleted: DeletedNotification = { id, data: notification, fading: false };
    setDeletedNotifications((prev) => new Map(prev).set(id, deleted));
  };

  const handleUndo = (id: string) => {
    const deleted = deletedNotifications.get(id);
    if (!deleted) return;

    const timeout = deletedTimeoutsRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      deletedTimeoutsRef.current.delete(id);
    }

    setDeletedNotifications((prev) => {
      const updated = new Map(prev);
      updated.delete(id);
      return updated;
    });
    if (expandedId === id) {
      setExpandedId(null);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('Delete all notifications?')) return;
    setLoading(true);
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteAll' }),
      });
      setNotifications([]);
      setUnreadCount(0);
      Array.from(deletedTimeoutsRef.current.values()).forEach((t) => clearTimeout(t));
      deletedTimeoutsRef.current = new Map();
      setDeletedNotifications(new Map());
    } catch (err) {
      console.error('Failed to delete all notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  // We render all notifications; deleted ones are shown in-place using `deletedNotifications` map

  return (
    <div className="fixed bottom-6 right-6 z-100" ref={panelRef}>
      {/* ── Notification Panel ── */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-[min(92vw,24rem)] max-h-150 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-linear-to-r from-blue-600 to-blue-700 text-white rounded-t-2xl">
            <span className="font-semibold text-sm">Notifications</span>
            <div className="flex items-center gap-2">
              {notifications.length > 0 && (
                <button
                  onClick={() => { void handleDeleteAll(); }}
                  disabled={loading}
                  title="Delete all"
                  className="hover:text-red-200 transition-colors disabled:opacity-50"
                >
                  <Trash className="w-4 h-4" />
                </button>
              )}
              <button onClick={() => setIsOpen(false)} className="hover:text-blue-100 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
                <Bell className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {/* Notifications (show deleted items inline) */}
                {notifications.map((n) => {
                  const deleted = deletedNotifications.get(n._id);
                  if (deleted) {
                    return (
                      <div
                        key={deleted.id}
                        className={`w-full px-4 py-3 transition-all duration-200 flex items-center justify-between gap-3 ${
                            deleted.fading ? 'opacity-0 scale-95' : 'opacity-100'
                          }`}
                      >
                        <div className="min-w-0">
                          <p className="text-sm text-slate-500 dark:text-slate-400">Notification removed</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleUndo(deleted.id)}
                            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline px-2 py-1"
                            aria-label="Undo delete"
                          >
                            Undo
                          </button>
                        </div>
                      </div>
                    );
                  }

                  const isExpanded = expandedId === n._id;
                  const bgClass = n.read ? '' : 'bg-blue-50 dark:bg-blue-900/20';
                  return (
                    <button
                      key={n._id}
                      onClick={() => setExpandedId(isExpanded ? null : n._id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setExpandedId(isExpanded ? null : n._id);
                        }
                      }}
                      className={`w-full text-left px-4 py-3 transition-all duration-200 cursor-pointer border-none bg-transparent ${bgClass} hover:bg-gray-50 dark:hover:bg-gray-800`}
                      aria-pressed={isExpanded}
                      title="Click to expand notification"
                    >
                      <div className="flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-sm text-slate-900 dark:text-white wrap-break-word">
                                {n.title}
                              </p>
                              <span className="shrink-0 text-[8px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                {TYPE_ICON[n.type] ?? 'Notification'}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteWithUndo(n._id);
                            }}
                            className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:text-red-500 dark:hover:text-red-300 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
                            title="Delete (undo available)"
                            aria-label="Delete notification"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col gap-2">
                          <p
                            className={`text-xs text-slate-500 dark:text-slate-400 transition-all ${
                              isExpanded ? 'line-clamp-none' : 'line-clamp-2'
                            }`}
                          >
                            {n.message}
                          </p>
                          <RiskAndTime riskLevel={n.riskLevel} adherenceRate={n.adherenceRate} createdAt={n.createdAt} />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Bell Button ── */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative w-14 h-14 bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        aria-label="Notifications"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
    </div>
  );
};

export default NotificationBell;