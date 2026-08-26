'use client';

import Link from 'next/link';
import {
  useMemo,
  useState,
} from 'react';
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCircle,
  Clock,
  ExternalLink,
  Info,
  MessageSquareText,
  Radio,
  ShieldAlert,
} from 'lucide-react';
import { useAlerts } from '@/hooks/useAlerts';
import type {
  AlertData,
  AlertSeverity,
} from '@/lib/interfaces/data/Alert';

const SEVERITY:
  Record<
    AlertSeverity,
    {
      label: string;
      badge: string;
      Icon: typeof Bell;
    }
  > = {
    INFO: {
      label:
        'Info',

      badge:
        'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300',

      Icon:
        Info,
    },

    NOTICE: {
      label:
        'Notice',

      badge:
        'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300',

      Icon:
        Clock,
    },

    WARNING: {
      label:
        'Warning',

      badge:
        'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-900/20 dark:text-orange-300',

      Icon:
        AlertTriangle,
    },

    CRITICAL: {
      label:
        'Critical',

      badge:
        'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300',

      Icon:
        ShieldAlert,
    },
  };

function fullTime(
  value: string,
): string {
  return new Date(
    value,
  ).toLocaleString(
    'en-US',
    {
      month:
        'long',

      day:
        'numeric',

      year:
        'numeric',

      hour:
        'numeric',

      minute:
        '2-digit',
    },
  );
}

function annotationTitle(
  type:
    AlertData['annotations'][number]['type'],
): string {
  if (
    type ===
    'missed_explanation'
  ) {
    return 'Missed-dose explanation';
  }

  if (
    type ===
    'family_acknowledgment'
  ) {
    return 'Family acknowledgment';
  }

  return 'Patient note';
}

function AlertDetails({
  alert,
  acknowledge,
}: {
  alert: AlertData;

  acknowledge:
    (
      id: string,
    ) => Promise<AlertData>;
}) {
  const severity =
    SEVERITY[
      alert.severity
    ];

  const Icon =
    severity.Icon;

  const annotations =
    alert.annotations ?? [];

  return (
    <div className="rounded-[28px] border border-border/70 bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full border ${severity.badge}`}
          >
            <Icon className="h-5 w-5" />
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
              Alert Details
            </p>

            <h2 className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
              {alert.title}
            </h2>
          </div>
        </div>

        <span
          className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${severity.badge}`}
        >
          {severity.label}
        </span>
      </div>

      <p className="mt-5 rounded-xl border border-border/50 bg-background/60 p-4 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
        {alert.message}
      </p>

      {annotations.length > 0 && (
        <section className="mt-5 rounded-2xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-800 dark:bg-blue-900/15">
          <div className="flex items-center gap-2">
            <MessageSquareText className="h-4 w-4 text-blue-600 dark:text-blue-400" />

            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Medication log notes
            </h3>
          </div>

          <div className="mt-3 space-y-3">
            {annotations.map(
              (annotation) => (
                <div
                  key={
                    annotation._id ||
                    `${annotation.type}-${annotation.createdAt}`
                  }
                  className="rounded-xl border border-blue-100 bg-white/80 p-3 dark:border-blue-900 dark:bg-gray-900/40"
                >
                  <p className="text-xs font-bold text-blue-700 dark:text-blue-300">
                    {annotationTitle(
                      annotation.type,
                    )}
                  </p>

                  {annotation.text && (
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-700 dark:text-gray-200">
                      {annotation.text}
                    </p>
                  )}

                  <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
                    {annotation.authorName}
                    {' · '}
                    {fullTime(
                      annotation.createdAt,
                    )}
                  </p>
                </div>
              ),
            )}
          </div>
        </section>
      )}

      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Patient
          </dt>

          <dd className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
            {alert.patient.name}
          </dd>
        </div>

        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Medication
          </dt>

          <dd className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
            {alert.medication
              ? `${alert.medication.name} ${
                  alert.medication.dosage ||
                  ''
                }`.trim()
              : 'Not specified'}
          </dd>
        </div>

        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Event
          </dt>

          <dd className="mt-1 text-sm text-gray-700 dark:text-gray-300">
            {alert.eventType.replaceAll(
              '_',
              ' ',
            )}
          </dd>
        </div>

        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Time
          </dt>

          <dd className="mt-1 text-sm text-gray-700 dark:text-gray-300">
            {fullTime(
              alert.occurredAt,
            )}
          </dd>
        </div>

        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Status
          </dt>

          <dd className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
            {alert.status}
          </dd>
        </div>

        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Delivery
          </dt>

          <dd className="mt-1 text-sm text-gray-700 dark:text-gray-300">
            In-app
            {alert.channels.push
              ? ' · Push'
              : ''}
            {alert.channels.sms
              ? ' · SMS'
              : ''}
          </dd>
        </div>
      </dl>

      <div className="mt-6 flex flex-wrap gap-2">
        {alert.status !==
          'ACKNOWLEDGED' && (
          <button
            type="button"
            onClick={() =>
              void acknowledge(
                alert._id,
              )
            }
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Check className="h-4 w-4" />
            Acknowledge
          </button>
        )}

        {alert.patient.patientId && (
          <Link
            href={`/monitor/${alert.patient.patientId}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <ExternalLink className="h-4 w-4" />
            Open patient monitoring
          </Link>
        )}
      </div>
    </div>
  );
}

