
/**
 * Medicine data interfaces
 *
 * Supports manually selected Rx Box chambers
 * for each scheduled medication dose.
 */

export interface MedicineChamberAssignment {
  /**
   * The scheduled medication time.
   *
   * Example: "8:00 AM"
   */
  scheduledTime: string;

  /**
   * Physical Rx Box chamber numbers.
   *
   * Valid values: 1, 2, 3, 4
   *
   * Example:
   * chamberIds: [1]
   *
   * Multiple pills may be loaded into one
   * chamber when they are intended to be
   * dispensed together.
   *
   * Multiple chambers may also be selected
   * for a single scheduled dose.
   */
  chamberIds: number[];
}

export interface Medicine {
  _id?: string;

  userId: string;

  name: string;

  dosage: string;

  frequency: string;

  scheduledTimes: string[];

  pillsPerDose: number;

  /**
   * Manually selected chamber assignments
   * for each scheduled medication dose.
   *
   * Example:
   *
   * [
   *   {
   *     scheduledTime: "8:00 AM",
   *     chamberIds: [1]
   *   },
   *   {
   *     scheduledTime: "8:00 PM",
   *     chamberIds: [3]
   *   }
   * ]
   *
   * Editing the scheduled time must not
   * automatically change the chamber.
   */
  chamberAssignments?: MedicineChamberAssignment[];

  /**
   * Legacy chamber assignment.
   *
   * Kept for compatibility with existing
   * medicine records.
   *
   * New manual assignments should use
   * chamberAssignments instead.
   */
  chamberId?: number | null;

  windowBeforeMinutes?: number;

  windowAfterMinutes?: number;

  lateAfterMinutes?: number;

  color?: string;

  notes?: string;

  startDate?: string;

  endDate?: string;

  isActive: boolean;

  createdAt?: Date;

  updatedAt?: Date;
}
