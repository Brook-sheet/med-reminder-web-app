/**
 * lib/adaptiveIntervention.ts
 *
 * Adaptive AI Intervention Engine
 * Transforms ML predictions into intelligent, personalized adherence interventions.
 *
 * Architecture:
 * 1. Rule-Based Clinical Safety Layer
 * 2. Feature Extraction & Behavioral Analytics Layer
 * 3. Random Forest Predictive Risk Classification
 * 4. Adaptive AI Intervention Engine
 * 5. Personalized Reminder & Predictive Adherence Support Layer
 * 6. Caregiver Escalation & Monitoring Layer
 */

import {
  evaluateMedicationLog,
  parseTimeToMinutes,
  type AdherenceFeatures,
  type RiskLevel,
  type TrendDirection,
} from './adherenceEngine';

import {
  addDaysToMedicationDateKey,
  getMedicationDateKey,
  resolveMedicationTimeZone,
} from './medicationTime';

export type InterventionIntensity =
  | 'minimal'
  | 'moderate'
  | 'aggressive';

export type EscalationPriority =
  | 'none'
  | 'low'
  | 'medium'
  | 'high'
  | 'critical';

export interface BehavioralPattern {
  avgIntakeDelayMinutes: number;

  delayProfile:
    | 'early'
    | 'ontime'
    | 'slightly_late'
    | 'late'
    | 'very_late';

  peakMissHour: number | null;
  hasClusteredMisses: boolean;

  delayTrend:
    | 'improving'
    | 'stable'
    | 'worsening';

  currentMissStreak: number;
  maxHistoricalMissStreak: number;
}

export interface AdaptiveReminderConfig {
  leadTimeMinutes: number;
  followUpCount: number;
  followUpIntervalMinutes: number;
  escalationEnabled: boolean;
  motivationalMessagingEnabled: boolean;
  intensity: InterventionIntensity;
  escalationPriority: EscalationPriority;
  behavioralLeadTimeBonus: number;
  interventionReason: string;

  messageTone:
    | 'gentle'
    | 'neutral'
    | 'urgent'
    | 'critical';

  highSensitivityMode: boolean;
  clinicalActionSuggestion: string;
}

export interface AdaptiveInterventionResult {
  behavioralPattern: BehavioralPattern;
  reminderConfig: AdaptiveReminderConfig;
  interventionSummary: string;
  isEscalation: boolean;
  drivingRiskLevel: RiskLevel;
  interventionConfidence: number;
  keySignals: string[];
}

export interface RawLogForBehavior {
  status: string;
  scheduledDate: string;
  scheduledTime: string;
  takenAt?: Date | null;
  lateAfterMinutes?: number | null;
  windowAfterMinutes?: number | null;
  countsTowardAdherence?: boolean;
}

const CLINICAL_SAFETY = {
  MAX_LEAD_TIME_MINUTES: 60,
  MIN_LEAD_TIME_MINUTES: 10,
  MAX_FOLLOWUP_COUNT: 5,
  MIN_FOLLOWUP_INTERVAL_MINUTES: 10,
  MAX_FOLLOWUP_INTERVAL_MINUTES: 30,
  HIGH_SENSITIVITY_THRESHOLD: 50,
  CAREGIVER_ESCALATION_MISS_THRESHOLD: 3,
  CRITICAL_ESCALATION_THRESHOLD: 40,
} as const;

