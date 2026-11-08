// lib/medicationVerification.ts

import mongoose from 'mongoose';

import MedicationLog, {
  type IMedicationLogDocument,
} from '@/models/MedicationLog';

import Medicine, {
  type IMedicineDocument,
} from '@/models/Medicine';

import {
  processMedicationAlertEvent,
} from '@/lib/alertEngine';

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

  /**
   * Only the authenticated Rx Box plan/group handler
   * may set this option.
   */
  allowHardwareMissedBeforeWindowEnd?: boolean;
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
  expectedChamberIds?: number[];
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
  log: FinalMedicationLog,
) {
  switch (log.status) {
    case 'taken':
      return {
        eventType:
          'MEDICATION_VERIFIED' as const,
        title: 'Medication taken',
      };

    case 'late':
      return {
        eventType:
          'MEDICATION_LATE' as const,
        title: 'Medication taken late',
      };

    case 'missed':
      return {
        eventType:
          'MEDICATION_MISSED' as const,
        title: 'Medication missed',
      };

    case 'incorrect_chamber':
      return {
        eventType:
          'MEDICATION_EVENT_WARNING' as const,
        title:
          'Incorrect medication access',
      };
  }
}

async function sendFinalStatusAlert(
  log: FinalMedicationLog,
  occurredAt: Date,
): Promise<void> {
  const details =
    finalAlertDetails(log);

  await processMedicationAlertEvent({
    /*
     * A deterministic key prevents duplicate final alerts.
     */
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
  chamberId: number | null | undefined,
): boolean {
  return (
    chamberId == null ||
    (
      Number.isInteger(chamberId) &&
      chamberId >= 1 &&
      chamberId <= 4
    )
  );
}

type ScheduleMedicine = Pick<
  IMedicineDocument,
  | 'isActive'
  | 'startDate'
  | 'endDate'
  | 'scheduledTimes'
  | 'name'
  | 'dosage'
  | 'windowBeforeMinutes'
  | 'windowAfterMinutes'
  | 'lateAfterMinutes'
>;

type ScheduleLog = Pick<
  IMedicationLogDocument,
  | 'status'
  | 'eventType'
  | 'scheduledTime'
  | 'countsTowardAdherence'
  | 'medicineName'
  | 'dosage'
  | 'windowBeforeMinutes'
  | 'windowAfterMinutes'
  | 'lateAfterMinutes'
  | 'expectedChamberId'
  | 'expectedChamberIds'
>;

function currentScheduledTimes(
  medicine: ScheduleMedicine,
  date: string,
): string[] {
  if (
    !medicine.isActive ||
    medicine.startDate > date ||
    (
      medicine.endDate &&
      medicine.endDate < date
    )
  ) {
    return [];
  }

  return [
    ...new Map(
      medicine.scheduledTimes.map(
        (time) => [
          timeToMinutes(time),
          time.trim().toUpperCase(),
        ],
      ),
    ).values(),
  ].filter(
    (time) => timeToMinutes(time) >= 0,
  );
}

function isMovableScheduledLog(
  log: ScheduleLog,
): boolean {
  return (
    (
      log.status === 'pending' ||
      log.status === 'reminder'
    ) &&
    log.eventType === 'SCHEDULED'
  );
}

function hasCurrentMedicineDetails(
  log: ScheduleLog,
  medicine: ScheduleMedicine,
): boolean {
  return (
    log.medicineName === medicine.name &&
    log.dosage === medicine.dosage &&

    log.windowBeforeMinutes ===
      medicine.windowBeforeMinutes &&

    log.windowAfterMinutes ===
      medicine.windowAfterMinutes &&

    log.lateAfterMinutes ===
      medicine.lateAfterMinutes
  );
}

/**
 * Read-only check.
 *
 * An unchanged dashboard/device refresh does not
 * need a transaction or medication-log writes.
 */
function needsScheduleSynchronization(
  medicine: ScheduleMedicine,
  date: string,
  logs: ScheduleLog[],
): boolean {
  const times =
    currentScheduledTimes(
      medicine,
      date,
    );

  const minutes = new Set(
    times.map(timeToMinutes),
  );

  const activeByMinute = new Map<
    number,
    ScheduleLog[]
  >();

  for (const log of logs) {
    const minute =
      timeToMinutes(
        log.scheduledTime,
      );

    const movable =
      isMovableScheduledLog(log);

    if (
      movable &&
      !minutes.has(minute)
    ) {
      if (
        log.countsTowardAdherence !== false ||
        log.expectedChamberId != null ||
        log.expectedChamberIds?.length
      ) {
        return true;
      }
    }

    if (
      log.countsTowardAdherence === false
    ) {
      continue;
    }

    const group =
      activeByMinute.get(minute) ?? [];

    group.push(log);
    activeByMinute.set(minute, group);
  }

  for (const minute of minutes) {
    const group =
      activeByMinute.get(minute) ?? [];

    if (group.length === 0) {
      return true;
    }

    if (
      group.length > 1 &&
      group.some(
        isMovableScheduledLog,
      )
    ) {
      return true;
    }

    if (
      group.some(
        (log) =>
          isMovableScheduledLog(log) &&
          !hasCurrentMedicineDetails(
            log,
            medicine,
          ),
      )
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Called inside the medicine edit/repair transaction.
 *
 * Ordinary pending time edits retain the dose log ID.
 * Completed and dispensed outcomes are preserved.
 */
export async function synchronizeMedicineLogs(
  medicine: IMedicineDocument,
  date: string,
  session: mongoose.ClientSession,
): Promise<void> {
  const times =
    currentScheduledTimes(
      medicine,
      date,
    );

  const minutes = new Set(
    times.map(timeToMinutes),
  );

  const logs =
    await MedicationLog.find({
      userId: medicine.userId,
      medicineId: medicine._id,
      scheduledDate: date,
    }).session(session);

  const priority = (
    log: IMedicationLogDocument,
  ) =>
    log.countsTowardAdherence === false
      ? -1
      : log.status === 'pending'
        ? 0
        : log.status === 'reminder'
          ? 1
          : log.status === 'dispensed'
            ? 2
            : 3;

  logs.sort(
    (first, second) =>
      priority(second) -
        priority(first) ||
      first._id
        .toString()
        .localeCompare(
          second._id.toString(),
        ),
  );

  const used = new Set<string>();

  const obsolete = logs.filter(
    (log) =>
      isMovableScheduledLog(log) &&
      !minutes.has(
        timeToMinutes(
          log.scheduledTime,
        ),
      ),
  );

  for (const time of times) {
    const minute =
      timeToMinutes(time);

    let log = logs.find(
      (item) =>
        !used.has(
          item._id.toString(),
        ) &&
        timeToMinutes(
          item.scheduledTime,
        ) === minute &&
        (
          item.countsTowardAdherence !== false ||
          isMovableScheduledLog(item)
        ),
    );

    if (!log) {
      log = obsolete.find(
        (item) =>
          !used.has(
            item._id.toString(),
          ),
      );
    }

    const fields = {
      medicineName:
        medicine.name,

      dosage:
        medicine.dosage,

      windowBeforeMinutes:
        medicine.windowBeforeMinutes,

      windowAfterMinutes:
        medicine.windowAfterMinutes,

      lateAfterMinutes:
        medicine.lateAfterMinutes,
    };

    if (log) {
      used.add(
        log._id.toString(),
      );

      if (
        !isMovableScheduledLog(log)
      ) {
        continue;
      }

      const moved =
        timeToMinutes(
          log.scheduledTime,
        ) !== minute;

      const changed =
        moved ||
        log.countsTowardAdherence === false ||
        !hasCurrentMedicineDetails(
          log,
          medicine,
        );

      /*
       * Avoid rewriting an unchanged pending dose.
       * Keep its existing chamber assignment too.
       */
      if (!changed) {
        continue;
      }

      await MedicationLog.updateOne(
        {
          _id: log._id,
        },
        {
          $set: {
            ...fields,

            scheduledTime:
              moved
                ? time
                : log.scheduledTime,

            countsTowardAdherence:
              true,

            ...(
              moved
                ? {
                    status: 'pending',
                    expectedChamberId: null,
                    expectedChamberIds: [],
                  }
                : {}
            ),
          },
        },
        { session },
      );
    } else {
      /*
       * Insert only a genuinely missing dose slot.
       * A normal pending time edit reuses a log above.
       */
      const [created] =
        await MedicationLog.create(
          [
            {
              ...fields,

              userId:
                medicine.userId,

              medicineId:
                medicine._id,

              scheduledDate:
                date,

              scheduledTime:
                time,

              status:
                'pending',

              source:
                'auto',

              eventType:
                'SCHEDULED',

              countsTowardAdherence:
                true,

              expectedChamberId:
                null,

              expectedChamberIds:
                [],
            },
          ],
          { session },
        );

      used.add(
        created._id.toString(),
      );
    }
  }

  /*
   * Retire only obsolete planned records that still
   * need an update. Previously retired records are
   * not rewritten on every synchronization.
   */
  const retired = logs
    .filter(
      (log) =>
        isMovableScheduledLog(log) &&
        !used.has(
          log._id.toString(),
        ) &&
        (
          log.countsTowardAdherence !== false ||
          log.expectedChamberId != null ||
          log.expectedChamberIds?.length
        ),
    )
    .map(
      (log) => log._id,
    );

  if (retired.length > 0) {
    await MedicationLog.updateMany(
      {
        _id: {
          $in: retired,
        },
      },
      {
        $set: {
          countsTowardAdherence: false,
          expectedChamberId: null,
          expectedChamberIds: [],
        },
      },
      { session },
    );
  }
}

/**
 * Check historical dates with two batched reads.
 *
 * Existing history is never rewritten.
 * Only genuinely missing historical slots can
 * be inserted, using the existing unique index.
 */
async function ensureHistoricalMedicationLogs(
  userId: string,
  from: string,
  to: string,
): Promise<void> {
  if (from > to) {
    return;
  }

  const [medicines, logs] =
    await Promise.all([
      Medicine.find({
        userId,
        isActive: true,
      }).lean(),

      MedicationLog.find({
        userId,

        scheduledDate: {
          $gte: from,
          $lte: to,
        },
      })
        .select(
          'medicineId scheduledDate scheduledTime',
        )
        .lean(),
    ]);

  const existing = new Set(
    logs.map(
      (log) =>
        `${
          log.medicineId?.toString()
        }:${
          log.scheduledDate
        }:${
          timeToMinutes(
            log.scheduledTime,
          )
        }`,
    ),
  );

  for (const medicine of medicines) {
    const lastEditDate =
      getMedicationDateKey(
        medicine.updatedAt,
      );

    let date = from;

    while (date <= to) {
      /*
       * Keep the previous history protection:
       * do not backfill an edited prescription into
       * dates before that edit.
       */
      if (lastEditDate <= date) {
        for (
          const time of
          currentScheduledTimes(
            medicine,
            date,
          )
        ) {
          const key =
            `${
              medicine._id.toString()
            }:${
              date
            }:${
              timeToMinutes(time)
            }`;

          if (existing.has(key)) {
            continue;
          }

          try {
            await MedicationLog.updateOne(
              {
                userId,

                medicineId:
                  medicine._id,

                scheduledDate:
                  date,

                scheduledTime:
                  time,
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
                    date,

                  scheduledTime:
                    time,

                  status:
                    'pending',

                  source:
                    'auto',

                  eventType:
                    'SCHEDULED',

                  countsTowardAdherence:
                    true,

                  expectedChamberId:
                    null,

                  expectedChamberIds:
                    [],

                  windowBeforeMinutes:
                    medicine.windowBeforeMinutes,

                  windowAfterMinutes:
                    medicine.windowAfterMinutes,

                  lateAfterMinutes:
                    medicine.lateAfterMinutes,
                },
              },
              {
                upsert: true,
              },
            );
          } catch (error) {
            /*
             * A concurrent request may have inserted
             * this same unique historical slot first.
             */
            if (
              typeof error !== 'object' ||
              error === null ||
              !('code' in error) ||
              error.code !== 11000
            ) {
              throw error;
            }
          }

          existing.add(key);
        }
      }

      date =
        addDaysToMedicationDateKey(
          date,
          1,
        );
    }
  }
}

export async function ensureMedicationLogsForDate(
  userId: string,
  dateString: string,
): Promise<void> {
  const today =
    getMedicationDateKey();

  if (dateString < today) {
    await ensureHistoricalMedicationLogs(
      userId,
      dateString,
      dateString,
    );

    return;
  }

  /*
   * Check existing data first.
   * These are reads, not transactions.
   */
  const [medicines, logs] =
    await Promise.all([
      Medicine.find({
        userId,
        isActive: true,
      }).lean(),

      MedicationLog.find({
        userId,
        scheduledDate: dateString,
      }).lean(),
    ]);

  const logsByMedicine = new Map<
    string,
    typeof logs
  >();

  for (const log of logs) {
    const medicineId =
      log.medicineId?.toString();

    if (!medicineId) {
      continue;
    }

    const group =
      logsByMedicine.get(
        medicineId,
      ) ?? [];

    group.push(log);

    logsByMedicine.set(
      medicineId,
      group,
    );
  }

  for (const item of medicines) {
    const needsSynchronization =
      needsScheduleSynchronization(
        item,
        dateString,
        logsByMedicine.get(
          item._id.toString(),
        ) ?? [],
      );

    /*
     * An unchanged refresh stops here.
     * No medicine lock, transaction, or log write.
     */
    if (!needsSynchronization) {
      continue;
    }

    /*
     * Missing or stale slots still use a transaction
     * so concurrent medicine edits remain protected.
     */
    await mongoose.connection.transaction(
      async (session) => {
        const medicine =
          await Medicine.findOneAndUpdate(
            {
              _id: item._id,
              userId,
              isActive: true,
            },
            {
              $inc: {
                __v: 1,
              },
            },
            {
              new: true,
              session,
              timestamps: false,
            },
          );

        if (!medicine) {
          return;
        }

        /*
         * Use the freshly locked medicine.
         * Never apply the old precheck snapshot.
         */
        await synchronizeMedicineLogs(
          medicine,
          dateString,
          session,
        );
      },
    );
  }
}

export async function ensureMedicationLogsForRange(
  userId: string,
  from: string,
  to: string,
): Promise<void> {
  if (from > to) {
    return;
  }

  const today =
    getMedicationDateKey();

  /*
   * Process the historical range together instead
   * of running one transaction per medicine per day.
   */
  if (from < today) {
    const yesterday =
      addDaysToMedicationDateKey(
        today,
        -1,
      );

    await ensureHistoricalMedicationLogs(
      userId,
      from,
      to < today
        ? to
        : yesterday,
    );
  }

  let cursor =
    from < today
      ? today
      : from;

  while (cursor <= to) {
    await ensureMedicationLogsForDate(
      userId,
      cursor,
    );

    cursor =
      addDaysToMedicationDateKey(
        cursor,
        1,
      );
  }
}

/**
 * Changes unresolved logs into missed after
 * their configured medication window expires.
 */
export async function finalizeExpiredMedicationLogs(
  userId: string,
  now = new Date(),
): Promise<void> {
  const timeZone =
    resolveMedicationTimeZone();

  const today =
    getMedicationDateKey(
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

  const expiredLogs =
    pending.filter(
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
          ) * 60_000,
        );

        return now > end;
      },
    );

  for (
    const expiredLog of expiredLogs
  ) {
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

            outcomeRecordedAt:
              new Date(),

            source:
              'system',

            eventType:
              'MISSED',

            verificationNote:
              'No valid medication event was received before the medication window ended.',
          },
        },
        { new: true },
      );

    if (!updated) {
      continue;
    }

    try {
      await sendFinalStatusAlert(
        updated as FinalMedicationLog,
        now,
      );
    } catch (error) {
      console.error(
        '[Medication Verification] Missed family alert failed:',
        {
          medicationLogId:
            updated._id.toString(),
          error,
        },
      );
    }
  }
}

