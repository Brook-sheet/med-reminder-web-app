import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import MedicationLog from '@/models/MedicationLog';
import User from '@/models/User';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import type { ApiResponse } from '@/lib/interfaces/data/Api';
import {
  ensureMedicationLogsForRange,
  finalizeExpiredMedicationLogs,
  processMedicationEvent,
} from '@/lib/medicationVerification';
import { evaluateMedicationLog } from '@/lib/adherenceEngine';
import {
  addDaysToMedicationDateKey,
  getMedicationDateKey,
  medicationScheduledAt,
  resolveMedicationTimeZone,
} from '@/lib/medicationTime';

export const dynamic = 'force-dynamic';

type ReportRange =
  | 'today'
  | 'week'
  | 'month'
  | 'custom';

type ReportStatus =
  | 'upcoming'
  | 'due'
  | 'pending'
  | 'taken'
  | 'late'
  | 'missed'
  | 'unverified'
  | 'incorrect_chamber';

async function getAuthUser(
  request: NextRequest,
) {
  const token =
    getTokenFromRequest(request);

  if (!token) return null;

  return verifyToken(token);
}

function resolveRange(
  request: NextRequest,
  now: Date,
  timeZone: string,
): {
  range: ReportRange;
  from: string;
  to: string;
} {
  const range = (
    request.nextUrl.searchParams.get(
      'range',
    ) || 'month'
  ) as ReportRange;

  if (
    ![
      'today',
      'week',
      'month',
      'custom',
    ].includes(range)
  ) {
    throw new Error(
      'range must be today, week, month, or custom.',
    );
  }

  const to =
    getMedicationDateKey(
      now,
      timeZone,
    );

  if (range === 'today') {
    return {
      range,
      from: to,
      to,
    };
  }

  if (range === 'week') {
    return {
      range,

      from:
        addDaysToMedicationDateKey(
          to,
          -6,
        ),

      to,
    };
  }

  if (range === 'month') {
    return {
      range,

      from:
        `${to.slice(0, 7)}-01`,

      to,
    };
  }

  const from =
    request.nextUrl.searchParams.get(
      'from',
    ) || '';

  const customTo =
    request.nextUrl.searchParams.get(
      'to',
    ) || '';

  const datePattern =
    /^\d{4}-\d{2}-\d{2}$/;

  if (
    !datePattern.test(from) ||
    !datePattern.test(customTo) ||
    from > customTo
  ) {
    throw new Error(
      'Custom range requires valid from and to dates in YYYY-MM-DD format.',
    );
  }

  const days = Math.ceil(
    (
      new Date(
        `${customTo}T00:00:00Z`,
      ).getTime() -
      new Date(
        `${from}T00:00:00Z`,
      ).getTime()
    ) /
      86_400_000,
  );

  if (days > 366) {
    throw new Error(
      'Custom range cannot exceed 366 days.',
    );
  }

  return {
    range,
    from,
    to: customTo,
  };
}

