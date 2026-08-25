import mongoose from 'mongoose';
import MedicationLog, {
  type IMedicationLogDocument,
} from '@/models/MedicationLog';
import Medicine from '@/models/Medicine';
import { processMedicationAlertEvent } from '@/lib/alertEngine';
import {
  addDaysToMedicationDateKey,
  formatMedicationTime,
  getMedicationDateKey,
  medicationScheduledAt,
  parseMedicationTimeToMinutes,
  resolveMedicationTimeZone,
} from '@/lib/medicationTime';

export type MedicationEventSource =
  | 'manual'
  | 'sensor'
  | 'system';

export type MedicationEventType =
  | 'CHAMBER_OPENED'
  | 'MEDICATION_DISPENSED'
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
    | 'dispensed'
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

type FinalMedicationStatus =
  | 'taken'
  | 'late'
  | 'missed'
  | 'incorrect_chamber';

type FinalMedicationLog = {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  medicineId?: mongoose.Types.ObjectId | null;
  medicineName: string;
  scheduledDate: string;
  scheduledTime: string;
  takenAt?: Date | null;
  status: FinalMedicationStatus;
  detectedChamberId?: number | null;
  expectedChamberId?: number | null;
  expectedChamberIds?: number[];
  verificationNote?: string;
};

const UNRESOLVED_STATUSES = [
  'pending',
  'reminder',
  'dispensed',
] as const;

function finalAlertDetails(
  log: FinalMedicationLog
) {
  switch (log.status) {
    case 'taken':
      return {
        eventType: 'MEDICATION_VERIFIED' as const,
        title: 'Medication taken',
      };

    case 'late':
      return {
        eventType: 'MEDICATION_LATE' as const,
        title: 'Medication taken late',
      };

    case 'missed':
      return {
        eventType: 'MEDICATION_MISSED' as const,
        title: 'Medication missed',
      };

    case 'incorrect_chamber':
      return {
        eventType: 'MEDICATION_EVENT_WARNING' as const,
        title: 'Incorrect medication access',
      };
  }
}

async function sendFinalStatusAlert(
  log: FinalMedicationLog,
  occurredAt: Date
): Promise<void> {
  const details =
    finalAlertDetails(log);

  await processMedicationAlertEvent({
    // alertEngine also normalizes final medication events to this key.
    // Keeping it deterministic makes repeated processing idempotent.
    eventKey:
      `medication-final:${log._id.toString()}`,

    patientId:
      log.userId.toString(),

    medicationId:
      log.medicineId?.toString() ?? null,

    medicationLogId:
      log._id.toString(),

    medicineName:
      log.medicineName,

    scheduledTime:
      log.scheduledTime,

    occurredAt,

    eventType:
      details.eventType,

    title:
      details.title,

    message:
      log.status === 'incorrect_chamber'
        ? log.verificationNote
        : undefined,

    metadata: {
      finalStatus:
        log.status,

      scheduledDate:
        log.scheduledDate,

      scheduledTime:
        log.scheduledTime,

      takenAt:
        log.takenAt?.toISOString() ?? null,

      expectedChamberId:
        log.expectedChamberId ?? null,

      detectedChamberId:
        log.detectedChamberId ?? null,

      verificationNote:
        log.verificationNote ?? '',
    },
  });
}

export const timeToMinutes =
  parseMedicationTimeToMinutes;

export function scheduledDateTime(
  date: string,
  time: string,
  requestedTimeZone?: string | null,
): Date {
  return medicationScheduledAt(
    date,
    time,
    requestedTimeZone,
  );
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
  let cursor = from;

  while (cursor <= to) {
    await ensureMedicationLogsForDate(
      userId,
      cursor
    );

    cursor = addDaysToMedicationDateKey(
      cursor,
      1,
    );
  }
}

