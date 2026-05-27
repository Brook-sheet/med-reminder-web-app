// components/dashboard/AdherenceCard.tsx
'use client';
import { useEffect, useState, useCallback } from 'react';
import {
  Brain, Shield, TrendingUp, TrendingDown, Minus,
  AlertTriangle, CheckCircle, Info, Clock, Bell,
} from 'lucide-react';

interface AdaptiveReminderConfig {
  leadTimeMinutes: number;
  followUpCount: number;
  followUpIntervalMinutes: number;
  intensity: string;
  messageTone: string;
  highSensitivityMode: boolean;
  escalationEnabled: boolean;
  escalationPriority: string;
  motivationalMessagingEnabled: boolean;
  behavioralLeadTimeBonus: number;
}

interface AdaptiveBehavioralPattern {
  avgIntakeDelayMinutes: number;
  delayProfile: string;
  hasClusteredMisses: boolean;
  delayTrend: string;
  currentMissStreak: number;
  maxHistoricalMissStreak: number;
  peakMissHour: number | null;
}

interface AdaptiveIntervention {
  behavioralPattern: AdaptiveBehavioralPattern;
  reminderConfig: AdaptiveReminderConfig;
  interventionSummary: string;
  isEscalation: boolean;
  drivingRiskLevel: string;
  interventionConfidence: number;
  keySignals: string[];
  interventionReason: string;
  clinicalActionSuggestion: string;
  motivationalMessage: string;
  escalationMessage: string | null;
}

interface AdherenceData {
  riskLevel: 'Low' | 'Moderate' | 'High';
  ruleBasedRisk: 'Low' | 'Moderate' | 'High';
  mlRisk: 'Low' | 'Moderate' | 'High';
  mlConfidence: number;
  adherenceRate: number;
  totalScheduled: number;
  totalTaken: number;
  totalMissed: number;
  totalPending: number;
  consecutiveMissed: number;
  delayedDoses: number;
  avgDelayMinutes: number;
  recentRate: number;
  weeklyTrend: 'improving' | 'declining' | 'stable';
  ruleReasons: string[];
  mlPrediction: string;
  featureImportance: Record<string, number>;
  aiInsight: string;
  adaptiveIntervention: AdaptiveIntervention;
}

