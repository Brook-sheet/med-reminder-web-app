import {
  addDaysToMedicationDateKey,
  getMedicationDateKey,
  resolveMedicationTimeZone,
} from './medicationTime';

export const MAX_MEDICATION_REPORT_DAYS = 365;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class MedicationReportError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'MedicationReportError';
    this.status = status;
  }
}

function isValidDateKey(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;

  const parsed = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function inclusiveDays(from: string, to: string): number {
  return (
    Math.round(
      (new Date(`${to}T00:00:00.000Z`).getTime() -
        new Date(`${from}T00:00:00.000Z`).getTime()) /
        86_400_000,
    ) + 1
  );
}

export function resolveMedicationReportRange(
  searchParams: URLSearchParams,
  now = new Date(),
): {
  from: string;
  to: string;
  numberOfDays: number;
  timeZone: string;
} {
  const timeZone = resolveMedicationTimeZone('Asia/Manila');
  const today = getMedicationDateKey(now, timeZone);
  const requestedFrom = searchParams.get('from')?.trim() ?? '';
  const requestedTo = searchParams.get('to')?.trim() ?? '';

  if (!requestedFrom && !requestedTo) {
    return {
      from: addDaysToMedicationDateKey(today, -29),
      to: today,
      numberOfDays: 30,
      timeZone,
    };
  }

  if (!requestedFrom || !requestedTo) {
    throw new MedicationReportError(
      'Both from and to dates are required in YYYY-MM-DD format.',
    );
  }

  if (!isValidDateKey(requestedFrom) || !isValidDateKey(requestedTo)) {
    throw new MedicationReportError(
      'Invalid report date. Use the YYYY-MM-DD format.',
    );
  }

  if (requestedFrom > requestedTo) {
    throw new MedicationReportError(
      'The report start date cannot be later than the end date.',
    );
  }

  if (requestedTo > today) {
    throw new MedicationReportError(
      'The report end date cannot be later than today in Asia/Manila.',
    );
  }

  const numberOfDays = inclusiveDays(requestedFrom, requestedTo);

  if (numberOfDays > MAX_MEDICATION_REPORT_DAYS) {
    throw new MedicationReportError(
      `The report range cannot exceed ${MAX_MEDICATION_REPORT_DAYS} days.`,
    );
  }

  return {
    from: requestedFrom,
    to: requestedTo,
    numberOfDays,
    timeZone,
  };
}