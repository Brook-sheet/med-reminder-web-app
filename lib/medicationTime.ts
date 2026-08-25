export const DEFAULT_MEDICATION_TIME_ZONE = 'Asia/Manila';

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface ZonedDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function resolveMedicationTimeZone(
  requestedTimeZone?: string | null,
): string {
  const candidate = requestedTimeZone?.trim() ||
    process.env.MEDICATION_TIME_ZONE?.trim() ||
    DEFAULT_MEDICATION_TIME_ZONE;

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return DEFAULT_MEDICATION_TIME_ZONE;
  }
}

export function parseMedicationTimeToMinutes(time: string): number {
  const twelveHour = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (twelveHour) {
    let hour = Number(twelveHour[1]);
    const minute = Number(twelveHour[2]);

    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return -1;

    if (twelveHour[3].toUpperCase() === 'PM' && hour !== 12) {
      hour += 12;
    }

    if (twelveHour[3].toUpperCase() === 'AM' && hour === 12) {
      hour = 0;
    }

    return hour * 60 + minute;
  }

  const twentyFourHour = time.trim().match(/^(\d{1,2}):(\d{2})$/);

  if (!twentyFourHour) return -1;

  const hour = Number(twentyFourHour[1]);
  const minute = Number(twentyFourHour[2]);

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return -1;

  return hour * 60 + minute;
}

export function getZonedDateParts(
  date: Date,
  requestedTimeZone?: string | null,
): ZonedDateParts {
  const timeZone = resolveMedicationTimeZone(requestedTimeZone);

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const values = new Map(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(values.get('year')),
    month: Number(values.get('month')),
    day: Number(values.get('day')),
    hour: Number(values.get('hour')),
    minute: Number(values.get('minute')),
    second: Number(values.get('second')),
  };
}

export function formatMedicationDateKey(
  year: number,
  month: number,
  day: number,
): string {
  return [
    String(year).padStart(4, '0'),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-');
}

export function isValidMedicationDateKey(dateKey: string): boolean {
  const match = dateKey.match(DATE_KEY_PATTERN);

  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
}

export function getMedicationDateKey(
  date = new Date(),
  requestedTimeZone?: string | null,
): string {
  const parts = getZonedDateParts(date, requestedTimeZone);

  return formatMedicationDateKey(parts.year, parts.month, parts.day);
}

export function addDaysToMedicationDateKey(
  dateKey: string,
  amount: number,
): string {
  const match = dateKey.match(DATE_KEY_PATTERN);

  if (!match || !isValidMedicationDateKey(dateKey)) {
    throw new Error(`Invalid medication date: ${dateKey}`);
  }

  const date = new Date(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]) + amount,
    ),
  );

  return formatMedicationDateKey(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  );
}

export function formatMedicationDateLabel(
  dateKey: string,
  options: Intl.DateTimeFormatOptions,
): string {
  const match = dateKey.match(DATE_KEY_PATTERN);

  if (!match) return dateKey;

  const logicalDate = new Date(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      12,
    ),
  );

  return logicalDate.toLocaleDateString('en-US', {
    ...options,
    timeZone: 'UTC',
  });
}

/**
 * Convert a medication's local calendar date/time into an absolute instant.
 */
export function medicationScheduledAt(
  dateKey: string,
  scheduledTime: string,
  requestedTimeZone?: string | null,
): Date {
  const dateMatch = dateKey.match(DATE_KEY_PATTERN);
  const scheduledMinutes = parseMedicationTimeToMinutes(scheduledTime);

  if (!dateMatch || scheduledMinutes < 0) {
    return new Date(Number.NaN);
  }

  const expected = {
    year: Number(dateMatch[1]),
    month: Number(dateMatch[2]),
    day: Number(dateMatch[3]),
    hour: Math.floor(scheduledMinutes / 60),
    minute: scheduledMinutes % 60,
  };

  const timeZone = resolveMedicationTimeZone(requestedTimeZone);

  const expectedLogicalTime = Date.UTC(
    expected.year,
    expected.month - 1,
    expected.day,
    expected.hour,
    expected.minute,
  );

  // Start with the wall-clock values interpreted as UTC, then correct the
  // guess using the target zone's actual offset. Iteration handles DST zones.
  let timestamp = expectedLogicalTime;

  for (let iteration = 0; iteration < 4; iteration += 1) {
    const actual = getZonedDateParts(new Date(timestamp), timeZone);

    const actualLogicalTime = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
    );

    const correction = expectedLogicalTime - actualLogicalTime;

    if (correction === 0) break;

    timestamp += correction;
  }

  const result = new Date(timestamp);
  const actual = getZonedDateParts(result, timeZone);

  const representsRequestedWallTime =
    actual.year === expected.year &&
    actual.month === expected.month &&
    actual.day === expected.day &&
    actual.hour === expected.hour &&
    actual.minute === expected.minute;

  return representsRequestedWallTime ? result : new Date(Number.NaN);
}

export function getMedicationMinutesOfDay(
  date = new Date(),
  requestedTimeZone?: string | null,
): number {
  const parts = getZonedDateParts(date, requestedTimeZone);

  return parts.hour * 60 + parts.minute;
}

export function formatMedicationTime(
  date: Date,
  requestedTimeZone?: string | null,
): string {
  return date.toLocaleTimeString('en-US', {
    timeZone: resolveMedicationTimeZone(requestedTimeZone),
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}