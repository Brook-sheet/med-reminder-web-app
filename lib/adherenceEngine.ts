/**
 * Shared medication adherence and behavioral-pattern engine.
 *
 * Future schedules never affect adherence or risk. A pending dose inside its
 * medication window is due, not missed, and is excluded from the denominator
 * until it is completed or the configured window ends.
 */

import {
  addDaysToMedicationDateKey,
  formatMedicationDateLabel,
  getMedicationDateKey,
  medicationScheduledAt,
  parseMedicationTimeToMinutes,
  resolveMedicationTimeZone,
} from './medicationTime';

export {
  medicationScheduledAt,
  parseMedicationTimeToMinutes as parseTimeToMinutes,
} from './medicationTime';

export type RiskLevel = 'Low' | 'Moderate' | 'High';
export type TrendDirection = 'improving' | 'stable' | 'declining';

export type MedicationLifecycle =
  | 'upcoming'
  | 'due'
  | 'taken'
  | 'late'
  | 'missed'
  | 'incorrect_chamber'
  | 'unverified'
  | 'audit';

export type InsightTone =
  | 'positive'
  | 'warning'
  | 'critical'
  | 'neutral';

export type TimeOfDay =
  | 'Morning'
  | 'Afternoon'
  | 'Evening';

export interface RawLog {
  id?: string;
  medicineId?: string | null;
  medicineName?: string;
  status: string;
  scheduledDate: string;
  scheduledTime: string;
  takenAt?: Date | string | null;
  delayMinutes?: number | null;
  lateAfterMinutes?: number | null;
  windowAfterMinutes?: number | null;
  expectedChamberId?: number | null;
  detectedChamberId?: number | null;
  countsTowardAdherence?: boolean;
}

export interface EvaluatedLog extends RawLog {
  lifecycle: MedicationLifecycle;
  scheduledAt: Date;
  windowEndsAt: Date;
  eligible: boolean;
  calculatedDelayMinutes: number | null;
}

export interface DailyAdherence {
  date: string;
  label: string;
  eligible: number;
  taken: number;
  adherenceRate: number | null;
}

export interface TimePattern {
  period: TimeOfDay;
  eligible: number;
  taken: number;
  missed: number;
  late: number;
  adherenceRate: number;
}

export interface MedicationPattern {
  medicineId: string | null;
  medicineName: string;
  eligible: number;
  taken: number;
  missed: number;
  late: number;
  incorrectChamber: number;
  adherenceRate: number;
}

export interface BehavioralInsight {
  id: string;
  tone: InsightTone;
  title: string;
  detail: string;
}

export interface AdherenceFeatures {
  adherenceRate: number;
  missedDoses: number;
  consecutiveMissed: number;
  consecutiveVerified: number;
  delayedDoses: number;
  avgDelayMinutes: number;

  /**
   * Finalized eligible doses only.
   * Active-window pending doses are excluded.
   */
  totalDue: number;

  totalTaken: number;
  duePending: number;
  upcomingDoses: number;
  incorrectChamberEvents: number;
  unverifiedEvents: number;
  onTimeRatio: number;
  recentAdherenceRate: number;
  previousAdherenceRate: number;
  trend: TrendDirection;
  trendAvailable: boolean;
  hasSufficientData: boolean;
}

export interface RuleBasedResult {
  riskLevel: RiskLevel;
  reasons: string[];
}

export interface BehavioralAnalysis {
  timeOfDay: TimePattern[];
  byMedication: MedicationPattern[];
  dailyTrend: DailyAdherence[];
  insights: BehavioralInsight[];
}

export interface AdherenceAnalysis {
  features: AdherenceFeatures;
  ruleBased: RuleBasedResult;
  finalRiskLevel: RiskLevel;
  riskReasons: string[];
  insight: string;
  recommendation: string;
  behavioral: BehavioralAnalysis;
}

const VERIFIED_STATUSES = new Set(['taken', 'late']);