export function extractBehavioralPattern(
  logs: RawLogForBehavior[],
  features: AdherenceFeatures,
  now = new Date(),
  requestedTimeZone?: string | null,
): BehavioralPattern {
  const timeZone =
    resolveMedicationTimeZone(requestedTimeZone);

  const evaluated = logs.map((log) =>
    evaluateMedicationLog(
      {
        status: log.status,
        scheduledDate: log.scheduledDate,
        scheduledTime: log.scheduledTime,
        takenAt: log.takenAt,
        lateAfterMinutes: log.lateAfterMinutes,
        windowAfterMinutes: log.windowAfterMinutes,
        countsTowardAdherence:
          log.countsTowardAdherence,
      },
      now,
      timeZone,
    ),
  );

  const takenWithDelay = evaluated
    .filter(
      (log) =>
        (
          log.lifecycle === 'taken' ||
          log.lifecycle === 'late'
        ) &&
        log.calculatedDelayMinutes != null,
    )
    .map((log) => ({
      delay:
        log.calculatedDelayMinutes as number,
      scheduledDate: log.scheduledDate,
    }));

  const avgIntakeDelayMinutes =
    takenWithDelay.length > 0
      ? Math.round(
          takenWithDelay.reduce(
            (a, b) => a + b.delay,
            0,
          ) / takenWithDelay.length,
        )
      : 0;

  let delayProfile:
    BehavioralPattern['delayProfile'];

  if (avgIntakeDelayMinutes < -5) {
    delayProfile = 'early';
  } else if (avgIntakeDelayMinutes <= 10) {
    delayProfile = 'ontime';
  } else if (avgIntakeDelayMinutes <= 30) {
    delayProfile = 'slightly_late';
  } else if (avgIntakeDelayMinutes <= 60) {
    delayProfile = 'late';
  } else {
    delayProfile = 'very_late';
  }

  // Only finalized eligible misses contribute.
  const missedLogs = evaluated.filter(
    (log) => log.lifecycle === 'missed',
  );

  const missHours = missedLogs.map((log) => {
    const minutes =
      parseTimeToMinutes(log.scheduledTime);

    return Math.floor(minutes / 60);
  });

  let peakMissHour: number | null = null;

  if (missHours.length > 0) {
    const hourCounts: Record<number, number> = {};

    for (const hour of missHours) {
      hourCounts[hour] =
        (hourCounts[hour] || 0) + 1;
    }

    peakMissHour = Number.parseInt(
      Object.entries(hourCounts).sort(
        (a, b) => b[1] - a[1],
      )[0]?.[0] ?? '0',
    );
  }

  const missTimeSlots = missedLogs.map(
    (log) => log.scheduledTime,
  );

  const slotCounts: Record<string, number> = {};

  for (const time of missTimeSlots) {
    slotCounts[time] =
      (slotCounts[time] || 0) + 1;
  }

  const hasClusteredMisses =
    Object.values(slotCounts).some(
      (count) => count >= 3,
    );

  const recentFrom =
    addDaysToMedicationDateKey(
      getMedicationDateKey(now, timeZone),
      -6,
    );

  const recentTaken = takenWithDelay.filter(
    (log) => log.scheduledDate >= recentFrom,
  );

  const olderTaken = takenWithDelay.filter(
    (log) => log.scheduledDate < recentFrom,
  );

  const recentAverage =
    recentTaken.length > 0
      ? recentTaken.reduce(
          (sum, item) => sum + item.delay,
          0,
        ) / recentTaken.length
      : avgIntakeDelayMinutes;

  const olderAverage =
    olderTaken.length > 0
      ? olderTaken.reduce(
          (sum, item) => sum + item.delay,
          0,
        ) / olderTaken.length
      : recentAverage;

  let delayTrend:
    BehavioralPattern['delayTrend'];

  if (recentAverage < olderAverage - 5) {
    delayTrend = 'improving';
  } else if (
    recentAverage > olderAverage + 5
  ) {
    delayTrend = 'worsening';
  } else {
    delayTrend = 'stable';
  }

  let maxStreak = 0;
  let streak = 0;

  const sortedLogs = evaluated
    .filter((log) => log.eligible)
    .sort(
      (a, b) =>
        a.scheduledAt.getTime() -
        b.scheduledAt.getTime(),
    );

  for (const log of sortedLogs) {
    if (log.lifecycle === 'missed') {
      streak += 1;
      maxStreak = Math.max(maxStreak, streak);
    } else {
      streak = 0;
    }
  }

  return {
    avgIntakeDelayMinutes,
    delayProfile,
    peakMissHour,
    hasClusteredMisses,
    delayTrend,
    currentMissStreak:
      features.consecutiveMissed,
    maxHistoricalMissStreak: maxStreak,
  };
}

