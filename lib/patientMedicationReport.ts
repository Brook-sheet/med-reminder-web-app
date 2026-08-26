import { createHash } from 'crypto';
import mongoose from 'mongoose';

export {
  MAX_MEDICATION_REPORT_DAYS,
  MedicationReportError,
  resolveMedicationReportRange,
} from '@/lib/patientMedicationReportCore';

import { MedicationReportError } from '@/lib/patientMedicationReportCore';
import {
  analyzeAdherence,
  evaluateMedicationLog,
  type EvaluatedLog,
  type MedicationPattern,
  type RawLog,
} from '@/lib/adherenceEngine';
import {
  addDaysToMedicationDateKey,
  getMedicationDateKey,
  medicationScheduledAt,
  resolveMedicationTimeZone,
} from '@/lib/medicationTime';
import {
  calculateFoodRisk,
  getFoodReminderContent,
  type FoodLogEntry,
  type RiskLevel as FoodRiskLevel,
} from '@/lib/foodMonitoring';
import type {
  MedicationReportActivityItem,
  MedicationReportAnnotation,
  MedicationReportPerformanceItem,
  MedicationReportRegimenItem,
  MedicationReportStatus,
  PatientMedicationReportData,
} from '@/lib/interfaces/data/PatientMedicationReport';
import User from '@/models/User';
import Medicine from '@/models/Medicine';
import MedicationLog from '@/models/MedicationLog';
import FoodLog from '@/models/FoodLog';

export const MEDICATION_REPORT_TITLE =
  'Rx Box: Patient Medication Adherence Report' as const;

export const MEDICATION_REPORT_DISCLAIMER =
  'This report is generated from medication schedules, manual confirmations, and Rx Box tray-removal events. Sensor verification indicates that medicine was removed from the tray but does not medically confirm ingestion. Behavioral and risk results are system-generated adherence-support information and are not a medical diagnosis. Rx Box does not replace professional medical advice, diagnosis, or treatment.';

type RawAnnotation = {
  _id?: { toString(): string } | string;
  type?: string;
  text?: string;
  authorRole?: string;
  authorName?: string;
  createdAt?: Date | string;
};

type ReportLog = {
  _id: mongoose.Types.ObjectId;
  medicineId?: mongoose.Types.ObjectId | null;
  medicineName: string;
  dosage?: string;
  scheduledDate: string;
  scheduledTime: string;
  takenAt?: Date | null;
  status: string;
  source: string;
  lateAfterMinutes?: number;
  windowAfterMinutes?: number;
  expectedChamberId?: number | null;
  expectedChamberIds?: number[];
  detectedChamberId?: number | null;
  countsTowardAdherence?: boolean;
  verificationNote?: string;
  annotations?: RawAnnotation[];
};

function serializeAnnotations(
  annotations: RawAnnotation[] | undefined,
): MedicationReportAnnotation[] {
  const allowedTypes = new Set([
    'patient_note',
    'missed_explanation',
    'family_acknowledgment',
  ]);

  return (annotations ?? [])
    .filter(
      (annotation) =>
        allowedTypes.has(String(annotation.type)) &&
        (annotation.authorRole === 'patient' ||
          annotation.authorRole === 'family'),
    )
    .map((annotation) => ({
      _id: annotation._id?.toString() ?? '',
      type: annotation.type as MedicationReportAnnotation['type'],
      text: String(annotation.text ?? ''),
      authorRole:
        annotation.authorRole as MedicationReportAnnotation['authorRole'],
      authorName:
        String(annotation.authorName ?? '').trim() ||
        (annotation.authorRole === 'patient'
          ? 'Patient'
          : 'Family member'),
      createdAt: new Date(
        annotation.createdAt ?? Date.now(),
      ).toISOString(),
    }))
    .sort(
      (first, second) =>
        new Date(first.createdAt).getTime() -
        new Date(second.createdAt).getTime(),
    );
}

function reportStatus(evaluated: EvaluatedLog): MedicationReportStatus {
  if (evaluated.lifecycle === 'taken') return 'taken';
  if (evaluated.lifecycle === 'late') return 'late';
  if (evaluated.lifecycle === 'missed') return 'missed';
  if (evaluated.lifecycle === 'due') return 'due';
  if (evaluated.lifecycle === 'upcoming') return 'upcoming';

  if (evaluated.lifecycle === 'incorrect_chamber') {
    return 'incorrect_chamber';
  }

  return 'unverified';
}

function reportSource(
  source: string,
): MedicationReportActivityItem['source'] {
  if (source === 'manual') return 'Manual';
  if (source === 'sensor') return 'Rx Box Sensor';

  return 'System';
}

function medicineKey(log: ReportLog): string {
  return (
    log.medicineId?.toString() ||
    `legacy:${log.medicineName}:${log.dosage ?? ''}`
  );
}