function distanceFromSchedule(
  log: CandidateLog,
  eventAt: Date,
): number {
  return Math.abs(
    eventAt.getTime() -
    scheduledDateTime(
      log.scheduledDate,
      log.scheduledTime,
      resolveMedicationTimeZone(),
    ).getTime(),
  );
}

/**
 * Creates an audit record for an event that
 * cannot safely finalize a scheduled dose.
 */
async function createAuditLog(
  input: MedicationEventInput,
  eventAt: Date,

  status:
    | 'unverified'
    | 'incorrect_chamber',

  expected: CandidateLog | null,
  expectedChamberIds: number[],
  message: string,
): Promise<VerificationResult> {
  const log:
    IMedicationLogDocument =
      await MedicationLog.create({
        userId:
          input.userId,

        medicineId:
          expected?.medicineId ??
          null,

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
          input.deviceId ??
          undefined,

        expectedChamberId:
          expected?.expectedChamberId ??
          null,

        detectedChamberId:
          input.chamberId ??
          null,

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
      log.expectedChamberId ??
      null,

    detectedChamberId:
      log.detectedChamberId ??
      null,

    expectedChamberIds,

    source:
      input.source,
  };
}

/**
 * Legacy chamber-access handling.
 *
 * The tray ultrasonic sensor cannot identify
 * an individual chamber.
 */
async function finalizeIncorrectAccess(
  input: MedicationEventInput,
  eventAt: Date,
  target: CandidateLog,
  expectedChamberIds: number[],
  message: string,
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
            input.deviceId ??
            undefined,

          detectedChamberId:
            input.chamberId ??
            null,

          expectedChamberIds,

          verificationNote:
            message,
        },
      },
      { new: true },
    );

  if (!updated) {
    throw new Error(
      'This medication schedule was already finalized.',
    );
  }

  await sendFinalStatusAlert(
    updated as FinalMedicationLog,
    eventAt,
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

function resultFromFinalLog(
  log: FinalMedicationLog,
  source: MedicationEventSource,
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
      log.expectedChamberId ??
      null,

    detectedChamberId:
      log.detectedChamberId ??
      null,

    expectedChamberIds:
      log.expectedChamberIds ??
      (
        log.expectedChamberId == null
          ? []
          : [log.expectedChamberId]
      ),

    source,
  };
}

