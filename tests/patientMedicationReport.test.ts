import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MedicationReportError,
  resolveMedicationReportRange,
} from '../lib/patientMedicationReportCore';

const NOW = new Date(
  '2026-08-26T12:00:00.000Z',
);

test(
  'medication report defaults to the last 30 Manila calendar days',
  () => {
    const result =
      resolveMedicationReportRange(
        new URLSearchParams(),
        NOW,
      );

    assert.deepEqual(
      {
        from: result.from,
        to: result.to,
        days: result.numberOfDays,
      },
      {
        from: '2026-07-28',
        to: '2026-08-26',
        days: 30,
      },
    );
  },
);

test(
  'medication report accepts a seven-day range',
  () => {
    const result =
      resolveMedicationReportRange(
        new URLSearchParams({
          from: '2026-08-20',
          to: '2026-08-26',
        }),
        NOW,
      );

    assert.equal(
      result.numberOfDays,
      7,
    );
  },
);

test(
  'medication report accepts a valid custom range',
  () => {
    const result =
      resolveMedicationReportRange(
        new URLSearchParams({
          from: '2026-06-01',
          to: '2026-08-26',
        }),
        NOW,
      );

    assert.equal(
      result.from,
      '2026-06-01',
    );

    assert.equal(
      result.to,
      '2026-08-26',
    );
  },
);

test(
  'medication report rejects invalid calendar dates',
  () => {
    assert.throws(
      () =>
        resolveMedicationReportRange(
          new URLSearchParams({
            from: '2026-02-30',
            to: '2026-08-26',
          }),
          NOW,
        ),
      MedicationReportError,
    );
  },
);

test(
  'medication report rejects a start date after the end date',
  () => {
    assert.throws(
      () =>
        resolveMedicationReportRange(
          new URLSearchParams({
            from: '2026-08-26',
            to: '2026-08-20',
          }),
          NOW,
        ),
      /start date cannot be later/i,
    );
  },
);

test(
  'medication report rejects future end dates',
  () => {
    assert.throws(
      () =>
        resolveMedicationReportRange(
          new URLSearchParams({
            from: '2026-08-20',
            to: '2026-08-27',
          }),
          NOW,
        ),
      /cannot be later than today/i,
    );
  },
);

test(
  'medication report rejects ranges longer than 365 days',
  () => {
    assert.throws(
      () =>
        resolveMedicationReportRange(
          new URLSearchParams({
            from: '2025-08-01',
            to: '2026-08-26',
          }),
          NOW,
        ),
      /cannot exceed 365 days/i,
    );
  },
);