import mongoose from "mongoose";

import {
  ensureMedicationLogsForDate,
  finalizeExpiredMedicationLogs,
} from "@/lib/medicationVerification";

import {
  addDaysToMedicationDateKey,
  getMedicationDateKey,
  medicationScheduledAt,
  resolveMedicationTimeZone,
} from "@/lib/medicationTime";

import {
  sendWebPushToUser,
  type ChannelDeliveryResult,
} from "@/lib/notificationChannels";

import MedicationLog from "@/models/MedicationLog";

import MedicationReminderDelivery, {
  type IMedicationReminderDeliveryDocument,
  type MedicationReminderType,
} from "@/models/MedicationReminderDelivery";

import Notification from "@/models/Notification";
import User from "@/models/User";

const MINUTE_IN_MILLISECONDS =
  60_000;

const DAY_IN_MILLISECONDS =
  24 * 60 * MINUTE_IN_MILLISECONDS;

const UPCOMING_REMINDER_MINUTES =
  getNumberEnvironmentVariable(
    "MEDICATION_UPCOMING_MINUTES",
    30,
    1,
    720
  );

const DUE_REMINDER_GRACE_MINUTES =
  getNumberEnvironmentVariable(
    "MEDICATION_DUE_GRACE_MINUTES",
    5,
    1,
    60
  );

const MAX_DELIVERY_ATTEMPTS =
  getNumberEnvironmentVariable(
    "MEDICATION_REMINDER_MAX_ATTEMPTS",
    5,
    1,
    20
  );

const RETRY_DELAY_MINUTES =
  getNumberEnvironmentVariable(
    "MEDICATION_REMINDER_RETRY_MINUTES",
    5,
    1,
    120
  );

const PROCESSING_LEASE_MINUTES =
  10;

const DELIVERY_RETENTION_DAYS =
  90;

interface SchedulerUser {
  _id: mongoose.Types.ObjectId;

  firstName?: string;

  notificationPreferences?: {
    inApp?: boolean;
    push?: boolean;
  };
}

interface SchedulerMedicationLog {
  _id: mongoose.Types.ObjectId;

  userId: mongoose.Types.ObjectId;

  medicineId?: mongoose.Types.ObjectId | null;

  medicineName: string;

  dosage: string;

  scheduledDate: string;

  scheduledTime: string;

  status: string;

  countsTowardAdherence?: boolean;
}

interface ReminderContent {
  title: string;
  message: string;
}

export interface MedicationReminderSchedulerResult {
  timeZone: string;

  checkedAt: string;

  patientsChecked: number;

  logsChecked: number;

  sent: number;

  failed: number;

  skipped: number;

  invalidSchedules: number;

  errors: string[];
}

function getNumberEnvironmentVariable(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  const rawValue =
    process.env[name]?.trim();

  if (!rawValue) {
    return fallback;
  }

  const parsedValue =
    Number(rawValue);

  if (
    !Number.isFinite(parsedValue) ||
    parsedValue < minimum ||
    parsedValue > maximum
  ) {
    console.warn(
      `[Medication Reminder Scheduler] ${name} is invalid. Using ${fallback}.`
    );

    return fallback;
  }

  return Math.floor(parsedValue);
}

function getMinutesUntilSchedule(
  log: SchedulerMedicationLog,
  now: Date,
  timeZone: string
): number | null {
  const scheduleTime =
    medicationScheduledAt(
      log.scheduledDate,
      log.scheduledTime,
      timeZone,
    );

  if (Number.isNaN(scheduleTime.getTime())) {
    return null;
  }

  const difference =
    (scheduleTime.getTime() - now.getTime()) /
    MINUTE_IN_MILLISECONDS;

  return difference > 0
    ? Math.ceil(difference)
    : Math.floor(difference);
}

function getReminderType(
  minutesUntilSchedule: number
): MedicationReminderType | null {
  if (
    minutesUntilSchedule > 0 &&
    minutesUntilSchedule <=
      UPCOMING_REMINDER_MINUTES
  ) {
    return "upcoming_reminder";
  }

  if (
    minutesUntilSchedule <= 0 &&
    minutesUntilSchedule >=
      -DUE_REMINDER_GRACE_MINUTES
  ) {
    return "due_alarm";
  }

  return null;
}

function getReminderContent(
  log: SchedulerMedicationLog,
  reminderType: MedicationReminderType
): ReminderContent {
  const medication =
    `${log.medicineName} ${log.dosage}`
      .trim();

  if (
    reminderType ===
    "upcoming_reminder"
  ) {
    return {
      title:
        "Upcoming Medication",

      message:
        `${medication} is scheduled at ${log.scheduledTime}.`,
    };
  }

  return {
    title:
      "Medication Due Now",

    message:
      `It is time to take ${medication}.`,
  };
}

function isDuplicateKeyError(
  error: unknown
): boolean {
  return (
    typeof error ===
      "object" &&
    error !== null &&
    "code" in error &&
    (
      error as {
        code?: number;
      }
    ).code === 11000
  );
}

