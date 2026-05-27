'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Brain, Shield, TrendingUp, TrendingDown, Minus,
  AlertTriangle, CheckCircle, Eye, ArrowLeft,
  Activity, Clock, Pill, User,
} from 'lucide-react';

interface PatientInfo {
  patientId: string;
  name: string;
  condition: string;
  memberSince: string;
}

interface AdherenceInfo {
  riskLevel: 'Low' | 'Moderate' | 'High';
  ruleBasedRisk: 'Low' | 'Moderate' | 'High';
  mlRisk: 'Low' | 'Moderate' | 'High';
  mlConfidence: number;
  adherenceRate: number;
  totalScheduled: number;
  totalTaken: number;
  totalMissed: number;
  consecutiveMissed: number;
  delayedDoses: number;
  avgDelayMinutes: number;
  recentRate: number;
  weeklyTrend: 'improving' | 'declining' | 'stable';
  insight: string;
  recommendation: string;
}

interface LogEntry {
  medicineName: string;
  scheduledDate: string;
  scheduledTime: string;
  status: string;
  takenAt?: string | null;
  dosage?: string;
}

interface DashboardData {
  patient: PatientInfo;
  adherence: AdherenceInfo;
  recentLogs: LogEntry[];
  readOnly: boolean;
}

const RISK_CONFIG = {
  Low: {
    badge: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-300 dark:border-green-700',
    dot: 'bg-green-500',
    text: 'text-green-700 dark:text-green-400',
    bar: 'bg-green-500',
    icon: CheckCircle,
  },
  Moderate: {
    badge: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700',
    dot: 'bg-yellow-500',
    text: 'text-yellow-700 dark:text-yellow-400',
    bar: 'bg-yellow-500',
    icon: AlertTriangle,
  },
  High: {
    badge: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-700',
    dot: 'bg-red-500',
    text: 'text-red-700 dark:text-red-400',
    bar: 'bg-red-500',
    icon: AlertTriangle,
  },
};