function computeAdaptiveLeadTime(
  baseLeadTime: number,
  pattern: BehavioralPattern,
  riskLevel: RiskLevel,
): {
  leadTime: number;
  bonus: number;
} {
  let bonus = 0;

  if (pattern.delayProfile === 'slightly_late') {
    bonus += 10;
  }

  if (pattern.delayProfile === 'late') {
    bonus += 20;
  }

  if (pattern.delayProfile === 'very_late') {
    bonus += 30;
  }

  if (pattern.delayTrend === 'worsening') {
    bonus += 10;
  }

  if (pattern.hasClusteredMisses) {
    bonus += 10;
  }

  if (pattern.currentMissStreak >= 2) {
    bonus += 15;
  }

  if (pattern.currentMissStreak >= 3) {
    bonus += 10;
  }

  if (riskLevel === 'Low') {
    bonus = Math.min(bonus, 5);
  } else if (riskLevel === 'Moderate') {
    bonus = Math.min(bonus, 20);
  }

  const rawLeadTime =
    baseLeadTime + bonus;

  const clampedLeadTime = Math.min(
    CLINICAL_SAFETY.MAX_LEAD_TIME_MINUTES,
    Math.max(
      CLINICAL_SAFETY.MIN_LEAD_TIME_MINUTES,
      rawLeadTime,
    ),
  );

  return {
    leadTime: clampedLeadTime,
    bonus,
  };
}

function computeEscalationPriority(
  features: AdherenceFeatures,
  riskLevel: RiskLevel,
  pattern: BehavioralPattern,
): EscalationPriority {
  if (!features.hasSufficientData) {
    return 'none';
  }

  if (
    features.adherenceRate <
      CLINICAL_SAFETY.CRITICAL_ESCALATION_THRESHOLD ||
    pattern.currentMissStreak >= 5
  ) {
    return 'critical';
  }

  if (
    riskLevel === 'High' &&
    pattern.currentMissStreak >=
      CLINICAL_SAFETY.CAREGIVER_ESCALATION_MISS_THRESHOLD
  ) {
    return 'high';
  }

  if (
    riskLevel === 'High' ||
    (
      riskLevel === 'Moderate' &&
      pattern.delayTrend === 'worsening'
    )
  ) {
    return 'medium';
  }

  if (
    riskLevel === 'Moderate' &&
    features.consecutiveMissed >= 2
  ) {
    return 'low';
  }

  return 'none';
}

