// lib/rxBoxPlanCore.ts
import {
  createHash,
} from 'node:crypto';

import {
  parseMedicationTimeToMinutes,
  resolveMedicationTimeZone,
} from './medicationTime';

export const RX_BOX_CAPACITY = 4;

export type RxBoxGroupStatus =
  | 'pending'
  | 'dispensed'
  | 'taken'
  | 'missed';

export interface RxBoxDoseInput {
  logId: string;
  medicineId: string;
  medicineName: string;
  dosage: string;
  scheduledTime: string;
  pillsPerDose: number;
  medicineCreatedAt: Date | string;
  logStatus: string;
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
  return `${prefix}_${
    createHash('sha256')
      .update(value)
      .digest('hex')
      .slice(0, 24)
  }`;
}

function groupStatus(
  statuses: string[]
): RxBoxGroupStatus {
  if (
    statuses.every(
      (status) =>
        status === 'taken' ||
        status === 'late'
    )
  ) {
    return 'taken';
  }

  if (
    statuses.every(
      (status) =>
        status === 'missed'
    )
  ) {
    return 'missed';
  }

  const unresolved =
    new Set([
      'pending',
      'reminder',
    ]);

  if (
    statuses.length > 0 &&
    statuses.every(
      (status) =>
        !unresolved.has(status)
    )
  ) {
    return statuses.includes('missed')
      ? 'missed'
      : 'dispensed';
  }

  return 'pending';
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
  return Array.from(
    new Set(logIds)
  );
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
  const timezone =
    resolveMedicationTimeZone(
      options.timezone
    );

  const sortedDoses =
    [...doses].sort(
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

        const medicineDifference =
          first.medicineId.localeCompare(
            second.medicineId
          );

        return (
          medicineDifference ||
          first.logId.localeCompare(
            second.logId
          )
        );
      }
    );

  const proposedLoadingItems:
    RxBoxLoadingItem[] = [];

  for (const dose of sortedDoses) {
    const pillsPerDose =
      Math.min(
        RX_BOX_CAPACITY,
        Math.max(
          1,
          dose.pillsPerDose
        )
      );

    for (
      let pillUnit = 1;
      pillUnit <= pillsPerDose;
      pillUnit += 1
    ) {
      proposedLoadingItems.push({
        chamberId:
          proposedLoadingItems.length + 1,

        medicineId:
          dose.medicineId,

        logId:
          dose.logId,

        medicineName:
          dose.medicineName,

        dosage:
          dose.dosage,

        pillUnit,

        pillsPerDose,

        scheduledTime:
          dose.scheduledTime,
      });
    }
  }

  const planSeed =
    proposedLoadingItems
      .map(
        (item) =>
          `${item.logId}:${item.pillUnit}:${item.scheduledTime}`
      )
      .join('|');

  const planId =
    stableId(
      'plan',
      `${options.deviceId}:${options.date}:${planSeed}`
    );

  const exceeded =
    proposedLoadingItems.length >
    RX_BOX_CAPACITY;

  // Never give hardware a partial plan.
  const loadingPlan =
    exceeded
      ? []
      : proposedLoadingItems;

  const doseByLogId =
    new Map(
      sortedDoses.map(
        (dose) => [
          dose.logId,
          dose,
        ]
      )
    );

  const grouped =
    new Map<
      string,
      RxBoxLoadingItem[]
    >();

  for (const item of loadingPlan) {
    const existing =
      grouped.get(
        item.scheduledTime
      ) ?? [];

    existing.push(item);

    grouped.set(
      item.scheduledTime,
      existing
    );
  }

  const groups =
    Array.from(
      grouped.entries()
    ).map(
      ([
        scheduledTime,
        items,
      ]) => {
        const minutes =
          parseMedicationTimeToMinutes(
            scheduledTime
          );

        const logIds =
          uniqueRxBoxLogIds(
            items.map(
              (item) => item.logId
            )
          );

        const statuses =
          logIds.map(
            (logId) =>
              doseByLogId.get(
                logId
              )?.logStatus ??
              'pending'
          );

        return {
          groupId:
            stableId(
              'group',
              `${planId}:${scheduledTime}:${
                items
                  .map(
                    (item) =>
                      `${item.logId}:${item.pillUnit}`
                  )
                  .join('|')
              }`
            ),

          hour:
            Math.floor(
              minutes / 60
            ),

          minute:
            minutes % 60,

          scheduledTime,

          chamberIds:
            items.map(
              (item) =>
                item.chamberId
            ),

          logIds,

          status:
            groupStatus(
              statuses
            ),
        };
      }
    );

  return {
    success: true,
    apiVersion: 1,
    deviceId:
      options.deviceId,
    date:
      options.date,
    timezone,
    planId,

    hardwareDispensingEnabled:
      !exceeded,

    capacity: {
      used:
        proposedLoadingItems.length,

      required:
        proposedLoadingItems.length,

      maximum:
        RX_BOX_CAPACITY,

      exceeded,
    },

    loadingPlan,

    proposedLoadingItems,

    groups:
      exceeded
        ? []
        : groups,

    message:
      exceeded
        ? `Today's schedule requires ${proposedLoadingItems.length} chambers, but the Rx Box has only ${RX_BOX_CAPACITY}. Hardware dispensing is disabled until the schedule is corrected.`
        : 'Refill the Rx Box daily using this exact order.',
  };
}