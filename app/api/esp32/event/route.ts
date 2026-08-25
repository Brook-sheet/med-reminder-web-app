// app/api/esp32/event/route.ts
import { NextRequest, NextResponse } from 'next/server';

import { connectDB } from '@/lib/mongodb';

import {
  addDaysToMedicationDateKey,
  getMedicationDateKey,
  resolveMedicationTimeZone,
} from '@/lib/medicationTime';

import {
  processMedicationEvent,
} from '@/lib/medicationVerification';

import {
  getRxBoxDailyPlan,
  type RxBoxAlarmGroup,
} from '@/lib/rxBoxDailyPlan';

import {
  isValidRxBoxChamberId,
  uniqueRxBoxLogIds,
} from '@/lib/rxBoxPlanCore';

import {
  resolveRxBoxDevice,
  RxBoxDeviceError,
} from '@/lib/rxBoxDevice';

import SensorData from '@/models/SensorData';

export const dynamic = 'force-dynamic';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

const SUPPORTED_STATUSES = [
  'dispensed',
  'taken',
  'missed',
  'heartbeat',
] as const;

type RxBoxEventStatus =
  (typeof SUPPORTED_STATUSES)[number];

interface RxBoxEventBody {
  eventId?: unknown;
  deviceId?: unknown;
  planId?: unknown;
  groupId?: unknown;
  status?: unknown;
  scheduledTime?: unknown;
  chamberIds?: unknown;
  snoozeCount?: unknown;
}

function stringField(
  value: unknown
): string {
  return typeof value === 'string'
    ? value.trim()
    : '';
}

function parseChamberIds(
  value: unknown
): number[] | null {
  if (
    !Array.isArray(value) ||
    value.length === 0
  ) {
    return null;
  }

  const chambers =
    value.map(Number);

  if (
    chambers.some(
      (chamber) =>
        !isValidRxBoxChamberId(chamber)
    ) ||
    new Set(chambers).size !== chambers.length
  ) {
    return null;
  }

  return chambers;
}

function sameChambers(
  left: number[],
  right: number[]
): boolean {
  const sortedLeft =
    [...left]
      .sort((a, b) => a - b)
      .join(',');

  const sortedRight =
    [...right]
      .sort((a, b) => a - b)
      .join(',');

  return sortedLeft === sortedRight;
}

async function findExactPlanGroup(
  userId: string,
  deviceId: string,
  planId: string,
  groupId: string
): Promise<{
  planDate: string;
  group: RxBoxAlarmGroup;
} | null> {
  const timezone =
    resolveMedicationTimeZone();

  const today =
    getMedicationDateKey(
      new Date(),
      timezone
    );

  /*
   * Include yesterday because the final missed event can
   * arrive after midnight following the complete snooze
   * sequence.
   */
  const candidateDates = [
    today,
    addDaysToMedicationDateKey(today, -1),
  ];

  for (const date of candidateDates) {
    const plan =
      await getRxBoxDailyPlan(
        userId,
        deviceId,
        {
          date,
          timezone,
        }
      );

    if (
      plan.planId !== planId ||
      plan.capacity.exceeded
    ) {
      continue;
    }

    const group =
      plan.groups.find(
        (candidate) =>
          candidate.groupId === groupId
      );

    if (group) {
      return {
        planDate: date,
        group,
      };
    }
  }

  return null;
}

function sensorEventName(
  status: RxBoxEventStatus
) {
  if (status === 'taken') {
    /*
     * This represents tray pickup detection.
     * It is not proof that the medicine was swallowed.
     */
    return 'container_opened' as const;
  }

  if (status === 'missed') {
    return 'medication_missed' as const;
  }

  if (status === 'heartbeat') {
    return 'heartbeat' as const;
  }

  return 'pill_dispensed' as const;
}

function errorResponse(
  error: unknown
) {
  if (
    error instanceof RxBoxDeviceError
  ) {
    return NextResponse.json(
      {
        success: false,
        apiVersion: 1,
        code: error.code,
        error: error.message,
      },
      {
        status: error.status,
        headers: NO_CACHE_HEADERS,
      }
    );
  }

  const message =
    error instanceof Error
      ? error.message
      : 'Internal server error';

  const clientError =
    /required|invalid|must|unknown|does not match|already finalized/i
      .test(message);

  console.error(
    '[POST /api/esp32/event]',
    error
  );

  return NextResponse.json(
    {
      success: false,
      apiVersion: 1,
      code: clientError
        ? 'RX_BOX_INVALID_EVENT'
        : 'RX_BOX_EVENT_ERROR',
      error: message,
    },
    {
      status: clientError
        ? 400
        : 500,
      headers: NO_CACHE_HEADERS,
    }
  );
}