async function ensureDeliveryRecord(
  log: SchedulerMedicationLog,
  reminderType: MedicationReminderType,
  scheduledFor: Date,
  now: Date
): Promise<string> {
  const dedupeKey =
    `${log._id.toString()}:${reminderType}`;

  const expireAt =
    new Date(
      now.getTime() +
        DELIVERY_RETENTION_DAYS *
          DAY_IN_MILLISECONDS
    );

  try {
    await MedicationReminderDelivery.updateOne(
      {
        dedupeKey,
      },
      {
        $setOnInsert: {
          dedupeKey,

          userId:
            log.userId,

          medicationLogId:
            log._id,

          medicineId:
            log.medicineId ??
            null,

          reminderType,

          scheduledDate:
            log.scheduledDate,

          scheduledTime:
            log.scheduledTime,

          scheduledFor,

          status:
            "pending",

          attemptCount:
            0,

          nextAttemptAt:
            now,

          expireAt,
        },
      },
      {
        upsert: true,
      }
    );
  } catch (error) {
    if (
      !isDuplicateKeyError(
        error
      )
    ) {
      throw error;
    }
  }

  return dedupeKey;
}

async function claimDelivery(
  dedupeKey: string,
  now: Date
): Promise<IMedicationReminderDeliveryDocument | null> {
  const staleClaimTime =
    new Date(
      now.getTime() -
        PROCESSING_LEASE_MINUTES *
          MINUTE_IN_MILLISECONDS
    );

  return MedicationReminderDelivery.findOneAndUpdate(
    {
      dedupeKey,

      attemptCount: {
        $lt:
          MAX_DELIVERY_ATTEMPTS,
      },

      $or: [
        {
          status:
            "pending",

          nextAttemptAt: {
            $lte: now,
          },
        },

        {
          status:
            "failed",

          nextAttemptAt: {
            $lte: now,
          },
        },

        {
          status:
            "processing",

          claimedAt: {
            $lte:
              staleClaimTime,
          },
        },
      ],
    },
    {
      $set: {
        status:
          "processing",

        claimedAt:
          now,

        lastAttemptAt:
          now,

        lastError:
          "",
      },

      $inc: {
        attemptCount:
          1,
      },
    },
    {
      new: true,
    }
  );
}

async function createInAppNotification(
  delivery: IMedicationReminderDeliveryDocument,
  log: SchedulerMedicationLog,
  reminderType: MedicationReminderType,
  content: ReminderContent
): Promise<mongoose.Types.ObjectId> {
  if (
    delivery.notificationId
  ) {
    return delivery.notificationId;
  }

  /*
   * medicineId is deliberately added only when it exists.
   *
   * Notification.medicineId is optional, but its Mongoose
   * type does not accept an explicit null value.
   */
  const notificationData: Record<
    string,
    unknown
  > = {
    userId:
      log.userId,

    type:
      reminderType,

    title:
      content.title,

    message:
      content.message,

    medicineName:
      log.medicineName,

    medicationLogId:
      log._id,

    screen:
      "dashboard",

    url:
      "/",

    read:
      false,
  };

  if (log.medicineId) {
    notificationData.medicineId =
      log.medicineId;
  }

  const notification =
    new Notification(
      notificationData
    );

  await notification.save();

  const notificationId =
    notification._id as mongoose.Types.ObjectId;

  await MedicationReminderDelivery.updateOne(
    {
      _id:
        delivery._id,

      $or: [
        {
          notificationId: {
            $exists: false,
          },
        },

        {
          notificationId:
            null,
        },
      ],
    },
    {
      $set: {
        notificationId,
      },
    }
  );

  return notificationId;
}

async function completeDelivery(
  deliveryId: mongoose.Types.ObjectId,
  now: Date,
  pushResult?: ChannelDeliveryResult
): Promise<void> {
  await MedicationReminderDelivery.updateOne(
    {
      _id:
        deliveryId,
    },
    {
      $set: {
        status:
          "sent",

        deliveredAt:
          now,

        claimedAt:
          null,

        lastError:
          pushResult?.error ||
          "",
      },
    }
  );
}

async function failDelivery(
  deliveryId: mongoose.Types.ObjectId,
  error: unknown,
  now: Date
): Promise<void> {
  const message =
    error instanceof Error
      ? error.message
      : "Medication reminder delivery failed.";

  await MedicationReminderDelivery.updateOne(
    {
      _id:
        deliveryId,
    },
    {
      $set: {
        status:
          "failed",

        claimedAt:
          null,

        nextAttemptAt:
          new Date(
            now.getTime() +
              RETRY_DELAY_MINUTES *
                MINUTE_IN_MILLISECONDS
          ),

        lastError:
          message.slice(
            0,
            500
          ),
      },
    }
  );
}

async function deliverReminder(
  user: SchedulerUser,
  log: SchedulerMedicationLog,
  reminderType: MedicationReminderType,
  minutesUntilSchedule: number,
  now: Date
): Promise<
  | "sent"
  | "failed"
  | "skipped"
