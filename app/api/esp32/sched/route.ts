// app/api/esp32/sched/route.ts
import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  connectDB,
} from '@/lib/mongodb';

import {
  getRxBoxDailyPlan,
} from '@/lib/rxBoxDailyPlan';

import {
  resolveRxBoxDevice,
  RxBoxDeviceError,
} from '@/lib/rxBoxDevice';

export const dynamic =
  'force-dynamic';

const NO_CACHE_HEADERS = {
  'Cache-Control':
    'no-store, no-cache, must-revalidate',
};

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

    const plan =
      await getRxBoxDailyPlan(
        device.userId,
        device.deviceId
      );

    return NextResponse.json(
      plan,
      {
        status:
          plan.capacity.exceeded
            ? 409
            : 200,

        headers:
          NO_CACHE_HEADERS,
      }
    );
  } catch (error) {
    if (
      error instanceof
      RxBoxDeviceError
    ) {
      return NextResponse.json(
        {
          success: false,
          apiVersion: 1,
          code: error.code,
          error: error.message,
          hardwareDispensingEnabled:
            false,
        },
        {
          status: error.status,
          headers:
            NO_CACHE_HEADERS,
        }
      );
    }

    console.error(
      '[GET /api/esp32/sched]',
      error
    );

    return NextResponse.json(
      {
        success: false,
        apiVersion: 1,
        code:
          'RX_BOX_SCHEDULE_ERROR',
        error:
          'Unable to create today\'s Rx Box plan.',
        hardwareDispensingEnabled:
          false,
      },
      {
        status: 500,
        headers:
          NO_CACHE_HEADERS,
      }
    );
  }
}