function weightedRate(logs: EvaluatedLog[]): number {
  if (logs.length === 0) return 0;

  const onTime = logs.filter(
    (log) => log.lifecycle === 'taken',
  ).length;

  const late = logs.filter(
    (log) => log.lifecycle === 'late',
  ).length;

  return Math.round(((onTime + late * 0.5) / logs.length) * 100);
}

function periodFor(time: string): TimeOfDay {
  const minutes = parseMedicationTimeToMinutes(time);

  if (minutes < 12 * 60) return 'Morning';
  if (minutes < 17 * 60) return 'Afternoon';

  return 'Evening';
}

export function evaluateMedicationLog(
  log: RawLog,
  now = new Date(),
  requestedTimeZone?: string | null,
): EvaluatedLog {
  const timeZone = resolveMedicationTimeZone(requestedTimeZone);

  const scheduledAt = medicationScheduledAt(
    log.scheduledDate,
    log.scheduledTime,
    timeZone,
  );

  const windowAfterMinutes = Math.max(
    0,
    log.windowAfterMinutes ?? 90,
  );

  const windowEndsAt = new Date(
    scheduledAt.getTime() + windowAfterMinutes * 60_000,
  );

  const counts = log.countsTowardAdherence !== false;

  let calculatedDelayMinutes: number | null =
    log.delayMinutes ?? null;

  if (log.takenAt && !Number.isNaN(scheduledAt.getTime())) {
    const takenAt = new Date(log.takenAt);

    if (!Number.isNaN(takenAt.getTime())) {
      calculatedDelayMinutes = Math.max(
        0,
        Math.round(
          (takenAt.getTime() - scheduledAt.getTime()) / 60_000,
        ),
      );
    }
  }

  if (Number.isNaN(scheduledAt.getTime())) {
    return {
      ...log,
      lifecycle: 'audit',
      scheduledAt,
      windowEndsAt,
      eligible: false,
      calculatedDelayMinutes,
    };
  }

  if (log.status === 'incorrect_chamber') {
    return {
      ...log,
      lifecycle: 'incorrect_chamber',
      scheduledAt,
      windowEndsAt,
      eligible: false,
      calculatedDelayMinutes,
    };
  }

  if (log.status === 'unverified') {
    return {
      ...log,
      lifecycle: 'unverified',
      scheduledAt,
      windowEndsAt,
      eligible: false,
      calculatedDelayMinutes,
    };
  }

  if (!counts) {
    return {
      ...log,
      lifecycle: 'audit',
      scheduledAt,
      windowEndsAt,
      eligible: false,
      calculatedDelayMinutes,
    };
  }

  if (VERIFIED_STATUSES.has(log.status)) {
    const isLate =
      log.status === 'late' ||
      (calculatedDelayMinutes ?? 0) >
        (log.lateAfterMinutes ?? 30);

    return {
      ...log,
      lifecycle: isLate ? 'late' : 'taken',
      scheduledAt,
      windowEndsAt,
      eligible: true,
      calculatedDelayMinutes,
    };
  }

  if (now < scheduledAt) {
    return {
      ...log,
      lifecycle: 'upcoming',
      scheduledAt,
      windowEndsAt,
      eligible: false,
      calculatedDelayMinutes,
    };
  }

  if (now <= windowEndsAt) {
    return {
      ...log,
      lifecycle: 'due',
      scheduledAt,
      windowEndsAt,
      eligible: false,
      calculatedDelayMinutes,
    };
  }

  return {
    ...log,
    lifecycle: 'missed',
    scheduledAt,
    windowEndsAt,
    eligible: true,
    calculatedDelayMinutes: null,
  };
}

function maxStreak(
  logs: EvaluatedLog[],
  wanted: 'missed' | 'verified',
): number {
  let longest = 0;
  let current = 0;

  for (const log of logs) {
    const matches =
      wanted === 'missed'
        ? log.lifecycle === 'missed'
        : log.lifecycle === 'taken' ||
          log.lifecycle === 'late';

    current = matches ? current + 1 : 0;
    longest = Math.max(longest, current);
  }

  return longest;
}

