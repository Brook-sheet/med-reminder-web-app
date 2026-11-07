import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Execute actual integration modules with isolated database/network boundaries.
// These are not live MongoDB, push, or SMS delivery tests.
function loadSource(path: string, dependencies: Record<string, unknown>) {
  const source = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const loadedModule = { exports: {} };
  runInNewContext(source, { module: loadedModule, exports: loadedModule.exports, require: (name: string) => {
    if (!(name in dependencies)) throw new Error(`Unmocked dependency ${name}`);
    return dependencies[name];
  }, console: { error: () => {} }, Date, Set, Map, Promise });
  return loadedModule.exports as Record<string, (...args: unknown[]) => Promise<unknown>>;
}
const id = '123456789012345678901234';
class ObjectId {
  constructor(private value: string) {}
  toString() { return this.value; }
}

test('predictive family alerts reuse approved recipients, dedupe, and never call SMS; final SMS still works', async () => {
  const created: Record<string, unknown>[] = [], pushed: string[] = [], sms: unknown[] = [];
  const keys = new Set<string>();
  const engine = loadSource('lib/alertEngine.ts', {
    mongoose: { isValidObjectId: () => true, Types: { ObjectId } },
    '@/lib/mongodb': { connectDB: async () => {} },
    '@/lib/medicationTime': { resolveMedicationTimeZone: () => 'Asia/Manila', formatMedicationDateLabel: () => 'July 20, 2026', medicationScheduledAt: () => new Date(), formatMedicationTime: () => '8:00 AM' },
    '@/lib/notificationChannels': { sendWebPushToUser: async (userId: string) => { pushed.push(userId); return { status: 'SENT' }; } },
    '@/lib/sms/delivery': { claimAndSendSms: async (input: unknown) => { sms.push(input); return { result: { status: 'sent', accepted: true } }; } },
    '@/lib/sms/phone': { normalizePhilippineMobileNumber: () => '+639171234567' },
    '@/models/MonitoringRequest': { find: (query: Record<string, unknown>) => {
      assert.equal(query.status, 'approved');
      return { select: () => ({ lean: async () => [{ familyId: 'family' }] }) };
    } },
    '@/models/User': {
      findOne: () => ({ select: async () => ({ _id: new ObjectId(id), firstName: 'Patient' }) }),
      find: (query: Record<string, unknown>) => {
        assert.equal(query.role, 'family');
        assert.equal((query.isDeleted as Record<string, unknown>).$ne, true);
        assert.equal(((query._id as Record<string, unknown>).$in as string[])[0], 'family');
        return { select: () => ({ lean: async () => [{ _id: new ObjectId(id), notificationPreferences: { push: true, sms: true, smsConsent: true, smsPhoneNumber: '+639171234567' } }] }) };
      },
    },
    '@/models/Alert': {
      create: async (input: Record<string, unknown>) => {
        const key = `${input.eventKey}:${input.monitorId}`;
        if (keys.has(key)) throw { code: 11000 };
        keys.add(key); created.push(input);
        return { ...input, _id: new ObjectId(id) };
      },
      updateOne: async () => {},
    },
  });
  const event = { patientId: id, eventKey: 'adherence-prediction:today', eventType: 'PREDICTED_ADHERENCE_RISK', title: 'Predicted risk', message: 'Prediction, not a confirmed event.' };
  await engine.processMedicationAlertEvent(event);
  await engine.processMedicationAlertEvent(event);
  assert.equal(created.length, 1);
  assert.equal(pushed.length, 1);
  assert.equal(sms.length, 0);
  assert.equal((created[0].channels as Record<string, unknown>).sms, false);
  await engine.processMedicationAlertEvent({ ...event, eventKey: 'taken', eventType: 'MEDICATION_VERIFIED', medicationLogId: id });
  assert.equal(sms.length, 1);
  assert.equal(created[1].eventKey, `medication-final:${id}`);
});

test('prediction service scopes history to patient/reset and performs only reads', async () => {
  let capturedQuery: Record<string, unknown> = {};
  const reset = new Date('2026-01-01');
  const fakePrediction = { status: 'insufficient_data' };
  const service = loadSource('lib/prediction/service.ts', {
    '@/models/User': { findOne: (query: Record<string, unknown>) => {
      assert.equal(query._id, id); assert.equal(query.role, 'patient');
      return { select: () => ({ lean: async () => ({ dataResetAt: reset }) }) };
    } },
    '@/models/Medicine': { find: () => ({ select: () => ({ lean: async () => [] }) }) },
    '@/models/MedicationLog': { find: (query: Record<string, unknown>) => {
      capturedQuery = query;
      return { select: () => ({ sort: () => ({ limit: (limit: number) => { assert.equal(limit, 5001); return { lean: async () => [] }; } }) }) };
    } },
    '@/lib/medicationTime': { resolveMedicationTimeZone: () => 'Asia/Manila', getMedicationDateKey: () => '2026-07-20', addDaysToMedicationDateKey: () => '2026-01-21' },
    './adherencePrediction': { predictAdherence: () => fakePrediction },
  });
  assert.equal(await service.getPatientPrediction(id), fakePrediction);
  assert.equal(capturedQuery.userId, id);
  assert.equal((capturedQuery.createdAt as Record<string, unknown>).$gt, reset);
});