function normalizeStatus(
  log: {
    status: string;
    scheduledDate: string;
    scheduledTime: string;
    takenAt?: Date | null;
    lateAfterMinutes?: number;
    windowAfterMinutes?: number;
    countsTowardAdherence?: boolean;
  },
  now: Date,
  timeZone: string,
): {
  status: ReportStatus;
  delayMinutes: number | null;
} {
  const evaluated =
    evaluateMedicationLog(
      {
        status:
          log.status,

        scheduledDate:
          log.scheduledDate,

        scheduledTime:
          log.scheduledTime,

        takenAt:
          log.takenAt,

        lateAfterMinutes:
          log.lateAfterMinutes,

        windowAfterMinutes:
          log.windowAfterMinutes,

        countsTowardAdherence:
          log.countsTowardAdherence,
      },
      now,
      timeZone,
    );

  if (
    evaluated.lifecycle ===
    'incorrect_chamber'
  ) {
    return {
      status:
        'incorrect_chamber',

      delayMinutes:
        evaluated.calculatedDelayMinutes,
    };
  }

  if (
    evaluated.lifecycle ===
      'unverified' ||
    evaluated.lifecycle ===
      'audit'
  ) {
    return {
      status:
        'unverified',

      delayMinutes:
        evaluated.calculatedDelayMinutes,
    };
  }

  if (
    evaluated.lifecycle ===
    'taken'
  ) {
    return {
      status:
        'taken',

      delayMinutes:
        evaluated.calculatedDelayMinutes,
    };
  }

  if (
    evaluated.lifecycle ===
    'late'
  ) {
    return {
      status:
        'late',

      delayMinutes:
        evaluated.calculatedDelayMinutes,
    };
  }

  if (
    evaluated.lifecycle ===
    'upcoming'
  ) {
    return {
      status:
        'upcoming',

      delayMinutes:
        null,
    };
  }

  if (
    evaluated.lifecycle ===
    'due'
  ) {
    return {
      status:
        'due',

      delayMinutes:
        null,
    };
  }

  if (
    evaluated.lifecycle ===
    'missed'
  ) {
    return {
      status:
        'missed',

      delayMinutes:
        null,
    };
  }

  return {
    status:
      'pending',

    delayMinutes:
      null,
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

    const now = new Date();

    const timeZone =
      resolveMedicationTimeZone();

    const selectedRange =
      resolveRange(
        request,
        now,
        timeZone,
      );

    await connectDB();

    await ensureMedicationLogsForRange(
      auth.userId,
      selectedRange.from,
      selectedRange.to,
    );

    await finalizeExpiredMedicationLogs(
      auth.userId,
      now,
    );

    const user =
      await User.findById(
        auth.userId,
      ).select(
        'dataResetAt',
      );

    const query:
      Record<string, unknown> = {
        userId:
          auth.userId,

        scheduledDate: {
          $gte:
            selectedRange.from,

          $lte:
            selectedRange.to,
        },
      };

    if (user?.dataResetAt) {
      query.createdAt = {
        $gt:
          user.dataResetAt,
      };
    }

    const rawLogs =
      await MedicationLog.find(
        query,
      )
        .sort({
          scheduledDate: -1,
          scheduledTime: -1,
          createdAt: -1,
        })
        .lean();

    rawLogs.sort(
      (first, second) =>
        medicationScheduledAt(
          String(
            second.scheduledDate,
          ),
          String(
            second.scheduledTime,
          ),
          timeZone,
        ).getTime() -
        medicationScheduledAt(
          String(
            first.scheduledDate,
          ),
          String(
            first.scheduledTime,
          ),
          timeZone,
        ).getTime(),
    );

    const logs =
      rawLogs.map((log) => {
        const normalized =
          normalizeStatus(
            {
              status:
                String(log.status),

              scheduledDate:
                String(
                  log.scheduledDate,
                ),

              scheduledTime:
                String(
                  log.scheduledTime,
                ),

              takenAt:
                log.takenAt ?? null,

              lateAfterMinutes:
                log.lateAfterMinutes,

              windowAfterMinutes:
                log.windowAfterMinutes,

              countsTowardAdherence:
                log.countsTowardAdherence !==
                false,
            },
            now,
            timeZone,
          );

        return {
          _id:
            log._id.toString(),

          medicineId:
            log.medicineId
              ?.toString() ?? null,

          medicineName:
            log.medicineName,

          dosage:
            log.dosage,

          scheduledDate:
            log.scheduledDate,

          scheduledTime:
            log.scheduledTime,

          actualTime:
            log.takenAt ?? null,

          status:
            normalized.status,

          delayMinutes:
            normalized.delayMinutes,

          source:
            log.source === 'auto'
              ? 'system'
              : log.source,

          verificationMethod:
            log.source === 'sensor'
              ? 'Sensor verification'
              : log.source === 'manual'
                ? 'Manual verification'
                : 'System',

          expectedChamberId:
            log.expectedChamberId ??
            null,

          detectedChamberId:
            log.detectedChamberId ??
            null,

          expectedChamberIds:
            log.expectedChamberIds ??
            [],

          countsTowardAdherence:
            log.countsTowardAdherence !==
            false,

          verificationNote:
            log.verificationNote ??
            '',
        };
      });

    const scheduledLogs =
      logs.filter(
        (log) =>
          log.countsTowardAdherence,
      );

    const dueLogs =
      scheduledLogs.filter(
        (log) =>
          [
            'taken',
            'late',
            'missed',
          ].includes(
            log.status,
          ),
      );

    const onTime =
      dueLogs.filter(
        (log) =>
          log.status === 'taken',
      ).length;

    const late =
      dueLogs.filter(
        (log) =>
          log.status === 'late',
      ).length;

    const missed =
      dueLogs.filter(
        (log) =>
          log.status === 'missed',
      ).length;

    const unverified =
      logs.filter(
        (log) =>
          log.status ===
          'unverified',
      ).length;

    const incorrectChamber =
      logs.filter(
        (log) =>
          log.status ===
          'incorrect_chamber',
      ).length;

    const adherenceRate:
      number | null =
        dueLogs.length > 0
          ? Math.round(
              (
                (
                  onTime +
                  late * 0.5
                ) /
                dueLogs.length
              ) *
                100,
            )
          : null;

    const medicineMap =
      new Map<
        string,
        {
          medicineId:
            string | null;

          medicineName:
            string;

          scheduled:
            number;

          verified:
            number;

          onTime:
            number;

          late:
            number;

          missed:
            number;

          incorrectChamber:
            number;
        }
      >();

    for (const log of logs) {
      const key =
        log.medicineId ||
        log.medicineName;

      const item =
        medicineMap.get(key) || {
          medicineId:
            log.medicineId,

          medicineName:
            log.medicineName,

          scheduled:
            0,

          verified:
            0,

          onTime:
            0,

          late:
            0,

          missed:
            0,

          incorrectChamber:
            0,
        };

      if (
        log.countsTowardAdherence &&
        [
          'taken',
          'late',
          'missed',
        ].includes(log.status)
      ) {
        item.scheduled += 1;

        if (
          log.status === 'taken'
        ) {
          item.onTime += 1;
        }

        if (
          log.status === 'late'
        ) {
          item.late += 1;
        }

        if (
          log.status === 'taken' ||
          log.status === 'late'
        ) {
          item.verified += 1;
        }

        if (
          log.status === 'missed'
        ) {
          item.missed += 1;
        }
      }

      if (
        log.status ===
        'incorrect_chamber'
      ) {
        item.incorrectChamber += 1;
      }

      medicineMap.set(
        key,
        item,
      );
    }

    const byMedicine =
      Array.from(
        medicineMap.values(),
      )
        .filter(
          (item) =>
            item.scheduled > 0 ||
            item.incorrectChamber > 0,
        )
        .map((item) => ({
          ...item,

          adherenceRate:
            item.scheduled > 0
              ? Math.round(
                  (
                    (
                      item.onTime +
                      item.late * 0.5
                    ) /
                    item.scheduled
                  ) *
                    100,
                )
              : null,
        }))
        .sort(
          (a, b) =>
            a.medicineName.localeCompare(
              b.medicineName,
            ),
        );

    return NextResponse.json<ApiResponse>({
      success:
        true,

      data: {
        range:
          selectedRange,

        summary: {
          totalScheduled:
            dueLogs.length,

          verified:
            onTime + late,

          onTime,

          late,

          missed,

          unverified,

          incorrectChamber,

          adherenceRate,
        },

        byMedicine,

        logs,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Internal server error';

    const clientError =
      /range|Custom/i.test(
        message,
      );

    console.error(
      '[GET /api/history]',
      error,
    );

    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: message,
      },
      {
        status:
          clientError
            ? 400
            : 500,
      },
    );
  }
}

export async function PATCH(
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

    const body =
      await request.json() as {
        logId?: string;
        status?: string;
      };

    if (
      !body.logId ||
      ![
        'taken',
        'missed',
      ].includes(
        body.status || '',
      )
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            'logId and a status of taken or missed are required.',
        },
        {
          status: 400,
        },
      );
    }

    const result =
      await processMedicationEvent({
        userId:
          auth.userId,

        source:
          'manual',

        eventType:
          body.status === 'missed'
            ? 'MISSED'
            : 'MEDICATION_CONFIRMED',

        logId:
          body.logId,
      });

    if (
      body.status === 'taken' &&
      !result.verified
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success:
            false,

          error:
            result.message,

          data:
            result,
        },
        {
          status:
            409,
        },
      );
    }

    return NextResponse.json<ApiResponse>({
      success:
        true,

      data:
        result,

      message:
        result.message,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Internal server error';

    console.error(
      '[PATCH /api/history]',
      error,
    );

    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: message,
      },
      {
        status: 400,
      },
    );
  }
}