export function generateAdaptiveIntervention(
  features: AdherenceFeatures,
  riskLevel: RiskLevel,
  mlConfidence: number,
  pattern: BehavioralPattern,
): AdaptiveReminderConfig {
  let intensity: InterventionIntensity;
  let baseLeadTime: number;
  let followUpCount: number;
  let followUpInterval: number;

  let messageTone:
    AdaptiveReminderConfig['messageTone'];

  let motivational: boolean;
  let highSensitivity: boolean;
  let interventionReason: string;
  let clinicalAction: string;

  if (riskLevel === 'Low') {
    intensity = 'minimal';
    baseLeadTime = 30;
    followUpCount = 1;
    followUpInterval = 20;
    messageTone = 'gentle';
    motivational = false;
    highSensitivity = false;
    interventionReason =
      'Adherence is within clinical targets. Standard reminder protocol active.';
    clinicalAction =
      'Continue current medication routine. No clinical action required.';
  } else if (riskLevel === 'Moderate') {
    intensity = 'moderate';
    baseLeadTime = 35;
    followUpCount = 2;
    followUpInterval = 15;
    messageTone = 'neutral';
    motivational = true;
    highSensitivity = false;
    interventionReason =
      'Moderate adherence risk detected. Elevated reminder protocol activated.';
    clinicalAction =
      'Consider reviewing medication routine with healthcare provider at next appointment.';
  } else {
    intensity = 'aggressive';
    baseLeadTime = 45;
    followUpCount = 4;
    followUpInterval = 10;
    messageTone = 'urgent';
    motivational = true;
    highSensitivity = true;
    interventionReason =
      'High adherence risk detected. Aggressive intervention protocol activated.';
    clinicalAction =
      'Urgent: consult healthcare provider. Persistent missed doses may impact clinical outcomes for hypertension/diabetes.';
  }

  // A patient with no completed dose history must not
  // immediately receive high-risk intervention behavior.
  if (!features.hasSufficientData) {
    return {
      leadTimeMinutes: 30,
      followUpCount: 1,
      followUpIntervalMinutes: 20,
      escalationEnabled: false,
      motivationalMessagingEnabled: false,
      intensity: 'minimal',
      escalationPriority: 'none',
      behavioralLeadTimeBonus: 0,
      interventionReason:
        'No completed medication activity is available yet. Standard reminder protocol remains active.',
      messageTone: 'gentle',
      highSensitivityMode: false,
      clinicalActionSuggestion:
        'Continue the medication schedule while the system gathers completed-dose history.',
    };
  }

  if (
    features.consecutiveMissed >= 2 &&
    intensity !== 'aggressive'
  ) {
    followUpCount = Math.min(
      followUpCount + 1,
      CLINICAL_SAFETY.MAX_FOLLOWUP_COUNT,
    );

    followUpInterval = Math.max(
      followUpInterval - 5,
      CLINICAL_SAFETY.MIN_FOLLOWUP_INTERVAL_MINUTES,
    );
  }

  if (features.trend === 'declining') {
    if (messageTone === 'gentle') {
      messageTone = 'neutral';
    } else if (messageTone === 'neutral') {
      messageTone = 'urgent';
    }
  }

  if (
    features.recentAdherenceRate <
    CLINICAL_SAFETY.HIGH_SENSITIVITY_THRESHOLD
  ) {
    highSensitivity = true;

    followUpCount = Math.min(
      followUpCount + 1,
      CLINICAL_SAFETY.MAX_FOLLOWUP_COUNT,
    );
  }

  if (features.trend === 'improving') {
    motivational = true;
  }

  if (
    features.adherenceRate <
    CLINICAL_SAFETY.CRITICAL_ESCALATION_THRESHOLD
  ) {
    messageTone = 'critical';
    highSensitivity = true;

    followUpCount =
      CLINICAL_SAFETY.MAX_FOLLOWUP_COUNT;
  }

  const {
    leadTime,
    bonus,
  } = computeAdaptiveLeadTime(
    baseLeadTime,
    pattern,
    riskLevel,
  );

  const escalationPriority =
    computeEscalationPriority(
      features,
      riskLevel,
      pattern,
    );

  const escalationEnabled =
    escalationPriority !== 'none';

  const safeFollowUpCount = Math.min(
    followUpCount,
    CLINICAL_SAFETY.MAX_FOLLOWUP_COUNT,
  );

  const safeInterval = Math.max(
    Math.min(
      followUpInterval,
      CLINICAL_SAFETY.MAX_FOLLOWUP_INTERVAL_MINUTES,
    ),
    CLINICAL_SAFETY.MIN_FOLLOWUP_INTERVAL_MINUTES,
  );

  return {
    leadTimeMinutes: leadTime,
    followUpCount: safeFollowUpCount,
    followUpIntervalMinutes: safeInterval,
    escalationEnabled,
    motivationalMessagingEnabled: motivational,
    intensity,
    escalationPriority,
    behavioralLeadTimeBonus: bonus,
    interventionReason,
    messageTone,
    highSensitivityMode: highSensitivity,
    clinicalActionSuggestion: clinicalAction,
  };
}

