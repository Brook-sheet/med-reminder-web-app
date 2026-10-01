import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import Medicine from "@/models/Medicine";
import MedicationLog from "@/models/MedicationLog";

import {
  getTokenFromRequest,
  verifyToken,
} from "@/lib/auth";

import { evaluateMedicationLog } from "@/lib/adherenceEngine";

import {
  addDaysToMedicationDateKey,
  formatMedicationDateLabel,
  getMedicationDateKey,
  isValidMedicationDateKey,
  medicationScheduledAt,
  parseMedicationTimeToMinutes,
  resolveMedicationTimeZone,
} from "@/lib/medicationTime";

export const dynamic = "force-dynamic";

const PREVIEW_LIMIT = 4;

export interface UpcomingItem {
  medicineId: string;
  medicineName: string;
  dosage: string;
  notes?: string;
  scheduledDate: string;
  scheduledDateFormatted: string;
  scheduledTime: string;
  status: "Upcoming" | "Scheduled";
  logId?: string;
}

export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request);
    const user = token ? await verifyToken(token) : null;

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 },
      );
    }

    const now = new Date();
    const timeZone = resolveMedicationTimeZone();
    const today = getMedicationDateKey(now, timeZone);
    const tomorrow = addDaysToMedicationDateKey(today, 1);

    const params = request.nextUrl.searchParams;

    // New dashboard preview:
    // /api/upcoming?preview=1
    const isPreview = params.get("preview") === "1";

    // Seven-day schedule browsing:
    // /api/upcoming?startDate=YYYY-MM-DD&excludeToday=1
    const requestedStart = params.get("startDate");
    const isRangeRequest = requestedStart !== null;

    const excludeToday =
      isPreview || params.get("excludeToday") === "1";

    if (
      requestedStart !== null &&
      !isValidMedicationDateKey(requestedStart)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "startDate must be a valid YYYY-MM-DD date.",
        },
        { status: 400 },
      );
    }

    const earliestDate = excludeToday ? tomorrow : today;

    const startDate =
      !isPreview &&
      requestedStart &&
      requestedStart > earliestDate
        ? requestedStart
        : earliestDate;

    // Preview searches for the nearest four actual future doses.
    // Other callers retain the original 31-calendar-day window.
    const endDate = isPreview
      ? null
      : addDaysToMedicationDateKey(
          startDate,
          isRangeRequest ? 6 : 30,
        );

    if (
      endDate !== null &&
      !isValidMedicationDateKey(endDate)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "The requested date range is not supported.",
        },
        { status: 400 },
      );
    }

    await connectDB();

    const medicines = await Medicine.find({
      userId: user.userId,
      isActive: true,
    });

    const medicineIds = medicines.map(
      (medicine) => medicine._id,
    );

    const existingLogs = await MedicationLog.find({
      userId: user.userId,
      medicineId: {
        $in: medicineIds,
      },
      scheduledDate:
        endDate === null
          ? { $gte: startDate }
          : {
              $gte: startDate,
              $lte: endDate,
            },
      countsTowardAdherence: {
        $ne: false,
      },
    }).lean();

    const logBySchedule = new Map(
      existingLogs.map((log) => [
        `${log.medicineId?.toString()}:${log.scheduledDate}:${log.scheduledTime}`,
        log,
      ]),
    );

    const upcomingItems: UpcomingItem[] = [];

    for (const medicine of medicines) {
      const medicineStart = medicine.startDate || today;
      const medicineEnd = medicine.endDate || "";

      if (
        !isValidMedicationDateKey(medicineStart) ||
        (medicineEnd &&
          !isValidMedicationDateKey(medicineEnd))
      ) {
        continue;
      }

      const scheduledTimes = Array.from(
        new Set<string>(medicine.scheduledTimes),
      )
        .filter(
          (time) => parseMedicationTimeToMinutes(time) >= 0,
        )
        .sort(
          (first, second) =>
            parseMedicationTimeToMinutes(first) -
            parseMedicationTimeToMinutes(second),
        );

      if (scheduledTimes.length === 0) {
        continue;
      }

      let date =
        medicineStart > startDate
          ? medicineStart
          : startDate;

      let collectedForMedicine = 0;

      // The first four doses from each medicine are sufficient
      // to determine the first four doses across all medicines.
      while (isValidMedicationDateKey(date)) {
        if (medicineEnd && date > medicineEnd) {
          break;
        }

        if (endDate !== null && date > endDate) {
          break;
        }

        if (
          isPreview &&
          collectedForMedicine >= PREVIEW_LIMIT
        ) {
          break;
        }

        for (const time of scheduledTimes) {
          const scheduledAt = medicationScheduledAt(
            date,
            time,
            timeZone,
          );

          if (
            Number.isNaN(scheduledAt.getTime()) ||
            scheduledAt <= now
          ) {
            continue;
          }

          const existingLog = logBySchedule.get(
            `${medicine._id.toString()}:${date}:${time}`,
          );

          if (existingLog) {
            const evaluated = evaluateMedicationLog(
              {
                status: String(existingLog.status),
                scheduledDate: String(
                  existingLog.scheduledDate,
                ),
                scheduledTime: String(
                  existingLog.scheduledTime,
                ),
                takenAt: existingLog.takenAt ?? null,
                lateAfterMinutes:
                  existingLog.lateAfterMinutes,
                windowAfterMinutes:
                  existingLog.windowAfterMinutes,
                countsTowardAdherence:
                  existingLog.countsTowardAdherence !== false,
              },
              now,
              timeZone,
            );

            if (evaluated.lifecycle !== "upcoming") {
              continue;
            }
          }

          const isToday = date === today;

          const formattedDate =
            date === today
              ? "Today"
              : date === tomorrow
                ? "Tomorrow"
                : formatMedicationDateLabel(date, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  });

          upcomingItems.push({
            medicineId: medicine._id.toString(),
            medicineName: medicine.name,
            dosage: medicine.dosage,
            notes:
              typeof medicine.notes === "string"
                ? medicine.notes.trim()
                : "",
            scheduledDate: date,
            scheduledDateFormatted: formattedDate,
            scheduledTime: time,
            status: isToday ? "Upcoming" : "Scheduled",
            logId: existingLog?._id?.toString(),
          });

          collectedForMedicine += 1;

          if (
            isPreview &&
            collectedForMedicine >= PREVIEW_LIMIT
          ) {
            break;
          }
        }

        if (
          (isPreview &&
            collectedForMedicine >= PREVIEW_LIMIT) ||
          date === "9999-12-31"
        ) {
          break;
        }

        date = addDaysToMedicationDateKey(date, 1);
      }
    }

    upcomingItems.sort((first, second) => {
      const dateDifference =
        first.scheduledDate.localeCompare(
          second.scheduledDate,
        );

      if (dateDifference !== 0) {
        return dateDifference;
      }

      const timeDifference =
        parseMedicationTimeToMinutes(first.scheduledTime) -
        parseMedicationTimeToMinutes(second.scheduledTime);

      if (timeDifference !== 0) {
        return timeDifference;
      }

      return first.medicineId.localeCompare(
        second.medicineId,
      );
    });

    const items = isPreview
      ? upcomingItems.slice(0, PREVIEW_LIMIT)
      : isRangeRequest
        ? upcomingItems
        : upcomingItems.slice(0, 20);

    return NextResponse.json(
      {
        success: true,
        data: items,
        range: {
          today,
          earliestDate,
          startDate,
          endDate,
          timeZone,
        },
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error) {
    console.error("[GET /api/upcoming]", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to load upcoming medications.",
      },
      { status: 500 },
    );
  }
}