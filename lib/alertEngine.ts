import mongoose from "mongoose";

import {
  connectDB,
} from "@/lib/mongodb";

import {
  sendWebPushToUser,
  type ChannelDeliveryResult,
} from "@/lib/notificationChannels";

import {
  claimAndSendSms,
} from "@/lib/sms/delivery";

import {
  normalizePhilippineMobileNumber,
} from "@/lib/sms/phone";

import type {
  SmsAlertType,
  SmsSendResult,
} from "@/lib/sms/types";

import Alert, {
  type AlertEventType,
  type AlertSeverity,
  type DeliveryStatus,
  type IAlertDocument,
} from "@/models/Alert";

import MonitoringRequest from "@/models/MonitoringRequest";
import User from "@/models/User";

export interface MedicationAlertEvent {
  eventKey: string;
  patientId: string;

  medicationId?:
    | string
    | null;

  medicationLogId?:
    | string
    | null;

  medicineName?:
    string;

  scheduledTime?:
    string;

  occurredAt?:
    Date;

  eventType:
    AlertEventType;

  title?:
    string;

  message?:
    string;

  metadata?:
    Record<
      string,
      unknown
    >;
}

export interface AlertEngineResult {
  created: number;
  duplicates: number;
  delivered: number;
  skipped: boolean;
  reason?: string;
  alertIds: string[];
}

interface AlertPolicy {
  createAlert: boolean;
  severity: AlertSeverity;
  push: boolean;
  sms: boolean;
  defaultTitle: string;
}

interface AlertRecipient {
  id:
    | mongoose.Types.ObjectId
    | null;

  pushEnabled:
    boolean;

  smsEnabled:
    boolean;

  smsConsented:
    boolean;

  phone?:
    string;
}

const ALERT_POLICIES:
  Record<
    AlertEventType,
    AlertPolicy
  > = {
  MEDICATION_VERIFIED: {
    createAlert:
      true,

    severity:
      "INFO",

    push:
      true,

    sms:
      true,

    defaultTitle:
      "Medication taken",
  },

  MEDICATION_LATE: {
    createAlert:
      true,

    severity:
      "NOTICE",

    push:
      true,

    sms:
      true,

    defaultTitle:
      "Medication taken late",
  },

  MEDICATION_MISSED: {
    createAlert:
      true,

    severity:
      "WARNING",

    push:
      true,

    sms:
      true,

    defaultTitle:
      "Medication missed",
  },

  MEDICATION_EVENT_WARNING: {
    createAlert:
      true,

    severity:
      "WARNING",

    push:
      true,

    sms:
      false,

    defaultTitle:
      "Medication event warning",
  },

  CRITICAL_MEDICATION_EVENT: {
    createAlert:
      true,

    severity:
      "CRITICAL",

    push:
      true,

    sms:
      true,

    defaultTitle:
      "Critical medication alert",
  },

  POSSIBLE_EXCESS_INTAKE: {
    createAlert:
      false,

    severity:
      "CRITICAL",

    push:
      false,

    sms:
      false,

    defaultTitle:
      "Potential medication incident",
  },
};

function safeObjectId(
  value?:
    | string
    | null
): mongoose.Types.ObjectId | null {
  return (
    value &&
    mongoose.isValidObjectId(
      value
    )
  )
    ? new mongoose.Types.ObjectId(
        value
      )
    : null;
}

function defaultMessage(
  event:
    MedicationAlertEvent,

  patientName:
    string
): string {
  const medicine =
    event.medicineName ||
    "a scheduled medication";

  const time =
    event.scheduledTime
      ? ` scheduled for ${event.scheduledTime}`
      : "";

  switch (
    event.eventType
  ) {
    case "MEDICATION_LATE":
      return `${patientName} took ${medicine} later than scheduled${time}.`;

    case "MEDICATION_MISSED":
      return `${patientName} did not verify ${medicine} before its medication window ended${time}.`;

    case "MEDICATION_EVENT_WARNING":
      return `${patientName} has a medication verification event that requires attention for ${medicine}.`;

    case "CRITICAL_MEDICATION_EVENT":
      return `${patientName} has a medication event requiring immediate attention.`;

    case "MEDICATION_VERIFIED":
      return `${patientName} took ${medicine}${time}.`;

    default:
      return `${patientName} has a medication event requiring review.`;
  }
}

