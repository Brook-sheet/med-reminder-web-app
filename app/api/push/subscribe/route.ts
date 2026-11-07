import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  isTourPreferenceOriginAllowed,
} from "@/lib/tourPreferenceOrigin";

import {
  connectDB,
} from "@/lib/mongodb";

import {
  getTokenFromRequest,
  verifyToken,
} from "@/lib/auth";

import {
  PUSH_COOKIE,
  deviceBinding,
  bindingMatches,
  validSubscription,
} from "@/lib/pwa/subscription";

import PushSubscription from "@/models/PushSubscription";
import User from "@/models/User";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cookieOptions = {
  httpOnly: true,
  secure:
    process.env.NODE_ENV ===
    "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: 31536000,
};

function json(
  body: object,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(
  request: NextRequest
) {
  if (
    !isTourPreferenceOriginAllowed(
      request
    )
  ) {
    return json(
      {
        success: false,
        error: "Invalid origin.",
      },
      403
    );
  }

  const token =
    getTokenFromRequest(request);

  const auth = token
    ? await verifyToken(token)
    : null;

  if (!auth) {
    return json(
      {
        success: false,
        error: "Unauthorized",
      },
      401
    );
  }

  try {
    const body =
      await request.json();

    if (
      !body ||
      typeof body !== "object"
    ) {
      return json(
        {
          success: false,
          error: "Invalid request.",
        },
        400
      );
    }

    await connectDB();

    const userExists =
      await User.exists({
        _id: auth.userId,
        isDeleted: {
          $ne: true,
        },
      });

    if (!userExists) {
      return json(
        {
          success: false,
          error: "User not found.",
        },
        404
      );
    }

    if (
      body.action === "status" ||
      body.action === "remove"
    ) {
      if (
        typeof body.endpoint !==
          "string" ||
        body.endpoint.length > 2048
      ) {
        return json(
          {
            success: false,
            error: "Invalid endpoint.",
          },
          400
        );
      }

      const filter = {
        userId: auth.userId,
        endpoint: body.endpoint,
      };

      if (
        body.action === "status"
      ) {
        const saved = Boolean(
          await PushSubscription.exists(
            filter
          )
        );

        const response = json({
          success: true,
          subscribed: saved,
        });

        if (saved) {
          response.cookies.set(
            PUSH_COOKIE,
            deviceBinding(
              body.endpoint
            ),
            cookieOptions
          );
        }

        return response;
      }

      await PushSubscription.deleteOne(
        filter
      );

      const response = json({
        success: true,
      });

      response.cookies.set(
        PUSH_COOKIE,
        "",
        {
          ...cookieOptions,
          maxAge: 0,
        }
      );

      return response;
    }

    const action = body.action;

    if (
      !validSubscription(body)
    ) {
      return json(
        {
          success: false,
          error:
            "Invalid browser push subscription.",
        },
        400
      );
    }

    if (
      !process.env
        .NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
      !process.env.VAPID_PRIVATE_KEY
    ) {
      return json(
        {
          success: false,
          error:
            "Device notifications are not configured yet.",
        },
        503
      );
    }

    if (action === "renew") {
      const previous =
        await PushSubscription.find({
          userId: auth.userId,
        }).lean();

      const old = previous.find(
        (sub) =>
          bindingMatches(
            sub.endpoint,
            request.cookies.get(
              PUSH_COOKIE
            )?.value
          )
      );

      if (!old) {
        return json(
          {
            success: false,
            error:
              "Please enable device notifications again.",
          },
          409
        );
      }

      await PushSubscription.updateOne(
        {
          _id: old._id,
        },
        {
          $set: {
            endpoint: body.endpoint,
            keys: body.keys,
          },
        }
      );
    } else {
      /*
       * One browser installation belongs
       * to one account at a time.
       */
      await PushSubscription.deleteMany({
        endpoint: body.endpoint,
        userId: {
          $ne: auth.userId,
        },
      });

      await PushSubscription.findOneAndUpdate(
        {
          userId: auth.userId,
          endpoint: body.endpoint,
        },
        {
          $set: {
            keys: body.keys,
          },
        },
        {
          upsert: true,
          runValidators: true,
        }
      );

      await User.updateOne(
        {
          _id: auth.userId,
        },
        {
          $set: {
            "notificationPreferences.push":
              true,
          },
        }
      );
    }

    const response = json({
      success: true,
      subscribed: true,
    });

    response.cookies.set(
      PUSH_COOKIE,
      deviceBinding(body.endpoint),
      cookieOptions
    );

    return response;
  } catch (error) {
    console.error(
      "[PWA subscription]",
      error
    );

    return json(
      {
        success: false,
        error:
          "Unable to update device notifications.",
      },
      500
    );
  }
}