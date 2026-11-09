
import MedicationLog from "@/models/MedicationLog";
import Medicine from "@/models/Medicine";

import {
  ensureMedicationLogsForDate,
} from "@/lib/medicationVerification";

import {
  getMedicationDateKey,
  parseMedicationTimeToMinutes,
  resolveMedicationTimeZone,
} from "@/lib/medicationTime";

import {
  buildRxBoxDailyPlan,
  type RxBoxDailyPlan,
  type RxBoxDoseInput,
} from "@/lib/rxBoxPlanCore";

export * from "@/lib/rxBoxPlanCore";

const FINAL_LOG_STATUSES = new Set([
  "taken",
  "late",
  "missed",
  "incorrect_chamber",
]);

const DEBUG_RX_BOX =
  process.env.NODE_ENV === "development";

function getLogPriority(status: string): number {
  if (FINAL_LOG_STATUSES.has(status)) {
    return 3;
  }

  if (status === "dispensed") {
    return 2;
  }

  if (status === "reminder") {
    return 1;
  }

  return 0;
}

function shouldReplaceDose(
  existing: RxBoxDoseInput,
  candidate: RxBoxDoseInput
): boolean {
  const existingPriority = getLogPriority(
    existing.logStatus
  );

  const candidatePriority = getLogPriority(
    candidate.logStatus
  );

  if (candidatePriority !== existingPriority) {
    return candidatePriority > existingPriority;
  }

  return (
    candidate.logId.localeCompare(existing.logId) < 0
  );
}

/**
 * Read manually assigned chambers for one
 * scheduled medication occurrence.
 *
 * Never automatically assign another chamber.
 */
function getAssignedChambers(
  assignments:
    | Array<{
        scheduledTime: string;
        chamberIds: number[];
      }>
    | undefined,
  scheduledTime: string
): number[] {
  const scheduledMinutes =
    parseMedicationTimeToMinutes(scheduledTime);

  if (scheduledMinutes < 0) {
    return [];
  }

  const assignment = (assignments ?? []).find(
    (item) =>
      parseMedicationTimeToMinutes(
        item.scheduledTime
      ) === scheduledMinutes
  );

  if (!assignment) {
    return [];
  }

  return [
    ...new Set(assignment.chamberIds ?? []),
  ]
    .filter(
      (id) =>
        Number.isInteger(id) &&
        id >= 1 &&
        id <= 4
    )
    .sort((a, b) => a - b);
}

function sameChambers(
  first: number[],
  second: number[]
): boolean {
  const a = [...new Set(first)].sort(
    (x, y) => x - y
  );

  const b = [...new Set(second)].sort(
    (x, y) => x - y
  );

  return (
    a.length === b.length &&
    a.every((value, index) => value === b[index])
  );
}

/**
 * Build today's Rx Box hardware plan.
 *
 * Preserves:
 * - Manual chamber assignments
 * - Multiple pills per chamber
 * - Same-time medication grouping
 * - Four-chamber capacity
 * - Medication log deduplication
 * - Existing taken/missed statuses
 * - ESP32 schedule response format
 */
