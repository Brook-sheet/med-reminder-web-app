import type { PredictionResult } from './adherencePrediction';
import { getMedicationDateKey, medicationScheduledAt } from '../medicationTime';

export function predictionAlertEvent(patientId: string, prediction: PredictionResult, now: Date, zone: string) {
  if (prediction.status !== 'validated' || !prediction.evaluation?.passed || prediction.riskLevel !== 'High' ||
      prediction.probability === null || prediction.probability < 0.6 || !prediction.target) return null;
  const until = +medicationScheduledAt(prediction.target.scheduledDate, prediction.target.scheduledTime, zone) - +now;
  if (until <= 0 || until > 24 * 60 * 60_000 || Math.abs(+now - +new Date(prediction.generatedAt)) > 5 * 60_000) return null;
  return {
    // Independent from medication-final keys; at most one risk alert per local day/recipient.
    eventKey: `adherence-prediction:${patientId}:${getMedicationDateKey(now, zone)}`,
    patientId,
    eventType: 'PREDICTED_ADHERENCE_RISK' as const,
    title: 'Predicted adherence risk — check-in suggested',
    message: `The next medication group on ${prediction.target.scheduledDate} at ${prediction.target.scheduledTime} (${zone}) has an estimated ${Math.round(prediction.probability * 100)}% chance of a recorded missed or delayed outcome. This is a prediction, not a confirmed missed dose. Please offer a reminder or check in.`,
    occurredAt: now,
    metadata: { modelVersion: prediction.modelVersion, probability: prediction.probability, target: prediction.target, evaluation: prediction.evaluation, factors: prediction.factors, trainingExamples: prediction.trainingExamples },
  };
}