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
      .select(
        '_id name dosage pillsPerDose createdAt'
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

  const logs =
    await MedicationLog.find({
      userId,
      scheduledDate: date,
      medicineId: {
        $in:
          medicines.map(
            (medicine) =>
              medicine._id
          ),
      },
      countsTowardAdherence: {
        $ne: false,
      },
    }).lean();

  const doses:
    RxBoxDoseInput[] =
      logs.flatMap(
        (log) => {
          const medicineId =
            log.medicineId
              ?.toString() ??
            '';

          const medicine =
            medicineById.get(
              medicineId
            );

          if (
            !medicine ||
            parseMedicationTimeToMinutes(
              log.scheduledTime
            ) < 0
          ) {
            return [];
          }

          return [
            {
              logId:
                log._id.toString(),

              medicineId,

              medicineName:
                log.medicineName,

              dosage:
                log.dosage,

              scheduledTime:
                log.scheduledTime,

              pillsPerDose:
                medicine.pillsPerDose ??
                1,

              medicineCreatedAt:
                medicine.createdAt,

              logStatus:
                log.status,
            },
          ];
        }
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

  if (!plan.capacity.exceeded) {
    for (
      const item of plan.loadingPlan
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

  if (logs.length > 0) {
    await MedicationLog.bulkWrite(
      logs.map(
        (log) => {
          const expectedChamberIds =
            chambersByLogId.get(
              log._id.toString()
            ) ?? [];

          return {
            updateOne: {
              filter: {
                _id:
                  log._id,
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
        }
      ),
      {
        ordered: false,
      }
    );
  }

  return plan;
}