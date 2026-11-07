import test from 'node:test';
import assert from 'node:assert/strict';
import { fit, probability, metrics } from '../lib/prediction/model';
import { predictAdherence, prepareGroups, buildExamples, type PredictionLog, type PredictionResult } from '../lib/prediction/adherencePrediction';
import { predictionAlertEvent } from '../lib/prediction/alertPolicy';

const zone = 'Asia/Manila';
// Deliberate software-test fixtures. Never inserted into a database or used as
// evidence of real-patient accuracy.
function fixtures(count = 200): PredictionLog[] {
  return Array.from({ length: count }, (_, i) => {
    const at = new Date(Date.UTC(2026, 0, 1 + i, 0));
    const missed = i % 7 === 2 || i % 7 === 3;
    return { id: String(i), medicineId: 'm1', scheduledDate: at.toISOString().slice(0, 10), scheduledTime: '08:00',
      status: missed ? 'missed' : 'taken', createdAt: new Date(+at - 3600000), updatedAt: new Date(+at + 91 * 60000),
      takenAt: missed ? null : new Date(+at + 5 * 60000), lateAfterMinutes: 30, windowAfterMinutes: 90 };
  });
}
const now = new Date('2026-07-20T00:00:00Z');
const target = { scheduledDate: '2026-07-21', scheduledTime: '08:00' };