export function analyzeAdaptiveIntervention(
  logs: RawLogForBehavior[],
  features: AdherenceFeatures,
  riskLevel: RiskLevel,
  mlRiskLevel: RiskLevel,
  mlConfidence: number,
  previousRiskLevel?: RiskLevel,
  now = new Date(),
  requestedTimeZone?: string | null,
): AdaptiveInterventionResult {
  const behavioralPattern =
    extractBehavioralPattern(
      logs,
      features,
      now,
      requestedTimeZone,
    );

  const riskRank: Record<RiskLevel, number> = {
    Low: 0,
    Moderate: 1,
    High: 2,
  };

  const drivingRisk: RiskLevel =
    riskRank[riskLevel] >=
    riskRank[mlRiskLevel]
      ? riskLevel
      : mlRiskLevel;

  const reminderConfig =
    generateAdaptiveIntervention(
      features,
      drivingRisk,
      mlConfidence,
      behavioralPattern,
    );

  const isEscalation =
    previousRiskLevel !== undefined &&
    riskRank[drivingRisk] >
      riskRank[previousRiskLevel];

  const dataConfidence = Math.min(
    features.totalDue / 10,
    1,
  );

  const interventionConfidence = Math.round(
    mlConfidence * 0.6 +
    dataConfidence * 100 * 0.4,
  );

  const keySignals: string[] = [];

  if (features.consecutiveMissed >= 2) {
    keySignals.push(
      `${features.consecutiveMissed} consecutive missed doses`,
    );
  }

  if (features.trend === 'declining') {
    keySignals.push(
      'Adherence trending downward in recent 7 days',
    );
  }

  if (
    features.hasSufficientData &&
    features.recentAdherenceRate < 60
  ) {
    keySignals.push(
      `Recent 7-day adherence critically low (${features.recentAdherenceRate}%)`,
    );
  }

  if (
    behavioralPattern.delayProfile === 'late' ||
    behavioralPattern.delayProfile === 'very_late'
  ) {
    keySignals.push(
      `Consistent late intake pattern ` +
      `(avg ${behavioralPattern.avgIntakeDelayMinutes} min delay)`,
    );
  }

  if (behavioralPattern.hasClusteredMisses) {
    keySignals.push(
      'Repeated missed doses at specific scheduled times detected',
    );
  }

  if (
    features.hasSufficientData &&
    features.adherenceRate < 50
  ) {
    keySignals.push(
      `Overall adherence critically low (${features.adherenceRate}%)`,
    );
  }

  if (features.avgDelayMinutes > 60) {
    keySignals.push(
      `High average dose delay (${features.avgDelayMinutes} min)`,
    );
  }

  if (
    behavioralPattern.delayTrend === 'worsening'
  ) {
    keySignals.push(
      'Dose delay behavior worsening over time',
    );
  }

  if (isEscalation) {
    keySignals.push(
      `Escalated from ${previousRiskLevel} to ${drivingRisk} risk`,
    );
  }

  let summary = '';

  if (drivingRisk === 'Low') {
    summary =
      'Adherence is stable and within clinical targets. ' +
      'Standard reminder protocol is active. ' +
      (
        features.trend === 'improving'
          ? 'Your adherence has been improving — keep it up!'
          : 'Maintain your current routine for optimal outcomes.'
      );
  } else if (drivingRisk === 'Moderate') {
    summary =
      `Moderate adherence concern detected ` +
      `(${features.adherenceRate}% rate). ` +
      `Reminders have been adjusted to ` +
      `${reminderConfig.leadTimeMinutes} minutes before ` +
      `scheduled dose time. ` +
      (
        reminderConfig.behavioralLeadTimeBonus > 0
          ? `An extra ${reminderConfig.behavioralLeadTimeBonus} ` +
            'minutes has been added based on your intake patterns. '
          : ''
      ) +
      'Motivational support notifications are active.';
  } else {
    summary =
      `High adherence risk identified ` +
      `(${features.adherenceRate}% rate, ` +
      `${features.consecutiveMissed} consecutive miss(es)). ` +
      `Aggressive intervention protocol active: reminders sent ` +
      `${reminderConfig.leadTimeMinutes} minutes in advance ` +
      `with ${reminderConfig.followUpCount} follow-ups every ` +
      `${reminderConfig.followUpIntervalMinutes} minutes. ` +
      (
        reminderConfig.escalationEnabled
          ? `Caregiver escalation is ` +
            `${reminderConfig.escalationPriority} priority. `
          : ''
      ) +
      reminderConfig.clinicalActionSuggestion;
  }

  return {
    behavioralPattern,
    reminderConfig,
    interventionSummary: summary,
    isEscalation,
    drivingRiskLevel: drivingRisk,
    interventionConfidence:
      Math.min(interventionConfidence, 100),
    keySignals,
  };
}

