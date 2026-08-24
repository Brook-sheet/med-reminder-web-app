import mongoose from "mongoose";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getTokenFromRequest,
  verifyToken,
} from "@/lib/auth";

import {
  getChatRelationshipSummary,
} from "@/lib/chatRelationship";

import type {
  ApiResponse,
} from "@/lib/interfaces/data/Api";

import {
  connectDB,
} from "@/lib/mongodb";

import {
  sendWebPushToUser,
} from "@/lib/notificationChannels";

import MonitoringRequest, {
  type MonitoringStatus,
} from "@/models/MonitoringRequest";

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

function fullName(user: {
  firstName?: string;
  lastName?: string;
}) {
  return (
    `${user.firstName ?? ""} ${
      user.lastName ?? ""
    }`.trim() ||
    "Unknown user"
  );
}

async function sendMonitoringPush(
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
        "[Monitoring Push] Delivery failed:",
        result.error
      );
    }
  } catch (error) {
    /*
     * Push failure must not undo an already completed
     * monitoring request or approval operation.
     */
    console.warn(
      "[Monitoring Push] Unexpected delivery error:",
      error
    );
  }
}

export async function GET(
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

    await connectDB();

    const currentUser =
      await User.findById(
        auth.userId
      ).select(
        "role"
      );

    if (!currentUser) {
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

    const role =
      currentUser.role ===
      "family"
        ? "family"
        : "patient";

    if (
      role ===
      "patient"
    ) {
      const pendingCount =
        await MonitoringRequest.countDocuments(
          {
            patientId:
              currentUser._id,

            status:
              "pending",
          }
        );

      if (
        request.nextUrl.searchParams.get(
          "countOnly"
        ) ===
        "1"
      ) {
        return NextResponse.json<ApiResponse>({
          success: true,

          data: {
            pendingCount,
          },
        });
      }

      const requests =
        await MonitoringRequest.find(
          {
            patientId:
              currentUser._id,
          }
        )
          .sort({
            createdAt: -1,
          })
          .populate(
            "familyId",
            "firstName middleName lastName email familyId role"
          )
          .lean();

      const data =
        await Promise.all(
          requests
            .filter(
              (
                item
              ) =>
                item.familyId
            )
            .map(
              async (
                item
              ) => {
                const family =
                  item.familyId as unknown as {
                    _id:
                      mongoose.Types.ObjectId;

                    firstName?: string;
                    lastName?: string;
                    email?: string;
                    familyId?: string;
                  };

                const chat =
                  item.status ===
                  "approved"
                    ? await getChatRelationshipSummary(
                        currentUser._id,
                        family._id
                      )
                    : null;

                return {
                  requestId:
                    item._id.toString(),

                  family: {
                    id:
                      family._id.toString(),

                    name:
                      fullName(
                        family
                      ),

                    email:
                      family.email,

                    familyId:
                      family.familyId,

                    role:
                      "family",
                  },

                  status:
                    item.status,

                  chat,

                  createdAt:
                    item.createdAt,

                  updatedAt:
                    item.updatedAt,
                };
              }
            )
        );

      return NextResponse.json<ApiResponse>({
        success: true,

        data: {
          role,
          pendingCount,
          requests:
            data,
        },
      });
    }

    const requests =
      await MonitoringRequest.find(
        {
          familyId:
            currentUser._id,
        }
      )
        .sort({
          createdAt: -1,
        })
        .populate(
          "patientId",
          "firstName lastName patientId condition role"
        )
        .lean();

    const data =
      await Promise.all(
        requests
          .filter(
            (
              item
            ) =>
              item.patientId
          )
          .map(
            async (
              item
            ) => {
              const patient =
                item.patientId as unknown as {
                  _id:
                    mongoose.Types.ObjectId;

                  firstName?: string;
                  lastName?: string;
                  patientId?: string;
                  condition?: string;
                };

              const chat =
                item.status ===
                "approved"
                  ? await getChatRelationshipSummary(
                      currentUser._id,
                      patient._id
                    )
                  : null;

              return {
                requestId:
                  item._id.toString(),

                patient: {
                  name:
                    fullName(
                      patient
                    ),

                  patientId:
                    patient.patientId,

                  ...(item.status ===
                  "approved"
                    ? {
                        condition:
                          patient.condition,
                      }
                    : {}),
                },

                status:
                  item.status,

                chat,

                createdAt:
                  item.createdAt,

                updatedAt:
                  item.updatedAt,
              };
            }
          )
      );

    return NextResponse.json<ApiResponse>({
      success: true,

      data: {
        role,
        requests:
          data,
      },
    });
  } catch (error) {
    console.error(
      "[GET /api/patient/monitor]",
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

export async function POST(
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

    const body =
      await request
        .json()
        .catch(
          () => ({})
        );

    const patientId =
      typeof body.patientId ===
      "string"
        ? body.patientId
            .trim()
            .toUpperCase()
        : "";

    if (!patientId) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "Patient ID is required",
        },
        {
          status: 400,
        }
      );
    }

    if (
      patientId.startsWith(
        "FM-"
      )
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "A Family ID cannot be used to request Patient monitoring access.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !/^PT-[A-Z0-9]{5,12}$/.test(
        patientId
      )
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "Enter a valid Patient ID beginning with PT-.",
        },
        {
          status: 400,
        }
      );
    }

    await connectDB();

    const family =
      await User.findById(
        auth.userId
      ).select(
        "role firstName lastName isDeleted"
      );

    if (
      !family ||
      family.isDeleted
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
      family.role !==
      "family"
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "Only Family accounts can request monitoring access.",
        },
        {
          status: 403,
        }
      );
    }

    const patient =
      await User.findOne({
        patientId,
        role:
          "patient",

        isDeleted: {
          $ne: true,
        },
      }).select(
        "_id firstName lastName patientId role notificationPreferences"
      );

    if (!patient) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "No Patient account was found with this ID.",
        },
        {
          status: 404,
        }
      );
    }

    let monitoringRequest =
      await MonitoringRequest.findOne(
        {
          patientId:
            patient._id,

          familyId:
            family._id,
        }
      );

    if (
      monitoringRequest
        ?.status ===
      "pending"
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "This monitoring request is already pending.",
        },
        {
          status: 409,
        }
      );
    }

    if (
      monitoringRequest
        ?.status ===
      "approved"
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "Monitoring access has already been approved.",
        },
        {
          status: 409,
        }
      );
    }

    if (
      monitoringRequest
    ) {
      monitoringRequest.status =
        "pending";

      monitoringRequest.respondedAt =
        null;

      await monitoringRequest.save();
    } else {
      monitoringRequest =
        await MonitoringRequest.create(
          {
            patientId:
              patient._id,

            familyId:
              family._id,

            status:
              "pending",
          }
        );
    }

    await Notification.deleteMany({
      userId:
        patient._id,

      type:
        "monitoring_request",

      monitoringRequestId:
        monitoringRequest._id,
    });

    const notificationTitle =
      "Monitoring Request";

    const notificationMessage =
      `${fullName(
        family
      )} wants to monitor your medication activity.`;

    await Notification.create({
      userId:
        patient._id,

      type:
        "monitoring_request",

      title:
        notificationTitle,

      message:
        notificationMessage,

      monitoringRequestId:
        monitoringRequest._id,

      read:
        false,
    });

    await sendMonitoringPush(
      patient._id.toString(),

      patient
        .notificationPreferences
        ?.push !== false,

      {
        title:
          notificationTitle,

        body:
          notificationMessage,

        type:
          "monitoring_request",

        screen:
          "settings",

        url:
          "/settings",

        patientId:
          patient.patientId,

        requestId:
          monitoringRequest._id.toString(),

        monitoringRequestId:
          monitoringRequest._id.toString(),
      }
    );

    return NextResponse.json<ApiResponse>(
      {
        success: true,

        message:
          "Monitoring request sent. The Patient must approve it before access is granted.",

        data: {
          requestId:
            monitoringRequest._id.toString(),

          status:
            monitoringRequest.status,

          patient: {
            name:
              fullName(
                patient
              ),

            patientId:
              patient.patientId,
          },
        },
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    if (
      error &&
      typeof error ===
        "object" &&
      "code" in error &&
      Number(
        (
          error as {
            code?: unknown;
          }
        ).code
      ) ===
        11000
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "A monitoring request already exists for this Patient.",
        },
        {
          status: 409,
        }
      );
    }

    console.error(
      "[POST /api/patient/monitor]",
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

export async function PATCH(
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

    const body =
      await request
        .json()
        .catch(
          () => ({})
        );

    const requestId =
      typeof body.requestId ===
      "string"
        ? body.requestId
        : "";

    const action =
      body.action as
        | "approve"
        | "decline"
        | "revoke"
        | undefined;

    if (
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

    if (
      !action ||
      ![
        "approve",
        "decline",
        "revoke",
      ].includes(
        action
      )
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "Action must be approve, decline, or revoke.",
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
        "role firstName lastName patientId"
      );

    if (
      !patient ||
      patient.role ===
        "family"
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "Only the Patient can decide monitoring access.",
        },
        {
          status: 403,
        }
      );
    }

    if (!patient.role) {
      patient.role =
        "patient";

      await patient.save();
    }

    const monitoringRequest =
      await MonitoringRequest.findOne(
        {
          _id:
            requestId,

          patientId:
            patient._id,
        }
      );

    if (
      !monitoringRequest
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "Monitoring request not found.",
        },
        {
          status: 404,
        }
      );
    }

    if (
      action ===
        "revoke" &&
      monitoringRequest.status !==
        "approved"
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "Only approved access can be revoked.",
        },
        {
          status: 409,
        }
      );
    }

    if (
      action !==
        "revoke" &&
      monitoringRequest.status !==
        "pending"
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "This request has already been decided.",
        },
        {
          status: 409,
        }
      );
    }

    const nextStatus:
      MonitoringStatus =
      action ===
      "approve"
        ? "approved"
        : action ===
            "decline"
          ? "declined"
          : "revoked";

    monitoringRequest.status =
      nextStatus;

    monitoringRequest.respondedAt =
      new Date();

    await monitoringRequest.save();

    await Notification.updateMany(
      {
        userId:
          patient._id,

        type:
          "monitoring_request",

        monitoringRequestId:
          monitoringRequest._id,
      },
      {
        $set: {
          read: true,
        },
      }
    );

    await Notification.deleteMany({
      userId:
        monitoringRequest.familyId,

      monitoringRequestId:
        monitoringRequest._id,

      type: {
        $in: [
          "monitoring_approved",
          "monitoring_declined",
          "monitoring_revoked",
        ],
      },
    });

    const patientName =
      fullName(
        patient
      );

    const notificationType =
      nextStatus ===
      "approved"
        ? "monitoring_approved"
        : nextStatus ===
            "declined"
          ? "monitoring_declined"
          : "monitoring_revoked";

    const notificationTitle =
      nextStatus ===
      "approved"
        ? "Monitoring Request Approved"
        : nextStatus ===
            "declined"
          ? "Monitoring Request Declined"
          : "Monitoring Access Revoked";

    const notificationMessage =
      nextStatus ===
      "approved"
        ? `${patientName} approved your monitoring request.`
        : nextStatus ===
            "declined"
          ? `${patientName} declined your monitoring request.`
          : `${patientName} revoked your monitoring access.`;

    await Notification.create({
      userId:
        monitoringRequest.familyId,

      type:
        notificationType,

      title:
        notificationTitle,

      message:
        notificationMessage,

      monitoringRequestId:
        monitoringRequest._id,

      read:
        false,
    });

    const familyRecipient =
      await User.findOne({
        _id:
          monitoringRequest.familyId,

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
      const approvedPatientUrl =
        patient.patientId
          ? `/monitor/${patient.patientId}`
          : "/monitor";

      await sendMonitoringPush(
        monitoringRequest.familyId.toString(),

        familyRecipient
          .notificationPreferences
          ?.push !== false,

        {
          title:
            notificationTitle,

          body:
            notificationMessage,

          type:
            notificationType,

          screen:
            nextStatus ===
            "approved"
              ? "patient_dashboard"
              : "monitoring",

          url:
            nextStatus ===
            "approved"
              ? approvedPatientUrl
              : "/monitor",

          patientId:
            patient.patientId,

          requestId:
            monitoringRequest._id.toString(),

          monitoringRequestId:
            monitoringRequest._id.toString(),
        }
      );
    }

    return NextResponse.json<ApiResponse>({
      success: true,

      message:
        nextStatus ===
        "approved"
          ? "Monitoring access approved."
          : nextStatus ===
              "declined"
            ? "Monitoring request declined."
            : "Monitoring access revoked.",

      data: {
        requestId,
        status:
          nextStatus,
      },
    });
  } catch (error) {
    console.error(
      "[PATCH /api/patient/monitor]",
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