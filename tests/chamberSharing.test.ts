import assert from 'node:assert/strict';
import test from 'node:test';
import { validateChamberSharing, type ChamberMedicine } from '../lib/chamberSharing';
import { buildRxBoxDailyPlan } from '../lib/rxBoxPlanCore';
import { medicationScheduledAt } from '../lib/medicationTime';
import { isFamilyAdvanceWindow, isReminderWindow } from '../lib/reminderTiming';

const medicine = (name: string, time = '7:00 AM', startDate = '2026-11-18', endDate: string | null = null): ChamberMedicine =>
  ({ name, startDate, endDate, chamberAssignments: [{ scheduledTime: time, chamberIds: [1] }] });

test('five medicines share a chamber; the sixth is rejected', () => {
  const others = Array.from({ length: 4 }, (_, i) => medicine(`medicine-${i}`));
  assert.equal(validateChamberSharing(medicine('fifth'), others), null);
  assert.match(validateChamberSharing(medicine('sixth'), [...others, medicine('fifth')])!, /at most 5/);
});
test('equivalent time formats match, conflicting times do not', () => {
  assert.equal(validateChamberSharing(medicine('new', '07:00'), [medicine('existing')]), null);
  assert.match(validateChamberSharing(medicine('new', '8:00 AM'), [medicine('existing')])!, /7:00 AM/);
});
test('date boundaries are inclusive but sequential courses do not consume simultaneous slots', () => {
  const others = Array.from({ length: 5 }, (_, i) => medicine(`${i}`, '7:00 AM', `2026-11-${19 + i}`, `2026-11-${19 + i}`));
  assert.equal(validateChamberSharing(medicine('new'), others), null);
  assert.match(validateChamberSharing(medicine('new'), Array.from({ length: 5 }, (_, i) => medicine(`${i}`, '7:00 AM', '2026-11-17', '2026-11-18')))!, /at most 5/);
  assert.equal(validateChamberSharing(medicine('new'), [medicine('ended', '8:00 AM', '2026-11-16', '2026-11-17')]), null);
});
test('shared hardware chamber opens once and retains every medication log for verification', () => {
  const doses = Array.from({ length: 5 }, (_, i) => ({ logId: `log-${i}`, medicineId: `medicine-${i}`, medicineName: `${i}`,
    dosage: '1mg', scheduledTime: '7:00 AM', pillsPerDose: 1, medicineCreatedAt: '2026-11-17', logStatus: 'pending', chamberIds: [1] }));
  const options = { deviceId: 'box_1', date: '2026-11-18', timezone: 'Asia/Manila' };
  const plan = buildRxBoxDailyPlan(doses, options);
  assert.equal(plan.hardwareDispensingEnabled, true);
  assert.deepEqual(plan.groups[0].chamberIds, [1]);
  assert.equal(plan.groups[0].logIds.length, 5);
  const invalid = buildRxBoxDailyPlan([...doses, { ...doses[0], logId: 'six', medicineId: 'six' }], options);
  assert.equal(invalid.hardwareDispensingEnabled, false);
  assert.deepEqual(invalid.groups, []);
});
test('family advance reminder handles Manila midnight without early or post-due delivery', () => {
  const due = medicationScheduledAt('2026-11-19', '12:15 AM', 'Asia/Manila');
  assert.equal(isFamilyAdvanceWindow(new Date('2026-11-18T15:44:59Z'), due), false);
  assert.equal(isFamilyAdvanceWindow(new Date('2026-11-18T15:45:00Z'), due), true);
  assert.equal(isFamilyAdvanceWindow(new Date('2026-11-18T16:14:59Z'), due), true);
  assert.equal(isFamilyAdvanceWindow(new Date('2026-11-18T16:15:00Z'), due), false);
  assert.equal(isFamilyAdvanceWindow(new Date(), new Date('invalid')), false);
});
test('follow-up catch-up windows do not overlap or fire at the next interval', () => {
  const base = Date.parse('2026-11-18T00:00:00Z');
  const delayed = new Date(base + 25 * 60000);
  assert.equal(isReminderWindow(delayed, base + 20 * 60000, base + 40 * 60000), true);
  assert.equal(isReminderWindow(delayed, base + 40 * 60000, base + 60 * 60000), false);
  assert.equal(isReminderWindow(new Date(base + 40 * 60000), base + 20 * 60000, base + 40 * 60000), false);
});