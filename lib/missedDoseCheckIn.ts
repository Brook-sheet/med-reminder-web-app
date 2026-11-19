import Alert from '@/models/Alert';
import MedicationLog from '@/models/MedicationLog';

import { processMedicationAlertEvent } from './alertEngine';
import { getMedicationDateKey, medicationScheduledAt, resolveMedicationTimeZone } from './medicationTime';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_MISSED_DOSES = 3;

export async function notifyRepeatedMissedDoses(patientId: string, now = new Date()) {
  const cutoff = new Date(now.getTime() - WEEK_MS);
  const previous = await Alert.findOne({
    patientId,
    monitorId: { $ne: null },
    eventType: 'REPEATED_MISSED_DOSES',
  }).sort({ occurredAt: -1, _id: -1 }).select('_id occurredAt').lean();

  if (previous && previous.occurredAt > cutoff) return;

  const zone = resolveMedicationTimeZone();
  const logs = await MedicationLog.find({
    userId: patientId,
    scheduledDate: { $gte: getMedicationDateKey(cutoff, zone), $lte: getMedicationDateKey(now, zone) },
    countsTowardAdherence: { $ne: false },
    status: 'missed',
  }).select('medicineId scheduledDate scheduledTime outcomeRecordedAt').lean();

  const missedDoses = new Set<string>();
  let hasNewMiss = false;
  for (const log of logs) {
    const scheduledAt = medicationScheduledAt(log.scheduledDate, log.scheduledTime, zone);
    if (!(scheduledAt > cutoff && scheduledAt <= now)) continue;

    missedDoses.add(`${log.medicineId ?? log._id}:${scheduledAt.getTime()}`);
    const recordedAt = log.outcomeRecordedAt ?? scheduledAt;
    if (previous && recordedAt > previous.occurredAt && recordedAt <= now) {
      hasNewMiss = true;
    }
  }

  if (missedDoses.size < MIN_MISSED_DOSES || (previous && !hasNewMiss)) return;

  // Concurrent runs use the same key until the previous summary changes.
  await processMedicationAlertEvent({
    eventKey: `repeated-missed:${patientId}:${previous?._id.toString() ?? 'first'}`,
    patientId,
    eventType: 'REPEATED_MISSED_DOSES',
    occurredAt: now,
    metadata: { missedDoseCount: missedDoses.size },
  });
}