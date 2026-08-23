import mongoose from 'mongoose';
import MedicationLog, {
  type IMedicationLogDocument,
} from '@/models/MedicationLog';
import Medicine from '@/models/Medicine';

export type MedicationEventSource =
  | 'manual'
  | 'sensor'
  | 'system';

export type MedicationEventType =
  | 'CHAMBER_OPENED'
  | 'MEDICATION_CONFIRMED'
  | 'MISSED';

export interface MedicationEventInput {
  userId: string;
  source: MedicationEventSource;
  eventType: MedicationEventType;
  timestamp?: string | Date;
  chamberId?: number | null;
  medicineId?: string | null;
  logId?: string | null;
  deviceId?: string | null;
}

export interface VerificationResult {
  verified: boolean;
  status:
    | 'taken'
    | 'late'
    | 'missed'
    | 'unverified'
    | 'incorrect_chamber';
  message: string;
  logId: string;
  medicineName: string;
  scheduledTime: string;
  expectedChamberId: number | null;
  detectedChamberId: number | null;
  expectedChamberIds: number[];
  source: MedicationEventSource;
}

type CandidateLog = {
  _id: mongoose.Types.ObjectId;
  medicineId?: mongoose.Types.ObjectId | null;
  medicineName: string;
  dosage: string;
  scheduledDate: string;
  scheduledTime: string;
  expectedChamberId?: number | null;
  windowBeforeMinutes?: number;
  windowAfterMinutes?: number;
  lateAfterMinutes?: number;
};

export function timeToMinutes(
  time: string
): number {
  const ampm = time.match(
    /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i
  );

  if (ampm) {
    let hour = Number(ampm[1]);
    const minute = Number(ampm[2]);

    if (
      ampm[3].toUpperCase() === 'PM' &&
      hour !== 12
    ) {
      hour += 12;
    }

    if (
      ampm[3].toUpperCase() === 'AM' &&
      hour === 12
    ) {
      hour = 0;
    }

    return hour * 60 + minute;
  }

  const plain = time.match(
    /^(\d{1,2}):(\d{2})$/
  );

  if (!plain) {
    return -1;
  }

  return (
    Number(plain[1]) * 60 +
    Number(plain[2])
  );
}

export function scheduledDateTime(
  date: string,
  time: string
): Date {
  const result = new Date(
    `${date}T00:00:00`
  );

  result.setMinutes(
    timeToMinutes(time)
  );

  return result;
}

function toDateString(
  date: Date
): string {
  return date
    .toISOString()
    .split('T')[0];
}

function addDays(
  date: Date,
  days: number
): Date {
  const result = new Date(date);

  result.setDate(
    result.getDate() + days
  );

  return result;
}

function isValidChamber(
  chamberId:
    | number
    | null
    | undefined
): boolean {
  return (
    chamberId == null ||
    (
      Number.isInteger(chamberId) &&
      chamberId >= 1 &&
      chamberId <= 3
    )
  );
}

export async function ensureMedicationLogsForDate(
  userId: string,
  dateString: string
): Promise<void> {
  const medicines = await Medicine.find({
    userId,
    isActive: true,
    startDate: {
      $lte: dateString,
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
          $gte: dateString,
        },
      },
    ],
  }).lean();

  const logUpdates = medicines.flatMap(
    (medicine) =>
      (
        medicine.scheduledTimes as string[]
      ).map((scheduledTime) =>
        MedicationLog.updateOne(
          {
            userId,
            medicineId:
              medicine._id,
            scheduledDate:
              dateString,
            scheduledTime,
            countsTowardAdherence: {
              $ne: false,
            },
          },
          {
            $setOnInsert: {
              userId,
              medicineId:
                medicine._id,
              medicineName:
                medicine.name,
              dosage:
                medicine.dosage,
              scheduledDate:
                dateString,
              scheduledTime,
              status: 'pending',
              source: 'auto',
              eventType:
                'SCHEDULED',
              expectedChamberId:
                medicine.chamberId ??
                null,
              expectedChamberIds:
                medicine.chamberId
                  ? [
                      medicine.chamberId,
                    ]
                  : [],
              windowBeforeMinutes:
                medicine
                  .windowBeforeMinutes ??
                30,
              windowAfterMinutes:
                medicine
                  .windowAfterMinutes ??
                90,
              lateAfterMinutes:
                medicine
                  .lateAfterMinutes ??
                30,
              countsTowardAdherence:
                true,
            },
          },
          {
            upsert: true,
          }
        )
      )
  );

  if (logUpdates.length > 0) {
    await Promise.all(logUpdates);
  }
}

export async function ensureMedicationLogsForRange(
  userId: string,
  from: string,
  to: string
): Promise<void> {
  const cursor = new Date(
    `${from}T00:00:00`
  );

  const last = new Date(
    `${to}T00:00:00`
  );

  while (cursor <= last) {
    await ensureMedicationLogsForDate(
      userId,
      toDateString(cursor)
    );

    cursor.setDate(
      cursor.getDate() + 1
    );
  }
}

