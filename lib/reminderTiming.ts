/** Inclusive start, exclusive end. Late workers never send a pre-dose reminder after due time. */
export function isReminderWindow(now: Date, start: number, end: number): boolean {
  const timestamp = now.getTime();
  return Number.isFinite(timestamp) && Number.isFinite(start) && Number.isFinite(end) &&
    timestamp >= start && timestamp < end;
}

export function isFamilyAdvanceWindow(now: Date, scheduled: Date): boolean {
  return isReminderWindow(now, scheduled.getTime() - 30 * 60000, scheduled.getTime());
}