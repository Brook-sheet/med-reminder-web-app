import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import Medicine from '@/models/Medicine';
import MedicationLog from '@/models/MedicationLog';
import RxBoxPlan from '@/models/RxBoxPlan';
import { ensureMedicationLogsForDate } from '@/lib/medicationVerification';
import {
  getMedicationDateKey,
  medicationScheduledAt,
  parseMedicationTimeToMinutes,
  resolveMedicationTimeZone,
} from '@/lib/medicationTime';
import {
  allocateRxBoxChambers,
  RX_BOX_MAX_CHAMBERS,
  type RxBoxAllocatedOccurrence,
} from '@/lib/rxBoxPlanCore';

export interface RxBoxPlanItem {
  logId: string;
  medicineId: string;
  medicineName: string;
  dosage: string;
  pillsPerDose: number;
  chamberIds: number[];
  dispenseUnits: Array<{ unitId: string; chamberId: number; pillIndex: number }>;
  status: string;
}

export interface RxBoxPlanGroup {
  groupId: string;
  scheduledAt: string;
  hour: number;
  minute: number;
  pickupDeadlineAt: string;
  state: 'pending' | 'dispensed' | 'completed';
  items: RxBoxPlanItem[];
}

export interface RxBoxDailyPlan {
  schemaVersion: 2;
  deviceId: string;
  planDate: string;
  timezone: string;
  planVersion: string;
  capacity: { used: number; maximum: number; valid: true };
  groups: RxBoxPlanGroup[];
}

interface LeanMedicine {
  _id: mongoose.Types.ObjectId;
  name: string;
  dosage: string;
  frequency: string;
  scheduledTimes: string[];
  pillsPerDose?: number;
  startDate: string;
  endDate?: string | null;
  windowAfterMinutes?: number;
  createdAt: Date;
}

function safeDevicePart(deviceId: string): string {
  return deviceId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 40);
}

function planIdentity(
  deviceId: string,
  planDate: string,
  timezone: string,
  allocated: RxBoxAllocatedOccurrence[],
): string {
  const identity = {
    schemaVersion: 2,
    deviceId,
    planDate,
    timezone,
    occurrences: allocated.map((item) => ({
      logId: item.logId,
      medicineId: item.medicineId,
      scheduledTime: item.scheduledTime,
      pillsPerDose: item.pillsPerDose,
      chamberIds: item.chamberIds,
    })),
  };
  return createHash('sha256').update(JSON.stringify(identity)).digest('hex').slice(0, 32);
}

