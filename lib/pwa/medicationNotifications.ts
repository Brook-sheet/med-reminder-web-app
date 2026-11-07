import mongoose from "mongoose";

import type {
  IMedicationLogDocument,
} from "@/models/MedicationLog";

import {
  connectDB,
} from "@/lib/mongodb";

import {
  sendWebPushToUser,
  type NotificationPayload,
} from "@/lib/notificationChannels";

import PwaDelivery from "@/models/PwaDelivery";
import MonitoringRequest from "@/models/MonitoringRequest";
import Notification from "@/models/Notification";
import User from "@/models/User";

interface MedicationState {
  _id:
    mongoose.Types.ObjectId;

  userId:
    mongoose.Types.ObjectId;

  medicineId?:
    | mongoose.Types.ObjectId
    | null;

  medicineName: string;
  status: string;
  updatedAt?: Date;
  takenAt?: Date | null;
  outcomeRecordedAt?: Date | null;
}

const titles:
  Record<string, string> = {
  dispensed:
    "Medication successfully dispensed",

  taken:
    "Medication pickup confirmed",

  late:
    "Late medication pickup confirmed",

  missed:
    "Medication missed",

  incorrect_chamber:
    "Incorrect medication access",

  unverified:
    "Medication pickup could not be verified",
};

async function enqueue(
  log: MedicationState,
  userId: string,
  patientId?: string
) {
  const type = [
    "taken",
    "late",
  ].includes(log.status)
    ? "intake_confirmed"
    : "medication_alert";

  const payload:
    NotificationPayload = {
    title:
      titles[log.status],

    body:
      `${log.medicineName}: ` +
      `${titles[log.status].toLowerCase()}.`,

    type,

    logId:
      log._id.toString(),

    medicineId:
      log.medicineId?.toString(),

    medicineName:
      log.medicineName,

    url:
      patientId
        ? "/alerts"
        : "/history",

    screen:
      patientId
        ? "alerts"
        : "history",
  };

  if (
    log.status === "dispensed"
  ) {
    payload.url =
      patientId
        ? "/monitor"
        : "/";
  }

  if (patientId) {
    const patient =
      await User.findById(
        patientId
      )
        .select(
          "firstName lastName"
        )
        .lean();

    const name = [
      patient?.firstName,
      patient?.lastName,
    ]
      .filter(Boolean)
      .join(" ") ||
      "Patient";

    payload.body =
      `${name}: ${payload.body}`;
  }

  await queuePwaEvent(
    `medication:${log._id}:${log.status}:${userId}`,
    userId,
    payload,
    patientId
  );
}