export async function POST(
  request: NextRequest
) {
  try {
    await connectDB();

    let body: RxBoxEventBody;

    try {
      body =
        (await request.json()) as RxBoxEventBody;
    } catch {
      throw new Error(
        'A valid JSON body is required.'
      );
    }

    const deviceId =
      stringField(body.deviceId);

    const device =
      await resolveRxBoxDevice(
        request,
        deviceId
      );

    const eventId =
      stringField(body.eventId);

    const status =
      stringField(
        body.status
      ).toLowerCase() as RxBoxEventStatus;

    if (
      !eventId ||
      eventId.length > 128
    ) {
      throw new Error(
        'eventId is required and must not exceed 128 characters.'
      );
    }

    if (
      !SUPPORTED_STATUSES.includes(status)
    ) {
      throw new Error(
        `status must be one of: ${SUPPORTED_STATUSES.join(', ')}.`
      );
    }

    /*
     * Check for an event that has already been processed.
     */
    const duplicate =
      await SensorData.findOne({
        deviceId: device.deviceId,
        eventId,
      }).lean();

    if (duplicate) {
      return NextResponse.json(
        {
          success: true,
          apiVersion: 1,
          duplicate: true,
          eventId,
          data:
            duplicate.rawData?.result ??
            null,
          message:
            'Event was already processed.',
        },
        {
          headers: NO_CACHE_HEADERS,
        }
      );
    }

    /*
     * Heartbeats confirm connectivity but do not update
     * medication logs or adherence.
     */
    if (status === 'heartbeat') {
      const result = {
        deviceId: device.deviceId,
        status,
        receivedAt: new Date(),
      };

      await SensorData.create({
        userId: device.userId,
        deviceId: device.deviceId,
        eventId,
        event: 'heartbeat',
        timestamp: new Date(),
        rawData: {
          request: body,
          result,
        },
        processed: true,
      });

      return NextResponse.json(
        {
          success: true,
          apiVersion: 1,
          duplicate: false,
          eventId,
          data: result,
          message:
            'Heartbeat received.',
        },
        {
          headers: NO_CACHE_HEADERS,
        }
      );
    }

    const planId =
      stringField(body.planId);

    const groupId =
      stringField(body.groupId);

    const scheduledTime =
      stringField(body.scheduledTime);

    const chamberIds =
      parseChamberIds(body.chamberIds);

    const snoozeCount =
      Number(body.snoozeCount ?? 0);

    if (
      !planId ||
      !groupId ||
      !scheduledTime ||
      !chamberIds
    ) {
      throw new Error(
        'planId, groupId, scheduledTime, and valid chamberIds are required for medication events.'
      );
    }

    if (
      !Number.isInteger(snoozeCount) ||
      snoozeCount < 0 ||
      snoozeCount > 3
    ) {
      throw new Error(
        'snoozeCount must be a whole number from 0 to 3.'
      );
    }

    /*
     * Match the event to an exact authenticated daily plan
     * and alarm group.
     */
    const exact =
      await findExactPlanGroup(
        device.userId,
        device.deviceId,
        planId,
        groupId
      );

    if (!exact) {
      throw new Error(
        'The event does not match an active Rx Box plan and group.'
      );
    }

    if (
      exact.group.scheduledTime !== scheduledTime ||
      !sameChambers(
        exact.group.chamberIds,
        chamberIds
      )
    ) {
      throw new Error(
        'The event schedule or chamberIds do not match the authenticated group.'
      );
    }

    const timestamp =
      new Date();

    /*
     * Multiple physical pill units belonging to the same
     * medicine still use one unique adherence log.
     */
    const logIds =
      uniqueRxBoxLogIds(
        exact.group.logIds
      );

    const eventType =
      status === 'dispensed'
        ? 'MEDICATION_DISPENSED'
        : status === 'taken'
          ? 'MEDICATION_CONFIRMED'
          : 'MISSED';

    const results = [];

    /*
     * Process every unique medication log in the group.
     * A single ultrasonic pickup therefore confirms every
     * medicine dispensed into the shared tray at that time.
     */
    for (const logId of logIds) {
      results.push(
        await processMedicationEvent({
          userId: device.userId,
          source: 'sensor',
          eventType,
          timestamp,
          logId,
          deviceId: device.deviceId,
          allowHardwareMissedBeforeWindowEnd:
            status === 'missed',
        })
      );
    }

    const result = {
      deviceId: device.deviceId,
      planId,
      planDate: exact.planDate,
      groupId,
      status,
      scheduledTime,
      chamberIds,
      snoozeCount,
      affectedLogIds: logIds,
      logs: results,
    };

    try {
      await SensorData.create({
        userId: device.userId,
        deviceId: device.deviceId,
        eventId,
        planId,
        groupId,
        event: sensorEventName(status),
        timestamp,
        rawData: {
          request: body,
          result,
        },
        processed: true,
      });
    } catch (error) {
      /*
       * The unique deviceId + eventId database index
       * protects against duplicate event records.
       */
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 11000
      ) {
        return NextResponse.json(
          {
            success: true,
            apiVersion: 1,
            duplicate: true,
            eventId,
            data: result,
            message:
              'Event was already processed.',
          },
          {
            headers: NO_CACHE_HEADERS,
          }
        );
      }

      throw error;
    }

    return NextResponse.json(
      {
        success: true,
        apiVersion: 1,
        duplicate: false,
        eventId,
        data: result,
        message:
          `${status} event processed for ${logIds.length} medication log(s).`,
      },
      {
        headers: NO_CACHE_HEADERS,
      }
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(
  request: NextRequest
) {
  try {
    await connectDB();

    const deviceId =
      new URL(request.url)
        .searchParams
        .get('deviceId')
        ?.trim() ??
      '';

    const device =
      await resolveRxBoxDevice(
        request,
        deviceId
      );

    return NextResponse.json(
      {
        success: true,
        apiVersion: 1,
        deviceId: device.deviceId,
        message:
          'Rx Box event API is online.',
        supportedStatuses:
          SUPPORTED_STATUSES,
      },
      {
        headers: NO_CACHE_HEADERS,
      }
    );
  } catch (error) {
    return errorResponse(error);
  }
}