function logsWithinDateKeys(
  logs: EvaluatedLog[],
  from: string,
  toExclusive: string,
): EvaluatedLog[] {
  return logs.filter(
    (log) =>
      log.eligible &&
      log.scheduledDate >= from &&
      log.scheduledDate < toExclusive,
  );
}

function createDailyTrend(
  logs: EvaluatedLog[],
  now: Date,
  timeZone: string,
): DailyAdherence[] {
  const today = getMedicationDateKey(now, timeZone);
  const result: DailyAdherence[] = [];

  for (let offset = -6; offset <= 0; offset += 1) {
    const day = addDaysToMedicationDateKey(today, offset);

    const dayLogs = logsWithinDateKeys(
      logs,
      day,
      addDaysToMedicationDateKey(day, 1),
    );

    result.push({
      date: day,
      label: formatMedicationDateLabel(day, {
        weekday: 'short',
      }),
      eligible: dayLogs.length,
      taken: dayLogs.filter(
        (log) =>
          log.lifecycle === 'taken' ||
          log.lifecycle === 'late',
      ).length,
      adherenceRate:
        dayLogs.length > 0 ? weightedRate(dayLogs) : null,
    });
  }

  return result;
}

function createTimePatterns(
  eligible: EvaluatedLog[],
): TimePattern[] {
  return (
    ['Morning', 'Afternoon', 'Evening'] as TimeOfDay[]
  ).map((period) => {
    const logs = eligible.filter(
      (log) => periodFor(log.scheduledTime) === period,
    );

    return {
      period,
      eligible: logs.length,
      taken: logs.filter(
        (log) =>
          log.lifecycle === 'taken' ||
          log.lifecycle === 'late',
      ).length,
      missed: logs.filter(
        (log) => log.lifecycle === 'missed',
      ).length,
      late: logs.filter(
        (log) => log.lifecycle === 'late',
      ).length,
      adherenceRate: weightedRate(logs),
    };
  });
}

function createMedicationPatterns(
  eligible: EvaluatedLog[],
  audit: EvaluatedLog[],
): MedicationPattern[] {
  const groups = new Map<string, MedicationPattern>();

  const keyFor = (log: EvaluatedLog) =>
    log.medicineId ||
    log.medicineName ||
    'Unknown medication';

  const getItem = (log: EvaluatedLog) => {
    const key = keyFor(log);
    const existing = groups.get(key);

    if (existing) return existing;

    const created: MedicationPattern = {
      medicineId: log.medicineId ?? null,
      medicineName: log.medicineName || 'Unknown medication',
      eligible: 0,
      taken: 0,
      missed: 0,
      late: 0,
      incorrectChamber: 0,
      adherenceRate: 0,
    };

    groups.set(key, created);

    return created;
  };

  for (const log of eligible) {
    const item = getItem(log);

    item.eligible += 1;

    if (
      log.lifecycle === 'taken' ||
      log.lifecycle === 'late'
    ) {
      item.taken += 1;
    }

    if (log.lifecycle === 'late') {
      item.late += 1;
    }

    if (log.lifecycle === 'missed') {
      item.missed += 1;
    }
  }

  for (
    const log of audit.filter(
      (item) => item.status === 'incorrect_chamber',
    )
  ) {
    getItem(log).incorrectChamber += 1;
  }

  for (const [key, item] of groups) {
    const itemLogs = eligible.filter(
      (log) => keyFor(log) === key,
    );

    item.adherenceRate = weightedRate(itemLogs);
  }

  return Array.from(groups.values()).sort(
    (a, b) =>
      a.adherenceRate - b.adherenceRate ||
      b.eligible - a.eligible,
  );
}