const RISK_BADGE = {
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

const FEATURE_LABELS: Record<string, string> = {
  adherenceRate: 'Adherence Rate',
  missedDoses: 'Missed Doses',
  consecutiveMissed: 'Consecutive Missed',
  delayBehavior: 'Delay Behavior',
  recentTrend: 'Recent Trend',
  compositeRisk: 'Composite Risk',
};

function formatHour(h: number): string {
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:00 ${period}`;
}

export default function AdherenceCard() {
  const [data, setData] = useState<AdherenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [showAdaptive, setShowAdaptive] = useState(false);

  const fetchAdherence = useCallback(async () => {
    try {
      const res = await fetch('/api/adherence');
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) {
      console.error('Adherence fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdherence();
  }, [fetchAdherence]);

  if (loading) {
    return (
      <div className="rounded-[28px] border border-border/70 bg-card p-6 shadow-lg shadow-slate-900/5 animate-pulse">
        <div className="h-4 bg-muted rounded w-1/3 mb-4" />
        <div className="h-24 bg-muted/70 rounded mb-3" />
        <div className="h-16 bg-muted/50 rounded" />
      </div>
    );
  }

  if (!data) return null;

  const riskCfg = RISK_BADGE[data.riskLevel];
  const RiskIcon = riskCfg.icon;
  const trendCfg = TREND_CONFIG[data.weeklyTrend];
  const TrendIcon = trendCfg.icon;
  const mlMatch = data.ruleBasedRisk === data.mlRisk;

  const barColor =
    data.adherenceRate >= 80 ? 'bg-green-500'
    : data.adherenceRate >= 50 ? 'bg-yellow-500'
    : 'bg-red-500';

  const adaptive = data.adaptiveIntervention;
  const rc = adaptive?.reminderConfig;
  const bp = adaptive?.behavioralPattern;

  const intensityColor =
    rc?.intensity === 'aggressive' ? 'text-red-600 dark:text-red-400'
    : rc?.intensity === 'moderate' ? 'text-yellow-600 dark:text-yellow-400'
    : 'text-green-600 dark:text-green-400';

  return (
    <div className="rounded-[28px] border border-border/70 bg-card p-6 shadow-lg shadow-slate-900/5 space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Predictive Adherence Analysis
          </h2>
        </div>
        <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${riskCfg.badge}`}>
          <RiskIcon className="w-3.5 h-3.5" />
          {data.riskLevel} Risk
        </span>
      </div>

      {/* ── Escalation Banner ── */}
      {adaptive?.isEscalation && adaptive?.escalationMessage && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700">
          <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-red-700 dark:text-red-300 uppercase tracking-wide mb-1">
              Risk Escalation Detected
            </p>
            <p className="text-xs text-red-600 dark:text-red-400 leading-relaxed">
              {adaptive.escalationMessage}
            </p>
          </div>
        </div>
      )}

      {/* ── Motivational Message ── */}
      {adaptive?.motivationalMessage && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
            {adaptive.motivationalMessage}
          </p>
        </div>
      )}

      {/* ── Adherence Rate Bar ── */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Overall Weighted Adherence
          </span>
          <span className={`text-2xl font-bold ${riskCfg.text}`}>
            {data.adherenceRate}%
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${Math.min(data.adherenceRate, 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-xs text-gray-400 dark:text-gray-500">
          <span>0%</span>
          <span className="text-yellow-600 dark:text-yellow-400">50% (Moderate)</span>
          <span className="text-green-600 dark:text-green-400">80% (Good)</span>
          <span>100%</span>
        </div>
      </div>

      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Taken', value: data.totalTaken, color: 'text-gray-900 dark:text-white' },
          { label: 'Missed', value: data.totalMissed, color: 'text-red-600 dark:text-red-400' },
          { label: 'Delayed', value: data.delayedDoses, color: 'text-yellow-600 dark:text-yellow-400' },
          { label: 'Recent 7d', value: null, color: trendCfg.color, isTrend: true },
        ].map((stat, i) => (
          <div key={i} className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-3 text-center border border-border/30">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{stat.label}</p>
            {stat.isTrend ? (
              <div className="flex items-center justify-center gap-1">
                <TrendIcon className={`w-3.5 h-3.5 ${trendCfg.color}`} />
                <p className={`text-xl font-bold ${trendCfg.color}`}>{data.recentRate}%</p>
              </div>
            ) : (
              <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
            )}
          </div>
        ))}
      </div>

      {/* ── Adaptive Intervention Config ── */}
      {rc && (
        <div className="rounded-xl border border-border/50 bg-white/50 dark:bg-gray-800/50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-indigo-500" />
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                Adaptive Reminder Config
              </span>
              <span className={`text-xs font-bold uppercase tracking-wide ${intensityColor}`}>
                · {rc.intensity}
              </span>
            </div>
            <button
              onClick={() => setShowAdaptive(!showAdaptive)}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {showAdaptive ? '▲ Hide' : '▼ Show'}
            </button>
          </div>

          {/* Always visible summary */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-2 border border-indigo-100 dark:border-indigo-800">
              <Clock className="w-3.5 h-3.5 text-indigo-500 mx-auto mb-1" />
              <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold">
                {rc.leadTimeMinutes} min
              </p>
              <p className="text-[10px] text-indigo-500 dark:text-indigo-500">Lead Time</p>
              {rc.behavioralLeadTimeBonus > 0 && (
                <p className="text-[10px] text-indigo-400">(+{rc.behavioralLeadTimeBonus} bonus)</p>
              )}
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-2 border border-orange-100 dark:border-orange-800">
              <Bell className="w-3.5 h-3.5 text-orange-500 mx-auto mb-1" />
              <p className="text-xs text-orange-600 dark:text-orange-400 font-bold">
                {rc.followUpCount}×
              </p>
              <p className="text-[10px] text-orange-500">Follow-ups</p>
              <p className="text-[10px] text-orange-400">every {rc.followUpIntervalMinutes}m</p>
            </div>
            <div className={`rounded-lg p-2 border ${
              rc.escalationEnabled
                ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800'
                : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
            }`}>
              <AlertTriangle className={`w-3.5 h-3.5 mx-auto mb-1 ${
                rc.escalationEnabled ? 'text-red-500' : 'text-gray-400'
              }`} />
              <p className={`text-xs font-bold ${
                rc.escalationEnabled ? 'text-red-600 dark:text-red-400' : 'text-gray-500'
              }`}>
                {rc.escalationEnabled ? rc.escalationPriority : 'None'}
              </p>
              <p className={`text-[10px] ${
                rc.escalationEnabled ? 'text-red-500' : 'text-gray-400'
              }`}>
                Escalation
              </p>
            </div>
          </div>

          {/* Expanded details */}
          {showAdaptive && bp && (
            <div className="space-y-2 pt-2 border-t border-border/30">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Behavioral Pattern
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Delay Profile</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200 capitalize">
                    {bp.delayProfile.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Avg Delay</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    {bp.avgIntakeDelayMinutes} min
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Miss Streak</span>
                  <span className={`font-semibold ${bp.currentMissStreak > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                    {bp.currentMissStreak}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Delay Trend</span>
                  <span className={`font-semibold capitalize ${
                    bp.delayTrend === 'improving' ? 'text-green-600 dark:text-green-400'
                    : bp.delayTrend === 'worsening' ? 'text-red-600 dark:text-red-400'
                    : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    {bp.delayTrend}
                  </span>
                </div>
                {bp.peakMissHour !== null && (
                  <div className="flex justify-between col-span-2">
                    <span className="text-gray-500">Peak Miss Hour</span>
                    <span className="font-semibold text-orange-600 dark:text-orange-400">
                      {formatHour(bp.peakMissHour)} (proactive nudge sent 1hr before)
                    </span>
                  </div>
                )}
                {bp.hasClusteredMisses && (
                  <div className="col-span-2 text-orange-600 dark:text-orange-400 text-xs">
                    ⚠ Clustered missed doses detected at specific scheduled times.
                  </div>
                )}
              </div>

              {adaptive.keySignals.length > 0 && (
                <div className="pt-2">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                    Key Signals
                  </p>
                  <ul className="space-y-1">
                    {adaptive.keySignals.map((s, i) => (
                      <li key={i} className="text-xs text-gray-600 dark:text-gray-400">
                        • {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {adaptive.clinicalActionSuggestion && (
                <div className="pt-2 border-t border-border/30">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                    Clinical Suggestion
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                    {adaptive.clinicalActionSuggestion}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Dual Classification ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-xl border border-border/50 bg-white/50 dark:bg-gray-800/50 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              Rule-Based (≥80% Benchmark)
            </span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`w-2 h-2 rounded-full ${RISK_BADGE[data.ruleBasedRisk].dot}`} />
            <span className={`text-sm font-bold ${RISK_BADGE[data.ruleBasedRisk].text}`}>
              {data.ruleBasedRisk} Risk
            </span>
          </div>
          {data.ruleReasons.slice(0, 2).map((reason, i) => (
            <p key={i} className="text-xs text-gray-500 dark:text-gray-400 leading-snug">
              • {reason}
            </p>
          ))}
        </div>

        <div className="rounded-xl border border-border/50 bg-white/50 dark:bg-gray-800/50 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="w-4 h-4 text-purple-500" />
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              Random Forest ML
            </span>
          </div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${RISK_BADGE[data.mlRisk].dot}`} />
              <span className={`text-sm font-bold ${RISK_BADGE[data.mlRisk].text}`}>
                {data.mlRisk} Risk
              </span>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {data.mlConfidence}% confidence
            </span>
          </div>
          <div className="space-y-1">
            {Object.entries(data.featureImportance)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3)
              .map(([key, val]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 w-24 truncate">
                    {FEATURE_LABELS[key] || key}
                  </span>
                  <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-purple-500"
                      style={{ width: `${Math.round(val * 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 w-8 text-right">
                    {Math.round(val * 100)}%
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* ── Agreement indicator ── */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
        mlMatch
          ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
          : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
      }`}>
        <Info className="w-3.5 h-3.5 shrink-0" />
        {mlMatch
          ? `Both rule-based and ML models agree: ${data.riskLevel} Risk. High classification confidence.`
          : `Models differ: Rule-Based (${data.ruleBasedRisk}) vs ML (${data.mlRisk}). Conservative ${data.riskLevel} Risk applied.`
        }
      </div>

      {/* ── AI Insight ── */}
      {data.aiInsight && (
        <div className="bg-white/70 dark:bg-gray-800/70 rounded-xl p-4 border border-border/40">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
            AI Clinical Insight
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            {data.aiInsight}
          </p>
        </div>
      )}

      {/* ── Toggle ML details ── */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
      >
        {showDetails ? '▲ Hide ML details' : '▼ Show ML prediction details'}
      </button>

      {showDetails && (
        <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-border/30">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono leading-relaxed">
            {data.mlPrediction}
          </p>
          {data.consecutiveMissed > 0 && (
            <p className="text-xs text-orange-600 dark:text-orange-400 mt-1.5">
              ⚠ {data.consecutiveMissed} consecutive missed dose(s) detected
            </p>
          )}
          {data.avgDelayMinutes > 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Average delay: {data.avgDelayMinutes} min across {data.delayedDoses} delayed dose(s)
            </p>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Recent 7-day trend: {TREND_CONFIG[data.weeklyTrend].label} ({data.recentRate}%)
          </p>
        </div>
      )}
    </div>
  );
}