export default function AlertsPageClient() {
  const {
    alerts,
    unreadCount,
    loading,
    error,
    connected,
    refetch,
    markRead,
    acknowledge,
    markAllRead,
  } =
    useAlerts(100);

  const [
    severityFilter,
    setSeverityFilter,
  ] =
    useState<
      | 'ALL'
      | AlertSeverity
    >('ALL');

  const [
    selectedId,
    setSelectedId,
  ] =
    useState<string | null>(
      null,
    );

  const filtered =
    useMemo(
      () =>
        severityFilter ===
        'ALL'
          ? alerts
          : alerts.filter(
              (alert) =>
                alert.severity ===
                severityFilter,
            ),
      [
        alerts,
        severityFilter,
      ],
    );

  const selected =
    alerts.find(
      (alert) =>
        alert._id ===
        selectedId,
    ) || null;

  const selectAlert =
    async (
      alert: AlertData,
    ) => {
      setSelectedId(
        alert._id,
      );

      try {
        /*
         * Opening an already-read alert refreshes the list
         * so notes added after alert delivery appear
         * immediately.
         */
        if (!alert.isRead) {
          await markRead(
            alert._id,
          );
        } else {
          await refetch();
        }
      } catch (updateError) {
        console.error(
          updateError,
        );
      }
    };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Medication Alerts
            </h1>

            <p className="mt-2 text-gray-600 dark:text-gray-300">
              Real-time alerts from your authorized Patients
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-gray-500">
            <Radio
              className={`h-3.5 w-3.5 ${
                connected
                  ? 'text-green-500'
                  : 'text-amber-500'
              }`}
            />

            {connected
              ? 'Real-time connected'
              : 'Reconnecting automatically'}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card p-4">
          <div className="flex flex-wrap gap-2">
            {(
              [
                'ALL',
                'NOTICE',
                'WARNING',
                'CRITICAL',
              ] as const
            ).map(
              (value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setSeverityFilter(
                      value,
                    )
                  }
                  className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                    severityFilter ===
                    value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                  }`}
                >
                  {value === 'ALL'
                    ? 'All Alerts'
                    : SEVERITY[value]
                        .label}
                </button>
              ),
            )}
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() =>
                void markAllRead()
              }
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400"
            >
              <CheckCircle className="h-4 w-4" />
              Mark all read (
              {unreadCount})
            </button>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.85fr)]">
          <section className="overflow-hidden rounded-[28px] border border-border/70 bg-card shadow-sm">
            {loading ? (
              <p className="p-8 text-center text-sm text-gray-500">
                Loading alerts…
              </p>
            ) : filtered.length ===
              0 ? (
              <div className="p-12 text-center text-gray-400">
                <Bell className="mx-auto mb-3 h-10 w-10 opacity-40" />

                <p>
                  No alerts in this category.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {filtered.map(
                  (alert) => {
                    const severity =
                      SEVERITY[
                        alert.severity
                      ];

                    const Icon =
                      severity.Icon;

                    const noteCount =
                      (
                        alert.annotations ??
                        []
                      ).length;

                    return (
                      <button
                        key={
                          alert._id
                        }
                        type="button"
                        onClick={() =>
                          void selectAlert(
                            alert,
                          )
                        }
                        className={`w-full p-4 text-left transition hover:bg-gray-50 dark:hover:bg-gray-800/60 ${
                          !alert.isRead
                            ? 'bg-blue-50/70 dark:bg-blue-900/10'
                            : ''
                        } ${
                          selectedId ===
                          alert._id
                            ? 'ring-2 ring-inset ring-blue-500'
                            : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${severity.badge}`}
                          >
                            <Icon className="h-4 w-4" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                                {
                                  alert.title
                                }
                              </p>

                              <span className="shrink-0 text-[10px] text-gray-400">
                                {fullTime(
                                  alert.createdAt,
                                )}
                              </span>
                            </div>

                            <p className="mt-1 line-clamp-2 text-xs text-gray-600 dark:text-gray-300">
                              {
                                alert.message
                              }
                            </p>

                            <p className="mt-2 text-[11px] text-gray-400">
                              {
                                alert
                                  .patient
                                  .name
                              }

                              {alert.medication
                                ? ` · ${alert.medication.name}`
                                : ''}

                              {' · '}
                              {
                                alert.status
                              }
                            </p>

                            {noteCount >
                              0 && (
                              <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                                <MessageSquareText className="h-3 w-3" />

                                {
                                  noteCount
                                }{' '}

                                {noteCount ===
                                1
                                  ? 'note'
                                  : 'notes'}
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  },
                )}
              </div>
            )}
          </section>

          <aside>
            {selected ? (
              <AlertDetails
                alert={
                  selected
                }
                acknowledge={async (
                  id,
                ) => {
                  const updated =
                    await acknowledge(
                      id,
                    );

                  setSelectedId(
                    updated._id,
                  );

                  return updated;
                }}
              />
            ) : (
              <div className="rounded-[28px] border border-dashed border-border p-10 text-center text-gray-400">
                <Bell className="mx-auto mb-3 h-10 w-10 opacity-40" />

                <p className="text-sm">
                  Select an alert to view its details.
                </p>
              </div>
            )}
          </aside>
        </div>

        <p className="text-center text-xs text-gray-400">
          Browser Push can be enabled in Settings. SMS is only attempted for configured important alerts.
        </p>
      </div>
    </div>
  );
}