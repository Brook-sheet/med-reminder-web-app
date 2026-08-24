'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bell, Check, CheckCheck, CircleAlert, X } from 'lucide-react';
import { useAlerts } from '@/hooks/useAlerts';
import type { AlertData, AlertSeverity } from '@/lib/interfaces/data/Alert';

const SEVERITY_STYLE: Record<AlertSeverity, { label: string; dot: string; text: string }> = {
  INFO: { label: 'Info', dot: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400' },
  NOTICE: { label: 'Notice', dot: 'bg-amber-400', text: 'text-amber-600 dark:text-amber-400' },
  WARNING: { label: 'Warning', dot: 'bg-orange-500', text: 'text-orange-600 dark:text-orange-400' },
  CRITICAL: { label: 'Critical', dot: 'bg-red-600', text: 'text-red-600 dark:text-red-400' },
};

function relativeTime(value: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function AlertBell() {
  const { alerts, unreadCount, loading, error, connected, markRead, acknowledge, markAllRead } = useAlerts(20);
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [liveAlert, setLiveAlert] = useState<AlertData | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const receive = (event: Event) => {
      const alert = (event as CustomEvent<AlertData>).detail;
      setLiveAlert(alert);
      window.setTimeout(() => setLiveAlert((current) => current?._id === alert._id ? null : current), 8_000);
    };
    window.addEventListener('medicationAlertReceived', receive);
    return () => window.removeEventListener('medicationAlertReceived', receive);
  }, []);

  useEffect(() => {
    const closeOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOutside);
    return () => document.removeEventListener('mousedown', closeOutside);
  }, []);

  const openAlert = async (alert: AlertData) => {
    setExpandedId((current) => current === alert._id ? null : alert._id);
    if (!alert.isRead) {
      try {
        await markRead(alert._id);
      } catch (updateError) {
        console.error('[AlertBell] Failed to mark alert read:', updateError);
      }
    }
  };

  return (
    <div ref={panelRef} className="fixed bottom-6 right-6 z-100">
      {liveAlert && !open && (
        <div className="absolute bottom-16 right-0 w-[min(90vw,22rem)] rounded-2xl border border-red-200 bg-white p-4 shadow-2xl dark:border-red-800 dark:bg-gray-900">
          <button type="button" onClick={() => setLiveAlert(null)} className="absolute right-3 top-3 text-gray-400" aria-label="Close alert"><X className="h-4 w-4" /></button>
          <div className="flex items-start gap-3 pr-5">
            <CircleAlert className={`mt-0.5 h-5 w-5 shrink-0 ${SEVERITY_STYLE[liveAlert.severity].text}`} />
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500">New medication alert</p>
              <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{liveAlert.title}</p>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{liveAlert.message}</p>
            </div>
          </div>
        </div>
      )}

      {open && (
        <div className="absolute bottom-16 right-0 flex max-h-[70vh] w-[min(94vw,26rem)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center justify-between bg-linear-to-r from-blue-600 to-blue-700 px-4 py-3 text-white">
            <div>
              <p className="text-sm font-semibold">Medication Alerts</p>
              <p className="flex items-center gap-1 text-[10px] text-blue-100"><span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-green-300' : 'bg-amber-300'}`} />{connected ? 'Real-time connected' : 'Reconnecting…'}</p>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && <button type="button" onClick={() => void markAllRead()} title="Mark all read"><CheckCheck className="h-4 w-4" /></button>}
              <button type="button" onClick={() => setOpen(false)} aria-label="Close alerts"><X className="h-4 w-4" /></button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <p className="p-8 text-center text-sm text-gray-500">Loading alerts…</p>
            ) : error ? (
              <p className="p-5 text-sm text-red-600">{error}</p>
            ) : alerts.length === 0 ? (
              <div className="p-10 text-center text-gray-400"><Bell className="mx-auto mb-2 h-9 w-9 opacity-40" /><p className="text-sm">No medication alerts yet</p></div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {alerts.map((alert) => {
                  const severity = SEVERITY_STYLE[alert.severity];
                  const expanded = expandedId === alert._id;
                  return (
                    <div key={alert._id} className={alert.isRead ? '' : 'bg-blue-50 dark:bg-blue-900/20'}>
                      <button type="button" onClick={() => void openAlert(alert)} className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800">
                        <div className="flex items-start gap-3">
                          <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${severity.dot}`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{alert.title}</p>
                              <span className="shrink-0 text-[10px] text-gray-400">{relativeTime(alert.createdAt)}</span>
                            </div>
                            <p className={`mt-0.5 text-[10px] font-bold uppercase tracking-wide ${severity.text}`}>{severity.label}</p>
                            <p className={`mt-1 text-xs text-gray-600 dark:text-gray-300 ${expanded ? '' : 'line-clamp-2'}`}>{alert.message}</p>
                            <p className="mt-1 text-[11px] text-gray-400">Patient: {alert.patient.name}{alert.medication ? ` · ${alert.medication.name}` : ''}</p>
                          </div>
                        </div>
                      </button>
                      {expanded && (
                        <div className="flex items-center justify-between gap-2 px-4 pb-3 pl-9">
                          <span className="text-[10px] font-semibold text-gray-400">{alert.status}</span>
                          {alert.status !== 'ACKNOWLEDGED' && (
                            <button type="button" onClick={() => void acknowledge(alert._id)} className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"><Check className="h-3.5 w-3.5" /> Acknowledge</button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <Link href="/alerts" onClick={() => setOpen(false)} className="border-t border-gray-200 px-4 py-3 text-center text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:border-gray-700 dark:text-blue-400 dark:hover:bg-gray-800">View all alerts</Link>
        </div>
      )}

      <button type="button" onClick={() => setOpen((value) => !value)} className="relative flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition hover:scale-105 hover:bg-blue-700" aria-label="Medication alerts">
        {unreadCount > 0 ? <AlertTriangle className="h-6 w-6" /> : <Bell className="h-6 w-6" />}
        {unreadCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>
    </div>
  );
}