function buildInsights(
  features: AdherenceFeatures,
  timeOfDay: TimePattern[],
  byMedication: MedicationPattern[],
  recent: EvaluatedLog[],
): BehavioralInsight[] {
  const insights: BehavioralInsight[] = [];

  if (!features.hasSufficientData) {
    return insights;
  }

  const missedRecent = recent.filter(
    (log) => log.lifecycle === 'missed',
  );

  const lateRecent = recent.filter(
    (log) => log.lifecycle === 'late',
  );

  if (missedRecent.length >= 3) {
    insights.push({
      id: 'repeated-missed',
      tone: 'critical',
      title: 'Repeated missed medication detected',
      detail:
        `${missedRecent.length} eligible doses were missed ` +
        'during the last 7 days.',
    });
  }

  if (lateRecent.length >= 2) {
    insights.push({
      id: 'repeated-late',
      tone: 'warning',
      title: 'Frequent delayed medication behavior detected',
      detail:
        `${lateRecent.length} doses were taken late ` +
        'during the last 7 days.',
    });
  }

  const weakPeriod = timeOfDay
    .filter(
      (item) =>
        item.eligible >= 3 &&
        (item.missed >= 2 || item.late >= 2),
    )
    .sort(
      (a, b) => a.adherenceRate - b.adherenceRate,
    )[0];

  if (weakPeriod) {
    insights.push({
      id: `weak-${weakPeriod.period.toLowerCase()}`,
      tone: 'warning',
      title: `${weakPeriod.period} medication needs attention`,
      detail:
        `${weakPeriod.missed} missed and ` +
        `${weakPeriod.late} delayed dose(s) across ` +
        `${weakPeriod.eligible} eligible ` +
        `${weakPeriod.period.toLowerCase()} doses.`,
    });
  }

  const lowestMedicine = byMedication.find(
    (item) =>
      item.eligible >= 3 &&
      item.adherenceRate < 80,
  );

  if (lowestMedicine) {
    insights.push({
      id:
        `medicine-${lowestMedicine.medicineId || lowestMedicine.medicineName}`,
      tone: 'warning',
      title:
        `${lowestMedicine.medicineName} has the lowest adherence`,
      detail:
        `${lowestMedicine.adherenceRate}% across ` +
        `${lowestMedicine.eligible} eligible doses.`,
    });
  }

  if (features.incorrectChamberEvents >= 3) {
    insights.push({
      id: 'incorrect-chamber',
      tone: 'critical',
      title: 'Repeated incorrect chamber access detected',
      detail:
        `${features.incorrectChamberEvents} incorrect chamber ` +
        'events were recorded. These were not counted as ' +
        'successful intake.',
    });
  }

  const strongPeriod = timeOfDay
    .filter(
      (item) =>
        item.eligible >= 3 &&
        item.adherenceRate >= 90,
    )
    .sort(
      (a, b) => b.adherenceRate - a.adherenceRate,
    )[0];

  if (strongPeriod) {
    insights.push({
      id: `strong-${strongPeriod.period.toLowerCase()}`,
      tone: 'positive',
      title:
        `${strongPeriod.period} medication routine is consistent`,
      detail:
        `${strongPeriod.adherenceRate}% adherence across ` +
        `${strongPeriod.eligible} eligible doses.`,
    });
  }

  if (features.consecutiveVerified >= 5) {
    insights.push({
      id: 'verified-streak',
      tone: 'positive',
      title: 'Consistent verified-dose streak',
      detail:
        `${features.consecutiveVerified} consecutive doses ` +
        'were correctly verified.',
    });
  }

  return insights.slice(0, 5);
}

