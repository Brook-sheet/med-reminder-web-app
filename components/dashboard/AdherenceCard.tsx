// components/dashboard/AdherenceCard.tsx
'use client';
import { useEffect, useState, useCallback } from 'react';
import { Brain, Shield, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, Info } from 'lucide-react';

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

export default function AdherenceCard() {
  const [data, setData] = useState<AdherenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

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

  useEffect(() => {
    if (!data) return;
    if (data.riskLevel === 'High' || data.riskLevel === 'Moderate') {
      sendRiskNotification(data.riskLevel, data.adherenceRate);
    }
  }, [data]);

  async function sendRiskNotification(risk: string, rate: number) {
    try {
      await fetch('/api/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-key': process.env.NEXT_PUBLIC_INTERNAL_API_KEY || '',
        },
        body: JSON.stringify({
          title: `Medication Adherence Alert — ${risk} Risk`,
          body: `Current adherence rate is ${rate}%. Please check your medication schedule.`,
          riskLevel: risk,
        }),
      });
    } catch {}
  }

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

  // Adherence bar color
  const barColor = data.adherenceRate >= 80
    ? 'bg-green-500'
    : data.adherenceRate >= 50
    ? 'bg-yellow-500'
    : 'bg-red-500';

  return (
    <div className="rounded-[28px] border border-border/70 bg-card p-6 shadow-lg shadow-slate-900/5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5">
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

      {/* ── Adherence Rate Bar ── */}
      <div className="mb-5">
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-3 text-center border border-border/30">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Taken</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{data.totalTaken}</p>
        </div>
        <div className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-3 text-center border border-border/30">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Missed</p>
          <p className="text-xl font-bold text-red-600 dark:text-red-400">{data.totalMissed}</p>
        </div>
        <div className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-3 text-center border border-border/30">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Delayed</p>
          <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400">{data.delayedDoses}</p>
        </div>
        <div className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-3 text-center border border-border/30">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Recent 7d</p>
          <div className="flex items-center justify-center gap-1">
            <TrendIcon className={`w-3.5 h-3.5 ${trendCfg.color}`} />
            <p className={`text-xl font-bold ${trendCfg.color}`}>{data.recentRate}%</p>
          </div>
        </div>
      </div>

      {/* ── Dual Classification: Rule-Based + ML ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
        {/* Rule-Based */}
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

        {/* Random Forest ML */}
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
          {/* Feature importance mini-bars */}
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

      {/* ── Agreement / Disagreement indicator ── */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-4 text-xs
        ${mlMatch
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

      {/* ── Toggle details ── */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="mt-3 w-full text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
      >
        {showDetails ? '▲ Hide details' : '▼ Show ML prediction details'}
      </button>

      {showDetails && (
        <div className="mt-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-border/30">
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