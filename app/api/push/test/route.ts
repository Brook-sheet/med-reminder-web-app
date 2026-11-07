import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  isTourPreferenceOriginAllowed,
} from "@/lib/tourPreferenceOrigin";

import {
  getTokenFromRequest,
  verifyToken,
} from "@/lib/auth";

import {
  connectDB,
} from "@/lib/mongodb";

import {
  sendWebPushToUser,
} from "@/lib/notificationChannels";

import {
  PUSH_COOKIE,
  bindingMatches,
} from "@/lib/pwa/subscription";

import PushSubscription from "@/models/PushSubscription";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest
) {
  if (
    !isTourPreferenceOriginAllowed(
      request
    )
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid origin.",
      },
      {
        status: 403,
      }
    );
  }

  const token =
    getTokenFromRequest(request);

  const auth = token
    ? await verifyToken(token)
    : null;

  if (!auth) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  try {
    await connectDB();

    const subscriptions =
      await PushSubscription.find({
        userId: auth.userId,
      }).lean();

    const enabledHere =
      subscriptions.some((sub) =>
        bindingMatches(
          sub.endpoint,
          request.cookies.get(
            PUSH_COOKIE
          )?.value
        )
      );

    if (!enabledHere) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Enable notifications on this device first.",
        },
        {
          status: 409,
        }
      );
    }

    const result =
      await sendWebPushToUser(
        auth.userId,
        {
          title:
            "Rx Box notifications are ready",
          body:
            "This is a device push notification from Rx Box.",
          type: "test",
          url: "/settings",
        }
      );

    const success =
      result.status === "SENT";

    return NextResponse.json(
      {
        success,
        error: success
          ? undefined
          : result.error,
      },
      {
        status: success ? 200 : 502,
      }
    );
  } catch (error) {
    console.error(
      "[PWA test]",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Unable to send the test notification.",
      },
      {
        status: 500,
      }
    );
  }
}