test('logistic weights are learned from labels, with deterministic finite estimates', () => {
  const rows = Array.from({ length: 100 }, (_, i) => ({ x: [i % 2], y: i % 2, at: i, knownAt: i }));
  const model = fit(rows);
  assert.ok(probability(model, [1]) > 0.8);
  assert.ok(probability(model, [0]) < 0.2);
  assert.deepEqual(fit(rows), model);
  const reversed = fit(rows.map(r => ({ ...r, y: 1 - r.y })));
  assert.ok(probability(reversed, [1]) < 0.2);
  assert.throws(() => fit([]));
});
test('metrics match known outcomes and handle absent classes without invented AUC', () => {
  const result = metrics([0, 1, 1, 0], [0.1, 0.9, 0.8, 0.3]);
  assert.ok(Math.abs(result.brier - 0.0375) < 1e-10);
  assert.equal(result.rocAuc, 1);
  assert.equal(result.precision, 1);
  assert.equal(result.recall, 1);
  assert.equal(metrics([0, 0], [0.1, 0.2]).rocAuc, null);
});
test('empty, short, and one-class histories never invent a probability or claim training', () => {
  for (const rows of [[], fixtures(20), fixtures().map(r => ({ ...r, status: 'missed', takenAt: null }))]) {
    const result = predictAdherence(rows, target, now, zone);
    assert.equal(result.status, 'insufficient_data');
    assert.equal(result.trained, false);
    assert.equal(result.probability, null);
    assert.equal(result.riskLevel, null);
  }
});
test('no upcoming dose cannot produce a prediction', () => {
  assert.equal(predictAdherence(fixtures(), null, now, zone).status, 'no_upcoming_schedule');
  assert.equal(predictAdherence(fixtures(), { scheduledDate: 'bad', scheduledTime: 'bad' }, now, zone).probability, null);
});
test('backfilled, unresolved, audit, future, invalid, and not-yet-known records are excluded', () => {
  const base = fixtures(1)[0];
  const at = new Date('2026-01-01T00:00:00Z');
  for (const change of [
    { createdAt: new Date(+at + 1) }, { status: 'pending' }, { status: 'dispensed' }, { status: 'reminder' },
    { status: 'unverified' }, { status: 'incorrect_chamber' }, { countsTowardAdherence: false },
    { takenAt: null }, { takenAt: new Date(+now + 1000) }, { scheduledDate: 'bad' },
    { updatedAt: new Date(+now + 1000) }, { windowAfterMinutes: NaN },
  ]) {
    assert.equal(prepareGroups([{ ...base, ...change }], now, zone).groups.length, 0, JSON.stringify(change));
  }
});
test('simultaneous medicines are one group; incomplete or duplicate groups are rejected', () => {
  const row = fixtures(1)[0];
  assert.equal(prepareGroups([row, { ...row, id: 'second', medicineId: 'm2' }], now, zone).groups.length, 1);
  assert.equal(prepareGroups([row, { ...row, id: 'second', medicineId: 'm2', status: 'pending' }], now, zone).groups.length, 0);
  assert.equal(prepareGroups([row, { ...row }], now, zone).groups.length, 0);
});
test('late timestamps create adverse labels using the stored per-dose threshold', () => {
  const row = fixtures(1)[0];
  const prepared = prepareGroups([{ ...row, takenAt: '2026-01-01T00:31:00Z' }], now, zone);
  assert.equal(prepared.groups[0].late, 1);
  assert.equal(prepared.groups[0].y, 1);
});
test('features never include their target outcome, future outcomes, or later-known labels', () => {
  const logs = fixtures(100);
  const groups = prepareGroups(logs, now, zone).groups;
  const original = buildExamples(groups, zone);
  const selected = groups[40];
  const changed = buildExamples(groups.map(g => g.at >= selected.at ? { ...g, y: 1 - g.y, missed: 1 - g.missed } : g), zone);
  assert.deepEqual(original.find(r => r.at === selected.at)?.x, changed.find(r => r.at === selected.at)?.x);
  const deferred = groups.map(g => g.at < selected.at ? { ...g, knownAt: selected.at + 1 } : g);
  assert.equal(buildExamples(deferred, zone).find(r => r.at === selected.at), undefined);
});
test('adequate histories fit and evaluate chronologically, with stable results on input reorder', () => {
  const rows = fixtures();
  const a = predictAdherence(rows, target, now, zone);
  assert.equal(a.trained, true);
  assert.ok(a.evaluation);
  assert.ok(a.probability! > 0 && a.probability! < 1);
  assert.ok(a.evaluation.trainCount < a.trainingExamples);
  assert.deepEqual(a, predictAdherence([...rows].reverse(), target, now, zone));
  assert.ok(a.factors.length > 0);
  const changed = rows.map((r, i) => i >= 190 ? { ...r, status: 'missed', takenAt: null } : r);
  assert.notEqual(a.probability, predictAdherence(changed, target, now, zone).probability);
});
test('stale data suppresses validated status and alerts', () => {
  const later = new Date('2026-10-01T00:00:00Z');
  const result = predictAdherence(fixtures(), { scheduledDate: '2026-10-02', scheduledTime: '08:00' }, later, zone);
  assert.equal(result.status, 'preliminary');
  assert.equal(predictionAlertEvent('patient', result, later, zone), null);
});
test('family risk alert policy gates quality, threshold, horizon, freshness, and deduplication', () => {
  const base = predictAdherence(fixtures(), target, now, zone);
  const p: PredictionResult = { ...base, status: 'validated', riskLevel: 'High', probability: 0.8,
    target: { scheduledDate: '2026-07-20', scheduledTime: '20:00' }, evaluation: { ...base.evaluation!, passed: true } };
  const event = predictionAlertEvent('patient', p, now, zone)!;
  assert.equal(event.eventType, 'PREDICTED_ADHERENCE_RISK');
  assert.match(event.message, /not a confirmed missed dose/);
  assert.equal(event.eventKey, 'adherence-prediction:patient:2026-07-20');
  for (const patch of [{ status: 'preliminary' as const }, { probability: 0.59 }, { riskLevel: 'Moderate' as const },
    { evaluation: { ...p.evaluation!, passed: false } }, { target: null }, { generatedAt: '2026-07-19T00:00:00Z' },
    { target: { scheduledDate: '2026-07-22', scheduledTime: '20:00' } }]) {
    assert.equal(predictionAlertEvent('patient', { ...p, ...patch }, now, zone), null);
  }
  assert.equal(event.eventKey, predictionAlertEvent('patient', { ...p, probability: 0.9 }, now, zone)?.eventKey);
});


test('immutable outcome receipt survives later annotation updates without future leakage', () => {
  const row = fixtures(1)[0];
  const withReceipt = { ...row, outcomeRecordedAt: row.updatedAt, updatedAt: new Date(+now + 1000) };
  assert.equal(prepareGroups([withReceipt], now, zone).groups.length, 1);
  assert.equal(prepareGroups([{ ...withReceipt, outcomeRecordedAt: new Date(+now + 1) }], now, zone).groups.length, 0);
});