export function generateMotivationalMessage(
  riskLevel: RiskLevel,
  trend: TrendDirection,
  adherenceRate: number,
  medicineName?: string,
): string {
  const medicine = medicineName
    ? `your ${medicineName}`
    : 'your medication';

  if (
    riskLevel === 'Low' &&
    trend === 'improving'
  ) {
    return (
      `Great work! Your adherence is improving. ` +
      `Taking ${medicine} consistently is key to managing ` +
      'your condition effectively.'
    );
  }

  if (riskLevel === 'Low') {
    return (
      `You're doing well! Keep taking ${medicine} as ` +
      'scheduled to maintain healthy outcomes.'
    );
  }

  if (
    riskLevel === 'Moderate' &&
    trend === 'improving'
  ) {
    return (
      `Good progress! Your adherence is getting better. ` +
      `Stay consistent with ${medicine} — it makes a real ` +
      'difference for your health.'
    );
  }

  if (riskLevel === 'Moderate') {
    return (
      `Consistency matters. Taking ${medicine} on time helps ` +
      'keep your condition under control. You can do this — ' +
      'small improvements add up.'
    );
  }

  if (
    riskLevel === 'High' &&
    adherenceRate < 50
  ) {
    return (
      `Your health is important. Please take ${medicine} now — ` +
      'skipping doses for hypertension or diabetes can have ' +
      'serious health consequences. If you are having difficulty, ' +
      'talk to your doctor.'
    );
  }

  return (
    `Please take ${medicine} as prescribed. Your healthcare ` +
    'team is counting on your consistent adherence for the ' +
    'best outcomes.'
  );
}

export function generateEscalationMessage(
  priority: EscalationPriority,
  features: AdherenceFeatures,
  patientName?: string,
): string {
  const name = patientName || 'Patient';

  switch (priority) {
    case 'critical':
      return (
        `CRITICAL ALERT: ${name} has missed ` +
        `${features.consecutiveMissed} consecutive doses and ` +
        `has an adherence rate of ${features.adherenceRate}%. ` +
        'Immediate follow-up is strongly recommended.'
      );

    case 'high':
      return (
        `HIGH PRIORITY: ${name}'s medication adherence has ` +
        `dropped to ${features.adherenceRate}% with ` +
        `${features.consecutiveMissed} missed doses. ` +
        'Please check in with the patient.'
      );

    case 'medium':
      return (
        `MODERATE CONCERN: ${name}'s adherence is at ` +
        `${features.adherenceRate}% with a declining trend. ` +
        'Consider reaching out to support adherence.'
      );

    case 'low':
      return (
        `EARLY WARNING: ${name}'s adherence pattern shows ` +
        `some irregularity (${features.adherenceRate}%). ` +
        'Monitoring has been increased.'
      );

    default:
      return '';
  }
}