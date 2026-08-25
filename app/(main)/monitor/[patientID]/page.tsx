'use client';

import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  useParams,
  useRouter,
} from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  Eye,
  Info,
  Minus,
  Pill,
  Sparkles,
  TrendingDown,
  TrendingUp,
  User,
} from 'lucide-react';

type RiskLevel =
  | 'Low'
  | 'Moderate'
  | 'High';

type Trend =
  | 'improving'
  | 'stable'
  | 'declining';

interface BehavioralInsight {
  id: string;

  tone:
    | 'positive'
    | 'warning'
    | 'critical'
    | 'neutral';

  title: string;
  detail: string;
}

interface AdherenceInfo {
  hasSufficientData: boolean;
  riskLevel: RiskLevel;
  adherenceRate: number;
  totalScheduled: number;
  totalTaken: number;
  totalMissed: number;
  totalPending: number;
  totalUpcoming: number;
  consecutiveMissed: number;
  delayedDoses: number;
  avgDelayMinutes: number;
  incorrectChamberEvents: number;
  recentRate: number;
  previousRate: number;
  weeklyTrend: Trend;
  trendAvailable: boolean;
  riskReasons: string[];
  insight: string;
  recommendation: string;

  behavioral: {
    insights:
      BehavioralInsight[];

    dailyTrend:
      Array<{
        date: string;
        label: string;
        eligible: number;
        taken: number;
        adherenceRate:
          number | null;
      }>;

    timeOfDay:
      Array<{
        period:
          | 'Morning'
          | 'Afternoon'
          | 'Evening';

        eligible: number;
        taken: number;
        missed: number;
        late: number;
        adherenceRate: number;
      }>;

    byMedication:
      Array<{
        medicineId:
          string | null;

        medicineName: string;
        eligible: number;
        taken: number;
        missed: number;
        late: number;
        incorrectChamber: number;
        adherenceRate: number;
      }>;
  };
}

interface LogEntry {
  medicineName: string;
  scheduledDate: string;
  scheduledTime: string;
  status: string;

  lifecycle:
    | 'upcoming'
    | 'due'
    | 'taken'
    | 'late'
    | 'missed'
    | 'incorrect_chamber'
    | 'unverified'
    | 'audit';

  takenAt?: string | null;
  dosage?: string;
  source?: string;
  expectedChamberId?: number | null;
  detectedChamberId?: number | null;
  expectedChamberIds?: number[];
  verificationNote?: string;
}

interface DashboardData {
  patient: {
    patientId: string;
    name: string;
    condition: string;
    memberSince: string;
  };

  adherence:
    AdherenceInfo;

  recentLogs:
    LogEntry[];

  reportSummary: {
    range: string;
    scheduled: number;
    verified: number;
    missed: number;
    late: number;
    incorrectChamber: number;
    unverified: number;

    today: {
      scheduled: number;
      verified: number;
      missed: number;
      late: number;
      incorrectChamber: number;
    };
  };

  readOnly: boolean;
}

const RISK_STYLE = {
  Low: {
    badge:
      'border-green-300 bg-green-100 text-green-800 dark:border-green-700 dark:bg-green-900/30 dark:text-green-300',

    text:
      'text-green-700 dark:text-green-400',

    bar:
      'bg-green-500',

    Icon:
      CheckCircle,
  },

  Moderate: {
    badge:
      'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300',

    text:
      'text-amber-700 dark:text-amber-400',

    bar:
      'bg-amber-500',

    Icon:
      AlertTriangle,
  },

  High: {
    badge:
      'border-red-300 bg-red-100 text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300',

    text:
      'text-red-700 dark:text-red-400',

    bar:
      'bg-red-500',

    Icon:
      AlertTriangle,
  },
} as const;

const TREND_STYLE = {
  improving: {
    label:
      'Improving',

    color:
      'text-green-600',

    Icon:
      TrendingUp,
  },

  stable: {
    label:
      'Stable',

    color:
      'text-gray-500',

    Icon:
      Minus,
  },

  declining: {
    label:
      'Declining',

    color:
      'text-red-600',

    Icon:
      TrendingDown,
  },
} as const;

