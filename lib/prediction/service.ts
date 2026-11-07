import MedicationLog from '@/models/MedicationLog';
import Medicine from '@/models/Medicine';
import User from '@/models/User';
import { addDaysToMedicationDateKey, getMedicationDateKey, medicationScheduledAt, resolveMedicationTimeZone } from '@/lib/medicationTime';
import { predictAdherence, type PredictionLog, type PredictionResult, type PredictionTarget } from './adherencePrediction';

/** Read only. Never backfill logs, change outcomes, or contact hardware. */
export async function getPatientPrediction(patientId: string, now = new Date()): Promise<PredictionResult> {
  const zone = resolveMedicationTimeZone();
  const empty = predictAdherence([], null, now, zone);
  try {
    const patient = await User.findOne({ _id: patientId, role: 'patient', isDeleted: { $ne: true } }).select('dataResetAt').lean();
    if (!patient) return { ...empty, status: 'unavailable', reason: 'Patient prediction is unavailable.' };
    const today = getMedicationDateKey(now, zone);
    const medicines = await Medicine.find({ userId: patientId, isActive: true }).select('startDate endDate scheduledTimes').lean();
    const targets: PredictionTarget[] = [];
    // Find each medicine's next occurrence, including future start dates.
    for (const medicine of medicines) {
      const start = medicine.startDate > today ? medicine.startDate : today;
      for (let offset = 0; offset <= 1; offset++) {
        const date = addDaysToMedicationDateKey(start, offset);
        if (medicine.endDate && date > medicine.endDate) continue;
        for (const time of medicine.scheduledTimes) {
          if (+medicationScheduledAt(date, time, zone) > +now) targets.push({ scheduledDate: date, scheduledTime: time });
        }
      }
    }
    targets.sort((a, b) => +medicationScheduledAt(a.scheduledDate, a.scheduledTime, zone) - +medicationScheduledAt(b.scheduledDate, b.scheduledTime, zone));
    const query: Record<string, unknown> = { userId: patientId, scheduledDate: { $gte: addDaysToMedicationDateKey(today, -180), $lte: today } };
    if (patient.dataResetAt) query.createdAt = { $gt: patient.dataResetAt };
    const records = await MedicationLog.find(query).select('_id medicineId status scheduledDate scheduledTime createdAt updatedAt outcomeRecordedAt takenAt countsTowardAdherence lateAfterMinutes windowAfterMinutes').sort({ scheduledDate: -1, scheduledTime: -1, _id: -1 }).limit(5001).lean();
    // Fail closed instead of silently truncating a simultaneous group.
    if (records.length > 5000) return { ...empty, status: 'unavailable', reason: 'Prediction history exceeds the supported 5,000-record review limit.' };
    const logs: PredictionLog[] = records.map(log => ({ ...log, id: log._id.toString(), medicineId: log.medicineId?.toString() ?? null }));
    return predictAdherence(logs, targets[0] ?? null, now, zone);
  } catch (error) {
    console.error('[Adherence prediction] Failed:', error instanceof Error ? error.message : 'Unknown error');
    return { ...empty, status: 'unavailable', reason: 'Prediction is temporarily unavailable. Recorded medication tracking is unaffected.' };
  }
}