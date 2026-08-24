import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getTokenFromRequest,
  verifyToken,
} from "@/lib/auth";

import type {
  ApiResponse,
} from "@/lib/interfaces/data/Api";

import {
  connectDB,
} from "@/lib/mongodb";

import ExpoPushToken from "@/models/ExpoPushToken";

const EXPO_TOKEN_PATTERN =
  /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/;

async function getAuthUser(
  request: NextRequest
) {
  const token =
    getTokenFromRequest(
      request
    );

  if (!token) {
    return null;
  }

  return verifyToken(token);
}

export async function POST(
  request: NextRequest
) {
  try {
    const user =
      await getAuthUser(
        request
      );

    if (!user) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const body =
      await request
        .json()
        .catch(() => ({}));

    const token =
      typeof body.token ===
      "string"
        ? body.token.trim()
        : "";

    const deviceId =
      typeof body.deviceId ===
      "string"
        ? body.deviceId.trim()
        : "";

    const platform =
      body.platform === "ios"
        ? "ios"
        : body.platform ===
            "android"
          ? "android"
          : null;

    const appVersion =
      typeof body.appVersion ===
      "string"
        ? body.appVersion
            .trim()
            .slice(0, 40)
        : "";

    if (
      !EXPO_TOKEN_PATTERN.test(
        token
      )
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "Invalid Expo push token.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !deviceId ||
      deviceId.length > 200
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "A valid device ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (!platform) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "Platform must be android or ios.",
        },
        {
          status: 400,
        }
      );
    }

    await connectDB();

    /*
     * A token must belong to only
     * one account and device record.
     *
     * This also removes stale records
     * after reinstalling or switching
     * accounts on the same phone.
     */
    await ExpoPushToken.deleteMany(
      {
        token,
        $or: [
          {
            userId: {
              $ne: user.userId,
            },
          },
          {
            deviceId: {
              $ne: deviceId,
            },
          },
        ],
      }
    );

    const savedToken =
      await ExpoPushToken.findOneAndUpdate(
        {
          userId:
            user.userId,
          deviceId,
        },
        {
          $set: {
            token,
            platform,
            appVersion:
              appVersion ||
              null,
          },
          $setOnInsert: {
            userId:
              user.userId,
            deviceId,
          },
        },
        {
          upsert: true,
          new: true,
          runValidators: true,
        }
      );

    return NextResponse.json<ApiResponse>({
      success: true,
      message:
        "Expo push token registered.",
      data: {
        tokenId:
          savedToken._id.toString(),
      },
    });
  } catch (error) {
    console.error(
      "[POST /api/push/expo-token]",
      error
    );

    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error:
          "Internal server error",
      },
      {
        status: 500,
      }
    );
  }
}

export async function DELETE(
  request: NextRequest
) {
  try {
    const user =
      await getAuthUser(
        request
      );

    if (!user) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const body =
      await request
        .json()
        .catch(() => ({}));

    const token =
      typeof body.token ===
      "string"
        ? body.token.trim()
        : "";

    const deviceId =
      typeof body.deviceId ===
      "string"
        ? body.deviceId.trim()
        : "";

    if (
      !token &&
      !deviceId
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "Token or device ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    await connectDB();

    await ExpoPushToken.deleteMany(
      {
        userId:
          user.userId,
        ...(token
          ? {
              token,
            }
          : {}),
        ...(deviceId
          ? {
              deviceId,
            }
          : {}),
      }
    );

    return NextResponse.json<ApiResponse>({
      success: true,
      message:
        "Expo push token removed.",
    });
  } catch (error) {
    console.error(
      "[DELETE /api/push/expo-token]",
      error
    );

    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error:
          "Internal server error",
      },
      {
        status: 500,
      }
    );
  }
}