const LOG_STYLE:
  Record<
    LogEntry['lifecycle'],
    {
      label: string;
      color: string;
      dot: string;
    }
  > = {
    upcoming: {
      label:
        'Upcoming',

      color:
        'text-blue-700 dark:text-blue-300',

      dot:
        'bg-blue-500',
    },

    due: {
      label:
        'Due / Pending',

      color:
        'text-amber-700 dark:text-amber-300',

      dot:
        'bg-amber-500',
    },

    taken: {
      label:
        'Taken',

      color:
        'text-green-700 dark:text-green-300',

      dot:
        'bg-green-500',
    },

    late: {
      label:
        'Late',

      color:
        'text-amber-700 dark:text-amber-300',

      dot:
        'bg-amber-500',
    },

    missed: {
      label:
        'Missed',

      color:
        'text-red-700 dark:text-red-300',

      dot:
        'bg-red-500',
    },

    incorrect_chamber: {
      label:
        'Wrong Chamber',

      color:
        'text-red-700 dark:text-red-300',

      dot:
        'bg-red-500',
    },

    unverified: {
      label:
        'Unverified',

      color:
        'text-gray-600 dark:text-gray-300',

      dot:
        'bg-gray-400',
    },

    audit: {
      label:
        'Verification Event',

      color:
        'text-gray-600 dark:text-gray-300',

      dot:
        'bg-gray-400',
    },
  };

