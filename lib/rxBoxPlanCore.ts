
import { createHash } from "node:crypto";

import {
  parseMedicationTimeToMinutes,
  resolveMedicationTimeZone,
} from "./medicationTime";

export const RX_BOX_CAPACITY = 4;

export type RxBoxGroupStatus =
  | "pending"
  | "dispensed"
  | "taken"
  | "missed";

export interface RxBoxDoseInput {
  logId: string;
  medicineId: string;
  medicineName: string;
  dosage: string;
  scheduledTime: string;
  pillsPerDose: number;
  medicineCreatedAt: Date | string;
  logStatus: string;

  /**
   * Manually selected chambers for this
   * particular scheduled dose.
   */
  chamberIds?: number[];
}

export interface RxBoxLoadingItem {
  chamberId: number;
  medicineId: string;
  logId: string;
  medicineName: string;
  dosage: string;
  pillUnit: number;
  pillsPerDose: number;
  scheduledTime: string;
}

export interface RxBoxAlarmGroup {
  groupId: string;
  hour: number;
  minute: number;
  scheduledTime: string;
  chamberIds: number[];
  logIds: string[];
  status: RxBoxGroupStatus;
}

export interface RxBoxDailyPlan {
  success: true;
  apiVersion: 1;
  deviceId: string;
  date: string;
  timezone: string;
  planId: string;
  hardwareDispensingEnabled: boolean;

  capacity: {
    used: number;
    required: number;
    maximum: number;
    exceeded: boolean;
  };

  loadingPlan: RxBoxLoadingItem[];
  proposedLoadingItems: RxBoxLoadingItem[];
  groups: RxBoxAlarmGroup[];
  message: string;
}

function stableId(
  prefix: string,
  value: string
): string {
  return `${prefix}_${createHash("sha256")
    .update(value)
    .digest("hex")
    .slice(0, 24)}`;
}

function groupStatus(
  statuses: string[]
): RxBoxGroupStatus {
  if (
    statuses.length > 0 &&
    statuses.every(
      (status) =>
        status === "taken" ||
        status === "late"
    )
  ) {
    return "taken";
  }

  if (
    statuses.length > 0 &&
    statuses.every(
      (status) => status === "missed"
    )
  ) {
    return "missed";
  }

  const unresolved = new Set([
    "pending",
    "reminder",
  ]);

  if (
    statuses.length > 0 &&
    statuses.every(
      (status) => !unresolved.has(status)
    )
  ) {
    return statuses.includes("missed")
      ? "missed"
      : "dispensed";
  }

  return "pending";
}

export function isValidRxBoxChamberId(
  value: number
): boolean {
  return (
    Number.isInteger(value) &&
    value >= 1 &&
    value <= RX_BOX_CAPACITY
  );
}

export function uniqueRxBoxLogIds(
  logIds: string[]
): string[] {
  return Array.from(new Set(logIds));
}

export function rxBoxEventIdentity(
  deviceId: string,
  eventId: string
): string {
  return `${deviceId.trim()}:${eventId.trim()}`;
}

