import assert from 'node:assert/strict';
import test from 'node:test';

import {
  analyzeAdherence,
  evaluateMedicationLog,
  type RawLog,
} from '../lib/adherenceEngine';

import {
  analyzeAdaptiveIntervention,
  type RawLogForBehavior,
} from '../lib/adaptiveIntervention';

import {
  getMedicationDateKey,
  getZonedDateParts,
  isValidMedicationDateKey,
  medicationScheduledAt,
} from '../lib/medicationTime';

const MANILA = 'Asia/Manila';

function pendingDose(
  overrides: Partial<RawLog> = {},
): RawLog {
  return {
    id: 'dose-1',
    medicineId: 'medicine-1',
    medicineName: 'Test medicine',
    status: 'pending',
    scheduledDate: '2026-08-25',
    scheduledTime: '8:55 AM',
    windowAfterMinutes: 90,
    lateAfterMinutes: 30,
    countsTowardAdherence: true,
    ...overrides,
  };
}

test(
  'converts a Manila medication wall time to the correct absolute instant',
  () => {
    const scheduled = medicationScheduledAt(
      '2026-08-25',
      '8:55 AM',
      MANILA,
    );

    assert.equal(
      scheduled.toISOString(),
      '2026-08-25T00:55:00.000Z',
    );

    assert.equal(
      getMedicationDateKey(
        new Date('2026-08-24T16:30:00.000Z'),
        MANILA,
      ),
      '2026-08-25',
    );

    assert.equal(
      isValidMedicationDateKey('2026-02-28'),
      true,
    );

    assert.equal(
      isValidMedicationDateKey('2026-02-30'),
      false,
    );
  },
);

test(
  'supports IANA zones with daylight-saving transitions',
  () => {
    const scheduled = medicationScheduledAt(
      '2026-07-15',
      '9:00 AM',
      'America/New_York',
    );

    assert.equal(
      scheduled.toISOString(),
      '2026-07-15T13:00:00.000Z',
    );

    assert.deepEqual(
      getZonedDateParts(
        scheduled,
        'America/New_York',
      ),
      {
        year: 2026,
        month: 7,
        day: 15,
        hour: 9,
        minute: 0,
        second: 0,
      },
    );
  },
);

test(
  'derives upcoming, due, and missed at medication-window boundaries',
  () => {
    assert.equal(
      evaluateMedicationLog(
        pendingDose(),
        new Date('2026-08-25T00:54:59.000Z'),
        MANILA,
      ).lifecycle,
      'upcoming',
    );

    assert.equal(
      evaluateMedicationLog(
        pendingDose(),
        new Date('2026-08-25T00:55:00.000Z'),
        MANILA,
      ).lifecycle,
      'due',
    );

    assert.equal(
      evaluateMedicationLog(
        pendingDose(),
        new Date('2026-08-25T01:22:00.000Z'),
        MANILA,
      ).lifecycle,
      'due',
    );

    assert.equal(
      evaluateMedicationLog(
        pendingDose(),
        new Date('2026-08-25T02:25:00.000Z'),
        MANILA,
      ).lifecycle,
      'due',
    );

    assert.equal(
      evaluateMedicationLog(
        pendingDose(),
        new Date('2026-08-25T02:25:01.000Z'),
        MANILA,
      ).lifecycle,
      'missed',
    );
  },
);

test(
  'does not trust a premature persisted missed state before its window expires',
  () => {
    const future = evaluateMedicationLog(
      pendingDose({
        status: 'missed',
        scheduledTime: '2:00 PM',
      }),
      new Date('2026-08-25T02:00:00.000Z'),
      MANILA,
    );

    assert.equal(future.lifecycle, 'upcoming');
    assert.equal(future.eligible, false);

    const active = evaluateMedicationLog(
      pendingDose({
        status: 'missed',
      }),
      new Date('2026-08-25T01:22:00.000Z'),
      MANILA,
    );

    assert.equal(active.lifecycle, 'due');
    assert.equal(active.eligible, false);
  },
);

test(
  'classifies verified doses as taken or late from configured threshold',
  () => {
    const taken = evaluateMedicationLog(
      pendingDose({
        status: 'taken',
        takenAt: new Date(
          '2026-08-25T01:10:00.000Z',
        ),
      }),
      new Date('2026-08-25T01:10:00.000Z'),
      MANILA,
    );

    assert.equal(taken.lifecycle, 'taken');
    assert.equal(
      taken.calculatedDelayMinutes,
      15,
    );
    assert.equal(taken.eligible, true);

    const late = evaluateMedicationLog(
      pendingDose({
        status: 'taken',
        takenAt: new Date(
          '2026-08-25T01:31:00.000Z',
        ),
      }),
      new Date('2026-08-25T01:31:00.000Z'),
      MANILA,
    );

    assert.equal(late.lifecycle, 'late');
    assert.equal(
      late.calculatedDelayMinutes,
      36,
    );
    assert.equal(late.eligible, true);
  },
);

test(
  'excludes future and active-window doses from adherence and behavioral risk',
  () => {
    const now = new Date(
      '2026-08-25T01:22:00.000Z',
    );

    const analysis = analyzeAdherence(
      [
        pendingDose({
          id: 'taken',
          scheduledTime: '8:00 AM',
          status: 'taken',
          takenAt: new Date(
            '2026-08-25T00:05:00.000Z',
          ),
        }),
        pendingDose({
          id: 'active',
          scheduledTime: '8:55 AM',
        }),
        pendingDose({
          id: 'future',
          scheduledTime: '2:00 PM',
        }),
      ],
      now,
      MANILA,
    );

    assert.equal(
      analysis.features.totalDue,
      1,
    );

    assert.equal(
      analysis.features.totalTaken,
      1,
    );

    assert.equal(
      analysis.features.missedDoses,
      0,
    );

    assert.equal(
      analysis.features.duePending,
      1,
    );

    assert.equal(
      analysis.features.upcomingDoses,
      1,
    );

    assert.equal(
      analysis.features.adherenceRate,
      100,
    );

    assert.equal(
      analysis.finalRiskLevel,
      'Low',
    );
  },
);