export async function processMedicationEvent(
  input: MedicationEventInput,
): Promise<VerificationResult> {
  if (
    !mongoose.isValidObjectId(
      input.userId,
    )
  ) {
    throw new Error(
      'A valid patient user ID is required.',
    );
  }

  if (
    !isValidChamber(
      input.chamberId,
    )
  ) {
    throw new Error(
      'chamberId must be 1, 2, 3, or 4.',
    );
  }

  const eventAt =
    input.timestamp
      ? new Date(input.timestamp)
      : new Date();

  if (
    Number.isNaN(
      eventAt.getTime(),
    )
  ) {
    throw new Error(
      'timestamp must be a valid date.',
    );
  }

  const timeZone =
    resolveMedicationTimeZone();

  const eventDate =
    getMedicationDateKey(
      eventAt,
      timeZone,
    );

  /*
   * Medication windows may cross midnight.
   */
  const dates = [-1, 0, 1].map(
    (offset) =>
      addDaysToMedicationDateKey(
        eventDate,
        offset,
      ),
  );

  await Promise.all(
    dates.map(
      (date) =>
        ensureMedicationLogsForDate(
          input.userId,
          date,
        ),
    ),
  );

  await finalizeExpiredMedicationLogs(
    input.userId,
    eventAt,
  );

  /*
   * Preserve and return already finalized logs.
   */
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
      }).lean<
        FinalMedicationLog | null
      >();

    if (existingFinalLog) {
      await sendFinalStatusAlert(
        existingFinalLog,
        existingFinalLog.takenAt ??
          eventAt,
      );

      return resultFromFinalLog(
        existingFinalLog,
        input.source,
      );
    }
  }

  const query:
    Record<string, unknown> = {
      userId:
        input.userId,

      scheduledDate: {
        $in:
          dates,
      },

      status: {
        $in: [
          'pending',
          'reminder',
          'dispensed',
        ],
      },

      countsTowardAdherence: {
        $ne:
          false,
      },
    };

  if (input.logId) {
    if (
      !mongoose.isValidObjectId(
        input.logId,
      )
    ) {
      throw new Error(
        'Invalid logId.',
      );
    }

    query._id = input.logId;
  }

  const pendingLogs =
    await MedicationLog.find(
      query,
    ).lean<CandidateLog[]>();

  const candidates =
    pendingLogs
      .filter(
        (log) => {
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
            ) * 60_000;

          const end =
            scheduled.getTime() +
            (
              log.windowAfterMinutes ??
              90
            ) * 60_000;

          return (
            eventAt.getTime() >= start &&
            eventAt.getTime() <= end
          );
        },
      )
      .sort(
        (first, second) =>
          distanceFromSchedule(
            first,
            eventAt,
          ) -
          distanceFromSchedule(
            second,
            eventAt,
          ),
      );

  const expectedChamberIds =
    Array.from(
      new Set(
        candidates
          .flatMap(
            (log) =>
              log.expectedChamberIds?.length
                ? log.expectedChamberIds
                : log.expectedChamberId == null
                  ? []
                  : [log.expectedChamberId],
          )
          .filter(
            (
              chamber,
            ): chamber is number =>
              typeof chamber === 'number',
          ),
      ),
    ).sort(
      (first, second) =>
        first - second,
    );

  let target:
    CandidateLog | undefined;

  /*
   * Authenticated Rx Box group events use
   * exact medication log IDs.
   */
  if (input.logId) {
    target = candidates.find(
      (log) =>
        log._id.toString() ===
        input.logId,
    );
  } else if (input.medicineId) {
    target = candidates.find(
      (log) =>
        log.medicineId?.toString() ===
        input.medicineId,
    );
  } else if (
    input.chamberId != null
  ) {
    target = candidates.find(
      (log) =>
        log.expectedChamberId ===
        input.chamberId,
    );
  }

  /*
   * Normal tray pickup events use
   * MEDICATION_CONFIRMED with exact group log IDs.
   */
  if (
    input.eventType === 'CHAMBER_OPENED' &&
    input.source === 'sensor' &&
    input.chamberId == null
  ) {
    return createAuditLog(
      input,
      eventAt,
      'unverified',
      candidates[0] ?? null,
      expectedChamberIds,
      'Sensor event was recorded but no chamber was provided, so no dose was verified.',
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
          expectedChamberIds.join(', ') ||
          'not assigned'
        }.`;

      return finalizeIncorrectAccess(
        input,
        eventAt,
        expected,
        expectedChamberIds,
        message,
      );
    }

    return createAuditLog(
      input,
      eventAt,
      'unverified',
      candidates[0] ?? null,
      expectedChamberIds,
      'No pending medication matched this event within its configured medication window.',
    );
  }

  if (
    input.chamberId != null &&
    target.expectedChamberId != null &&
    input.chamberId !==
      target.expectedChamberId
  ) {
    return finalizeIncorrectAccess(
      input,
      eventAt,
      target,
      expectedChamberIds,
      `Chamber ${input.chamberId} was accessed instead of chamber ${target.expectedChamberId}.`,
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
      ) / 60_000,
    );

  const status =
    input.eventType ===
      'MEDICATION_DISPENSED'
      ? 'dispensed'
      : input.eventType === 'MISSED'
        ? 'missed'
        : delayMinutes >
            (
              target.lateAfterMinutes ??
              30
            )
          ? 'late'
          : 'taken';

  /*
   * Manual or unrelated calls cannot mark a dose
   * missed before its medication window expires.
   */
  if (status === 'missed') {
    const windowEndsAt =
      new Date(
        scheduled.getTime() +
        (
          target.windowAfterMinutes ??
          90
        ) * 60_000,
      );

    if (
      eventAt <= windowEndsAt &&
      !input.allowHardwareMissedBeforeWindowEnd
    ) {
      throw new Error(
        'Medication cannot be marked missed until its medication window has expired.',
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

          ...(
            status !== 'dispensed'
              ? {
                  outcomeRecordedAt:
                    new Date(),
                }
              : {}
          ),

          /*
           * Dispensed means waiting for pickup.
           * Missed events also do not receive takenAt.
           */
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
                : status === 'missed'
                  ? 'Medication was marked missed by an authorized event.'
                  : 'Medication access was verified within the configured time window.',
        },
      },
      { new: true },
    );

  if (!updated) {
    throw new Error(
      'This medication schedule was already finalized.',
    );
  }

  /*
   * Dispensed is an intermediate state.
   */
  if (status !== 'dispensed') {
    await sendFinalStatusAlert(
      updated as FinalMedicationLog,
      eventAt,
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