export function buildRxBoxDailyPlan(
  doses: RxBoxDoseInput[],
  options: {
    deviceId: string;
    date: string;
    timezone?: string;
  }
): RxBoxDailyPlan {
  const timezone = resolveMedicationTimeZone(
    options.timezone
  );

  const sortedDoses = [...doses].sort(
    (first, second) => {
      const timeDifference =
        parseMedicationTimeToMinutes(
          first.scheduledTime
        ) -
        parseMedicationTimeToMinutes(
          second.scheduledTime
        );

      if (timeDifference !== 0) {
        return timeDifference;
      }

      const creationDifference =
        new Date(
          first.medicineCreatedAt
        ).getTime() -
        new Date(
          second.medicineCreatedAt
        ).getTime();

      if (creationDifference !== 0) {
        return creationDifference;
      }

      return (
        first.medicineId.localeCompare(
          second.medicineId
        ) ||
        first.logId.localeCompare(
          second.logId
        )
      );
    }
  );

  const proposedLoadingItems: RxBoxLoadingItem[] =
    [];

  const chamberTimeMap = new Map<
    number,
    number
  >();

  const errors: string[] = [];

  for (const dose of sortedDoses) {
    const scheduledMinutes =
      parseMedicationTimeToMinutes(
        dose.scheduledTime
      );

    const pillsPerDose = dose.pillsPerDose;

    const chamberIds = [
      ...new Set(dose.chamberIds ?? []),
    ].sort((a, b) => a - b);

    if (scheduledMinutes < 0) {
      errors.push(
        `Invalid scheduled time for ${dose.medicineName}.`
      );
      continue;
    }

    if (
      !Number.isInteger(pillsPerDose) ||
      pillsPerDose < 1 ||
      pillsPerDose > 4
    ) {
      errors.push(
        `Invalid pill quantity for ${dose.medicineName}.`
      );
      continue;
    }

    if (
      chamberIds.length === 0 ||
      chamberIds.length > RX_BOX_CAPACITY ||
      chamberIds.some(
        (id) => !isValidRxBoxChamberId(id)
      )
    ) {
      errors.push(
        `${dose.medicineName} at ${dose.scheduledTime} needs a valid chamber assignment.`
      );
      continue;
    }

    /*
     * Each chamber may only be opened at one
     * scheduled time during a daily loading cycle.
     *
     * Multiple medicines at the same time may
     * share the chamber.
     */
    for (const chamberId of chamberIds) {
      const existingTime =
        chamberTimeMap.get(chamberId);

      if (
        existingTime !== undefined &&
        existingTime !== scheduledMinutes
      ) {
        errors.push(
          `Chamber ${chamberId} is assigned to different scheduled times.`
        );
      } else {
        chamberTimeMap.set(
          chamberId,
          scheduledMinutes
        );
      }
    }

    /*
     * Multiple pills may be loaded into
     * a single selected chamber.
     *
     * A loading item represents one medicine
     * assigned to one physical chamber.
     *
     * pillUnit is retained for compatibility
     * with the existing loading-plan interface.
     */
    chamberIds.forEach((chamberId, index) => {
      proposedLoadingItems.push({
        chamberId,
        medicineId: dose.medicineId,
        logId: dose.logId,
        medicineName: dose.medicineName,
        dosage: dose.dosage,
        pillUnit: index + 1,
        pillsPerDose,
        scheduledTime: dose.scheduledTime,
      });
    });
  }

  /*
   * Count unique physical chambers,
   * not the number of tablets or medicines.
   */
  const usedChambers = new Set(
    proposedLoadingItems.map(
      (item) => item.chamberId
    )
  );

  const requiredChambers = usedChambers.size;

  const exceeded =
    requiredChambers > RX_BOX_CAPACITY ||
    errors.length > 0;

  /*
   * Include manual assignments in the plan ID
   * so changes can be detected.
   */
  const planSeed = sortedDoses
    .map((dose) => {
      const chambers = [
        ...new Set(dose.chamberIds ?? []),
      ].sort((a, b) => a - b);

      return [
        dose.logId,
        dose.scheduledTime,
        dose.pillsPerDose,
        chambers.join(","),
      ].join(":");
    })
    .join("|");

  const planId = stableId(
    "plan",
    `${options.deviceId}:${options.date}:${planSeed}`
  );

  /*
   * Never send a partial or conflicting
   * dispensing plan to the hardware.
   */
  const loadingPlan = exceeded
    ? []
    : proposedLoadingItems;

  const doseByLogId = new Map(
    sortedDoses.map((dose) => [
      dose.logId,
      dose,
    ])
  );

  /*
   * Group all medicines scheduled at the
   * same minute into one dispensing event.
   */
  const grouped = new Map<
    number,
    RxBoxLoadingItem[]
  >();

  for (const item of loadingPlan) {
    const minutes =
      parseMedicationTimeToMinutes(
        item.scheduledTime
      );

    const existing =
      grouped.get(minutes) ?? [];

    existing.push(item);

    grouped.set(minutes, existing);
  }

  const groups: RxBoxAlarmGroup[] =
    Array.from(grouped.entries())
      .sort(([a], [b]) => a - b)
      .map(([minutes, items]) => {
        const chamberIds = [
          ...new Set(
            items.map(
              (item) => item.chamberId
            )
          ),
        ].sort((a, b) => a - b);

        const logIds = uniqueRxBoxLogIds(
          items.map(
            (item) => item.logId
          )
        );

        const statuses = logIds.map(
          (logId) =>
            doseByLogId.get(logId)
              ?.logStatus ?? "pending"
        );

        const scheduledTime =
          items[0].scheduledTime;

        const groupSeed = [
          planId,
          String(minutes),
          chamberIds.join(","),
          [...logIds].sort().join(","),
        ].join(":");

        return {
          groupId: stableId(
            "group",
            groupSeed
          ),

          hour: Math.floor(minutes / 60),

          minute: minutes % 60,

          scheduledTime,

          chamberIds,

          logIds,

          status: groupStatus(statuses),
        };
      });

  const errorMessage = [
    ...new Set(errors),
  ].join(" ");

  return {
    success: true,
    apiVersion: 1,
    deviceId: options.deviceId,
    date: options.date,
    timezone,
    planId,

    hardwareDispensingEnabled: !exceeded,

    capacity: {
      used: requiredChambers,
      required: requiredChambers,
      maximum: RX_BOX_CAPACITY,
      exceeded,
    },

    loadingPlan,

    proposedLoadingItems,

    groups: exceeded ? [] : groups,

    message: exceeded
      ? errorMessage ||
        "Invalid chamber configuration. Hardware dispensing is disabled."
      : "Load the medicines into their manually assigned chambers. Multiple pills scheduled together may share one chamber if they fit and dispense safely.",
  };
}