export async function finalizeExpiredMedicationLogs(
  userId: string,
  now = new Date()
): Promise<void> {
  const today = toDateString(now);

  const pending =
    await MedicationLog.find({
      userId,
      scheduledDate: {
        $lte: today,
      },
      status: {
        $in: [
          'pending',
          'reminder',
          'dispensed',
        ],
      },
      countsTowardAdherence: {
        $ne: false,
      },
    });

  const expiredIds = pending
    .filter((log) => {
      const scheduled =
        scheduledDateTime(
          log.scheduledDate,
          log.scheduledTime
        );

      const end = new Date(
        scheduled.getTime() +
          (
            log.windowAfterMinutes ??
            90
          ) *
            60_000
      );

      return now > end;
    })
    .map((log) => log._id);

  if (expiredIds.length > 0) {
    await MedicationLog.updateMany(
      {
        _id: {
          $in: expiredIds,
        },
      },
      {
        $set: {
          status: 'missed',
          source: 'system',
          eventType: 'MISSED',
          verificationNote:
            'No valid medication event was received before the medication window ended.',
        },
      }
    );
  }
}

function distanceFromSchedule(
  log: CandidateLog,
  eventAt: Date
): number {
  return Math.abs(
    eventAt.getTime() -
      scheduledDateTime(
        log.scheduledDate,
        log.scheduledTime
      ).getTime()
  );
}

async function createAuditLog(
  input: MedicationEventInput,
  eventAt: Date,
  status:
    | 'unverified'
    | 'incorrect_chamber',
  expected: CandidateLog | null,
  expectedChamberIds: number[],
  message: string
): Promise<VerificationResult> {
  const log: IMedicationLogDocument =
    await MedicationLog.create({
      userId: input.userId,
      medicineId:
        expected?.medicineId ?? null,
      medicineName:
        expected?.medicineName ??
        'Unmatched medication event',
      dosage:
        expected?.dosage ?? '',
      scheduledDate:
        expected?.scheduledDate ??
        toDateString(eventAt),
      scheduledTime:
        expected?.scheduledTime ??
        eventAt.toLocaleTimeString(
          'en-US',
          {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          }
        ),
      takenAt: eventAt,
      status,
      source: input.source,
      eventType:
        input.eventType,
      sensorDeviceId:
        input.deviceId ?? undefined,
      expectedChamberId:
        expected?.expectedChamberId ??
        null,
      detectedChamberId:
        input.chamberId ?? null,
      expectedChamberIds,
      countsTowardAdherence:
        false,
      verificationNote:
        message,
    });

  return {
    verified: false,
    status,
    message,
    logId:
      log._id.toString(),
    medicineName:
      log.medicineName,
    scheduledTime:
      log.scheduledTime,
    expectedChamberId:
      log.expectedChamberId ?? null,
    detectedChamberId:
      log.detectedChamberId ?? null,
    expectedChamberIds,
    source:
      input.source,
  };
}