test(
  'a new future dose alone produces insufficient data and low risk',
  () => {
    const now = new Date(
      '2026-08-25T02:00:00.000Z',
    );

    const analysis = analyzeAdherence(
      [
        pendingDose({
          scheduledTime: '2:00 PM',
        }),
      ],
      now,
      MANILA,
    );

    assert.equal(
      analysis.features.totalDue,
      0,
    );

    assert.equal(
      analysis.features.missedDoses,
      0,
    );

    assert.equal(
      analysis.features.hasSufficientData,
      false,
    );

    assert.equal(
      analysis.finalRiskLevel,
      'Low',
    );
  },
);

test(
  'counts multiple finalized doses correctly while excluding active schedules',
  () => {
    const now = new Date(
      '2026-08-25T04:00:00.000Z',
    );

    const analysis = analyzeAdherence(
      [
        pendingDose({
          id: 'taken',
          scheduledTime: '8:00 AM',
          status: 'taken',
          takenAt: new Date(
            '2026-08-25T00:05:00.000Z',
          ),
        }),
        pendingDose({
          id: 'late',
          scheduledTime: '9:00 AM',
          status: 'late',
          takenAt: new Date(
            '2026-08-25T01:40:00.000Z',
          ),
        }),
        pendingDose({
          id: 'active',
          scheduledTime: '11:30 AM',
        }),
        pendingDose({
          id: 'missed',
          scheduledDate: '2026-08-24',
          scheduledTime: '8:00 AM',
          status: 'pending',
        }),
      ],
      now,
      MANILA,
    );

    assert.equal(
      analysis.features.totalDue,
      3,
    );

    assert.equal(
      analysis.features.totalTaken,
      2,
    );

    assert.equal(
      analysis.features.delayedDoses,
      1,
    );

    assert.equal(
      analysis.features.missedDoses,
      1,
    );

    assert.equal(
      analysis.features.duePending,
      1,
    );

    assert.equal(
      analysis.features.adherenceRate,
      50,
    );
  },
);

test(
  'handles Manila day rollover without moving schedules to the wrong date',
  () => {
    const now = new Date(
      '2026-08-25T16:10:00.000Z',
    );

    const previousNight =
      evaluateMedicationLog(
        pendingDose({
          scheduledDate: '2026-08-25',
          scheduledTime: '11:30 PM',
        }),
        now,
        MANILA,
      );

    const nextDose =
      evaluateMedicationLog(
        pendingDose({
          scheduledDate: '2026-08-26',
          scheduledTime: '1:00 AM',
        }),
        now,
        MANILA,
      );

    assert.equal(
      getMedicationDateKey(now, MANILA),
      '2026-08-26',
    );

    assert.equal(
      previousNight.lifecycle,
      'due',
    );

    assert.equal(
      nextDose.lifecycle,
      'upcoming',
    );
  },
);

test(
  'wrong-chamber and unverified events are explicit and not successful doses',
  () => {
    const now = new Date(
      '2026-08-25T01:22:00.000Z',
    );

    const wrong = evaluateMedicationLog(
      pendingDose({
        status: 'incorrect_chamber',
      }),
      now,
      MANILA,
    );

    assert.equal(
      wrong.lifecycle,
      'incorrect_chamber',
    );

    assert.equal(
      wrong.eligible,
      false,
    );

    const analysis = analyzeAdherence(
      [
        pendingDose({
          status: 'incorrect_chamber',
        }),
        pendingDose({
          id: 'audit',
          status: 'unverified',
          countsTowardAdherence: false,
        }),
      ],
      now,
      MANILA,
    );

    assert.equal(
      analysis.features.incorrectChamberEvents,
      1,
    );

    assert.equal(
      analysis.features.unverifiedEvents,
      1,
    );

    assert.equal(
      analysis.features.totalTaken,
      0,
    );

    assert.equal(
      analysis.features.totalDue,
      0,
    );
  },
);

test(
  'adaptive analysis ignores future doses and does not escalate no-data patients',
  () => {
    const now = new Date(
      '2026-08-25T02:00:00.000Z',
    );

    const logs: RawLogForBehavior[] = [
      {
        status: 'pending',
        scheduledDate: '2026-08-25',
        scheduledTime: '2:00 PM',
        windowAfterMinutes: 90,
        lateAfterMinutes: 30,
        countsTowardAdherence: true,
      },
    ];

    const analysis = analyzeAdherence(
      logs,
      now,
      MANILA,
    );

    const adaptive =
      analyzeAdaptiveIntervention(
        logs,
        analysis.features,
        analysis.finalRiskLevel,
        analysis.finalRiskLevel,
        0,
        undefined,
        now,
        MANILA,
      );

    assert.equal(
      adaptive.behavioralPattern.peakMissHour,
      null,
    );

    assert.equal(
      adaptive.behavioralPattern.currentMissStreak,
      0,
    );

    assert.equal(
      adaptive.behavioralPattern.maxHistoricalMissStreak,
      0,
    );

    assert.equal(
      adaptive.reminderConfig.intensity,
      'minimal',
    );

    assert.equal(
      adaptive.reminderConfig.escalationEnabled,
      false,
    );

    assert.equal(
      adaptive.reminderConfig.escalationPriority,
      'none',
    );

    assert.equal(
      adaptive.reminderConfig.highSensitivityMode,
      false,
    );

    assert.deepEqual(
      adaptive.keySignals,
      [],
    );
  },
);