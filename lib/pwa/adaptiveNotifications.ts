import {
  analyzeAdherence,
  type RawLog,
} from "@/lib/adherenceEngine";

import {
  analyzeAdaptiveIntervention,
} from "@/lib/adaptiveIntervention";

import {
  getMedicationDateKey,
  medicationScheduledAt,
  resolveMedicationTimeZone,
} from "@/lib/medicationTime";

import MedicationLog from "@/models/MedicationLog";
import User from "@/models/User";

import {
  queuePwaEvent,
} from "./medicationNotifications";

export async function queueAdaptiveNotifications(
  now = new Date()
) {
  const zone =
    resolveMedicationTimeZone();

  const date =
    getMedicationDateKey(
      now,
      zone
    );

  const users =
    User.find({
      role: "patient",
      isDeleted: {
        $ne: true,
      },
    })
      .select(
        "_id lastRiskLevel dataResetAt"
      )
      .cursor();

  for await (
    const user of users
  ) {
    const logs =
      await MedicationLog.find({
        userId: user._id,

        ...(user.dataResetAt
          ? {
              createdAt: {
                $gt:
                  user.dataResetAt,
              },
            }
          : {}),
      }).lean();

    const raw: RawLog[] =
      logs.map((log) => ({
        id: log._id.toString(),
        medicineId:
          log.medicineId?.toString() ||
          null,
        medicineName:
          log.medicineName,
        status: log.status,
        scheduledDate:
          log.scheduledDate,
        scheduledTime:
          log.scheduledTime,
        takenAt: log.takenAt,
        lateAfterMinutes:
          log.lateAfterMinutes,
        windowAfterMinutes:
          log.windowAfterMinutes,
        countsTowardAdherence:
          log.countsTowardAdherence,
      }));

    const analysis =
      analyzeAdherence(
        raw,
        now,
        zone
      );

    const { features } =
      analysis;

    const adaptive =
      analyzeAdaptiveIntervention(
        raw.map((log) => ({
          ...log,
          takenAt: log.takenAt
            ? new Date(
                log.takenAt
              )
            : null,
        })),
        features,
        analysis.finalRiskLevel,
        analysis.finalRiskLevel,
        features.hasSufficientData
          ? Math.min(
              95,
              40 +
                features.totalDue *
                  5
            )
          : 0,
        user.lastRiskLevel as
          | "Low"
          | "Moderate"
          | "High"
          | undefined,
        now,
        zone
      );

    const config =
      adaptive.reminderConfig;

    const userId =
      user._id.toString();

    const recent = (
      target: number
    ) =>
      now.getTime() >= target &&
      now.getTime() - target <
        120000;

    for (const log of logs) {
      if (
        ![
          "pending",
          "reminder",
          "dispensed",
        ].includes(log.status) ||
        log.countsTowardAdherence ===
          false
      ) {
        continue;
      }

      const scheduled =
        medicationScheduledAt(
          log.scheduledDate,
          log.scheduledTime,
          zone
        );

      if (!scheduled) continue;

      const base = {
        medicineName:
          log.medicineName,
        logId:
          log._id.toString(),
        url: "/",
        screen:
          "dashboard" as const,
      };

      if (
        config.leadTimeMinutes !==
          30 &&
        recent(
          scheduled.getTime() -
            config.leadTimeMinutes *
              60000
        )
      ) {
        await queuePwaEvent(
          `adaptive-upcoming:${log._id}`,
          userId,
          {
            ...base,
            type:
              "upcoming_reminder",
            title:
              "Upcoming Medication Reminder",
            body:
              `${log.medicineName} is scheduled at ` +
              `${log.scheduledTime} — ` +
              `${config.leadTimeMinutes} minutes away.`,
          }
        );
      }

      for (
        let count = 1;
        count <=
        config.followUpCount;
        count++
      ) {
        const target =
          scheduled.getTime() +
          count *
            config.followUpIntervalMinutes *
            60000;

        if (!recent(target)) {
          continue;
        }

        await queuePwaEvent(
          `followup:${log._id}:${count}`,
          userId,
          {
            ...base,
            type: "due_alarm",
            title:
              `Follow-up Reminder ` +
              `(${count}/${config.followUpCount})`,
            body:
              `${log.medicineName} still has not been confirmed. ` +
              "Please check your medication schedule.",
          }
        );
      }
    }

    const peak =
      adaptive.behavioralPattern
        .peakMissHour;

    const hour = Number(
      new Intl.DateTimeFormat(
        "en-GB",
        {
          timeZone: zone,
          hour: "2-digit",
          hourCycle: "h23",
        }
      ).format(now)
    );

    if (
      peak !== null &&
      hour ===
        (peak + 23) % 24
    ) {
      await queuePwaEvent(
        `peak-nudge:${userId}:${date}`,
        userId,
        {
          type:
            "upcoming_reminder",
          title:
            "Proactive Medication Reminder",
          body:
            "Your history shows missed doses around " +
            `${String(peak).padStart(2, "0")}:00. ` +
            "Check your upcoming schedule.",
          url: "/",
          screen: "dashboard",
        }
      );
    }
  }
}