function buildPerformance(
  logs: ReportLog[],
  evaluated: EvaluatedLog[],
  regimen: MedicationReportRegimenItem[],
  enginePatterns: MedicationPattern[],
): MedicationReportPerformanceItem[] {
  const groups = new Map<
    string,
    {
      medicineName: string;
      dosage: string;
      schedule: Set<string>;
      totalEligible: number;
      takenOnTime: number;
      takenLate: number;
      missed: number;
      verificationIssues: number;
    }
  >();

  logs.forEach((log, index) => {
    const key = medicineKey(log);

    const item = groups.get(key) ?? {
      medicineName: log.medicineName || 'Unknown medication',
      dosage: log.dosage ?? '',
      schedule: new Set<string>(),
      totalEligible: 0,
      takenOnTime: 0,
      takenLate: 0,
      missed: 0,
      verificationIssues: 0,
    };

    const result = evaluated[index];

    item.schedule.add(log.scheduledTime);

    if (result.eligible) {
      item.totalEligible += 1;

      if (result.lifecycle === 'taken') {
        item.takenOnTime += 1;
      }

      if (result.lifecycle === 'late') {
        item.takenLate += 1;
      }

      if (result.lifecycle === 'missed') {
        item.missed += 1;
      }
    }

    if (
      result.lifecycle === 'incorrect_chamber' ||
      result.lifecycle === 'unverified'
    ) {
      item.verificationIssues += 1;
    }

    groups.set(key, item);
  });

  for (const medicine of regimen) {
    const existing = groups.get(medicine.medicineKey);

    if (existing) {
      medicine.scheduledTimes.forEach((time) =>
        existing.schedule.add(time),
      );

      if (!existing.dosage) {
        existing.dosage = medicine.dosage;
      }
    }
  }

  return Array.from(groups.entries())
    .map(([key, item]) => {
      const enginePattern = enginePatterns.find(
        (pattern) =>
          pattern.medicineId === key ||
          (!pattern.medicineId &&
            pattern.medicineName === item.medicineName),
      );

      return {
        medicineKey: key,
        medicineName: item.medicineName,
        dosage: item.dosage,
        schedule: Array.from(item.schedule).sort().join(', '),
        totalEligible: item.totalEligible,
        takenOnTime: item.takenOnTime,
        takenLate: item.takenLate,
        missed: item.missed,
        verificationIssues: item.verificationIssues,
        adherencePercentage:
          item.totalEligible > 0
            ? (enginePattern?.adherenceRate ?? null)
            : null,
      };
    })
    .sort((first, second) =>
      first.medicineName.localeCompare(second.medicineName),
    );
}

function buildFoodRecommendation(
  condition: string,
  risk: FoodRiskLevel,
): string {
  const guidance = getFoodReminderContent(condition);
  const suggestion = guidance?.eat[0];

  if (risk === 'High') {
    return `Review the high-risk food-monitoring result and consider discussing recurring concerns with a qualified health professional.${
      suggestion
        ? ` Suggested supportive choice: ${suggestion}.`
        : ''
    }`;
  }

  if (risk === 'Moderate') {
    return `Review the condition-specific food choices that contributed to this result.${
      suggestion
        ? ` Suggested supportive choice: ${suggestion}.`
        : ''
    }`;
  }

  return `Continue following the recorded condition-appropriate food routine.${
    suggestion
      ? ` Suggested supportive choice: ${suggestion}.`
      : ''
  }`;
}