const TREND_CONFIG = {
  improving: { icon: TrendingUp, color: 'text-green-600 dark:text-green-400', label: 'Improving' },
  declining: { icon: TrendingDown, color: 'text-red-600 dark:text-red-400', label: 'Declining' },
  stable: { icon: Minus, color: 'text-gray-500 dark:text-gray-400', label: 'Stable' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  taken: { label: 'Taken', color: 'text-green-700 dark:text-green-300', dot: 'bg-green-500' },
  missed: { label: 'Missed', color: 'text-red-700 dark:text-red-300', dot: 'bg-red-500' },
  pending: { label: 'Pending', color: 'text-yellow-700 dark:text-yellow-300', dot: 'bg-yellow-500' },
  skipped: { label: 'Skipped', color: 'text-gray-500', dot: 'bg-gray-400' },
};

export default function MonitorDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const patientID = params.patientID as string;

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchDashboard = useCallback(async () => {
    if (!patientID) return;
    try {
      const res = await fetch(`/api/patient/monitor/${patientID}/dashboard`);
      const json = await res.json();
      if (!json.success) {
        setError(json.error || 'Failed to load patient dashboard');
        return;
      }
      setData(json.data);
      setLastUpdated(new Date());
    } catch {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }, [patientID]);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 60_000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500">Loading patient dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto" />
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            {error || 'Patient not found'}
          </p>
          <button
            onClick={() => router.back()}
            className="text-sm text-blue-600 dark:text-blue-400 underline"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  const { patient, adherence, recentLogs } = data;
  const riskCfg = RISK_CONFIG[adherence.riskLevel];
  const RiskIcon = riskCfg.icon;
  const trendCfg = TREND_CONFIG[adherence.weeklyTrend];
  const TrendIcon = trendCfg.icon;

  const barColor =
    adherence.adherenceRate >= 80 ? 'bg-green-500' :
    adherence.adherenceRate >= 50 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Read-Only Banner */}
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <Eye className="w-4 h-4 text-blue-500 shrink-0" />
          <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
            Read-only monitoring mode — you cannot edit patient data
          </p>
          {lastUpdated && (
            <p className="ml-auto text-xs text-blue-400 shrink-0">
              Updated {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>

        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Profile
        </button>

        {/* Patient Info */}
        <div className="rounded-[28px] border border-border/70 bg-card p-6 shadow-lg shadow-slate-900/5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <User className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  {patient.name}
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {patient.condition} · ID: {patient.patientId}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  Member since {new Date(patient.memberSince).toLocaleDateString()}
                </p>
              </div>
            </div>
            <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${riskCfg.badge}`}>
              <RiskIcon className="w-3.5 h-3.5" />
              {adherence.riskLevel} Risk
            </span>
          </div>
        </div>

        {/* Adherence Overview */}
        <div className="rounded-[28px] border border-border/70 bg-card p-6 shadow-lg shadow-slate-900/5 space-y-5">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Adherence Analysis
            </h2>
          </div>

          {/* Bar */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Overall Adherence Rate
              </span>
              <span className={`text-2xl font-bold ${riskCfg.text}`}>
                {adherence.adherenceRate}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
              <div
                className={`h-3 rounded-full transition-all duration-500 ${barColor}`}
                style={{ width: `${Math.min(adherence.adherenceRate, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-1 text-xs text-gray-400">
              <span>0%</span>
              <span className="text-yellow-600 dark:text-yellow-400">50%</span>
              <span className="text-green-600 dark:text-green-400">80% Target</span>
              <span>100%</span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Taken', value: adherence.totalTaken, color: 'text-gray-900 dark:text-white' },
              { label: 'Missed', value: adherence.totalMissed, color: 'text-red-600 dark:text-red-400' },
              { label: 'Delayed', value: adherence.delayedDoses, color: 'text-yellow-600 dark:text-yellow-400' },
              { label: 'Recent 7d', value: null, color: trendCfg.color, isTrend: true },
            ].map((stat, i) => (
              <div key={i} className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-3 text-center border border-border/30">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{stat.label}</p>
                {stat.isTrend ? (
                  <div className="flex items-center justify-center gap-1">
                    <TrendIcon className={`w-3.5 h-3.5 ${trendCfg.color}`} />
                    <p className={`text-xl font-bold ${trendCfg.color}`}>{adherence.recentRate}%</p>
                  </div>
                ) : (
                  <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                )}
              </div>
            ))}
          </div>

          {/* Dual Classification */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border/50 bg-white/50 dark:bg-gray-800/50 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                  Rule-Based
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${RISK_CONFIG[adherence.ruleBasedRisk].dot}`} />
                <span className={`text-sm font-bold ${RISK_CONFIG[adherence.ruleBasedRisk].text}`}>
                  {adherence.ruleBasedRisk} Risk
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-border/50 bg-white/50 dark:bg-gray-800/50 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="w-4 h-4 text-purple-500" />
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                  ML Prediction
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${RISK_CONFIG[adherence.mlRisk].dot}`} />
                  <span className={`text-sm font-bold ${RISK_CONFIG[adherence.mlRisk].text}`}>
                    {adherence.mlRisk} Risk
                  </span>
                </div>
                <span className="text-xs text-gray-500">{adherence.mlConfidence}%</span>
              </div>
            </div>
          </div>

          {/* Additional Stats */}
          <div className="grid grid-cols-2 gap-3">
            {adherence.consecutiveMissed > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {adherence.consecutiveMissed} consecutive missed dose(s)
              </div>
            )}
            {adherence.avgDelayMinutes > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-xs text-yellow-700 dark:text-yellow-300">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                Avg delay: {adherence.avgDelayMinutes} min
              </div>
            )}
          </div>

          {/* Insight */}
          {adherence.insight && (
            <div className="bg-white/70 dark:bg-gray-800/70 rounded-xl p-4 border border-border/40">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                Clinical Insight
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                {adherence.insight}
              </p>
            </div>
          )}
        </div>

        {/* Recent Medication Logs */}
        <div className="rounded-[28px] border border-border/70 bg-card p-6 shadow-lg shadow-slate-900/5 space-y-4">
          <div className="flex items-center gap-2">
            <Pill className="w-5 h-5 text-purple-500" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Recent Medication Logs
            </h2>
            <span className="ml-auto text-xs text-gray-400">Last 30 entries</span>
          </div>

          {recentLogs.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
              No medication logs found
            </p>
          ) : (
            <div className="space-y-2">
              {recentLogs.map((log, i) => {
                const statusCfg = STATUS_CONFIG[log.status] || STATUS_CONFIG.pending;
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/60 dark:bg-gray-800/60 border border-border/30"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${statusCfg.dot}`} />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {log.medicineName}
                          {log.dosage ? (
                            <span className="text-xs text-gray-400 ml-1">({log.dosage})</span>
                          ) : null}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {log.scheduledDate} · {log.scheduledTime}
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs font-semibold ${statusCfg.color}`}>
                      {statusCfg.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Activity Summary */}
        <div className="rounded-[28px] border border-border/70 bg-card p-6 shadow-lg shadow-slate-900/5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-green-500" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Activity Summary
            </h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Scheduled', value: adherence.totalScheduled },
              { label: 'Completion Rate', value: `${adherence.adherenceRate}%` },
              { label: 'Weekly Trend', value: trendCfg.label },
            ].map((item, i) => (
              <div key={i} className="text-center p-3 bg-white/60 dark:bg-gray-800/60 rounded-xl border border-border/30">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{item.label}</p>
                <p className="text-base font-bold text-gray-900 dark:text-white">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 dark:text-gray-500 pb-4">
          Auto-refreshes every 60 seconds · Read-only monitoring mode
        </div>
      </div>
    </div>
  );
}