export async function generateRxBoxPlan(options: {
  patientId: string;
  deviceId: string;
  planDate?: string;
  persist?: boolean;
}): Promise<RxBoxDailyPlan> {
  if (!mongoose.isValidObjectId(options.patientId)) {
    throw new Error('A valid mapped patient ID is required.');
  }
  const timezone = resolveMedicationTimeZone('Asia/Manila');
  const planDate = options.planDate || getMedicationDateKey(new Date(), timezone);
  await ensureMedicationLogsForDate(options.patientId, planDate);

  const medicines = await Medicine.find({
    userId: options.patientId,
    isActive: true,
    frequency: { $ne: 'As needed' },
    startDate: { $lte: planDate },
    $or: [{ endDate: null }, { endDate: '' }, { endDate: { $gte: planDate } }],
  })
    .sort({ createdAt: 1, _id: 1 })
    .lean<LeanMedicine[]>();

  const medicineIds = medicines.map((medicine) => medicine._id);
  const logs = await MedicationLog.find({
    userId: options.patientId,
    scheduledDate: planDate,
    medicineId: { $in: medicineIds },
    countsTowardAdherence: { $ne: false },
  }).lean();
  const logByOccurrence = new Map(
    logs.map((log) => [`${String(log.medicineId)}|${log.scheduledTime}`, log]),
  );

  const occurrences = medicines.flatMap((medicine) =>
    medicine.scheduledTimes.map((scheduledTime) => {
      const log = logByOccurrence.get(`${medicine._id.toString()}|${scheduledTime}`);
      if (!log) throw new Error(`Medication log was not created for ${medicine.name} at ${scheduledTime}.`);
      const scheduled = medicationScheduledAt(planDate, scheduledTime, timezone);
      const pickupDeadline = new Date(
        scheduled.getTime() + (medicine.windowAfterMinutes ?? 90) * 60_000,
      );
      return {
        logId: log._id.toString(),
        medicineId: medicine._id.toString(),
        medicineName: medicine.name,
        dosage: medicine.dosage,
        scheduledTime,
        scheduledAt: scheduled.toISOString(),
        pickupDeadlineAt: pickupDeadline.toISOString(),
        pillsPerDose: medicine.pillsPerDose ?? 1,
        medicineCreatedAt: medicine.createdAt.toISOString(),
        status: String(log.status),
      };
    }),
  );

  const allocated = allocateRxBoxChambers(occurrences);
  const planVersion = planIdentity(options.deviceId, planDate, timezone, allocated);
  const byMinute = new Map<number, RxBoxAllocatedOccurrence[]>();
  for (const item of allocated) {
    const minutes = parseMedicationTimeToMinutes(item.scheduledTime);
    byMinute.set(minutes, [...(byMinute.get(minutes) ?? []), item]);
  }

  const groups: RxBoxPlanGroup[] = Array.from(byMinute.entries())
    .sort(([first], [second]) => first - second)
    .map(([minutes, items]) => {
      const statuses = items.map((item) => item.status);
      const completed = statuses.every((status) =>
        ['taken', 'late', 'missed', 'incorrect_chamber'].includes(status ?? ''),
      );
      const dispensed = statuses.some((status) => status === 'dispensed');
      return {
        groupId: `${planDate}-${String(Math.floor(minutes / 60)).padStart(2, '0')}${String(minutes % 60).padStart(2, '0')}-${safeDevicePart(options.deviceId)}`,
        scheduledAt: items[0].scheduledAt,
        hour: Math.floor(minutes / 60),
        minute: minutes % 60,
        pickupDeadlineAt: items
          .map((item) => item.pickupDeadlineAt)
          .sort()[0],
        state: completed ? 'completed' : dispensed ? 'dispensed' : 'pending',
        items: items.map((item) => ({
          logId: item.logId,
          medicineId: item.medicineId,
          medicineName: item.medicineName,
          dosage: item.dosage,
          pillsPerDose: item.pillsPerDose,
          chamberIds: item.chamberIds,
          dispenseUnits: item.dispenseUnits,
          status: item.status ?? 'pending',
        })),
      };
    });

  const groupByLogId = new Map<string, RxBoxPlanGroup>();
  for (const group of groups) {
    for (const item of group.items) groupByLogId.set(item.logId, group);
  }
  if (allocated.length > 0) {
    await MedicationLog.bulkWrite(
      allocated.map((item) => ({
        updateOne: {
          filter: { _id: item.logId, userId: options.patientId },
          update: {
            $set: {
              pillsPerDose: item.pillsPerDose,
              expectedChamberId: item.chamberIds[0] ?? null,
              expectedChamberIds: item.chamberIds,
              groupId: groupByLogId.get(item.logId)?.groupId ?? null,
              planDate,
              planVersion,
              sensorDeviceId: options.deviceId,
            },
          },
        },
      })),
      { ordered: false },
    );
  }

  const plan: RxBoxDailyPlan = {
    schemaVersion: 2,
    deviceId: options.deviceId,
    planDate,
    timezone,
    planVersion,
    capacity: { used: allocated.reduce((sum, item) => sum + item.pillsPerDose, 0), maximum: RX_BOX_MAX_CHAMBERS, valid: true },
    groups,
  };

  if (options.persist !== false) {
    await RxBoxPlan.updateOne(
      { deviceId: options.deviceId, planDate, planVersion },
      { $set: { patientId: options.patientId, plan } },
      { upsert: true },
    );
  }
  return plan;
}