export async function buildPatientMedicationReport(input: {
  patientObjectId: string;
  from: string;
  to: string;
  numberOfDays: number;
  now?: Date;
}): Promise<PatientMedicationReportData> {
  if (!mongoose.isValidObjectId(input.patientObjectId)) {
    throw new MedicationReportError('Invalid patient.', 400);
  }

  const generatedAt = input.now ?? new Date();
  const timeZone = resolveMedicationTimeZone('Asia/Manila');
  const today = getMedicationDateKey(generatedAt, timeZone);

  /*
   * A historical report is evaluated at the end of its selected period.
   * A report including today is evaluated using the real current time.
   *
   * This preserves the shared adherence-engine rules for upcoming doses,
   * active medication windows, late doses, and missed doses.
   */
  const analysisNow =
    input.to < today
      ? new Date(
          medicationScheduledAt(
            addDaysToMedicationDateKey(input.to, 1),
            '12:00 AM',
            timeZone,
          ).getTime() - 1,
        )
      : generatedAt;

  const patient = await User.findOne({
    _id: input.patientObjectId,
    role: 'patient',
    isDeleted: { $ne: true },
  })
    .select(
      'firstName middleName lastName patientId condition dataResetAt',
    )
    .lean();

  if (!patient) {
    throw new MedicationReportError('Patient not found.', 404);
  }

  const logQuery: Record<string, unknown> = {
    userId: patient._id,
    scheduledDate: {
      $gte: input.from,
      $lte: input.to,
    },
  };

  if (patient.dataResetAt) {
    logQuery.createdAt = {
      $gt: patient.dataResetAt,
    };
  }

  const foodFrom = medicationScheduledAt(
    input.from,
    '12:00 AM',
    timeZone,
  );

  const foodToExclusive = medicationScheduledAt(
    addDaysToMedicationDateKey(input.to, 1),
    '12:00 AM',
    timeZone,
  );

  /*
   * These are read-only queries. This builder does not create logs,
   * finalize medication status, trigger alerts, or contact hardware.
   */
  const [rawMedicines, rawLogDocuments, rawFoodLogs] =
    await Promise.all([
      Medicine.find({
        userId: patient._id,
        startDate: {
          $lte: input.to,
        },
        $or: [
          {
            endDate: null,
          },
          {
            endDate: '',
          },
          {
            endDate: {
              $gte: input.from,
            },
          },
        ],
      })
        .sort({
          name: 1,
          startDate: 1,
        })
        .lean(),

      MedicationLog.find(logQuery)
        .sort({
          scheduledDate: 1,
          scheduledTime: 1,
          createdAt: 1,
        })
        .lean(),

      FoodLog.find({
        userId: patient._id,
        timestamp: {
          $gte: foodFrom,
          $lt: foodToExclusive,
        },
      })
        .sort({
          timestamp: 1,
        })
        .lean(),
    ]);

  const logs = rawLogDocuments as unknown as ReportLog[];

  const rawLogs: RawLog[] = logs.map((log) => ({
    id: log._id.toString(),
    medicineId: log.medicineId?.toString() ?? null,
    medicineName: log.medicineName,
    status: String(log.status),
    scheduledDate: String(log.scheduledDate),
    scheduledTime: String(log.scheduledTime),
    takenAt: log.takenAt ?? null,
    lateAfterMinutes: log.lateAfterMinutes,
    windowAfterMinutes: log.windowAfterMinutes,
    expectedChamberId: log.expectedChamberId ?? null,
    detectedChamberId: log.detectedChamberId ?? null,
    countsTowardAdherence:
      log.countsTowardAdherence !== false,
  }));

  /*
   * All lifecycle classifications and adherence percentages come from the
   * existing shared adherence engine.
   */
  const evaluated = rawLogs.map((log) =>
    evaluateMedicationLog(log, analysisNow, timeZone),
  );

  const analysis = analyzeAdherence(
    rawLogs,
    analysisNow,
    timeZone,
  );

  const regimen: MedicationReportRegimenItem[] =
    rawMedicines.map((medicine) => ({
      medicineKey: medicine._id.toString(),
      name: medicine.name,
      dosage: medicine.dosage,
      scheduledTimes: [...medicine.scheduledTimes].sort(),
      pillsPerDose: medicine.pillsPerDose ?? 1,
      startDate: medicine.startDate,
      endDate: medicine.endDate || null,
      currentlyActive: medicine.isActive,
      notes: medicine.notes ?? '',
    }));

  const activity: MedicationReportActivityItem[] = logs.map(
    (log, index) => {
      const result = evaluated[index];
      const annotations = serializeAnnotations(log.annotations);

      return {
        rowKey: log._id.toString(),
        medicineName: log.medicineName,
        dosage: log.dosage ?? '',
        scheduledDate: log.scheduledDate,
        scheduledTime: log.scheduledTime,
        finalStatus: reportStatus(result),
        verifiedAt: log.takenAt
          ? new Date(log.takenAt).toISOString()
          : null,
        delayMinutes: result.calculatedDelayMinutes,
        source: reportSource(log.source),
        verificationNote: log.verificationNote ?? '',
        expectedChamberIds:
          log.expectedChamberIds?.length
            ? log.expectedChamberIds
            : log.expectedChamberId
              ? [log.expectedChamberId]
              : [],
        annotations,
        patientNotes: annotations.filter(
          (annotation) =>
            annotation.type === 'patient_note',
        ),
        missedExplanations: annotations.filter(
          (annotation) =>
            annotation.type === 'missed_explanation',
        ),
        familyAcknowledgments: annotations.filter(
          (annotation) =>
            annotation.type === 'family_acknowledgment',
        ),
      };
    },
  );

  const onTime = evaluated.filter(
    (log) =>
      log.eligible && log.lifecycle === 'taken',
  ).length;

  const late = evaluated.filter(
    (log) =>
      log.eligible && log.lifecycle === 'late',
  ).length;

  const missed = evaluated.filter(
    (log) =>
      log.eligible && log.lifecycle === 'missed',
  ).length;

  const foodEntries: FoodLogEntry[] = rawFoodLogs.map(
    (log) => ({
      questionId: log.questionId,
      answer: log.answer,
      score: log.score,
      timestamp: log.timestamp,
    }),
  );

  const foodGroups = new Map<string, FoodLogEntry[]>();

  rawFoodLogs.forEach((log, index) => {
    const key =
      `${log.medicationLogId?.toString() ?? 'none'}:` +
      new Date(log.timestamp).toISOString();

    foodGroups.set(key, [
      ...(foodGroups.get(key) ?? []),
      foodEntries[index],
    ]);
  });

  const foodResults = Array.from(foodGroups.values()).map(
    (entries) => ({
      assessedAt: new Date(entries[0].timestamp),
      result: calculateFoodRisk(
        entries,
        patient.condition ?? 'None',
      ),
    }),
  );

  const latestFoodResult = foodResults.at(-1);

  const overallFoodResult =
    foodEntries.length > 0
      ? calculateFoodRisk(
          foodEntries,
          patient.condition ?? 'None',
        )
      : null;

  const fullName = [
    patient.firstName,
    patient.middleName,
    patient.lastName,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  const referenceId = createHash('sha256')
    .update(
      `${patient._id.toString()}:${input.from}:` +
        `${input.to}:${generatedAt.toISOString()}`,
    )
    .digest('hex')
    .slice(0, 12)
    .toUpperCase();

  return {
    title: MEDICATION_REPORT_TITLE,
    referenceId,
    timeZone,
    generatedAt: generatedAt.toISOString(),
    disclaimer: MEDICATION_REPORT_DISCLAIMER,

    patient: {
      name: fullName || 'Patient',
      patientId: patient.patientId || 'Not assigned',
      condition: patient.condition || 'Not specified',
    },

    period: {
      from: input.from,
      to: input.to,
      numberOfDays: input.numberOfDays,
    },

    regimen,

    summary: {
      totalEligible: analysis.features.totalDue,
      takenOnTime: onTime,
      takenLate: late,
      missed,
      duePending: analysis.features.duePending,
      upcoming: analysis.features.upcomingDoses,
      incorrectChamber:
        analysis.features.incorrectChamberEvents,
      unverified:
        analysis.features.unverifiedEvents,
      totalVerificationIssues:
        analysis.features.incorrectChamberEvents +
        analysis.features.unverifiedEvents,
      adherencePercentage:
        analysis.features.hasSufficientData
          ? analysis.features.adherenceRate
          : null,
      recentAdherencePercentage:
        analysis.features.hasSufficientData
          ? analysis.features.recentAdherenceRate
          : null,
      previousAdherencePercentage:
        analysis.features.trendAvailable
          ? analysis.features.previousAdherenceRate
          : null,
      trend: analysis.features.trend,
      trendAvailable: analysis.features.trendAvailable,
      consecutiveMissed:
        analysis.features.consecutiveMissed,
      averageDelayMinutes:
        analysis.features.avgDelayMinutes,
      riskLevel: analysis.finalRiskLevel,
      riskReasons: analysis.riskReasons,
      insight: analysis.insight,
      recommendation: analysis.recommendation,
      hasSufficientData:
        analysis.features.hasSufficientData,
    },

    performance: buildPerformance(
      logs,
      evaluated,
      regimen,
      analysis.behavioral.byMedication,
    ),

    activity,

    behavioral: {
      hasSufficientData:
        analysis.features.hasSufficientData,
      dailyTrend: analysis.behavioral.dailyTrend,
      timeOfDay: analysis.behavioral.timeOfDay,
      byMedication:
        analysis.behavioral.byMedication,
      insights: analysis.behavioral.insights,
      riskReasons: analysis.riskReasons,
      recommendation: analysis.recommendation,
    },

    foodMonitoring:
      latestFoodResult && overallFoodResult
        ? {
            completedAssessments: foodGroups.size,
            latestRiskLevel:
              latestFoodResult.result.finalRiskLevel,
            resultCounts:
              foodResults.reduce<
                Record<FoodRiskLevel, number>
              >(
                (counts, item) => {
                  counts[
                    item.result.finalRiskLevel
                  ] += 1;

                  return counts;
                },
                {
                  Low: 0,
                  Moderate: 0,
                  High: 0,
                },
              ),
            conditionSpecificSummary:
              overallFoodResult.breakdown.length > 0
                ? overallFoodResult.breakdown
                    .map(
                      (item) =>
                        `${item.category}: ${item.score}%`,
                    )
                    .join(' · ')
                : `Food-monitoring results were evaluated for ${
                    patient.condition ||
                    'the recorded condition'
                  }.`,
            latestRecommendation:
              buildFoodRecommendation(
                patient.condition ?? 'None',
                latestFoodResult.result.finalRiskLevel,
              ),
            latestAssessedAt:
              latestFoodResult.assessedAt.toISOString(),
          }
        : null,
  };
}