export function extractFeatures(
  logs: RawLog[],
  now = new Date(),
  requestedTimeZone?: string | null,
): AdherenceFeatures {
  const timeZone =
    resolveMedicationTimeZone(requestedTimeZone);

  const evaluated = logs.map((log) =>
    evaluateMedicationLog(log, now, timeZone),
  );

  const eligible = evaluated
    .filter((log) => log.eligible)
    .sort(
      (a, b) =>
        a.scheduledAt.getTime() -
        b.scheduledAt.getTime(),
    );

  const onTime = eligible.filter(
    (log) => log.lifecycle === 'taken',
  ).length;

  const late = eligible.filter(
    (log) => log.lifecycle === 'late',
  ).length;

  const missed = eligible.filter(
    (log) => log.lifecycle === 'missed',
  ).length;

  const delays = eligible
    .filter(
      (log) =>
        log.lifecycle === 'late' &&
        log.calculatedDelayMinutes != null,
    )
    .map(
      (log) => log.calculatedDelayMinutes as number,
    );

  const today = getMedicationDateKey(now, timeZone);
  const currentFrom =
    addDaysToMedicationDateKey(today, -6);
  const currentTo =
    addDaysToMedicationDateKey(today, 1);
  const previousFrom =
    addDaysToMedicationDateKey(today, -13);

  const current = logsWithinDateKeys(
    eligible,
    currentFrom,
    currentTo,
  );

  const previous = logsWithinDateKeys(
    eligible,
    previousFrom,
    currentFrom,
  );

  const trendAvailable =
    current.length >= 2 &&
    previous.length >= 2;

  const recentAdherenceRate = weightedRate(current);
  const previousAdherenceRate = weightedRate(previous);

  let trend: TrendDirection = 'stable';

  if (
    trendAvailable &&
    recentAdherenceRate >= previousAdherenceRate + 5
  ) {
    trend = 'improving';
  }

  if (
    trendAvailable &&
    recentAdherenceRate <= previousAdherenceRate - 5
  ) {
    trend = 'declining';
  }

  return {
    adherenceRate: weightedRate(eligible),
    missedDoses: missed,
    consecutiveMissed: maxStreak(
      eligible,
      'missed',
    ),
    consecutiveVerified: maxStreak(
      eligible,
      'verified',
    ),
    delayedDoses: late,
    avgDelayMinutes:
      delays.length > 0
        ? Math.round(
            delays.reduce(
              (sum, value) => sum + value,
              0,
            ) / delays.length,
          )
        : 0,
    totalDue: eligible.length,
    totalTaken: onTime + late,
    duePending: evaluated.filter(
      (log) => log.lifecycle === 'due',
    ).length,
    upcomingDoses: evaluated.filter(
      (log) => log.lifecycle === 'upcoming',
    ).length,
    incorrectChamberEvents: evaluated.filter(
      (log) => log.status === 'incorrect_chamber',
    ).length,
    unverifiedEvents: evaluated.filter(
      (log) => log.status === 'unverified',
    ).length,
    onTimeRatio:
      onTime + late > 0
        ? Math.round(
            (onTime / (onTime + late)) * 100,
          ) / 100
        : 0,
    recentAdherenceRate,
    previousAdherenceRate,
    trend,
    trendAvailable,
    hasSufficientData: eligible.length > 0,
  };
}

