import { medicationScheduledAt, parseMedicationTimeToMinutes } from '../medicationTime';
import { fit, probability, metrics, type Example } from './model';

export const MODEL_VERSION = 'personal-logistic-v1';
const DAY = 86_400_000;
export interface PredictionLog {
  id: string;
  medicineId?: string | null;
  status: string;
  scheduledDate: string;
  scheduledTime: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  takenAt?: Date | string | null;
  outcomeRecordedAt?: Date | string | null;
  countsTowardAdherence?: boolean;
  lateAfterMinutes?: number | null;
  windowAfterMinutes?: number | null;
}
export interface PredictionTarget { scheduledDate: string; scheduledTime: string }
interface Group { at: number; knownAt: number; missed: number; late: number; y: number }
const timestamp = (value?: Date | string | null) => value ? new Date(value).getTime() : NaN;
const FEATURE_NAMES = [
  'Missed fraction in last 7 groups', 'Delayed fraction in last 7 groups',
  'Problem fraction in last 28 groups', 'Recent change in problem fraction',
  'Current missed streak', 'Schedule hour (sine)', 'Schedule hour (cosine)', 'Weekend schedule',
];
export interface PredictionResult {
  modelVersion: string;
  status: 'insufficient_data' | 'preliminary' | 'validated' | 'no_upcoming_schedule' | 'unavailable';
  trained: boolean;
  probability: number | null;
  riskLevel: 'Low' | 'Moderate' | 'High' | null;
  target: PredictionTarget | null;
  generatedAt: string;
  reason: string;
  eligibleGroups: number;
  excludedRecords: number;
  trainingExamples: number;
  trainingPositives: number;
  evaluation: (ReturnType<typeof metrics> & { baselineBrier: number; baselineLogLoss: number; trainCount: number; splitAt: string; passed: boolean }) | null;
  factors: { name: string; value: number; contribution: number; direction: 'increases' | 'decreases' }[];
  historyWindowDays: number;
}

/** Only persisted final outcomes from prospectively created slots are labels.
 * updatedAt is deliberately conservative: annotations/plan rewrites can delay
 * availability, but never make a later outcome appear known in the past.
 */
