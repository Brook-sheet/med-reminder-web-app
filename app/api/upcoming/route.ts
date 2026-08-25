import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Medicine from '@/models/Medicine';
import MedicationLog from '@/models/MedicationLog';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import type { ApiResponse } from '@/lib/interfaces/data/Api';
import { evaluateMedicationLog } from '@/lib/adherenceEngine';
import {
  addDaysToMedicationDateKey,
  formatMedicationDateLabel,
  getMedicationDateKey,
  medicationScheduledAt,
  parseMedicationTimeToMinutes,
  resolveMedicationTimeZone,
} from '@/lib/medicationTime';

export const dynamic = 'force-dynamic';

async function getAuthUser(
  request: NextRequest,
) {
  const token =
    getTokenFromRequest(request);

  if (!token) return null;

  return verifyToken(token);
}

function formatDate(
  dateString: string,
): string {
  return formatMedicationDateLabel(
    dateString,
    {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    },
  );
}

export interface UpcomingItem {
  medicineId: string;
  medicineName: string;
  dosage: string;
  notes?: string;
  scheduledDate: string;
  scheduledDateFormatted: string;
  scheduledTime: string;
  status: 'Upcoming' | 'Scheduled';
  logId?: string;
}

export async function GET(
  request: NextRequest,
) {
  try {
    const user =
      await getAuthUser(request);

    if (!user) {
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

    const todayString =
      getMedicationDateKey(
        now,
        timeZone,
      );

    const medicines =
      await Medicine.find({
        userId:
          user.userId,

        isActive:
          true,
      });

    const upcomingItems:
      UpcomingItem[] = [];

    const lookAheadDays =
      30;

    const lastDate =
      addDaysToMedicationDateKey(
        todayString,
        lookAheadDays,
      );

    const medicineIds =
      medicines.map(
        (medicine) =>
          medicine._id,
      );

    const existingLogs =
      await MedicationLog.find({
        userId:
          user.userId,

        medicineId: {
          $in:
            medicineIds,
        },

        scheduledDate: {
          $gte:
            todayString,

          $lte:
            lastDate,
        },

        countsTowardAdherence: {
          $ne:
            false,
        },
      }).lean();

    const logBySchedule =
      new Map(
        existingLogs.map(
          (log) => [
            `${log.medicineId?.toString()}:${log.scheduledDate}:${log.scheduledTime}`,
            log,
          ],
        ),
      );

    for (
      const medicine of medicines
    ) {
      const startDate =
        medicine.startDate ||
        todayString;

      const endDate =
        medicine.endDate || '';

      for (
        let index = 0;
        index <= lookAheadDays;
        index += 1
      ) {
        const checkDateString =
          addDaysToMedicationDateKey(
            todayString,
            index,
          );

        if (
          checkDateString <
          startDate
        ) {
          continue;
        }

        if (
          endDate &&
          checkDateString >
            endDate
        ) {
          continue;
        }

        for (
          const time of
          medicine.scheduledTimes
        ) {
          const scheduledAt =
            medicationScheduledAt(
              checkDateString,
              time,
              timeZone,
            );

          if (
            Number.isNaN(
              scheduledAt.getTime(),
            ) ||
            scheduledAt <= now
          ) {
            continue;
          }

          const existingLog =
            logBySchedule.get(
              `${medicine._id.toString()}:${checkDateString}:${time}`,
            );

          if (existingLog) {
            const evaluated =
              evaluateMedicationLog(
                {
                  status:
                    String(
                      existingLog.status,
                    ),

                  scheduledDate:
                    String(
                      existingLog.scheduledDate,
                    ),

                  scheduledTime:
                    String(
                      existingLog.scheduledTime,
                    ),

                  takenAt:
                    existingLog.takenAt ??
                    null,

                  lateAfterMinutes:
                    existingLog
                      .lateAfterMinutes,

                  windowAfterMinutes:
                    existingLog
                      .windowAfterMinutes,

                  countsTowardAdherence:
                    existingLog
                      .countsTowardAdherence !==
                    false,
                },
                now,
                timeZone,
              );

            if (
              evaluated.lifecycle !==
              'upcoming'
            ) {
              continue;
            }
          }

          const isToday =
            checkDateString ===
            todayString;

          const status:
            | 'Upcoming'
            | 'Scheduled' =
              isToday
                ? 'Upcoming'
                : 'Scheduled';

          upcomingItems.push({
            medicineId:
              medicine._id.toString(),

            medicineName:
              medicine.name,

            dosage:
              medicine.dosage,

            notes:
              typeof medicine.notes ===
                'string'
                ? medicine.notes.trim()
                : '',

            scheduledDate:
              checkDateString,

            scheduledDateFormatted:
              isToday
                ? 'Today'
                : formatDate(
                    checkDateString,
                  ),

            scheduledTime:
              time,

            status,

            logId:
              existingLog?._id
                ?.toString(),
          });
        }
      }
    }

    upcomingItems.sort(
      (first, second) => {
        if (
          first.scheduledDate !==
          second.scheduledDate
        ) {
          return first.scheduledDate.localeCompare(
            second.scheduledDate,
          );
        }

        return (
          parseMedicationTimeToMinutes(
            first.scheduledTime,
          ) -
          parseMedicationTimeToMinutes(
            second.scheduledTime,
          )
        );
      },
    );

    const limitedItems =
      upcomingItems.slice(
        0,
        20,
      );

    return NextResponse.json<ApiResponse>({
      success:
        true,

      data:
        limitedItems,
    });
  } catch (error) {
    console.error(
      '[GET /api/upcoming]',
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