function safePatientFirstName(
  value: string
): string {
  const firstName =
    value
      .replace(
        /[^\p{L}\p{N} .'-]/gu,
        ""
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim()
      .slice(
        0,
        40
      );

  return (
    firstName ||
    "The patient"
  );
}

function formatSmsTime(
  date: Date
): string {
  const options:
    Intl.DateTimeFormatOptions = {
    hour:
      "numeric",

    minute:
      "2-digit",

    hour12:
      true,

    timeZone:
      process.env
        .MEDICATION_TIME_ZONE ||
      "Asia/Manila",
  };

  try {
    return new Intl.DateTimeFormat(
      "en-PH",
      options
    ).format(
      date
    );
  } catch {
    return new Intl.DateTimeFormat(
      "en-PH",
      {
        ...options,

        timeZone:
          "Asia/Manila",
      }
    ).format(
      date
    );
  }
}

function smsMessage(
  event:
    MedicationAlertEvent,

  patientFirstName:
    string
): string {
  const name =
    safePatientFirstName(
      patientFirstName
    );

  const occurredAt =
    event.occurredAt ||
    new Date();

  switch (
    event.eventType
  ) {
    case "MEDICATION_VERIFIED":
      return `Rx Box Alert: ${name}'s scheduled medication was marked as taken at ${formatSmsTime(
        occurredAt
      )}. Open Rx Box for details.`;

    case "MEDICATION_LATE":
      return `Rx Box Alert: ${name}'s scheduled medication was marked as taken late at ${formatSmsTime(
        occurredAt
      )}. Open Rx Box for details.`;

    case "MEDICATION_MISSED":
      return `Rx Box Alert: ${name} missed a scheduled medication at ${
        event.scheduledTime ||
        "the scheduled time"
      }. Please check on the patient.`;

    case "CRITICAL_MEDICATION_EVENT":
      return `Rx Box Alert: ${name} has a medication event requiring immediate attention. Open Rx Box for details.`;

    default:
      return `Rx Box Alert: ${name} has a medication update. Open Rx Box for details.`;
  }
}

function smsDedupeEventKey(
  event:
    MedicationAlertEvent,

  fallbackEventKey:
    string
): string {
  const scheduledDate =
    typeof event.metadata
      ?.scheduledDate ===
    "string"
      ? event.metadata
          .scheduledDate
          .trim()
      : "";

  if (
    [
      "MEDICATION_VERIFIED",
      "MEDICATION_LATE",
      "MEDICATION_MISSED",
    ].includes(
      event.eventType
    ) &&
    scheduledDate &&
    event.scheduledTime
  ) {
    /*
     * All medicines with the same
     * patient/date/time use one
     * concise group SMS.
     */
    return `medication-final-group:${event.patientId}:${scheduledDate}:${event.scheduledTime}`;
  }

  return fallbackEventKey;
}

function smsAlertType(
  eventType:
    AlertEventType
): SmsAlertType {
  if (
    eventType ===
      "MEDICATION_EVENT_WARNING" ||
    eventType ===
      "POSSIBLE_EXCESS_INTAKE"
  ) {
    return "OTHER";
  }

  return eventType;
}

function smsDeliveryStatus(
  result:
    | SmsSendResult
    | null
): DeliveryStatus {
  switch (
    result?.status
  ) {
    case "queued":
      return "QUEUED";

    case "sent":
      return "SENT";

    case "failed":
      return "FAILED";

    default:
      return "SKIPPED";
  }
}

async function updateDelivery(
  alert:
    IAlertDocument,

  pushResult:
    ChannelDeliveryResult,

  smsResult:
    | SmsSendResult
    | null
): Promise<void> {
  await Alert.updateOne(
    {
      _id:
        alert._id,
    },
    {
      $set: {
        "delivery.pushStatus":
          alert.channels
            .push
            ? pushResult
                .status
            : "NOT_REQUESTED",

        "delivery.smsStatus":
          alert.channels
            .sms
            ? smsDeliveryStatus(
                smsResult
              )
            : "NOT_REQUESTED",

        "delivery.pushError":
          pushResult
            .error ||
          "",

        "delivery.smsError":
          smsResult
            ?.errorMessage ||
          "",
      },
    }
  );
}

async function processMedicationAlertEventInternal(
  event:
    MedicationAlertEvent
): Promise<
  AlertEngineResult
> {
  const policy =
    ALERT_POLICIES[
      event.eventType
    ];

  if (
    !policy.createAlert
  ) {
    return {
      created:
        0,

      duplicates:
        0,

      delivered:
        0,

      skipped:
        true,

      reason:
        event.eventType ===
        "POSSIBLE_EXCESS_INTAKE"
          ? "Excess-intake detection is reserved for Phase 6."
          : "This event is stored in medication history only.",

      alertIds:
        [],
    };
  }

  const requestedEventKey =
    event.eventKey.trim();

  const isFinalMedicationEvent =
    [
      "MEDICATION_VERIFIED",
      "MEDICATION_LATE",
      "MEDICATION_MISSED",
      "MEDICATION_EVENT_WARNING",
    ].includes(
      event.eventType
    );

  const eventKey =
    isFinalMedicationEvent &&
    event.medicationLogId
      ? `medication-final:${event.medicationLogId}`
      : requestedEventKey;

  if (
    !eventKey ||
    eventKey.length >
      180
  ) {
    throw new Error(
      "A valid alert eventKey is required."
    );
  }

  if (
    !mongoose.isValidObjectId(
      event.patientId
    )
  ) {
    throw new Error(
      "A valid patientId is required for alert processing."
    );
  }

  await connectDB();

  const patient =
    await User.findOne(
      {
        _id:
          event.patientId,

        role:
          "patient",

        isDeleted: {
          $ne:
            true,
        },
      }
    ).select(
      "firstName lastName"
    );

  if (!patient) {
    throw new Error(
      "Alert patient was not found."
    );
  }

  const patientName =
    `${patient.firstName || ""} ${
      patient.lastName || ""
    }`.trim() ||
    "Patient";

  const patientFirstName =
    patient.firstName ||
    "Patient";

  const relationships =
    await MonitoringRequest.find(
      {
        patientId:
          patient._id,

        status:
          "approved",
      }
    )
      .select(
        "familyId"
      )
      .lean();

  const monitorIds =
    relationships.map(
      (
        relationship
      ) =>
        relationship
          .familyId
    );

  /*
   * This projection fixes the
   * MongoDB path-collision error.
   *
   * It does not select both the
   * notificationPreferences parent
   * and smsPhoneNumber child.
   */
  const monitors =
    monitorIds.length >
    0
      ? await User.find(
          {
            _id: {
              $in:
                monitorIds,
            },

            role:
              "family",

            isDeleted: {
              $ne:
                true,
            },
          }
        )
          .select({
            "notificationPreferences.push":
              1,

            "notificationPreferences.sms":
              1,

            "notificationPreferences.smsConsent":
              1,

            "notificationPreferences.smsPhoneNumber":
              1,
          })
          .lean()
      : [];

  const recipients:
    AlertRecipient[] =
    monitors.length >
    0
      ? monitors.map(
          (
            monitor
          ) => ({
            id:
              monitor._id,

            pushEnabled:
              monitor
                .notificationPreferences
                ?.push !==
              false,

            smsEnabled:
              monitor
                .notificationPreferences
                ?.sms ===
              true,

            smsConsented:
              monitor
                .notificationPreferences
                ?.smsConsent ===
              true,

            phone:
              monitor
                .notificationPreferences
                ?.smsPhoneNumber,
          })
        )
      : [
          {
            id:
              null,

            pushEnabled:
              false,

            smsEnabled:
              false,

            smsConsented:
              false,
          },
        ];

  let created =
    0;

  let duplicates =
    0;

  let delivered =
    0;

  const alertIds:
    string[] = [];

  for (
    const recipient
    of recipients
  ) {
    const pushRequested =
      Boolean(
        recipient.id &&
        policy.push &&
        recipient
          .pushEnabled
      );

    const normalizedPhone =
      normalizePhilippineMobileNumber(
        recipient.phone
      );

    const smsRequested =
      Boolean(
        recipient.id &&
        policy.sms &&
        recipient
          .smsEnabled &&
        recipient
          .smsConsented &&
        normalizedPhone
      );

    let alert:
      IAlertDocument;

    try {
      alert =
        await Alert.create(
          {
            patientId:
              patient._id,

            monitorId:
              recipient.id,

            medicationId:
              safeObjectId(
                event.medicationId
              ),

            medicationLogId:
              safeObjectId(
                event.medicationLogId
              ),

            eventKey,

            eventType:
              event.eventType,

            severity:
              policy.severity,

            title:
              event.title ||
              policy.defaultTitle,

            message:
              event.message ||
              defaultMessage(
                event,
                patientName
              ),

            status:
              "UNREAD",

            isRead:
              false,

            occurredAt:
              event.occurredAt ||
              new Date(),

            channels: {
              inApp:
                true,

              push:
                pushRequested,

              sms:
                smsRequested,
            },

            delivery: {
              pushStatus:
                pushRequested
                  ? "PENDING"
                  : "NOT_REQUESTED",

              smsStatus:
                smsRequested
                  ? "PENDING"
                  : "NOT_REQUESTED",
            },

            metadata:
              event.metadata ||
              {},
          }
        );
    } catch (error) {
      if (
        typeof error ===
          "object" &&
        error !== null &&
        "code" in error &&
        (
          error as {
            code?: number;
          }
        ).code ===
          11000
      ) {
        duplicates +=
          1;

        continue;
      }

      throw error;
    }

    created +=
      1;

    alertIds.push(
      alert._id.toString()
    );

    if (
      !recipient.id
    ) {
      continue;
    }

    const smsKey =
      `${smsDedupeEventKey(
        event,
        eventKey
      )}:${recipient.id.toString()}:sms`;

    const [
      pushResult,
      smsDelivery,
    ] =
      await Promise.all(
        [
          pushRequested
            ? sendWebPushToUser(
                recipient.id.toString(),
                {
                  title:
                    alert.title,

                  body:
                    alert.message,

                  type:
                    "medication_alert",

                  severity:
                    alert.severity,

                  alertId:
                    alert._id.toString(),

                  medicineName:
                    event.medicineName,

                  patientId:
                    patient._id.toString(),

                  logId:
                    event.medicationLogId ||
                    undefined,

                  url:
                    "/alerts",
                }
              )
            : Promise.resolve<
                ChannelDeliveryResult
              >({
                status:
                  "SKIPPED",
              }),

          smsRequested &&
          normalizedPhone
            ? claimAndSendSms(
                {
                  dedupeKey:
                    smsKey,

                  recipientId:
                    recipient.id.toString(),

                  patientId:
                    patient._id.toString(),

                  alertId:
                    alert._id.toString(),

                  alertType:
                    smsAlertType(
                      event.eventType
                    ),

                  to:
                    normalizedPhone,

                  message:
                    smsMessage(
                      event,
                      patientFirstName
                    ),
                }
              )
            : Promise.resolve(
                null
              ),
        ]
      );

    const smsResult =
      smsDelivery
        ?.result ||
      null;

    await updateDelivery(
      alert,
      pushResult,
      smsResult
    );

    if (
      pushResult
        .status ===
        "SENT" ||
      smsResult
        ?.accepted ===
        true
    ) {
      delivered +=
        1;
    }
  }

  return {
    created,
    duplicates,
    delivered,

    skipped:
      false,

    alertIds,
  };
}

export async function processMedicationAlertEvent(
  event:
    MedicationAlertEvent
): Promise<
  AlertEngineResult
> {
  try {
    return await processMedicationAlertEventInternal(
      event
    );
  } catch (error) {
    /*
     * SMS, push, or alert failures must
     * never roll back taken, late, or
     * missed medication status.
     */
    console.error(
      "[Alert Engine] Processing failed:",
      {
        eventType:
          event.eventType,

        medicationLogId:
          event.medicationLogId ||
          "",

        message:
          error instanceof
            Error
            ? error.message
            : "Unknown alert error",
      }
    );

    return {
      created:
        0,

      duplicates:
        0,

      delivered:
        0,

      skipped:
        true,

      reason:
        "Alert delivery failed without affecting the medication status.",

      alertIds:
        [],
    };
  }
}