export async function getRxBoxDailyPlan(
  userId: string,
  deviceId: string,
  options: {
    date?: string;
    now?: Date;
    timezone?: string;
  } = {}
): Promise<RxBoxDailyPlan> {
  const timezone = resolveMedicationTimeZone(
    options.timezone
  );

  const date =
    options.date ??
    getMedicationDateKey(
      options.now ?? new Date(),
      timezone
    );

  /*
   * Ensure today's medication logs exist.
   */
  await ensureMedicationLogsForDate(
    userId,
    date
  );

  /*
   * Load active medicines and their
   * manually saved chamber assignments.
   */
  const medicines = await Medicine.find({
    userId,
    isActive: true,
    startDate: {
      $lte: date,
    },
    $or: [
      { endDate: null },
      { endDate: "" },
      { endDate: { $gte: date } },
    ],
  })
    .select(
      "_id name dosage scheduledTimes " +
      "pillsPerDose chamberAssignments createdAt"
    )
    .lean();

  const medicineById = new Map(
    medicines.map((medicine) => [
      medicine._id.toString(),
      medicine,
    ])
  );

  const scheduledMinutesByMedicineId =
    new Map<string, Set<number>>();

  for (const medicine of medicines) {
    const medicineId = medicine._id.toString();

    const validMinutes = new Set(
      (medicine.scheduledTimes ?? [])
        .map((time) =>
          parseMedicationTimeToMinutes(time)
        )
        .filter((minutes) => minutes >= 0)
    );

    scheduledMinutesByMedicineId.set(
      medicineId,
      validMinutes
    );
  }

  /*
   * Load today's adherence records.
   */
  const logs = await MedicationLog.find({
    userId,
    scheduledDate: date,
    medicineId: {
      $in: medicines.map(
        (medicine) => medicine._id
      ),
    },
    countsTowardAdherence: {
      $ne: false,
    },
  }).lean();

  const doseByOccurrence =
    new Map<string, RxBoxDoseInput>();

  let invalidTimeLogs = 0;
  let outdatedScheduleLogs = 0;
  let duplicateOccurrenceLogs = 0;

  for (const log of logs) {
    const medicineId =
      log.medicineId?.toString() ?? "";

    const medicine = medicineById.get(
      medicineId
    );

    if (!medicine) {
      continue;
    }

    const scheduledMinutes =
      parseMedicationTimeToMinutes(
        log.scheduledTime
      );

    if (scheduledMinutes < 0) {
      invalidTimeLogs++;
      continue;
    }

    const currentScheduleMinutes =
      scheduledMinutesByMedicineId.get(
        medicineId
      );

    /*
     * Ignore old scheduled times left behind
     * after medicine schedule edits.
     */
    if (
      !currentScheduleMinutes?.has(
        scheduledMinutes
      )
    ) {
      outdatedScheduleLogs++;
      continue;
    }

    const assignedChambers =
      getAssignedChambers(
        medicine.chamberAssignments,
        log.scheduledTime
      );

    const candidate: RxBoxDoseInput = {
      logId: log._id.toString(),
      medicineId,
      medicineName: medicine.name,
      dosage: medicine.dosage,
      scheduledTime: log.scheduledTime,
      pillsPerDose:
        medicine.pillsPerDose ?? 1,
      medicineCreatedAt: medicine.createdAt,
      logStatus: log.status,
      chamberIds: assignedChambers,
    };

    const occurrenceKey =
      `${medicineId}:${scheduledMinutes}`;

    const existing = doseByOccurrence.get(
      occurrenceKey
    );

    if (existing) {
      duplicateOccurrenceLogs++;
    }

    if (
      !existing ||
      shouldReplaceDose(existing, candidate)
    ) {
      doseByOccurrence.set(
        occurrenceKey,
        candidate
      );
    }
  }

  const doses = Array.from(
    doseByOccurrence.values()
  );

  /*
   * Use the existing validated plan builder.
   *
   * Do not bypass assignment conflicts.
   */
  const plan = buildRxBoxDailyPlan(
    doses,
    {
      deviceId,
      date,
      timezone,
    }
  );

  /*
   * Development-only diagnostics.
   *
   * No patient IDs, authentication keys,
   * or database connection strings logged.
   */
  if (DEBUG_RX_BOX) {
    console.log(
      "\n========== RX BOX PLAN DEBUG =========="
    );

    console.log("Date:", date);
    console.log("Device:", deviceId);
    console.log("Timezone:", timezone);

    console.log(
      "Active medicines:",
      medicines.length
    );

    console.log(
      "Medication logs:",
      logs.length
    );

    console.log(
      "Valid scheduled occurrences:",
      doses.length
    );

    console.log(
      "Invalid-time logs:",
      invalidTimeLogs
    );

    console.log(
      "Outdated schedule logs:",
      outdatedScheduleLogs
    );

    console.log(
      "Duplicate occurrence logs:",
      duplicateOccurrenceLogs
    );

    console.log(
      "Saved medicine assignments:",
      medicines.map((medicine) => ({
        medicine: medicine.name,
        scheduledTimes:
          medicine.scheduledTimes ?? [],
        chamberAssignments:
          medicine.chamberAssignments ?? [],
      }))
    );

    console.log(
      "Resolved dose assignments:",
      doses.map((dose) => ({
        medicine: dose.medicineName,
        time: dose.scheduledTime,
        chambers: dose.chamberIds,
        pills: dose.pillsPerDose,
        status: dose.logStatus,
      }))
    );

    console.log(
      "Hardware enabled:",
      plan.hardwareDispensingEnabled
    );

    console.log(
      "Capacity:",
      plan.capacity
    );

    console.log(
      "Plan message:",
      plan.message
    );

    console.log(
      "Dispensing groups:",
      plan.groups.map((group) => ({
        time: group.scheduledTime,
        chambers: group.chamberIds,
        status: group.status,
      }))
    );

    console.log(
      "========== END RX BOX DEBUG ==========\n"
    );
  }

  /*
   * Map each selected medication log
   * to its expected physical chambers.
   */
  const chambersByLogId =
    new Map<string, number[]>();

  if (plan.hardwareDispensingEnabled) {
    for (const item of plan.loadingPlan) {
      const existing =
        chambersByLogId.get(item.logId) ?? [];

      if (!existing.includes(item.chamberId)) {
        existing.push(item.chamberId);
      }

      chambersByLogId.set(
        item.logId,
        existing
      );
    }
  }

  /*
   * Update only records whose expected
   * chamber assignments actually changed.
   *
   * Preserve medication statuses and
   * adherence outcomes.
   */
  const updates = logs.flatMap((log) => {
    const expectedChamberIds = [
      ...new Set(
        chambersByLogId.get(
          log._id.toString()
        ) ?? []
      ),
    ].sort((a, b) => a - b);

    const existingChamberIds =
      log.expectedChamberIds ?? [];

    const expectedChamberId =
      expectedChamberIds[0] ?? null;

    const existingChamberId =
      log.expectedChamberId ?? null;

    if (
      sameChambers(
        existingChamberIds,
        expectedChamberIds
      ) &&
      existingChamberId === expectedChamberId
    ) {
      return [];
    }

    return [
      {
        updateOne: {
          filter: {
            _id: log._id,
          },
          update: {
            $set: {
              expectedChamberId,
              expectedChamberIds,
            },
          },
        },
      },
    ];
  });

  if (updates.length > 0) {
    await MedicationLog.bulkWrite(
      updates,
      {
        ordered: false,
      }
    );
  }

  return plan;
}
