import {
  evaluateMedicationLog,
  extractFeatures,
  type DailyAdherence,
  type RawLog,
} from './adherenceEngine';
import {
  addDaysToMedicationDateKey,
  formatMedicationDateLabel,
  getMedicationDateKey,
  resolveMedicationTimeZone,
} from './medicationTime';

/**
 * Full stored history for the chart only.
 * Keep the engine's weekly comparisons and risk calculations unchanged.
 */
export function buildAdherenceHistory(
  logs: RawLog[],
  now = new Date(),
  requestedTimeZone?: string | null,
): DailyAdherence[] {
  const timeZone = resolveMedicationTimeZone(requestedTimeZone);
  const today = getMedicationDateKey(now, timeZone);
  const groups = new Map<string, RawLog[]>();

  for (const log of logs) {
    const evaluated = evaluateMedicationLog(log, now, timeZone);

    if (!evaluated.eligible || evaluated.scheduledAt > now) {
      continue;
    }

    const group = groups.get(log.scheduledDate) ?? [];
    group.push(log);
    groups.set(log.scheduledDate, group);
  }

  const firstDay = [...groups.keys()].sort()[0];

  if (!firstDay) {
    return [];
  }

  const result: DailyAdherence[] = [];

  for (
    let date = firstDay;
    date <= today;
    date = addDaysToMedicationDateKey(date, 1)
  ) {
    const dayLogs = groups.get(date) ?? [];

    // Reuse the existing weighted score, including late-dose handling.
    const features = dayLogs.length
      ? extractFeatures(dayLogs, now, timeZone)
      : null;

    result.push({
      date,
      label: formatMedicationDateLabel(date, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      eligible: features?.totalDue ?? 0,
      taken: features?.totalTaken ?? 0,
      adherenceRate: features?.adherenceRate ?? null,
    });
  }

  return result;
}