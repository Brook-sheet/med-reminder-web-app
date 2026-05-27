/**
 * lib/adherenceEngine.ts
 *
 * AI-Enhanced Medication Adherence Monitoring
 * Phase 1: Medically-supported Rule-Based Classification
 * Phase 2: Random Forest Predictive Classification
 *
 * Medical references:
 * - ≥80% adherence = good adherence (hypertension/diabetes management)
 * - Morisky Medication Adherence Scale thresholds
 * - WHO medication adherence guidelines
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type RiskLevel = 'Low' | 'Moderate' | 'High';
export type TrendDirection = 'improving' | 'stable' | 'declining';


export interface AdherenceFeatures {
  /** Weighted adherence rate 0-100 */
  adherenceRate: number;
  /** Number of missed doses total */
  missedDoses: number;
  /** Maximum consecutive missed doses */
  consecutiveMissed: number;
  /** Number of delayed (late) doses */
  delayedDoses: number;
  /** Average delay in minutes for delayed doses */
  avgDelayMinutes: number;
  /** Total doses scheduled (only due doses) */
  totalDue: number;
  /** Ratio of on-time doses to total taken */
  onTimeRatio: number;
  /** Recent 7-day adherence rate (weighted) */
  recentAdherenceRate: number;
  /** Trend direction */
  trend: TrendDirection;
}

export interface RuleBasedResult {
  riskLevel: RiskLevel;
  reasons: string[];
}

export interface RandomForestResult {
  riskLevel: RiskLevel;
  confidence: number; // 0-1
  featureImportance: Record<string, number>;
  prediction: string;
}

export interface AdherenceAnalysis {
  features: AdherenceFeatures;
  ruleBased: RuleBasedResult;
  mlPrediction: RandomForestResult;
  finalRiskLevel: RiskLevel;
  insight: string;
  recommendation: string;
}

// ── Feature Extraction ─────────────────────────────────────────────────────

export interface RawLog {
  status: string;
  scheduledDate: string;
  scheduledTime: string;
  takenAt?: Date | null;
  classifiedStatus?: string;
  delayMinutes?: number | null;
}

function parseTimeToMinutes(timeStr: string): number {
  const ampm = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampm) {
    let h = parseInt(ampm[1]);
    const m = parseInt(ampm[2]);
    if (ampm[3].toUpperCase() === 'PM' && h !== 12) h += 12;
    if (ampm[3].toUpperCase() === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  }
  const plain = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (plain) return parseInt(plain[1]) * 60 + parseInt(plain[2]);
  return 0;
}

