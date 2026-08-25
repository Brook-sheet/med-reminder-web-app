import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Medicine from '@/models/Medicine';
import MedicationLog from '@/models/MedicationLog';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import type { ApiResponse } from '@/lib/interfaces/data/Api';
import type {
  DashboardStats,
  ScheduleItem,
  WeeklyDayData,
} from '@/lib/interfaces/data/Dashboard';
import {
  analyzeAdherence,
  evaluateMedicationLog,
  parseTimeToMinutes,
  type RawLog,
} from '@/lib/adherenceEngine';
import {
  ensureMedicationLogsForDate,
  ensureMedicationLogsForRange,
  finalizeExpiredMedicationLogs,
} from '@/lib/medicationVerification';
import {
  addDaysToMedicationDateKey,
  formatMedicationDateLabel,
  getMedicationDateKey,
  resolveMedicationTimeZone,
} from '@/lib/medicationTime';

export const dynamic = 'force-dynamic';

async function getAuthUser(
  request: NextRequest,
) {
  const token = getTokenFromRequest(request);

  return token
    ? verifyToken(token)
    : null;
}

function toRawLog(log: {
  _id: {
    toString(): string;
  };

  medicineId?: {
    toString(): string;
  } | null;

  medicineName: string;
  status: string;
  scheduledDate: string;
  scheduledTime: string;
  takenAt?: Date | null;
  lateAfterMinutes?: number;
  windowAfterMinutes?: number;
  expectedChamberId?: number | null;
  detectedChamberId?: number | null;
  countsTowardAdherence?: boolean;
}): RawLog {
  return {
    id:
      log._id.toString(),

    medicineId:
      log.medicineId?.toString() ?? null,

    medicineName:
      log.medicineName,

    status:
      String(log.status),

    scheduledDate:
      String(log.scheduledDate),

    scheduledTime:
      String(log.scheduledTime),

    takenAt:
      log.takenAt ?? null,

    lateAfterMinutes:
      log.lateAfterMinutes,

    windowAfterMinutes:
      log.windowAfterMinutes,

    expectedChamberId:
      log.expectedChamberId ?? null,

    detectedChamberId:
      log.detectedChamberId ?? null,

    countsTowardAdherence:
      log.countsTowardAdherence !== false,
  };
}