export function ruleBasedClassify(
  features: AdherenceFeatures,
): RuleBasedResult {
  if (!features.hasSufficientData) {
    return {
      riskLevel: 'Low',
      reasons: [
        'More completed medication activity is needed before risk can be assessed.',
      ],
    };
  }

  const reasons: string[] = [];
  let riskLevel: RiskLevel;

  if (features.adherenceRate >= 80) {
    riskLevel = 'Low';

    reasons.push(
      `Adherence is ${features.adherenceRate}% across eligible doses.`,
    );
  } else if (features.adherenceRate >= 50) {
    riskLevel = 'Moderate';

    reasons.push(
      `Adherence is below the configured 80% target (${features.adherenceRate}%).`,
    );
  } else {
    riskLevel = 'High';

    reasons.push(
      `Adherence is below 50% (${features.adherenceRate}%).`,
    );
  }

  if (features.consecutiveMissed >= 3) {
    riskLevel = 'High';

    reasons.push(
      `${features.consecutiveMissed} consecutive missed doses were detected.`,
    );
  } else if (features.consecutiveMissed >= 2) {
    if (riskLevel === 'Low') {
      riskLevel = 'Moderate';
    }

    reasons.push(
      `${features.consecutiveMissed} consecutive missed doses were detected.`,
    );
  }

  const delayRatio =
    features.delayedDoses /
    Math.max(features.totalDue, 1);

  if (
    delayRatio >= 0.3 &&
    features.delayedDoses >= 2
  ) {
    if (riskLevel === 'Low') {
      riskLevel = 'Moderate';
    }

    reasons.push(
      `${features.delayedDoses} eligible doses were delayed.`,
    );
  }

  if (features.incorrectChamberEvents >= 3) {
    if (riskLevel === 'Low') {
      riskLevel = 'Moderate';
    }

    reasons.push(
      `${features.incorrectChamberEvents} incorrect chamber events were recorded.`,
    );
  }

  if (
    features.trendAvailable &&
    features.trend === 'declining'
  ) {
    if (riskLevel === 'Low') {
      riskLevel = 'Moderate';
    }

    reasons.push(
      `Recent adherence declined from ` +
      `${features.previousAdherenceRate}% to ` +
      `${features.recentAdherenceRate}%.`,
    );
  } else if (
    features.trendAvailable &&
    features.trend === 'improving'
  ) {
    reasons.push(
      `Recent adherence improved from ` +
      `${features.previousAdherenceRate}% to ` +
      `${features.recentAdherenceRate}%.`,
    );
  }

  return {
    riskLevel,
    reasons,
  };
}

export function analyzeAdherence(
  logs: RawLog[],
  now = new Date(),
  requestedTimeZone?: string | null,
): AdherenceAnalysis {
  const timeZone =
    resolveMedicationTimeZone(requestedTimeZone);

  const evaluated = logs.map((log) =>
    evaluateMedicationLog(log, now, timeZone),
  );

  const eligible = evaluated
    .filter((log) => log.eligible)
    .sort(
      (a, b) =>
        a.scheduledAt.getTime() -
        b.scheduledAt.getTime(),
    );

  const audit = evaluated.filter(
    (log) =>
      log.lifecycle === 'audit' ||
      log.lifecycle === 'incorrect_chamber' ||
      log.lifecycle === 'unverified',
  );

  const features = extractFeatures(
    logs,
    now,
    timeZone,
  );

  const ruleBased = ruleBasedClassify(features);

  const today = getMedicationDateKey(
    now,
    timeZone,
  );

  const recent = logsWithinDateKeys(
    eligible,
    addDaysToMedicationDateKey(today, -6),
    addDaysToMedicationDateKey(today, 1),
  );

  const timeOfDay =
    createTimePatterns(eligible);

  const byMedication =
    createMedicationPatterns(eligible, audit);

  const behavioral: BehavioralAnalysis = {
    timeOfDay,
    byMedication,
    dailyTrend: createDailyTrend(
      eligible,
      now,
      timeZone,
    ),
    insights: buildInsights(
      features,
      timeOfDay,
      byMedication,
      recent,
    ),
  };

  if (!features.hasSufficientData) {
    return {
      features,
      ruleBased,
      finalRiskLevel: 'Low',
      riskReasons: ruleBased.reasons,
      insight: 'Insufficient Data',
      recommendation:
        'More completed medication activity is needed before behavioral patterns can be identified.',
      behavioral,
    };
  }

  const concern = behavioral.insights.find(
    (item) =>
      item.tone === 'critical' ||
      item.tone === 'warning',
  );

  const positive = behavioral.insights.find(
    (item) => item.tone === 'positive',
  );

  return {
    features,
    ruleBased,
    finalRiskLevel: ruleBased.riskLevel,
    riskReasons: ruleBased.reasons,
    insight:
      concern?.title ||
      positive?.title ||
      'No repeated negative behavior detected.',
    recommendation:
      ruleBased.riskLevel === 'Low'
        ? 'Keep following the medication schedule and review new patterns as more activity is recorded.'
        : 'Use reminders and review the affected medication or time period shown in the behavioral insights.',
    behavioral,
  };
}