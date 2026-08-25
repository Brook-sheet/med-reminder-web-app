// app/api/rx-box/today/route.ts
import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  getTokenFromRequest,
  verifyToken,
} from '@/lib/auth';

import {
  connectDB,
} from '@/lib/mongodb';

import {
  getRxBoxDailyPlan,
} from '@/lib/rxBoxDailyPlan';

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
    const token =
      getTokenFromRequest(
        request
      );

    const auth =
      token
        ? await verifyToken(token)
        : null;

    if (!auth) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Unauthorized',
        },
        {
          status: 401,
          headers:
            NO_CACHE_HEADERS,
        }
      );
    }

    await connectDB();

    /*
     * This route is authenticated as the signed-in patient.
     * It never uses DEFAULT_DEVICE_USER_ID to authorize the
     * web user.
     */
    const deviceId =
      process.env
        .RX_BOX_DEVICE_ID
        ?.trim() ||
      'rx-box-unconfigured';

    const plan =
      await getRxBoxDailyPlan(
        auth.userId,
        deviceId
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
    console.error(
      '[GET /api/rx-box/today]',
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          'Unable to load today\'s Rx Box loading plan.',
      },
      {
        status: 500,
        headers:
          NO_CACHE_HEADERS,
      }
    );
  }
}