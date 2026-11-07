import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  isTourPreferenceOriginAllowed,
} from "@/lib/tourPreferenceOrigin";

import {
  COOKIE_OPTIONS,
  getTokenFromRequest,
  verifyToken,
} from "@/lib/auth";

import {
  connectDB,
} from "@/lib/mongodb";

import {
  PUSH_COOKIE,
  bindingMatches,
} from "@/lib/pwa/subscription";

import PushSubscription from "@/models/PushSubscription";

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

  try {
    const binding =
      request.cookies.get(
        PUSH_COOKIE
      )?.value;

    if (auth && binding) {
      await connectDB();

      const subscriptions =
        await PushSubscription.find({
          userId: auth.userId,
        }).lean();

      const ids = subscriptions
        .filter((sub) =>
          bindingMatches(
            sub.endpoint,
            binding
          )
        )
        .map((sub) => sub._id);

      await PushSubscription.deleteMany({
        _id: {
          $in: ids,
        },
        userId: auth.userId,
      });
    }

    const response =
      NextResponse.json({
        success: true,
        message:
          "Logged out successfully",
      });

    response.cookies.set({
      ...COOKIE_OPTIONS,
      value: "",
      maxAge: 0,
    });

    response.cookies.set(
      PUSH_COOKIE,
      "",
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV ===
          "production",
        sameSite: "strict",
        path: "/",
        maxAge: 0,
      }
    );

    return response;
  } catch (error) {
    console.error(
      "[PWA logout]",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Unable to disconnect device notifications. Please try signing out again.",
      },
      {
        status: 503,
      }
    );
  }
}