export async function GET(
  request: NextRequest,
) {
  try {
    const auth =
      await getAuthUser(request);

    if (!auth) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'Unauthorized',
        },
        {
          status: 401,
        },
      );
    }

    await connectDB();

    const now = new Date();

    const timeZone =
      resolveMedicationTimeZone();

    const today =
      getMedicationDateKey(
        now,
        timeZone,
      );

    const sixDaysAgo =
      addDaysToMedicationDateKey(
        today,
        -6,
      );

    await ensureMedicationLogsForDate(
      auth.userId,
      today,
    );

    await ensureMedicationLogsForRange(
      auth.userId,
      sixDaysAgo,
      today,
    );

    await finalizeExpiredMedicationLogs(
      auth.userId,
      now,
    );

    const medicines =
      await Medicine.find({
        userId:
          auth.userId,

        isActive:
          true,
      }).lean();

    const activeMedicineIds =
      medicines.map(
        (medicine) =>
          medicine._id,
      );

    const medicineNotes =
      new Map(
        medicines.map(
          (medicine) => [
            medicine._id.toString(),

            typeof medicine.notes ===
              'string'
              ? medicine.notes.trim()
              : '',
          ],
        ),
      );

    const todayLogs =
      await MedicationLog.find({
        userId:
          auth.userId,

        scheduledDate:
          today,

        medicineId: {
          $in:
            activeMedicineIds,
        },

        countsTowardAdherence: {
          $ne:
            false,
        },
      }).lean();

    todayLogs.sort(
      (first, second) =>
        parseTimeToMinutes(
          first.scheduledTime,
        ) -
        parseTimeToMinutes(
          second.scheduledTime,
        ),
    );

    const evaluatedToday =
      todayLogs.map((log) => ({
        log,

        evaluated:
          evaluateMedicationLog(
            toRawLog(log),
            now,
            timeZone,
          ),
      }));

    const todaySchedule:
      ScheduleItem[] =
        evaluatedToday.map(
          ({
            log,
            evaluated,
          }) => {
            let status:
              ScheduleItem['status'] =
                'Scheduled';

            if (
              evaluated.lifecycle ===
                'taken' ||
              evaluated.lifecycle ===
                'late'
            ) {
              status = 'Taken';
            }

            if (
              evaluated.lifecycle ===
              'late'
            ) {
              status = 'Late';
            }

            if (
              evaluated.lifecycle ===
              'missed'
            ) {
              status = 'Missed';
            }

            if (
              evaluated.lifecycle ===
              'due'
            ) {
              status = 'Now';
            }

            if (
              evaluated.lifecycle ===
              'upcoming'
            ) {
              status = 'Upcoming';
            }

            if (
              evaluated.lifecycle ===
              'incorrect_chamber'
            ) {
              status =
                'Wrong Chamber';
            }

            const medicineId =
              log.medicineId
                ?.toString() ?? '';

            return {
              medicineId,

              name:
                `${log.medicineName} ${log.dosage}`.trim(),

              dosage:
                log.dosage,

              notes:
                medicineNotes.get(
                  medicineId,
                ) || '',

              time:
                log.scheduledTime,

              status,

              logId:
                log._id.toString(),
            };
          },
        );

    const next =
      evaluatedToday
        .filter(
          ({ evaluated }) =>
            evaluated.lifecycle ===
            'upcoming',
        )
        .sort(
          (a, b) =>
            a.evaluated.scheduledAt.getTime() -
            b.evaluated.scheduledAt.getTime(),
        )[0];

    const weeklyLogs =
      await MedicationLog.find({
        userId:
          auth.userId,

        scheduledDate: {
          $gte:
            sixDaysAgo,

          $lte:
            today,
        },
      }).lean();

    const weeklyRaw =
      weeklyLogs.map(toRawLog);

    const weeklyData:
      WeeklyDayData[] = [];

    for (
      let offset = 6;
      offset >= 0;
      offset -= 1
    ) {
      const key =
        addDaysToMedicationDateKey(
          today,
          -offset,
        );

      const dayAnalysis =
        analyzeAdherence(
          weeklyRaw.filter(
            (log) =>
              log.scheduledDate === key,
          ),
          now,
          timeZone,
        );

      weeklyData.push({
        day:
          formatMedicationDateLabel(
            key,
            {
              weekday: 'short',
            },
          ),

        taken:
          dayAnalysis.features
            .totalTaken,

        total:
          dayAnalysis.features
            .totalDue,
      });
    }

    const allLogs =
      await MedicationLog.find({
        userId:
          auth.userId,
      }).lean();

    const analysis =
      analyzeAdherence(
        allLogs.map(toRawLog),
        now,
        timeZone,
      );

    const stats:
      DashboardStats = {
        adherenceRate:
          analysis.features
            .hasSufficientData
            ? analysis.features
                .adherenceRate
            : null,

        todayProgress: {
          taken:
            evaluatedToday.filter(
              ({ evaluated }) =>
                evaluated.lifecycle ===
                  'taken' ||
                evaluated.lifecycle ===
                  'late',
            ).length,

          total:
            evaluatedToday.length,
        },

        nextReminder:
          next
            ? {
                time:
                  next.log
                    .scheduledTime,

                medicineName:
                  `${next.log.medicineName} ${next.log.dosage}`.trim(),
              }
            : null,

        weeklyData,

        todaySchedule,
      };

    return NextResponse.json<ApiResponse>({
      success:
        true,

      data:
        stats,
    });
  } catch (error) {
    console.error(
      '[GET /api/dashboard]',
      error,
    );

    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: 'Internal server error',
      },
      {
        status: 500,
      },
    );
  }
}