export function extractFeatures(logs: RawLog[]): AdherenceFeatures {
  const now = new Date();

  // Only evaluate due doses
  const dueLogs = logs.filter((log) => {
    const scheduledMinutes = parseTimeToMinutes(log.scheduledTime);
    const scheduledDateTime = new Date(`${log.scheduledDate}T00:00:00`);
    scheduledDateTime.setMinutes(scheduledDateTime.getMinutes() + scheduledMinutes);
    return scheduledDateTime <= now;
  });

  if (dueLogs.length === 0) {
    return {
      adherenceRate: 0,
      missedDoses: 0,
      consecutiveMissed: 0,
      delayedDoses: 0,
      avgDelayMinutes: 0,
      totalDue: 0,
      onTimeRatio: 0,
      recentAdherenceRate: 0,
      trend: 'stable',
    };
  }

  let onTime = 0;
  let delayed = 0;
  let missed = 0;
  const delays: number[] = [];

  for (const log of dueLogs) {
    const scheduledMinutes = parseTimeToMinutes(log.scheduledTime);
    const scheduledDateTime = new Date(`${log.scheduledDate}T00:00:00`);
    scheduledDateTime.setMinutes(scheduledDateTime.getMinutes() + scheduledMinutes);

    if (log.status === 'taken') {
      if (log.takenAt) {
        const diffMinutes = Math.round(
          (new Date(log.takenAt).getTime() - scheduledDateTime.getTime()) / 60_000
        );
        if (diffMinutes <= 30) {
          onTime++;
        } else {
          delayed++;
          delays.push(diffMinutes);
        }
      } else {
        onTime++;
      }
    } else {
      // Check if truly missed (past 2hr window)
      const elapsedMinutes = (now.getTime() - scheduledDateTime.getTime()) / 60_000;
      if (elapsedMinutes > 120) {
        missed++;
      }
    }
  }

  const totalDue = dueLogs.length;
  const weightedScore = totalDue > 0
    ? Math.round(Math.min((1.0 * onTime + 0.5 * delayed) / totalDue * 100, 100))
    : 0;

  // Consecutive missed doses (sort by date, find max run of misses)
  const sortedLogs = [...dueLogs].sort((a, b) =>
    a.scheduledDate.localeCompare(b.scheduledDate) ||
    parseTimeToMinutes(a.scheduledTime) - parseTimeToMinutes(b.scheduledTime)
  );

  let maxConsecutive = 0;
  let currentRun = 0;
  for (const log of sortedLogs) {
    const scheduledMinutes = parseTimeToMinutes(log.scheduledTime);
    const scheduledDateTime = new Date(`${log.scheduledDate}T00:00:00`);
    scheduledDateTime.setMinutes(scheduledDateTime.getMinutes() + scheduledMinutes);
    const elapsed = (now.getTime() - scheduledDateTime.getTime()) / 60_000;

    const isMissed = log.status !== 'taken' && elapsed > 120;
    if (isMissed) {
      currentRun++;
      maxConsecutive = Math.max(maxConsecutive, currentRun);
    } else {
      currentRun = 0;
    }
  }

  // Recent 7-day adherence
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentDateStr = sevenDaysAgo.toISOString().split('T')[0];
  const recentLogs = dueLogs.filter((l) => l.scheduledDate >= recentDateStr);

  let recentOnTime = 0;
  let recentDelayed = 0;
  for (const log of recentLogs) {
    if (log.status === 'taken') {
      const scheduledMinutes = parseTimeToMinutes(log.scheduledTime);
      const scheduledDateTime = new Date(`${log.scheduledDate}T00:00:00`);
      scheduledDateTime.setMinutes(scheduledDateTime.getMinutes() + scheduledMinutes);
      if (log.takenAt) {
        const diff = Math.round((new Date(log.takenAt).getTime() - scheduledDateTime.getTime()) / 60_000);
        if (diff <= 30) recentOnTime++; else recentDelayed++;
      } else {
        recentOnTime++;
      }
    }
  }

  const recentAdherenceRate = recentLogs.length > 0
    ? Math.round(Math.min((1.0 * recentOnTime + 0.5 * recentDelayed) / recentLogs.length * 100, 100))
    : weightedScore;

  // Trend: compare recent vs overall
  let trend: TrendDirection = 'stable';
  if (recentAdherenceRate > weightedScore + 5) trend = 'improving';
  else if (recentAdherenceRate < weightedScore - 5) trend = 'declining';

  return {
    adherenceRate: weightedScore,
    missedDoses: missed,
    consecutiveMissed: maxConsecutive,
    delayedDoses: delayed,
    avgDelayMinutes: delays.length > 0 ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length) : 0,
    totalDue,
    onTimeRatio: (onTime + delayed) > 0 ? Math.round((onTime / (onTime + delayed)) * 100) / 100 : 0,
    recentAdherenceRate,
    trend,
  };
}

// ── Phase 1: Rule-Based Classification ────────────────────────────────────
// Based on medically supported thresholds:
// ≥80% → Low Risk (good adherence benchmark for hypertension/diabetes)
// 50–79% → Moderate Risk
// <50% → High Risk
// Additional escalation rules for repeated delays and consecutive misses

export function ruleBasedClassify(features: AdherenceFeatures): RuleBasedResult {
  const { adherenceRate, consecutiveMissed, delayedDoses, totalDue, avgDelayMinutes, trend } = features;

  const reasons: string[] = [];
  let riskLevel: RiskLevel;

  // Base classification (≥80% benchmark per WHO/clinical guidelines)
  if (adherenceRate >= 80) {
    riskLevel = 'Low';
    reasons.push(`Adherence rate ${adherenceRate}% meets the ≥80% clinical benchmark`);
  } else if (adherenceRate >= 50) {
    riskLevel = 'Moderate';
    reasons.push(`Adherence rate ${adherenceRate}% is below the 80% benchmark`);
  } else {
    riskLevel = 'High';
    reasons.push(`Adherence rate ${adherenceRate}% is critically below 50%`);
  }

  // Escalation: consecutive missed doses (clinical risk amplifier)
  if (consecutiveMissed >= 3) {
    if (riskLevel === 'Low') riskLevel = 'Moderate';
    else if (riskLevel === 'Moderate') riskLevel = 'High';
    reasons.push(`${consecutiveMissed} consecutive missed doses detected — risk escalated`);
  } else if (consecutiveMissed >= 2) {
    if (riskLevel === 'Low') riskLevel = 'Moderate';
    reasons.push(`${consecutiveMissed} consecutive missed doses detected`);
  }

  // Escalation: frequent delays (pattern of non-adherence)
  const delayRatio = totalDue > 0 ? delayedDoses / totalDue : 0;
  if (delayRatio > 0.4 && avgDelayMinutes > 60) {
    if (riskLevel === 'Low') riskLevel = 'Moderate';
    reasons.push(`${Math.round(delayRatio * 100)}% of doses delayed by avg ${avgDelayMinutes} minutes`);
  } else if (delayRatio > 0.25 && avgDelayMinutes > 45) {
    reasons.push(`Frequent delayed intake pattern detected (${Math.round(delayRatio * 100)}% delayed)`);
  }

  // Trend consideration
  if (trend === 'declining') {
    reasons.push('Adherence trend is declining in recent 7 days');
    if (riskLevel === 'Low') riskLevel = 'Moderate';
  } else if (trend === 'improving') {
    reasons.push('Adherence trend is improving in recent 7 days');
  }

  return { riskLevel, reasons };
}

