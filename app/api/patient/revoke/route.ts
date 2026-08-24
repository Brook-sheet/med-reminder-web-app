import mongoose from "mongoose";

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

import {
  sendWebPushToUser,
} from "@/lib/notificationChannels";

import MonitoringRequest from "@/models/MonitoringRequest";
import Notification from "@/models/Notification";
import User from "@/models/User";

async function getAuthUser(
  request: NextRequest
) {
  const token =
    getTokenFromRequest(
      request
    );

  return token
    ? verifyToken(token)
    : null;
}

async function sendRevocationPush(
  userId: string,
  pushEnabled: boolean,
  payload: Parameters<
    typeof sendWebPushToUser
  >[1]
): Promise<void> {
  if (!pushEnabled) {
    return;
  }

  try {
    const result =
      await sendWebPushToUser(
        userId,
        payload
      );

    if (
      result.status ===
      "FAILED"
    ) {
      console.warn(
        "[Monitoring Revoke Push] Delivery failed:",
        result.error
      );
    }
  } catch (error) {
    /*
     * A push failure must not reverse a completed
     * monitoring-access revocation.
     */
    console.warn(
      "[Monitoring Revoke Push] Unexpected delivery error:",
      error
    );
  }
}

/*
 * Compatibility endpoint for older clients.
 *
 * New clients use:
 * PATCH /api/patient/monitor
 * {
 *   requestId,
 *   action: "revoke"
 * }
 */
export async function DELETE(
  request: NextRequest
) {
  try {
    const auth =
      await getAuthUser(
        request
      );

    if (!auth) {
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

    const requestId =
      request.nextUrl.searchParams.get(
        "requestId"
      )?.trim() || "";

    const familyId =
      request.nextUrl.searchParams
        .get(
          "familyId"
        )
        ?.trim()
        .toUpperCase() ||
      "";

    if (
      !requestId &&
      !familyId
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "A monitoring request ID or Family ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      requestId &&
      !mongoose.Types.ObjectId.isValid(
        requestId
      )
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "Invalid monitoring request ID.",
        },
        {
          status: 400,
        }
      );
    }

    await connectDB();

    const patient =
      await User.findById(
        auth.userId
      ).select(
        "_id role firstName lastName patientId isDeleted"
      );

    if (
      !patient ||
      patient.isDeleted
    ) {
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

    if (
      patient.role !==
      "patient"
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "Only the Patient can revoke monitoring access.",
        },
        {
          status: 403,
        }
      );
    }

    let familyObjectId:
      | mongoose.Types.ObjectId
      | undefined;

    if (familyId) {
      const family =
        await User.findOne({
          familyId,
          role:
            "family",

          isDeleted: {
            $ne: true,
          },
        }).select(
          "_id"
        );

      if (!family) {
        return NextResponse.json<ApiResponse>(
          {
            success: false,
            error:
              "Family account not found.",
          },
          {
            status: 404,
          }
        );
      }

      familyObjectId =
        family._id;
    }

    /*
     * When both identifiers are supplied, both must match
     * the same approved monitoring relationship.
     */
    const monitoringQuery: {
      _id?: string;
      familyId?:
        mongoose.Types.ObjectId;
      patientId:
        mongoose.Types.ObjectId;
      status: "approved";
    } = {
      patientId:
        patient._id,

      status:
        "approved",
    };

    if (requestId) {
      monitoringQuery._id =
        requestId;
    }

    if (familyObjectId) {
      monitoringQuery.familyId =
        familyObjectId;
    }

    const monitoring =
      await MonitoringRequest.findOne(
        monitoringQuery
      );

    if (!monitoring) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "Approved monitoring access was not found.",
        },
        {
          status: 404,
        }
      );
    }

    monitoring.status =
      "revoked";

    monitoring.respondedAt =
      new Date();

    await monitoring.save();

    const patientName =
      `${patient.firstName ?? ""} ${
        patient.lastName ?? ""
      }`.trim() ||
      "The Patient";

    const notificationTitle =
      "Monitoring Access Revoked";

    const notificationMessage =
      `${patientName} revoked your monitoring access.`;

    /*
     * Remove an older duplicate revocation notification
     * for this same monitoring relationship.
     */
    await Notification.deleteMany({
      userId:
        monitoring.familyId,

      type:
        "monitoring_revoked",

      monitoringRequestId:
        monitoring._id,
    });

    await Notification.create({
      userId:
        monitoring.familyId,

      type:
        "monitoring_revoked",

      title:
        notificationTitle,

      message:
        notificationMessage,

      monitoringRequestId:
        monitoring._id,

      read:
        false,
    });

    const familyRecipient =
      await User.findOne({
        _id:
          monitoring.familyId,

        role:
          "family",

        isDeleted: {
          $ne: true,
        },
      })
        .select(
          "notificationPreferences"
        )
        .lean();

    if (
      familyRecipient
    ) {
      await sendRevocationPush(
        monitoring.familyId.toString(),

        familyRecipient
          .notificationPreferences
          ?.push !== false,

        {
          title:
            notificationTitle,

          body:
            notificationMessage,

          type:
            "monitoring_revoked",

          screen:
            "monitoring",

          url:
            "/monitor",

          patientId:
            patient.patientId,

          requestId:
            monitoring._id.toString(),

          monitoringRequestId:
            monitoring._id.toString(),
        }
      );
    }

    return NextResponse.json<ApiResponse>({
      success: true,

      message:
        "Monitoring access revoked.",

      data: {
        requestId:
          monitoring._id.toString(),

        status:
          monitoring.status,
      },
    });
  } catch (error) {
    console.error(
      "[DELETE /api/patient/revoke]",
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