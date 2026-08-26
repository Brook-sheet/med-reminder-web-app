// lib/rxBoxDailyPlan.ts
import MedicationLog from '@/models/MedicationLog';
import Medicine from '@/models/Medicine';

import {
  ensureMedicationLogsForDate,
} from '@/lib/medicationVerification';

import {
  getMedicationDateKey,
  parseMedicationTimeToMinutes,
  resolveMedicationTimeZone,
} from '@/lib/medicationTime';

import {
  buildRxBoxDailyPlan,
  type RxBoxDailyPlan,
  type RxBoxDoseInput,
} from '@/lib/rxBoxPlanCore';

export * from '@/lib/rxBoxPlanCore';

const FINAL_LOG_STATUSES = new Set([
  'taken',
  'late',
  'missed',
  'incorrect_chamber',
]);

function getLogPriority(
  status: string
): number {
  if (
    FINAL_LOG_STATUSES.has(
      status
    )
  ) {
    return 3;
  }

  if (
    status === 'dispensed'
  ) {
    return 2;
  }

  if (
    status === 'reminder'
  ) {
    return 1;
  }

  return 0;
}

/**
 * Chooses one medication log when legacy duplicate records
 * exist for the same medicine, date, and scheduled time.
 *
 * Finalized records are preferred so an already completed
 * dose cannot become pending again. If both records have the
 * same status priority, the lower ObjectId is used to keep the
 * result deterministic.
 */
function shouldReplaceDose(
  existing: RxBoxDoseInput,
  candidate: RxBoxDoseInput
): boolean {
  const existingPriority =
    getLogPriority(
      existing.logStatus
    );

  const candidatePriority =
    getLogPriority(
      candidate.logStatus
    );

  if (
    candidatePriority !==
    existingPriority
  ) {
    return (
      candidatePriority >
      existingPriority
    );
  }

  return (
    candidate.logId.localeCompare(
      existing.logId
    ) < 0
  );
}

export async function getRxBoxDailyPlan(
  userId: string,
  deviceId: string,
  options: {
    date?: string;
    now?: Date;
    timezone?: string;
  } = {}
): Promise<RxBoxDailyPlan> {
  const timezone =
    resolveMedicationTimeZone(
      options.timezone
    );

  const date =
    options.date ??
    getMedicationDateKey(
      options.now ??
        new Date(),
      timezone
    );

  /*
   * Make sure logs for the medicine's current schedule
   * exist before the loading plan is generated.
   */
  await ensureMedicationLogsForDate(
    userId,
    date
  );

  const medicines =
    await Medicine.find({
      userId,
      isActive: true,

      startDate: {
        $lte: date,
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
            $gte: date,
          },
        },
      ],
    })
      /*
       * scheduledTimes is required here so logs left behind
       * by previous schedule edits can be excluded.
       */
      .select(
        '_id name dosage scheduledTimes pillsPerDose createdAt'
      )
      .lean();

  const medicineById =
    new Map(
      medicines.map(
        (medicine) => [
          medicine._id.toString(),
          medicine,
        ]
      )
    );

  /*
   * Store the current valid schedule minutes for each
   * medicine. Comparing by minute also handles harmless
   * formatting differences such as letter casing.
   */
  const scheduledMinutesByMedicineId =
    new Map<
      string,
      Set<number>
    >();

  for (
    const medicine of
    medicines
  ) {
    const medicineId =
      medicine._id.toString();

    const validMinutes =
      new Set(
        (
          medicine.scheduledTimes ??
          []
        )
          .map((time) =>
            parseMedicationTimeToMinutes(
              time
            )
          )
          .filter(
            (minutes) =>
              minutes >= 0
          )
      );

    scheduledMinutesByMedicineId.set(
      medicineId,
      validMinutes
    );
  }

  const logs =
    await MedicationLog.find({
      userId,
      scheduledDate: date,

      medicineId: {
        $in: medicines.map(
          (medicine) =>
            medicine._id
        ),
      },

      countsTowardAdherence: {
        $ne: false,
      },
    }).lean();

  /*
   * One entry represents one currently scheduled occurrence:
   *
   * medicineId + scheduled minute
   *
   * pillsPerDose is expanded into separate chambers later by
   * buildRxBoxDailyPlan(). It must not be represented by
   * duplicate MedicationLog documents.
   */
  const doseByOccurrence =
    new Map<
      string,
      RxBoxDoseInput
    >();

  for (const log of logs) {
    const medicineId =
      log.medicineId
        ?.toString() ??
      '';

    const medicine =
      medicineById.get(
        medicineId
      );

    if (!medicine) {
      continue;
    }

    const scheduledMinutes =
      parseMedicationTimeToMinutes(
        log.scheduledTime
      );

    if (
      scheduledMinutes < 0
    ) {
      continue;
    }

    const currentScheduleMinutes =
      scheduledMinutesByMedicineId.get(
        medicineId
      );

    /*
     * This is the main stale-log fix.
     *
     * If the medicine was changed from 8:00 AM to 9:00 AM,
     * the old 8:00 AM log is no longer part of the current
     * schedule and must not receive a chamber.
     */
    if (
      !currentScheduleMinutes?.has(
        scheduledMinutes
      )
    ) {
      continue;
    }

    const candidate:
      RxBoxDoseInput = {
        logId:
          log._id.toString(),

        medicineId,

        /*
         * Use the medicine's current details instead of
         * stale name or dosage snapshots from an old log.
         */
        medicineName:
          medicine.name,

        dosage:
          medicine.dosage,

        scheduledTime:
          log.scheduledTime,

        pillsPerDose:
          medicine.pillsPerDose ??
          1,

        medicineCreatedAt:
          medicine.createdAt,

        logStatus:
          log.status,
      };

    const occurrenceKey =
      `${medicineId}:${scheduledMinutes}`;

    const existing =
      doseByOccurrence.get(
        occurrenceKey
      );

    if (
      !existing ||
      shouldReplaceDose(
        existing,
        candidate
      )
    ) {
      doseByOccurrence.set(
        occurrenceKey,
        candidate
      );
    }
  }

  const doses =
    Array.from(
      doseByOccurrence.values()
    );

  const plan =
    buildRxBoxDailyPlan(
      doses,
      {
        deviceId,
        date,
        timezone,
      }
    );

  const chambersByLogId =
    new Map<
      string,
      number[]
    >();

  if (
    !plan.capacity.exceeded
  ) {
    for (
      const item of
      plan.loadingPlan
    ) {
      const chambers =
        chambersByLogId.get(
          item.logId
        ) ?? [];

      chambers.push(
        item.chamberId
      );

      chambersByLogId.set(
        item.logId,
        chambers
      );
    }
  }

  /*
   * Update all today's logs.
   *
   * Stale logs that are no longer in the current medicine
   * schedule receive no expected chambers, while valid logs
   * receive their newly ordered chamber assignments.
   */
  if (logs.length > 0) {
    await MedicationLog.bulkWrite(
      logs.map((log) => {
        const expectedChamberIds =
          chambersByLogId.get(
            log._id.toString()
          ) ?? [];

        return {
          updateOne: {
            filter: {
              _id: log._id,
            },

            update: {
              $set: {
                expectedChamberId:
                  expectedChamberIds[0] ??
                  null,

                expectedChamberIds,
              },
            },
          },
        };
      }),
      {
        ordered: false,
      }
    );
  }

  return plan;
}