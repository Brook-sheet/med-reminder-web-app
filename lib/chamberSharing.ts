import { parseMedicationTimeToMinutes } from './medicationTime';

export const MAX_MEDICINES_PER_CHAMBER = 5;
export interface ChamberMedicine {
  name: string;
  startDate?: string;
  endDate?: string | null;
  chamberAssignments?: { scheduledTime: string; chamberIds: number[] }[];
}

export function overlappingMedicines<T extends ChamberMedicine>(incoming: ChamberMedicine, others: T[]) {
  return others.filter(other => (incoming.startDate || '0000-01-01') <= (other.endDate || '9999-12-31') &&
    (other.startDate || '0000-01-01') <= (incoming.endDate || '9999-12-31'));
}

/** Count distinct medicine records, not loading rows or physical chambers. */
export function validateChamberSharing(incoming: ChamberMedicine, others: ChamberMedicine[]): string | null {
  const overlapping = overlappingMedicines(incoming, others);
  for (const assignment of incoming.chamberAssignments || []) {
    for (const chamber of assignment.chamberIds) {
      const occupants = overlapping.filter(other => other.chamberAssignments?.some(a => a.chamberIds.includes(chamber)));
      for (const other of occupants) {
        const conflict = other.chamberAssignments?.find(a => a.chamberIds.includes(chamber) &&
          parseMedicationTimeToMinutes(a.scheduledTime) !== parseMedicationTimeToMinutes(assignment.scheduledTime));
        if (conflict) return `Chamber ${chamber} is assigned to ${other.name} at ${conflict.scheduledTime}. Use that time or choose another chamber.`;
      }
      // Test interval start boundaries so nonconcurrent courses are not added together.
      const dates = [incoming.startDate || '0000-01-01', ...occupants.map(o => o.startDate || '0000-01-01')];
      for (const date of dates) {
        if (date < (incoming.startDate || '0000-01-01') || date > (incoming.endDate || '9999-12-31')) continue;
        const count = occupants.filter(o => (o.startDate || '0000-01-01') <= date && date <= (o.endDate || '9999-12-31')).length;
        if (count >= MAX_MEDICINES_PER_CHAMBER) return `Chamber ${chamber} allows at most ${MAX_MEDICINES_PER_CHAMBER} medicines at the same scheduled time.`;
      }
    }
  }
  return null;
}

interface ScheduledChamberMedicine extends ChamberMedicine {
  _id: string;
  scheduledTimes: string[];
  frequency: string;
}

/** Move only doses that shared a retained chamber and time before the edit. */
export function planSharedChamberTimeEdit<T extends ScheduledChamberMedicine>(
  previous: ChamberMedicine,
  incoming: ChamberMedicine,
  others: T[],
) {
  const updates: {
    medicine: T;
    changes: { from: number; to: string; chambers: number[] }[];
  }[] = [];
  const affected = overlappingMedicines(incoming, overlappingMedicines(previous, others));

  for (const other of affected) {
    const changes: (typeof updates)[number]['changes'] = [];
    for (const assignment of other.chamberAssignments ?? []) {
      const from = parseMedicationTimeToMinutes(assignment.scheduledTime);
      const sharedChambers = (previous.chamberAssignments ?? [])
        .filter(row => parseMedicationTimeToMinutes(row.scheduledTime) === from)
        .flatMap(row => row.chamberIds)
        .filter(chamber => assignment.chamberIds.includes(chamber));
      const targets = (incoming.chamberAssignments ?? [])
        .filter(row => row.chamberIds.some(chamber => sharedChambers.includes(chamber)));
      if (targets.length > 1) {
        throw new Error(`${other.name} shares chambers that would move to different times. Keep those chambers at one time or change their assignments first.`);
      }
      const target = targets[0];
      if (target && parseMedicationTimeToMinutes(target.scheduledTime) !== from) {
        changes.push({
          from,
          to: target.scheduledTime,
          chambers: sharedChambers.filter(chamber => target.chamberIds.includes(chamber)).sort((a, b) => a - b),
        });
      }
    }
    if (!changes.length) continue;

    const moveTime = (time: string) =>
      changes.find(change => change.from === parseMedicationTimeToMinutes(time))?.to ?? time;
    const scheduledTimes = other.scheduledTimes.map(moveTime)
      .sort((a, b) => parseMedicationTimeToMinutes(a) - parseMedicationTimeToMinutes(b));
    const minutes = scheduledTimes.map(parseMedicationTimeToMinutes);
    if (new Set(minutes).size !== minutes.length) {
      throw new Error(`${other.name} already has a dose at the new time. Choose another time to avoid combining its doses.`);
    }
    const interval = /^Every (4|6|8) hours$/.exec(other.frequency);
    if (interval) {
      const step = Number(interval[1]) * 60;
      if (minutes.length !== 1440 / step ||
          minutes.some((minute, index) => ((minutes[(index + 1) % minutes.length] - minute + 1440) % 1440) !== step)) {
        throw new Error(`Moving the shared dose would break the ${other.frequency.toLowerCase()} schedule for ${other.name}. Change its chamber assignment first.`);
      }
    }
    const chamberAssignments = other.chamberAssignments?.map(row => ({
      ...row,
      scheduledTime: moveTime(row.scheduledTime),
    }));
    updates.push({
      medicine: { ...other, scheduledTimes, chamberAssignments },
      changes: changes.sort((a, b) => a.from - b.from),
    });
  }

  updates.sort((a, b) => a.medicine._id.localeCompare(b.medicine._id));
  const updatedOthers = others.map(other => updates.find(update => update.medicine._id === other._id)?.medicine ?? other);
  const conflict = validateChamberSharing(incoming, updatedOthers) ??
    updates.map(({ medicine }) => validateChamberSharing(
      medicine, [incoming, ...updatedOthers.filter(other => other._id !== medicine._id)],
    )).find(Boolean) ?? null;
  const confirmation = updates.length
    ? JSON.stringify(updates.map(({ medicine, changes }) => [medicine._id, changes]))
    : null;
  return { updates, conflict, confirmation };
}