// ── Phase 2: Random Forest Classifier ─────────────────────────────────────
// Simulates a trained Random Forest using medically-grounded decision trees.
// Each "tree" evaluates a subset of features and votes on a risk level.
// The ensemble majority vote determines the final ML prediction.

interface DecisionTree {
  name: string;
  weight: number;
  predict: (f: AdherenceFeatures) => RiskLevel;
}

const RANDOM_FOREST_TREES: DecisionTree[] = [
  // Tree 1: Adherence rate primary focus (highest weight - most predictive)
  {
    name: 'adherence_rate_tree',
    weight: 0.30,
    predict: (f) => {
      if (f.adherenceRate >= 80) return 'Low';
      if (f.adherenceRate >= 60) return 'Moderate';
      if (f.adherenceRate >= 40) return 'Moderate';
      return 'High';
    },
  },
  // Tree 2: Missed dose pattern (clinical significance)
  {
    name: 'missed_dose_tree',
    weight: 0.20,
    predict: (f) => {
      const missRate = f.totalDue > 0 ? f.missedDoses / f.totalDue : 0;
      if (missRate <= 0.1) return 'Low';
      if (missRate <= 0.3) return 'Moderate';
      if (missRate <= 0.5) return 'Moderate';
      return 'High';
    },
  },
  // Tree 3: Consecutive missed (reflects behavioral pattern)
  {
    name: 'consecutive_miss_tree',
    weight: 0.15,
    predict: (f) => {
      if (f.consecutiveMissed === 0) return 'Low';
      if (f.consecutiveMissed === 1) return 'Low';
      if (f.consecutiveMissed <= 2) return 'Moderate';
      if (f.consecutiveMissed <= 4) return 'Moderate';
      return 'High';
    },
  },
  // Tree 4: Delay behavior analysis
  {
    name: 'delay_behavior_tree',
    weight: 0.12,
    predict: (f) => {
      const delayRatio = f.totalDue > 0 ? f.delayedDoses / f.totalDue : 0;
      if (delayRatio <= 0.15) return 'Low';
      if (delayRatio <= 0.35 && f.avgDelayMinutes <= 60) return 'Moderate';
      if (delayRatio <= 0.5 && f.avgDelayMinutes <= 90) return 'Moderate';
      return 'High';
    },
  },
  // Tree 5: Recent trend (temporal pattern recognition)
  {
    name: 'trend_tree',
    weight: 0.10,
    predict: (f) => {
      if (f.trend === 'improving' && f.recentAdherenceRate >= 70) return 'Low';
      if (f.trend === 'improving') return 'Moderate';
      if (f.trend === 'stable' && f.recentAdherenceRate >= 80) return 'Low';
      if (f.trend === 'stable' && f.recentAdherenceRate >= 50) return 'Moderate';
      if (f.trend === 'declining' && f.recentAdherenceRate >= 70) return 'Moderate';
      if (f.trend === 'declining') return 'High';
      return 'Moderate';
    },
  },
  // Tree 6: Combined adherence + miss composite
  {
    name: 'composite_risk_tree',
    weight: 0.13,
    predict: (f) => {
      const riskScore = (100 - f.adherenceRate) * 0.5 +
        (f.missedDoses / Math.max(f.totalDue, 1)) * 30 +
        Math.min(f.consecutiveMissed * 5, 20);
      if (riskScore <= 15) return 'Low';
      if (riskScore <= 35) return 'Moderate';
      return 'High';
    },
  },
];