export function prepareGroups(logs: PredictionLog[], now: Date, zone: string) {
  const slots = new Map<string, PredictionLog[]>();
  let excludedRecords = 0;
  for (const log of logs) {
    const at = medicationScheduledAt(log.scheduledDate, log.scheduledTime, zone).getTime();
    if (log.countsTowardAdherence === false || !Number.isFinite(at) || at >= +now) { excludedRecords++; continue; }
    const key = String(at);
    slots.set(key, [...(slots.get(key) ?? []), log]);
  }
  const groups: Group[] = [];
  for (const [key, rows] of slots) {
    const at = Number(key);
    let valid = true, knownAt = at, missed = 0, late = 0;
    const seen = new Set<string>();
    for (const row of rows) {
      const identity = row.medicineId || row.id;
      const created = timestamp(row.createdAt), updated = timestamp(row.outcomeRecordedAt ?? row.updatedAt);
      const taken = timestamp(row.takenAt);
      const lateAfter = row.lateAfterMinutes ?? 30, windowAfter = row.windowAfterMinutes ?? 90;
      if (seen.has(identity) || !Number.isFinite(created) || created > at || !Number.isFinite(updated) || updated < created || updated > +now ||
          !Number.isFinite(lateAfter) || lateAfter < 0 || !Number.isFinite(windowAfter) || windowAfter < 0 ||
          !['taken', 'late', 'missed'].includes(row.status)) { valid = false; break; }
      seen.add(identity);
      if (row.status !== 'missed' && (!Number.isFinite(taken) || taken > +now || taken < created)) { valid = false; break; }
      missed = Math.max(missed, Number(row.status === 'missed'));
      late = Math.max(late, Number(row.status === 'late' || (row.status === 'taken' && (taken - at) / 60_000 > lateAfter)));
      knownAt = Math.max(knownAt, updated, row.status === 'missed' ? at + windowAfter * 60_000 : taken);
    }
    if (!valid || knownAt > +now) { excludedRecords += rows.length; continue; }
    groups.push({ at, knownAt, missed, late, y: Number(Boolean(missed || late)) });
  }
  return { groups: groups.sort((a, b) => a.at - b.at), excludedRecords };
}
function features(history: Group[], target: PredictionTarget): number[] {
  const recent = history.slice(-7), previous = history.slice(-14, -7), longer = history.slice(-28);
  const rate = (rows: Group[], key: 'y' | 'missed' | 'late') => rows.length ? rows.reduce((s, r) => s + r[key], 0) / rows.length : 0;
  let streak = 0;
  for (let i = history.length - 1; i >= 0 && history[i].missed; i--) streak++;
  const angle = parseMedicationTimeToMinutes(target.scheduledTime) / 1440 * 2 * Math.PI;
  const weekday = new Date(`${target.scheduledDate}T12:00:00Z`).getUTCDay();
  return [rate(recent, 'missed'), rate(recent, 'late'), rate(longer, 'y'), rate(recent, 'y') - rate(previous, 'y'), Math.min(streak, 7) / 7, Math.sin(angle), Math.cos(angle), Number(weekday === 0 || weekday === 6)];
}
export function buildExamples(groups: Group[], zone: string): Example[] {
  return groups.flatMap(group => {
    const history = groups.filter(g => g.at < group.at && g.knownAt < group.at);
    if (history.length < 14) return [];
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(group.at);
    const get = (name: string) => parts.find(p => p.type === name)!.value;
    return [{ x: features(history, { scheduledDate: `${get('year')}-${get('month')}-${get('day')}`, scheduledTime: `${get('hour')}:${get('minute')}` }), y: group.y, at: group.at, knownAt: group.knownAt }];
  });
}
export function predictAdherence(logs: PredictionLog[], target: PredictionTarget | null, now: Date, zone: string): PredictionResult {
  const { groups, excludedRecords } = prepareGroups(logs, now, zone);
  const rows = buildExamples(groups, zone);
  const positives = rows.reduce((s, r) => s + r.y, 0);
  const result: PredictionResult = {
    modelVersion: MODEL_VERSION, status: 'insufficient_data', trained: false, probability: null, riskLevel: null,
    target, generatedAt: now.toISOString(), reason: '', eligibleGroups: groups.length, excludedRecords,
    trainingExamples: rows.length, trainingPositives: positives, evaluation: null, factors: [], historyWindowDays: 180,
  };
  if (!target || medicationScheduledAt(target.scheduledDate, target.scheduledTime, zone).getTime() <= +now ||
      !Number.isFinite(medicationScheduledAt(target.scheduledDate, target.scheduledTime, zone).getTime())) {
    return { ...result, status: 'no_upcoming_schedule', reason: 'No future scheduled group is available to predict.' };
  }
  if (rows.length < 60 || positives < 10 || rows.length - positives < 10 || rows[rows.length - 1].at - rows[0].at < 14 * DAY) {
    return { ...result, reason: 'Prediction needs at least 60 usable examples spanning 14 days, including 10 on-time and 10 missed-or-delayed groups, after 14 earlier groups for context. No probability is invented.' };
  }
  // Final chronological holdout; purge training labels not known by split time.
  const split = Math.floor(rows.length * 0.75);
  const test = rows.slice(split), train = rows.slice(0, split).filter(r => r.knownAt < test[0].at);
  const trainPositive = train.reduce((s, r) => s + r.y, 0);
  if (train.length >= 40 && trainPositive >= 5 && train.length - trainPositive >= 5 && test.length >= 20) {
    const validationModel = fit(train);
    const scores = metrics(test.map(r => r.y), test.map(r => probability(validationModel, r.x)));
    const baseline = metrics(test.map(r => r.y), test.map(() => trainPositive / train.length));
    result.evaluation = { ...scores, baselineBrier: baseline.brier, baselineLogLoss: baseline.logLoss, trainCount: train.length, splitAt: new Date(test[0].at).toISOString(),
      passed: scores.positives >= 5 && scores.negatives >= 5 && scores.brier < baseline.brier && scores.logLoss < baseline.logLoss && (scores.rocAuc ?? 0) >= 0.6 && (scores.precision ?? 0) >= 0.5 && (scores.recall ?? 0) >= 0.5 };
  }
  const model = fit(rows);
  const x = features(groups.filter(g => g.knownAt <= +now), target);
  const p = probability(model, x);
  const stale = +now - groups[groups.length - 1].knownAt > 14 * DAY;
  const validated = Boolean(result.evaluation?.passed) && !stale;
  return {
    ...result, trained: true, status: validated ? 'validated' : 'preliminary', probability: p,
    riskLevel: p >= 0.6 ? 'High' : p >= 0.3 ? 'Moderate' : 'Low',
    reason: validated
      ? 'Passed an initial chronological holdout check. This estimates a recorded missed or delayed outcome for the next group, not ingestion or a medical condition.'
      : stale ? 'Recent history is older than 14 days. This estimate is preliminary; family risk alerts are suppressed.'
      : 'A model was fitted to this patient’s records, but evidence is not yet sufficient for the alert validation gate. Treat this estimate as preliminary.',
    factors: x.map((value, i) => ({ name: FEATURE_NAMES[i], value, contribution: model.weights[i] * (value - model.means[i]), direction: model.weights[i] * (value - model.means[i]) >= 0 ? 'increases' as const : 'decreases' as const }))
      .filter(f => Math.abs(f.contribution) > 0.001).sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)).slice(0, 4),
  };
}