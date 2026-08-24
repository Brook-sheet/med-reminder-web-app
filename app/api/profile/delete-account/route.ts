import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  COOKIE_OPTIONS,
  getTokenFromRequest,
  verifyToken,
} from "@/lib/auth";

import type {
  ApiResponse,
} from "@/lib/interfaces/data/Api";

import {
  connectDB,
} from "@/lib/mongodb";

import Alert from "@/models/Alert";
import ExpoPushToken from "@/models/ExpoPushToken";
import FoodLog from "@/models/FoodLog";
import MedicationLog from "@/models/MedicationLog";
import Medicine from "@/models/Medicine";
import Notification from "@/models/Notification";
import PushSubscription from "@/models/PushSubscription";
import SensorData from "@/models/SensorData";
import User from "@/models/User";

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

    await connectDB();

    await Promise.all([
      MedicationLog.deleteMany(
        {
          userId:
            user.userId,
        }
      ),

      Medicine.deleteMany({
        userId:
          user.userId,
      }),

      Notification.deleteMany(
        {
          userId:
            user.userId,
        }
      ),

      FoodLog.deleteMany({
        userId:
          user.userId,
      }),

      SensorData.deleteMany(
        {
          userId:
            user.userId,
        }
      ),

      PushSubscription.deleteMany(
        {
          userId:
            user.userId,
        }
      ),

      ExpoPushToken.deleteMany(
        {
          userId:
            user.userId,
        }
      ),

      Alert.deleteMany({
        $or: [
          {
            patientId:
              user.userId,
          },
          {
            monitorId:
              user.userId,
          },
        ],
      }),
    ]);

    const deletedUser =
      await User.findByIdAndDelete(
        user.userId
      );

    if (!deletedUser) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "User not found",
        },
        {
          status: 404,
        }
      );
    }

    const response =
      NextResponse.json<ApiResponse>({
        success: true,
        message:
          "Account and all associated data permanently deleted.",
      });

    response.cookies.set({
      ...COOKIE_OPTIONS,
      value: "",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error(
      "[DELETE /api/profile/delete-account]",
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