export async function processMedicationEvent(
  input: MedicationEventInput
): Promise<VerificationResult> {
  if (
    !mongoose.isValidObjectId(
      input.userId
    )
  ) {
    throw new Error(
      'A valid patient user ID is required.'
    );
  }

  if (
    !isValidChamber(
      input.chamberId
    )
  ) {
    throw new Error(
      'chamberId must be 1, 2, or 3.'
    );
  }

  const eventAt =
    input.timestamp
      ? new Date(input.timestamp)
      : new Date();

  if (
    Number.isNaN(
      eventAt.getTime()
    )
  ) {
    throw new Error(
      'timestamp must be a valid date.'
    );
  }

  const dates =
    [-1, 0, 1].map(
      (offset) =>
        toDateString(
          addDays(
            eventAt,
            offset
          )
        )
    );

  await Promise.all(
    dates.map((date) =>
      ensureMedicationLogsForDate(
        input.userId,
        date
      )
    )
  );

  await finalizeExpiredMedicationLogs(
    input.userId,
    eventAt
  );

  const query: Record<
    string,
    unknown
  > = {
    userId:
      input.userId,
    scheduledDate: {
      $in: dates,
    },
    status: {
      $in: [
        'pending',
        'reminder',
        'dispensed',
      ],
    },
    countsTowardAdherence: {
      $ne: false,
    },
  };

  if (input.logId) {
    if (
      !mongoose.isValidObjectId(
        input.logId
      )
    ) {
      throw new Error(
        'Invalid logId.'
      );
    }

    query._id =
      input.logId;
  }

  const pendingLogs =
    await MedicationLog.find(
      query
    ).lean<CandidateLog[]>();

  const candidates =
    pendingLogs
      .filter((log) => {
        const scheduled =
          scheduledDateTime(
            log.scheduledDate,
            log.scheduledTime
          );

        const start =
          scheduled.getTime() -
          (
            log.windowBeforeMinutes ??
            30
          ) *
            60_000;

        const end =
          scheduled.getTime() +
          (
            log.windowAfterMinutes ??
            90
          ) *
            60_000;

        return (
          eventAt.getTime() >=
            start &&
          eventAt.getTime() <=
            end
        );
      })
      .sort(
        (first, second) =>
          distanceFromSchedule(
            first,
            eventAt
          ) -
          distanceFromSchedule(
            second,
            eventAt
          )
      );

  const expectedChamberIds =
    Array.from(
      new Set(
        candidates
          .map(
            (log) =>
              log.expectedChamberId
          )
          .filter(
            (
              chamber
            ): chamber is number =>
              typeof chamber ===
              'number'
          )
      )
    ).sort(
      (first, second) =>
        first - second
    );

  let target:
    | CandidateLog
    | undefined;

  if (input.logId) {
    target =
      candidates.find(
        (log) =>
          log._id.toString() ===
          input.logId
      );
  } else if (
    input.medicineId
  ) {
    target =
      candidates.find(
        (log) =>
          log.medicineId?.toString() ===
          input.medicineId
      );
  } else if (
    input.chamberId != null
  ) {
    target =
      candidates.find(
        (log) =>
          log.expectedChamberId ===
          input.chamberId
      );
  }

  if (
    input.eventType ===
      'CHAMBER_OPENED' &&
    input.source ===
      'sensor' &&
    input.chamberId == null
  ) {
    return createAuditLog(
      input,
      eventAt,
      'unverified',
      candidates[0] ??
        null,
      expectedChamberIds,
      'Sensor event was recorded but no chamber was provided, so no dose was verified.'
    );
  }

  if (!target) {
    const incorrect =
      input.chamberId != null &&
      candidates.length > 0;

    return createAuditLog(
      input,
      eventAt,
      incorrect
        ? 'incorrect_chamber'
        : 'unverified',
      candidates[0] ??
        null,
      expectedChamberIds,
      incorrect
        ? `Chamber ${input.chamberId} was accessed, but the valid chamber${
            expectedChamberIds.length === 1
              ? ' is'
              : 's are'
          } ${
            expectedChamberIds.join(
              ', '
            ) ||
            'not assigned'
          }.`
        : 'No pending medication matched this event within its configured medication window.'
    );
  }

  if (
    input.chamberId != null &&
    target.expectedChamberId !=
      null &&
    input.chamberId !==
      target.expectedChamberId
  ) {
    return createAuditLog(
      input,
      eventAt,
      'incorrect_chamber',
      target,
      expectedChamberIds,
      `Chamber ${input.chamberId} was accessed instead of chamber ${target.expectedChamberId}.`
    );
  }

  const scheduled =
    scheduledDateTime(
      target.scheduledDate,
      target.scheduledTime
    );

  const delayMinutes =
    Math.round(
      (
        eventAt.getTime() -
        scheduled.getTime()
      ) /
        60_000
    );

  const status =
    input.eventType ===
    'MISSED'
      ? 'missed'
      : delayMinutes >
          (
            target.lateAfterMinutes ??
            30
          )
        ? 'late'
        : 'taken';

  const updated =
    await MedicationLog.findOneAndUpdate(
      {
        _id:
          target._id,
        status: {
          $in: [
            'pending',
            'reminder',
            'dispensed',
          ],
        },
      },
      {
        $set: {
          status,
          takenAt:
            status === 'missed'
              ? null
              : eventAt,
          source:
            input.source,
          eventType:
            input.eventType,
          sensorDeviceId:
            input.deviceId ??
            undefined,
          detectedChamberId:
            input.chamberId ??
            null,
          expectedChamberIds,
          verificationNote:
            status === 'late'
              ? `Medication access was verified ${delayMinutes} minutes after the scheduled time.`
              : status ===
                  'missed'
                ? 'Medication was marked missed by an authorized event.'
                : 'Medication access was verified within the configured time window.',
        },
      },
      {
        new: true,
      }
    );

  if (!updated) {
    throw new Error(
      'This medication schedule was already finalized.'
    );
  }

  return {
    verified:
      status === 'taken' ||
      status === 'late',
    status,
    message:
      updated.verificationNote ||
      `Medication marked ${status}.`,
    logId:
      updated._id.toString(),
    medicineName:
      updated.medicineName,
    scheduledTime:
      updated.scheduledTime,
    expectedChamberId:
      updated.expectedChamberId ??
      null,
    detectedChamberId:
      updated.detectedChamberId ??
      null,
    expectedChamberIds,
    source:
      input.source,
  };
}