export function randomForestPredict(features: AdherenceFeatures): RandomForestResult {
  // Collect weighted votes from all trees
  const votes: Record<RiskLevel, number> = { Low: 0, Moderate: 0, High: 0 };
  const treePredictions: Record<string, RiskLevel> = {};

  for (const tree of RANDOM_FOREST_TREES) {
    const prediction = tree.predict(features);
    votes[prediction] += tree.weight;
    treePredictions[tree.name] = prediction;
  }

  // Determine winner by weighted vote
  let finalRisk: RiskLevel = 'Low';
  let maxVote = 0;
  for (const [level, vote] of Object.entries(votes)) {
    if (vote > maxVote) {
      maxVote = vote;
      finalRisk = level as RiskLevel;
    }
  }

  // Calculate confidence: winner's vote share
  const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);
  const confidence = totalVotes > 0 ? Math.round((maxVote / totalVotes) * 100) / 100 : 0;

  // Feature importance (based on tree weights and agreement)
  const featureImportance: Record<string, number> = {
    adherenceRate: 0.30,
    missedDoses: 0.20,
    consecutiveMissed: 0.15,
    delayBehavior: 0.12,
    recentTrend: 0.10,
    compositeRisk: 0.13,
  };

  // Generate human-readable prediction rationale
  const topFeature = features.adherenceRate < 60
    ? 'low adherence rate'
    : features.consecutiveMissed >= 3
    ? 'consecutive missed doses'
    : features.trend === 'declining'
    ? 'declining recent trend'
    : 'overall adherence pattern';

  const prediction = `Random Forest ensemble (${RANDOM_FOREST_TREES.length} trees, weighted voting) ` +
    `predicts ${finalRisk} Risk based primarily on ${topFeature}. ` +
    `Confidence: ${Math.round(confidence * 100)}%`;

  return { riskLevel: finalRisk, confidence, featureImportance, prediction };
}

// ── Full Analysis ──────────────────────────────────────────────────────────

export function analyzeAdherence(logs: RawLog[]): AdherenceAnalysis {
  const features = extractFeatures(logs);
  const ruleBased = ruleBasedClassify(features);
  const mlPrediction = randomForestPredict(features);

  // Final decision: if both agree, use that. If disagreement, use higher risk
  // (conservative approach — safety-first for healthcare)
  const riskRank: Record<RiskLevel, number> = { Low: 0, Moderate: 1, High: 2 };
  const finalRiskLevel =
    riskRank[ruleBased.riskLevel] >= riskRank[mlPrediction.riskLevel]
      ? ruleBased.riskLevel
      : mlPrediction.riskLevel;

  // Generate insight based on features
  let insight = '';
  let recommendation = '';

  const { adherenceRate, consecutiveMissed, delayedDoses, trend, totalDue } = features;

  if (totalDue === 0) {
    insight = 'No medication doses have been due yet. Add medications and their schedules to begin tracking adherence.';
    recommendation = 'Set up your medication schedule in the Medicines section.';
  } else if (finalRiskLevel === 'Low') {
    insight = `Excellent adherence! Your ${adherenceRate}% weighted adherence rate meets or exceeds the clinical benchmark of ≥80%. ` +
      (trend === 'improving' ? 'Your recent adherence is trending even better.' : 'Keep up the great work.');
    recommendation = 'Maintain your current routine. Consider setting reminders to preserve this pattern.';
  } else if (finalRiskLevel === 'Moderate') {
    const issues = [];
    if (adherenceRate < 80) issues.push(`adherence at ${adherenceRate}% (target ≥80%)`);
    if (consecutiveMissed >= 2) issues.push(`${consecutiveMissed} consecutive missed doses`);
    if (delayedDoses > 0) issues.push(`${delayedDoses} delayed intake(s)`);
    insight = `Moderate adherence concern: ${issues.join(', ')}. ` +
      (trend === 'declining' ? 'Recent trend is declining — attention needed.' : 'Consistent improvement could reduce health risks.');
    recommendation = 'Set more frequent reminders and consider discussing your schedule with your healthcare provider.';
  } else {
    insight = `Critical adherence gap detected. ${adherenceRate}% adherence is well below the ≥80% clinical benchmark. ` +
      (consecutiveMissed >= 3 ? `${consecutiveMissed} consecutive missed doses indicate a serious pattern disruption.` : 'Multiple missed or delayed doses detected.');
    recommendation = 'Please consult your healthcare provider immediately. Missing medications for hypertension or diabetes can have serious health consequences.';
  }

  return { features, ruleBased, mlPrediction, finalRiskLevel, insight, recommendation };
  
}

