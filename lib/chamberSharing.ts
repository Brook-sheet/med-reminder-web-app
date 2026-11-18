import { parseMedicationTimeToMinutes } from './medicationTime';

export const MAX_MEDICINES_PER_CHAMBER = 5;
export interface ChamberMedicine {
  name: string;
  startDate?: string;
  endDate?: string | null;
  chamberAssignments?: { scheduledTime: string; chamberIds: number[] }[];
}

export function overlappingMedicines(incoming: ChamberMedicine, others: ChamberMedicine[]) {
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