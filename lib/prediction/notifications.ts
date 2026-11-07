import { processMedicationAlertEvent } from '@/lib/alertEngine';
import { resolveMedicationTimeZone } from '@/lib/medicationTime';
import { getPatientPrediction } from './service';
import { predictionAlertEvent } from './alertPolicy';

export async function notifyPredictedAdherenceRisk(patientId: string, now = new Date()) {
  try {
    const prediction = await getPatientPrediction(patientId, now);
    const event = predictionAlertEvent(patientId, prediction, now, resolveMedicationTimeZone());
    if (event) await processMedicationAlertEvent(event);
  } catch (error) {
    console.error('[Predictive family alert] Failed without affecting medication reminders:', error);
  }
}