export async function queuePwaEvent(
  eventKey: string,
  userId: string,
  payload: NotificationPayload,
  patientId?: string
) {
  const recipient =
    await User.findOne({
      _id:
        userId,

      isDeleted: {
        $ne: true,
      },
    })
      .select(
        "notificationPreferences"
      )
      .lean();

  if (!recipient) {
    return;
  }

  const delivery =
    await PwaDelivery.findOneAndUpdate(
      {
        eventKey,
      },
      {
        $setOnInsert: {
          eventKey,
          userId,
          patientId,
          payload,

          expiresAt:
            new Date(
              Date.now() +
                15 * 60000
            ),
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

  if (
    recipient
      .notificationPreferences
      ?.inApp !== false
  ) {
    await Notification.updateOne(
      {
        _id:
          delivery._id,
      },
      {
        $setOnInsert: {
          userId,

          type:
            payload.type,

          title:
            payload.title,

          message:
            payload.body,

          url:
            payload.url,

          screen:
            payload.screen,

          medicineName:
            payload.medicineName,

          medicationLogId:
            payload.logId,

          read:
            false,
        },
      },
      {
        upsert: true,
        runValidators: true,
      }
    );
  }
}

export async function queueMedicationState(
  log: MedicationState
) {
  if (
    !titles[log.status]
  ) {
    return;
  }

  try {
    await enqueue(
      log,
      log.userId.toString()
    );

    /*
     * Existing alertEngine continues
     * to send final taken, missed,
     * and risk alerts to family.
     */
    if (
      log.status === "dispensed"
    ) {
      const links =
        await MonitoringRequest.find({
          patientId:
            log.userId,

          status:
            "approved",
        })
          .select(
            "familyId"
          )
          .lean();

      for (
        const link of links
      ) {
        await enqueue(
          log,
          link.familyId.toString(),
          log.userId.toString()
        );
      }
    }

    await drainPwaDeliveries(
      log.userId.toString()
    );
  } catch (error) {
    console.error(
      "[PWA medication queue]",
      error
    );
  }
}

export async function drainPwaDeliveries(
  userId?: string
) {
  await connectDB();

  let sent = 0;

  /*
   * Process a bounded batch.
   * Cron retries pending records.
   */
  for (
    let i = 0;
    i < 50;
    i++
  ) {
    const now =
      new Date();

    const delivery =
      await PwaDelivery.findOneAndUpdate(
        {
          ...(userId
            ? { userId }
            : {}),

          status:
            "pending",

          attempts: {
            $lt: 5,
          },

          nextAttemptAt: {
            $lte: now,
          },

          leaseUntil: {
            $lte: now,
          },

          expiresAt: {
            $gt: now,
          },
        },
        {
          $set: {
            leaseUntil:
              new Date(
                now.getTime() +
                  120000
              ),
          },

          $inc: {
            attempts: 1,
          },
        },
        {
          new: true,

          sort: {
            nextAttemptAt: 1,
          },
        }
      );

    if (!delivery) {
      break;
    }

    try {
      const user =
        await User.findOne({
          _id:
            delivery.userId,

          isDeleted: {
            $ne: true,
          },
        })
          .select(
            "notificationPreferences"
          )
          .lean();

      const relationship =
        !delivery.patientId ||
        (
          await MonitoringRequest.exists({
            patientId:
              delivery.patientId,

            familyId:
              delivery.userId,

            status:
              "approved",
          })
        );

      if (
        !user ||
        !relationship ||
        user
          .notificationPreferences
          ?.push === false
      ) {
        await PwaDelivery.updateOne(
          {
            _id:
              delivery._id,
          },
          {
            $set: {
              status:
                "skipped",
            },
          }
        );

        continue;
      }

      const result =
        await sendWebPushToUser(
          delivery.userId.toString(),
          delivery.payload
        );

      if (
        result.status === "FAILED"
      ) {
        throw new Error(
          result.error
        );
      }

      await PwaDelivery.updateOne(
        {
          _id:
            delivery._id,
        },
        {
          $set: {
            status:
              result.status === "SENT"
                ? "sent"
                : "skipped",
          },
        }
      );

      if (
        result.status === "SENT"
      ) {
        sent++;
      }
    } catch (error) {
      console.error(
        "[PWA medication delivery]",
        error
      );

      await PwaDelivery.updateOne(
        {
          _id:
            delivery._id,
        },
        {
          $set: {
            nextAttemptAt:
              new Date(
                Date.now() +
                  60000
              ),

            leaseUntil:
              new Date(0),
          },
        }
      );
    }
  }

  return { sent };
}

export async function recoverRecentMedicationNotifications() {
  const MedicationLog = (
    await import(
      "@/models/MedicationLog"
    )
  ).default;

  const cutoff =
    new Date(
      Date.now() -
        10 * 60000
    );

  const recoverableStatuses:
    IMedicationLogDocument["status"][] = [
    "dispensed",
    "taken",
    "late",
    "missed",
    "incorrect_chamber",
    "unverified",
  ];

  const logs =
    MedicationLog.find({
      status: {
        $in:
          recoverableStatuses,
      },

      updatedAt: {
        $gte:
          cutoff,
      },
    }).cursor();

  for await (
    const log of logs
  ) {
    const occurred =
      log.status === "dispensed"
        ? log.updatedAt
        : log.outcomeRecordedAt ||
          log.takenAt ||
          log.updatedAt;

    if (
      occurred &&
      new Date(occurred) >= cutoff
    ) {
      await queueMedicationState(
        log
      );
    }
  }

  return drainPwaDeliveries();
}