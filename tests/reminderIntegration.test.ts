import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as timing from '../lib/reminderTiming';
import * as medicationTime from '../lib/medicationTime';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>; // Isolated database doubles accept MongoDB update documents.
function load(path: string, dependencies: Row): Row {
  const js = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  const loadedModule = { exports: {} };
  runInNewContext(js, { module: loadedModule, exports: loadedModule.exports, require: (key: string) => {
    if (!(key in dependencies)) throw new Error(`Unmocked dependency: ${key}`);
    return dependencies[key];
  }, Date, Set, Map, Promise, process: { env: {} }, console: { error() {}, warn() {} } });
  return loadedModule.exports;
}
const query = (value: unknown) => ({ select: () => ({ lean: async () => value }), lean: async () => value });

test('family advance workflow keeps one alert and one SMS claim across repeated concurrent runs', async () => {
  const alerts = new Map<string, Row>(), deliveries = new Map<string, Row>();
  let sends = 0, approved = true, consent = true;
  const sms = load('lib/sms/delivery.ts', {
    mongoose: { isValidObjectId: () => false },
    '@/lib/sms': { configuredSmsProvider: () => 'textbee', sendSms: async () => {
      sends++; return { accepted: true, provider: 'textbee', status: 'queued' };
    } },
    '@/lib/sms/phone': { maskPhilippineMobileNumber: () => '****4567' },
    '@/models/SmsDelivery': {
      create: async (data: Row) => {
        if (deliveries.has(data.dedupeKey)) throw { code: 11000 };
        const row = { ...data, _id: data.dedupeKey }; deliveries.set(data.dedupeKey, row); return row;
      },
      findOne: ({ dedupeKey }: Row) => query(deliveries.get(dedupeKey)),
      updateOne: async ({ _id }: Row, update: Row) => Object.assign(deliveries.get(_id)!, update.$set),
    },
  });
  const family = load('lib/familyAdvanceReminders.ts', {
    './reminderTiming': timing, '@/lib/medicationTime': medicationTime,
    '@/lib/sms/delivery': sms, '@/lib/sms/phone': { normalizePhilippineMobileNumber: () => '+639171234567' },
    '@/models/MonitoringRequest': {
      find: (filter: Row) => { assert.equal(filter.status, 'approved'); return query(approved ? [{ familyId: 'family' }] : []); },
      exists: async () => approved,
    },
    '@/models/User': {
      findOne: () => query({ firstName: 'Juan', lastName: 'Cruz' }),
      find: () => query(approved ? [{ _id: 'family', notificationPreferences: { sms: true, smsConsent: consent, smsPhoneNumber: '09171234567' } }] : []),
    },
    '@/models/Alert': {
      findOneAndUpdate: async (filter: Row, update: Row) => {
        const key = `${filter.eventKey}:${filter.monitorId}`;
        if (!alerts.has(key)) alerts.set(key, { ...update.$setOnInsert, _id: key });
        return alerts.get(key);
      },
      updateOne: async () => {},
    },
  });
  const dose = { _id: 'log', userId: 'patient', medicineId: 'medicine', medicineName: 'Medicine', scheduledDate: '2026-11-18', scheduledTime: '7:00 AM' };
  const run = (time: string) => family.sendFamilyAdvanceReminders(dose, new Date(time), 'Asia/Manila');
  await run('2026-11-17T22:29:59Z'); assert.equal(alerts.size, 0);
  await Promise.all([run('2026-11-17T22:30:00Z'), run('2026-11-17T22:30:00Z')]);
  await run('2026-11-17T22:31:00Z');
  assert.equal(alerts.size, 1); assert.equal(sends, 1);
  assert.match([...alerts.values()][0].message, /Juan Cruz.*Medicine.*7:00 AM/);
  dose.scheduledTime = '8:00 AM'; consent = false;
  await run('2026-11-17T23:30:00Z'); assert.equal(alerts.size, 2); assert.equal(sends, 1);
  dose.scheduledTime = '9:00 AM'; approved = false;
  await run('2026-11-18T00:30:00Z'); assert.equal(alerts.size, 2);
});

test('patient scheduler saves bell reminders, retries failed push without another bell record, and respects final doses', async () => {
  const deliveries = new Map<string, Row>(), notifications = new Map<string, Row>();
  let failPush = true, pushes = 0, active = true;
  const dose = { _id: 'log', userId: 'patient', medicineId: 'medicine', medicineName: 'Medicine', dosage: '1mg',
    scheduledDate: '2026-11-18', scheduledTime: '7:00 AM', status: 'pending' };
  const scheduler = load('lib/medicationReminderScheduler.ts', {
    mongoose: {}, '@/lib/medicationTime': medicationTime,
    '@/lib/familyAdvanceReminders': { sendFamilyAdvanceReminders: async () => {} },
    '@/lib/prediction/notifications': { notifyPredictedAdherenceRisk: async () => {} },
    '@/lib/medicationVerification': { ensureMedicationLogsForDate: async () => {}, finalizeExpiredMedicationLogs: async () => {} },
    '@/lib/notificationChannels': { sendWebPushToUser: async () => { pushes++; return { status: failPush ? 'FAILED' : 'SENT' }; } },
    '@/models/User': { find: () => query([{ _id: 'patient' }]) },
    '@/models/MedicationLog': { find: () => query(active ? [dose] : []), exists: async () => active, updateOne: async () => {} },
    '@/models/Notification': { updateOne: async ({ _id }: Row, update: Row) => {
      if (!notifications.has(_id)) notifications.set(_id, update.$setOnInsert);
    } },
    '@/models/MedicationReminderDelivery': {
      findOne: ({ dedupeKey }: Row) => query(deliveries.get(dedupeKey)),
      updateOne: async (filter: Row, update: Row) => {
        const key = filter.dedupeKey || filter._id;
        if (update.$setOnInsert && !deliveries.has(key)) deliveries.set(key, { ...update.$setOnInsert, _id: key });
        if (update.$set) Object.assign(deliveries.get(key)!, update.$set);
      },
      findOneAndUpdate: async (filter: Row, update: Row) => {
        const row = deliveries.get(filter.dedupeKey)!;
        if (row.status === 'sent' || row.status === 'processing' || row.nextAttemptAt > update.$set.claimedAt) return null;
        Object.assign(row, update.$set); row.attemptCount++; return { ...row };
      },
    },
  });
  await scheduler.runMedicationReminderScheduler(new Date('2026-11-17T23:00:00Z'));
  assert.equal(notifications.size, 1); assert.equal(pushes, 1);
  failPush = false;
  await scheduler.runMedicationReminderScheduler(new Date('2026-11-17T23:05:00Z'));
  assert.equal(notifications.size, 1); assert.equal(pushes, 2);
  assert.equal([...deliveries.values()][0].status, 'sent');
  await scheduler.runMedicationReminderScheduler(new Date('2026-11-17T23:05:00Z'));
  assert.equal(pushes, 2);
  active = false;
  await scheduler.runMedicationReminderScheduler(new Date('2026-11-17T23:05:00Z'));
  assert.equal(notifications.size, 1);
});