export async function finalizeExpiredMedicationLogs(
  userId: string,
  now = new Date()
): Promise<void> {
  const timeZone =
    resolveMedicationTimeZone();

  const today = getMedicationDateKey(
    now,
    timeZone,
  );

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

  const expiredLogs = pending.filter(
    (log) => {
      const scheduled =
        scheduledDateTime(
          log.scheduledDate,
          log.scheduledTime,
          timeZone,
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
    }
  );

  for (const expiredLog of expiredLogs) {
    const updated =
      await MedicationLog.findOneAndUpdate(
        {
          _id:
            expiredLog._id,

          status: {
            $in:
              UNRESOLVED_STATUSES,
          },
        },
        {
          $set: {
            status:
              'missed',

            source:
              'system',

            eventType:
              'MISSED',

            verificationNote:
              'No valid medication event was received before the medication window ended.',
          },
        },
        {
          new: true,
        }
      );

    if (!updated) {
      continue;
    }

    try {
      await sendFinalStatusAlert(
        updated as FinalMedicationLog,
        now
      );
    } catch (error) {
      // The medication state is already safely finalized. A notification
      // provider failure must not roll the dose back to pending.
      console.error(
        '[Medication Verification] Missed family alert failed:',
        {
          medicationLogId:
            updated._id.toString(),

          error,
        }
      );
    }
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
        log.scheduledTime,
        resolveMedicationTimeZone(),
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
      userId:
        input.userId,

      medicineId:
        expected?.medicineId ?? null,

      medicineName:
        expected?.medicineName ??
        'Unmatched medication event',

      dosage:
        expected?.dosage ?? '',

      scheduledDate:
        expected?.scheduledDate ??
        getMedicationDateKey(
          eventAt,
          resolveMedicationTimeZone(),
        ),

      scheduledTime:
        expected?.scheduledTime ??
        formatMedicationTime(
          eventAt,
          resolveMedicationTimeZone(),
        ),

      takenAt:
        eventAt,

      status,

      source:
        input.source,

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

async function finalizeIncorrectAccess(
  input: MedicationEventInput,
  eventAt: Date,
  target: CandidateLog,
  expectedChamberIds: number[],
  message: string
): Promise<VerificationResult> {
  const updated =
    await MedicationLog.findOneAndUpdate(
      {
        _id:
          target._id,

        status: {
          $in:
            UNRESOLVED_STATUSES,
        },
      },
      {
        $set: {
          status:
            'incorrect_chamber',

          takenAt:
            eventAt,

          source:
            input.source,

          eventType:
            input.eventType,

          sensorDeviceId:
            input.deviceId ?? undefined,

          detectedChamberId:
            input.chamberId ?? null,

          expectedChamberIds,

          verificationNote:
            message,
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

  await sendFinalStatusAlert(
    updated as FinalMedicationLog,
    eventAt
  );

  return {
    verified: false,

    status:
      'incorrect_chamber',

    message:
      updated.verificationNote ||
      message,

    logId:
      updated._id.toString(),

    medicineName:
      updated.medicineName,

    scheduledTime:
      updated.scheduledTime,

    expectedChamberId:
      updated.expectedChamberId ?? null,

    detectedChamberId:
      updated.detectedChamberId ?? null,

    expectedChamberIds,

    source:
      input.source,
  };
}

function resultFromFinalLog(
  log: FinalMedicationLog,
  source: MedicationEventSource
): VerificationResult {
  return {
    verified:
      log.status === 'taken' ||
      log.status === 'late',

    status:
      log.status,

    message:
      log.verificationNote ||
      `Medication marked ${log.status}.`,

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

    expectedChamberIds:
      log.expectedChamberIds ??
      (
        log.expectedChamberId == null
          ? []
          : [
              log.expectedChamberId,
            ]
      ),

    source,
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

  const timeZone =
    resolveMedicationTimeZone();

  const eventDate =
    getMedicationDateKey(
      eventAt,
      timeZone,
    );

  const dates =
    [-1, 0, 1].map(
      (offset) =>
        addDaysToMedicationDateKey(
          eventDate,
          offset,
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

  if (input.logId) {
    const existingFinalLog =
      await MedicationLog.findOne({
        _id:
          input.logId,

        userId:
          input.userId,

        status: {
          $in: [
            'taken',
            'late',
            'missed',
            'incorrect_chamber',
          ],
        },
      }).lean<FinalMedicationLog | null>();

    if (existingFinalLog) {
      await sendFinalStatusAlert(
        existingFinalLog,
        existingFinalLog.takenAt ??
          eventAt
      );

      return resultFromFinalLog(
        existingFinalLog,
        input.source
      );
    }
  }

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
            log.scheduledTime,
            timeZone,
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

    if (incorrect) {
      const expected =
        candidates[0];

      const message =
        `Chamber ${input.chamberId} was accessed, but the valid chamber${
          expectedChamberIds.length === 1
            ? ' is'
            : 's are'
        } ${
          expectedChamberIds.join(
            ', '
          ) ||
          'not assigned'
        }.`;

      return finalizeIncorrectAccess(
        input,
        eventAt,
        expected,
        expectedChamberIds,
        message
      );
    }

    return createAuditLog(
      input,
      eventAt,
      'unverified',
      candidates[0] ??
        null,
      expectedChamberIds,
      'No pending medication matched this event within its configured medication window.'
    );
  }

  if (
    input.chamberId != null &&
    target.expectedChamberId !=
      null &&
    input.chamberId !==
      target.expectedChamberId
  ) {
    return finalizeIncorrectAccess(
      input,
      eventAt,
      target,
      expectedChamberIds,
      `Chamber ${input.chamberId} was accessed instead of chamber ${target.expectedChamberId}.`
    );
  }

  const scheduled =
    scheduledDateTime(
      target.scheduledDate,
      target.scheduledTime,
      timeZone,
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
      'MEDICATION_DISPENSED'
      ? 'dispensed'
      : input.eventType ===
          'MISSED'
        ? 'missed'
        : delayMinutes >
            (
              target.lateAfterMinutes ??
              30
            )
          ? 'late'
          : 'taken';

  if (
    status === 'missed'
  ) {
    const windowEndsAt =
      new Date(
        scheduled.getTime() +
          (
            target.windowAfterMinutes ??
            90
          ) *
            60_000
      );

    if (
      eventAt <= windowEndsAt
    ) {
      throw new Error(
        'Medication cannot be marked missed until its medication window has expired.'
      );
    }
  }

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
            status === 'missed' ||
            status === 'dispensed'
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
            status === 'dispensed'
              ? 'Medication was dispensed and is waiting for intake confirmation.'
              : status === 'late'
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

  if (
    status !== 'dispensed'
  ) {
    await sendFinalStatusAlert(
      updated as FinalMedicationLog,
      eventAt
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