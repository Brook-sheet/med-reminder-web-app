'use client';

import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Info,
  Minus,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useAdherence, type BehavioralInsight } from '@/hooks/useAdherence';

const RISK_STYLE = {
  Low: {
    badge: 'border-green-300 bg-green-100 text-green-800 dark:border-green-700 dark:bg-green-900/30 dark:text-green-300',
    text: 'text-green-700 dark:text-green-400',
    bar: 'bg-green-500',
    Icon: CheckCircle,
  },
  Moderate: {
    badge: 'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    text: 'text-amber-700 dark:text-amber-400',
    bar: 'bg-amber-500',
    Icon: AlertTriangle,
  },
  High: {
    badge: 'border-red-300 bg-red-100 text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300',
    text: 'text-red-700 dark:text-red-400',
    bar: 'bg-red-500',
    Icon: AlertTriangle,
  },
} as const;

const TREND_STYLE = {
  improving: { label: 'Improving', color: 'text-green-600 dark:text-green-400', Icon: TrendingUp },
  stable: { label: 'Stable', color: 'text-gray-500 dark:text-gray-400', Icon: Minus },
  declining: { label: 'Declining', color: 'text-red-600 dark:text-red-400', Icon: TrendingDown },
} as const;

function InsightRow({ insight }: { insight: BehavioralInsight }) {
  const style = insight.tone === 'positive'
    ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
    : insight.tone === 'critical'
      ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
      : 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20';
  const Icon = insight.tone === 'positive' ? CheckCircle : AlertTriangle;
  const iconColor = insight.tone === 'positive'
    ? 'text-green-600'
    : insight.tone === 'critical'
      ? 'text-red-600'
      : 'text-amber-600';

  return (
    <div className={`flex items-start gap-3 rounded-xl border p-3 ${style}`}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconColor}`} />
      <div>
        <p className="text-sm font-semibold text-gray-900 dark:text-white">{insight.title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-gray-600 dark:text-gray-300">{insight.detail}</p>
      </div>
    </div>
  );
}

export default function AdherenceCard() {
  const { data, loading, error } = useAdherence({
    autoRefetch: true,
    refetchIntervalMs: 60_000,
    initialLoad: true,
  });

  if (loading) {
    return (
      <div className="animate-pulse rounded-[28px] border border-border/70 bg-card p-6 shadow-lg shadow-slate-900/5">
        <div className="mb-4 h-5 w-1/3 rounded bg-muted" />
        <div className="mb-3 h-24 rounded-xl bg-muted/70" />
        <div className="h-20 rounded-xl bg-muted/50" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[28px] border border-red-200 bg-red-50 p-6 shadow-lg shadow-slate-900/5 dark:border-red-800 dark:bg-red-900/20">
        <p className="text-sm text-red-700 dark:text-red-300">Failed to load adherence data: {error}</p>
      </div>
    );
  }

  if (!data) return null;

  if (!data.hasSufficientData) {
    return (
      <section className="rounded-[28px] border border-border/70 bg-card p-6 shadow-lg shadow-slate-900/5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Adherence Analysis</h2>
        </div>
        <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-center dark:border-blue-800 dark:bg-blue-900/20">
          <Info className="mx-auto h-7 w-7 text-blue-500" />
          <p className="mt-2 text-lg font-bold text-gray-900 dark:text-white">Insufficient Data</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-600 dark:text-gray-300">
            More completed medication activity is needed before behavioral patterns can be identified.
          </p>
          {(data.totalPending > 0 || data.totalUpcoming > 0) && (
            <p className="mt-3 text-xs text-blue-700 dark:text-blue-300">
              {data.totalPending} due within an active window · {data.totalUpcoming} upcoming
            </p>
          )}
        </div>
      </section>
    );
  }

  const risk = RISK_STYLE[data.riskLevel];
  const RiskIcon = risk.Icon;
  const trend = TREND_STYLE[data.weeklyTrend];
  const TrendIcon = trend.Icon;

  return (
    <section className="space-y-5 rounded-[28px] border border-border/70 bg-card p-6 shadow-lg shadow-slate-900/5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Adherence Analysis</h2>
        </div>
        <span className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${risk.badge}`}>
          <RiskIcon className="h-3.5 w-3.5" />
          {data.riskLevel} Behavioral Risk
        </span>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Eligible-dose adherence</span>
          <span className={`text-2xl font-bold ${risk.text}`}>{data.adherenceRate}%</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div className={`h-3 rounded-full transition-all duration-500 ${risk.bar}`} style={{ width: `${Math.min(data.adherenceRate, 100)}%` }} />
        </div>
        <p className="mt-1 text-xs text-gray-400">
          Upcoming and active-window pending doses are excluded from this calculation.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          { label: 'Eligible', value: data.totalEligible, color: 'text-gray-900 dark:text-white' },
          { label: 'Taken', value: data.totalTaken, color: 'text-green-600 dark:text-green-400' },
          { label: 'Missed', value: data.totalMissed, color: 'text-red-600 dark:text-red-400' },
          { label: 'Delayed', value: data.delayedDoses, color: 'text-amber-600 dark:text-amber-400' },
          { label: 'Upcoming', value: data.totalUpcoming, color: 'text-blue-600 dark:text-blue-400' },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-border/30 bg-white/60 p-3 text-center dark:bg-gray-800/60">
            <p className="text-xs text-gray-500 dark:text-gray-400">{item.label}</p>
            <p className={`mt-1 text-xl font-bold ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border/50 bg-white/50 p-4 dark:bg-gray-800/50">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Behavioral trend</p>
            <div className={`mt-1 flex items-center gap-1.5 text-sm font-bold ${trend.color}`}>
              <TrendIcon className="h-4 w-4" />
              {data.trendAvailable ? trend.label : 'Insufficient historical data'}
            </div>
          </div>
          {data.trendAvailable && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Previous 7 days {data.previousRate}% → Current 7 days {data.recentRate}%
            </p>
          )}
        </div>

        <div className="mt-4 grid grid-cols-7 gap-2">
          {data.behavioral.dailyTrend.map((day) => (
            <div key={day.date} className="text-center">
              <div className="flex h-20 items-end justify-center rounded-lg bg-gray-100 px-1 dark:bg-gray-800">
                {day.adherenceRate == null ? (
                  <div className="mb-2 h-1 w-full rounded bg-gray-300 dark:bg-gray-600" />
                ) : (
                  <div
                    className={`w-full rounded-t ${day.adherenceRate >= 80 ? 'bg-green-500' : day.adherenceRate >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ height: `${Math.max(day.adherenceRate, 6)}%` }}
                    title={`${day.adherenceRate}%`}
                  />
                )}
              </div>
              <p className="mt-1 text-[10px] text-gray-500">{day.label}</p>
              <p className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">{day.adherenceRate == null ? '—' : `${day.adherenceRate}%`}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">Behavioral Insights</h3>
        <div className="mt-3 space-y-2">
          {data.behavioral.insights.length > 0 ? (
            data.behavioral.insights.map((item) => <InsightRow key={item.id} insight={item} />)
          ) : (
            <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              <p className="text-sm text-blue-700 dark:text-blue-300">No repeated negative behavior has been detected yet.</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {data.behavioral.timeOfDay.map((period) => (
          <div key={period.period} className="rounded-xl border border-border/40 bg-background/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{period.period}</p>
              <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{period.eligible > 0 ? `${period.adherenceRate}%` : '—'}</p>
            </div>
            <p className="mt-1 text-xs text-gray-500">{period.eligible} eligible · {period.missed} missed · {period.late} late</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border/40 bg-background/60 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Why this risk level</p>
        <ul className="mt-2 space-y-1">
          {data.riskReasons.map((reason) => (
            <li key={reason} className="text-xs text-gray-600 dark:text-gray-300">• {reason}</li>
          ))}
        </ul>
        {data.avgDelayMinutes > 0 && (
          <p className="mt-2 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
            <Clock className="h-3.5 w-3.5" /> Average delay: {data.avgDelayMinutes} minutes
          </p>
        )}
      </div>
    </section>
  );
}