export default function MonitorDashboardPage() {
  const params =
    useParams();

  const router =
    useRouter();

  const patientID =
    params.patientID as string;

  const [data, setData] =
    useState<DashboardData | null>(
      null,
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(
      null,
    );

  const [
    lastUpdated,
    setLastUpdated,
  ] =
    useState<Date | null>(
      null,
    );

  const fetchDashboard =
    useCallback(async () => {
      if (!patientID) return;

      try {
        const response =
          await fetch(
            `/api/patient/monitor/${patientID}/dashboard`,
            {
              cache:
                'no-store',
            },
          );

        const json =
          await response.json();

        if (
          !response.ok ||
          !json.success
        ) {
          throw new Error(
            json.error ||
              'Failed to load patient dashboard',
          );
        }

        setData(
          json.data,
        );

        setError(
          null,
        );

        setLastUpdated(
          new Date(),
        );
      } catch (fetchError) {
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : 'Failed to connect to server',
        );
      } finally {
        setLoading(
          false,
        );
      }
    }, [
      patientID,
    ]);

  useEffect(() => {
    fetchDashboard();

    const interval =
      setInterval(
        fetchDashboard,
        60_000,
      );

    const refreshWhenVisible =
      () => {
        if (
          document.visibilityState ===
          'visible'
        ) {
          fetchDashboard();
        }
      };

    window.addEventListener(
      'focus',
      fetchDashboard,
    );

    document.addEventListener(
      'visibilitychange',
      refreshWhenVisible,
    );

    return () => {
      clearInterval(
        interval,
      );

      window.removeEventListener(
        'focus',
        fetchDashboard,
      );

      document.removeEventListener(
        'visibilitychange',
        refreshWhenVisible,
      );
    };
  }, [
    fetchDashboard,
  ]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />

          <p className="mt-3 text-sm text-gray-500">
            Loading patient dashboard...
          </p>
        </div>
      </div>
    );
  }

  if (
    error ||
    !data
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="max-w-sm space-y-4 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-400" />

          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            {error ||
              'Patient not found'}
          </p>

          <button
            onClick={() =>
              router.back()
            }
            className="text-sm text-blue-600 underline dark:text-blue-400"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  const {
    patient,
    adherence,
    recentLogs,
    reportSummary,
  } = data;

  const risk =
    RISK_STYLE[
      adherence.riskLevel
    ];

  const RiskIcon =
    risk.Icon;

  const trend =
    TREND_STYLE[
      adherence.weeklyTrend
    ];

  const TrendIcon =
    trend.Icon;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl space-y-5 px-4 py-6">
        <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 dark:border-blue-800 dark:bg-blue-900/20">
          <Eye className="h-4 w-4 shrink-0 text-blue-500" />

          <p className="text-xs font-medium text-blue-700 dark:text-blue-300">
            Read-only monitoring mode — you cannot edit patient data
          </p>

          {lastUpdated && (
            <p className="ml-auto text-xs text-blue-400">
              Updated{' '}
              {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>

        <button
          onClick={() =>
            router.back()
          }
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Patient Monitoring
        </button>

        <section className="rounded-[28px] border border-border/70 bg-card p-6 shadow-lg shadow-slate-900/5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                <User className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>

              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  {patient.name}
                </h1>

                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {patient.condition}
                  {' · ID: '}
                  {patient.patientId}
                </p>

                <p className="mt-0.5 text-xs text-gray-400">
                  Member since{' '}
                  {new Date(
                    patient.memberSince,
                  ).toLocaleDateString()}
                </p>
              </div>
            </div>

            {adherence.hasSufficientData && (
              <span
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${risk.badge}`}
              >
                <RiskIcon className="h-3.5 w-3.5" />
                {adherence.riskLevel}
                {' Behavioral Risk'}
              </span>
            )}
          </div>
        </section>

        <section className="rounded-[28px] border border-border/70 bg-card p-6 shadow-lg shadow-slate-900/5">
          <div className="mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-green-500" />

            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Today&apos;s Medication Status
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {[
              {
                label:
                  'Verified',

                value:
                  `${reportSummary.today.verified} / ${reportSummary.today.scheduled}`,

                color:
                  'text-green-600',
              },
              {
                label:
                  'Missed',

                value:
                  reportSummary.today.missed,

                color:
                  'text-red-600',
              },
              {
                label:
                  'Late',

                value:
                  reportSummary.today.late,

                color:
                  'text-amber-600',
              },
              {
                label:
                  'Wrong Chamber',

                value:
                  reportSummary.today.incorrectChamber,

                color:
                  'text-red-600',
              },
              {
                label:
                  'Adherence',

                value:
                  adherence.hasSufficientData
                    ? `${adherence.adherenceRate}%`
                    : '—',

                color:
                  'text-blue-600',
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-border/30 bg-white/60 p-3 text-center dark:bg-gray-800/60"
              >
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {item.label}
                </p>

                <p
                  className={`mt-1 text-xl font-bold ${item.color}`}
                >
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-5 rounded-[28px] border border-border/70 bg-card p-6 shadow-lg shadow-slate-900/5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />

            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Behavioral Adherence Analysis
            </h2>
          </div>

          {!adherence.hasSufficientData ? (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-center dark:border-blue-800 dark:bg-blue-900/20">
              <Info className="mx-auto h-7 w-7 text-blue-500" />

              <p className="mt-2 text-lg font-bold text-gray-900 dark:text-white">
                Insufficient Data
              </p>

              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                More completed medication activity is needed before behavioral patterns can be identified.
              </p>

              <p className="mt-2 text-xs text-blue-700 dark:text-blue-300">
                {adherence.totalPending}
                {' due within an active window · '}
                {adherence.totalUpcoming}
                {' upcoming'}
              </p>
            </div>
          ) : (
            <>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Eligible-dose adherence
                  </span>

                  <span
                    className={`text-2xl font-bold ${risk.text}`}
                  >
                    {adherence.adherenceRate}%
                  </span>
                </div>

                <div className="h-3 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className={`h-3 rounded-full ${risk.bar}`}
                    style={{
                      width:
                        `${Math.min(
                          adherence.adherenceRate,
                          100,
                        )}%`,
                    }}
                  />
                </div>

                <p className="mt-1 text-xs text-gray-400">
                  Upcoming and active-window pending doses do not affect this rate.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                {[
                  {
                    label:
                      'Eligible',

                    value:
                      adherence.totalScheduled,
                  },
                  {
                    label:
                      'Taken',

                    value:
                      adherence.totalTaken,
                  },
                  {
                    label:
                      'Missed',

                    value:
                      adherence.totalMissed,
                  },
                  {
                    label:
                      'Delayed',

                    value:
                      adherence.delayedDoses,
                  },
                  {
                    label:
                      'Wrong Chamber',

                    value:
                      adherence.incorrectChamberEvents,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-border/30 bg-white/60 p-3 text-center dark:bg-gray-800/60"
                  >
                    <p className="text-xs text-gray-500">
                      {item.label}
                    </p>

                    <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-border/50 bg-white/50 p-4 dark:bg-gray-800/50">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div
                    className={`flex items-center gap-1.5 text-sm font-bold ${trend.color}`}
                  >
                    <TrendIcon className="h-4 w-4" />

                    {adherence.trendAvailable
                      ? trend.label
                      : 'Insufficient historical data for trend'}
                  </div>

                  {adherence.trendAvailable && (
                    <p className="text-xs text-gray-500">
                      Previous 7 days{' '}
                      {adherence.previousRate}%
                      {' → Current 7 days '}
                      {adherence.recentRate}%
                    </p>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-7 gap-2">
                  {adherence.behavioral.dailyTrend.map(
                    (day) => (
                      <div
                        key={day.date}
                        className="text-center"
                      >
                        <div className="flex h-16 items-end rounded bg-gray-100 px-1 dark:bg-gray-800">
                          {day.adherenceRate == null ? (
                            <div className="mb-2 h-1 w-full rounded bg-gray-300" />
                          ) : (
                            <div
                              className={`w-full rounded-t ${
                                day.adherenceRate >= 80
                                  ? 'bg-green-500'
                                  : day.adherenceRate >= 50
                                    ? 'bg-amber-500'
                                    : 'bg-red-500'
                              }`}
                              style={{
                                height:
                                  `${Math.max(
                                    day.adherenceRate,
                                    6,
                                  )}%`,
                              }}
                            />
                          )}
                        </div>

                        <p className="mt-1 text-[10px] text-gray-500">
                          {day.label}
                        </p>

                        <p className="text-[10px] font-semibold">
                          {day.adherenceRate == null
                            ? '—'
                            : `${day.adherenceRate}%`}
                        </p>
                      </div>
                    ),
                  )}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {adherence.behavioral.timeOfDay.map(
                  (period) => (
                    <div
                      key={period.period}
                      className="rounded-xl border border-border/40 bg-background/60 p-3"
                    >
                      <div className="flex justify-between">
                        <b className="text-sm">
                          {period.period}
                        </b>

                        <b className="text-sm text-blue-600">
                          {period.eligible
                            ? `${period.adherenceRate}%`
                            : '—'}
                        </b>
                      </div>

                      <p className="mt-1 text-xs text-gray-500">
                        {period.eligible}
                        {' eligible · '}
                        {period.missed}
                        {' missed · '}
                        {period.late}
                        {' late'}
                      </p>
                    </div>
                  ),
                )}
              </div>

              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Detected Patterns
                </h3>

                <div className="mt-3 space-y-2">
                  {adherence.behavioral.insights.length === 0 ? (
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
                      No repeated negative behavior has been detected.
                    </div>
                  ) : (
                    adherence.behavioral.insights.map(
                      (item) => (
                        <div
                          key={item.id}
                          className={`rounded-xl border p-3 ${
                            item.tone === 'positive'
                              ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                              : item.tone === 'critical'
                                ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                                : 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'
                          }`}
                        >
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {item.title}
                          </p>

                          <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-300">
                            {item.detail}
                          </p>
                        </div>
                      ),
                    )
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-border/40 bg-background/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Risk reasons
                </p>

                <ul className="mt-2 space-y-1">
                  {adherence.riskReasons.map(
                    (reason) => (
                      <li
                        key={reason}
                        className="text-xs text-gray-600 dark:text-gray-300"
                      >
                        • {reason}
                      </li>
                    ),
                  )}
                </ul>
              </div>
            </>
          )}
        </section>

        <section className="space-y-4 rounded-[28px] border border-border/70 bg-card p-6 shadow-lg shadow-slate-900/5">
          <div className="flex items-center gap-2">
            <Pill className="h-5 w-5 text-purple-500" />

            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Recent Medication Logs
            </h2>

            <span className="ml-auto text-xs text-gray-400">
              Last 30 entries
            </span>
          </div>

          {recentLogs.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">
              No medication logs found
            </p>
          ) : (
            <div className="space-y-2">
              {recentLogs.map(
                (log, index) => {
                  const style =
                    LOG_STYLE[
                      log.lifecycle
                    ];

                  const auditLabel =
                    log.status ===
                      'incorrect_chamber'
                      ? 'Incorrect Chamber'
                      : log.status ===
                          'unverified'
                        ? 'Unverified'
                        : style.label;

                  return (
                    <div
                      key={`${log.scheduledDate}-${log.scheduledTime}-${index}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border/30 bg-white/60 px-3 py-2.5 dark:bg-gray-800/60"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`}
                        />

                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                            {log.medicineName}{' '}

                            {log.dosage && (
                              <span className="text-xs font-normal text-gray-400">
                                ({log.dosage})
                              </span>
                            )}
                          </p>

                          <p className="text-xs text-gray-500">
                            {log.scheduledDate}
                            {' · '}
                            {log.scheduledTime}
                          </p>

                          {(log.expectedChamberId ||
                            log.detectedChamberId) && (
                            <p className="text-[11px] text-gray-400">
                              Expected{' '}
                              {log.expectedChamberId ??
                                '—'}
                              {' · Detected '}
                              {log.detectedChamberId ??
                                '—'}
                              {' · '}
                              {log.source ??
                                'system'}
                            </p>
                          )}
                        </div>
                      </div>

                      <span
                        className={`shrink-0 text-xs font-semibold ${style.color}`}
                      >
                        {auditLabel}
                      </span>
                    </div>
                  );
                },
              )}
            </div>
          )}
        </section>

        <div className="pb-4 text-center text-xs text-gray-400">
          Auto-refreshes every 60 seconds · Read-only monitoring mode
        </div>
      </div>
    </div>
  );
}