> {
  const scheduledFor =
    new Date(
      now.getTime() +
        minutesUntilSchedule *
          MINUTE_IN_MILLISECONDS
    );

  const dedupeKey =
    await ensureDeliveryRecord(
      log,
      reminderType,
      scheduledFor,
      now
    );

  const delivery =
    await claimDelivery(
      dedupeKey,
      now
    );

  if (!delivery) {
    return "skipped";
  }

  const inAppEnabled =
    user.notificationPreferences
      ?.inApp !== false;

  const pushEnabled =
    user.notificationPreferences
      ?.push !== false;

  if (
    !inAppEnabled &&
    !pushEnabled
  ) {
    await completeDelivery(
      delivery._id,
      now,
      {
        status:
          "SKIPPED",

        error:
          "The user disabled medication notifications.",
      }
    );

    return "skipped";
  }

  const content =
    getReminderContent(
      log,
      reminderType
    );

  try {
    if (inAppEnabled) {
      await createInAppNotification(
        delivery,
        log,
        reminderType,
        content
      );
    }

    let pushResult:
      | ChannelDeliveryResult
      | undefined;

    if (pushEnabled) {
      pushResult =
        await sendWebPushToUser(
          log.userId.toString(),
          {
            title:
              content.title,

            body:
              content.message,

            type:
              reminderType,

            screen:
              "dashboard",

            url:
              "/",

            medicineName:
              log.medicineName,
          }
        );

      if (
        pushResult.status ===
        "FAILED"
      ) {
        throw new Error(
          pushResult.error ||
            "Push delivery failed."
        );
      }
    }

    await completeDelivery(
      delivery._id,
      now,
      pushResult
    );

    await MedicationLog.updateOne(
      {
        _id:
          log._id,

        status:
          "pending",
      },
      {
        $set: {
          status:
            "reminder",
        },
      }
    );

    return "sent";
  } catch (error) {
    await failDelivery(
      delivery._id,
      error,
      now
    );

    console.error(
      "[Medication Reminder Scheduler] Delivery failed:",
      {
        dedupeKey,

        userId:
          log.userId.toString(),

        medicationLogId:
          log._id.toString(),

        error,
      }
    );

    return "failed";
  }
}

export async function runMedicationReminderScheduler(
  schedulerNow = new Date()
): Promise<MedicationReminderSchedulerResult> {
  const timeZone =
    resolveMedicationTimeZone();

  const result: MedicationReminderSchedulerResult =
    {
      timeZone,

      checkedAt:
        schedulerNow.toISOString(),

      patientsChecked:
        0,

      logsChecked:
        0,

      sent:
        0,

      failed:
        0,

      skipped:
        0,

      invalidSchedules:
        0,

      errors:
        [],
    };

  const currentDateKey =
    getMedicationDateKey(
      schedulerNow,
      timeZone
    );

  const dateKeys = [
    addDaysToMedicationDateKey(
      currentDateKey,
      -1
    ),

    currentDateKey,

    addDaysToMedicationDateKey(
      currentDateKey,
      1
    ),
  ];

  const patients = (
    await User.find({
      role:
        "patient",

      isDeleted: {
        $ne: true,
      },
    })
      .select(
        "_id firstName notificationPreferences"
      )
      .lean()
  ) as unknown as SchedulerUser[];

  for (const user of patients) {
    result.patientsChecked +=
      1;

    try {
      await Promise.all(
        dateKeys.map(
          (dateKey) =>
            ensureMedicationLogsForDate(
              user._id.toString(),
              dateKey
            )
        )
      );

      // Finalize unresolved schedules only after their configured medication
      // windows expire. This also creates the deduplicated family missed alert.
      await finalizeExpiredMedicationLogs(
        user._id.toString(),
        schedulerNow
      );

      const logs = (
        await MedicationLog.find({
          userId:
            user._id,

          scheduledDate: {
            $in:
              dateKeys,
          },

          status: {
            $in: [
              "pending",
              "reminder",
              "dispensed",
            ],
          },

          countsTowardAdherence: {
            $ne: false,
          },
        })
          .select(
            [
              "_id",
              "userId",
              "medicineId",
              "medicineName",
              "dosage",
              "scheduledDate",
              "scheduledTime",
              "status",
              "countsTowardAdherence",
            ].join(" ")
          )
          .lean()
      ) as unknown as SchedulerMedicationLog[];

      result.logsChecked +=
        logs.length;

      for (const log of logs) {
        const minutesUntilSchedule =
          getMinutesUntilSchedule(
            log,
            schedulerNow,
            timeZone
          );

        if (
          minutesUntilSchedule ===
          null
        ) {
          result.invalidSchedules +=
            1;

          continue;
        }

        const reminderType =
          getReminderType(
            minutesUntilSchedule
          );

        if (!reminderType) {
          continue;
        }

        const deliveryResult =
          await deliverReminder(
            user,
            log,
            reminderType,
            minutesUntilSchedule,
            schedulerNow
          );

        result[deliveryResult] +=
          1;
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown patient scheduler error.";

      result.errors.push(
        `Patient ${user._id.toString()}: ${message}`
      );

      console.error(
        "[Medication Reminder Scheduler] Patient processing failed:",
        {
          userId:
            user._id.toString(),

          error,
        }
      );
    }
  }

  return result;
}