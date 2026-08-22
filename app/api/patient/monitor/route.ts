import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import {
  getTokenFromRequest,
  verifyToken,
} from "@/lib/auth";
import { ensureApprovedConversation } from "@/lib/monitoringAuthorization";
import MonitoringRequest, {
  type MonitoringStatus,
} from "@/models/MonitoringRequest";
import Notification from "@/models/Notification";
import User from "@/models/User";
import type { ApiResponse } from "@/lib/interfaces/data/Api";

async function getAuthUser(request: NextRequest) {
  const token = getTokenFromRequest(request);
  return token ? verifyToken(token) : null;
}

function fullName(user: {
  firstName?: string;
  lastName?: string;
}) {
  return (
    `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() ||
    "Unknown user"
  );
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthUser(request);

    if (!auth) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    await connectDB();

    const currentUser = await User.findById(
      auth.userId
    ).select("role");

    if (!currentUser) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "User not found",
        },
        {
          status: 404,
        }
      );
    }

    const role =
      currentUser.role === "family"
        ? "family"
        : "patient";

    if (role === "patient") {
      const pendingCount =
        await MonitoringRequest.countDocuments({
          patientId: currentUser._id,
          status: "pending",
        });

      if (
        request.nextUrl.searchParams.get(
          "countOnly"
        ) === "1"
      ) {
        return NextResponse.json<ApiResponse>({
          success: true,
          data: {
            pendingCount,
          },
        });
      }

      const requests =
        await MonitoringRequest.find({
          patientId: currentUser._id,
        })
          .sort({
            createdAt: -1,
          })
          .populate(
            "familyId",
            "firstName middleName lastName email role"
          )
          .lean();

      const data = requests
        .filter((item) => item.familyId)
        .map((item) => {
          const family =
            item.familyId as unknown as {
              _id: mongoose.Types.ObjectId;
              firstName?: string;
              lastName?: string;
              email?: string;
            };

          return {
            requestId: item._id.toString(),
            family: {
              id: family._id.toString(),
              name: fullName(family),
              email: family.email,
            },
            status: item.status,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
          };
        });

      return NextResponse.json<ApiResponse>({
        success: true,
        data: {
          role,
          pendingCount,
          requests: data,
        },
      });
    }

    const requests =
      await MonitoringRequest.find({
        familyId: currentUser._id,
      })
        .sort({
          createdAt: -1,
        })
        .populate(
          "patientId",
          "firstName lastName patientId condition role"
        )
        .lean();

    const data = requests
      .filter((item) => item.patientId)
      .map((item) => {
        const patient =
          item.patientId as unknown as {
            _id: mongoose.Types.ObjectId;
            firstName?: string;
            lastName?: string;
            patientId?: string;
            condition?: string;
          };

        return {
          requestId: item._id.toString(),
          patient: {
            name: fullName(patient),
            patientId: patient.patientId,
            ...(item.status === "approved"
              ? {
                  condition: patient.condition,
                }
              : {}),
          },
          status: item.status,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        };
      });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        role,
        requests: data,
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
        error: "Internal server error",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthUser(request);

    if (!auth) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const body = await request
      .json()
      .catch(() => ({}));

    const patientId =
      typeof body.patientId === "string"
        ? body.patientId.trim().toUpperCase()
        : "";

    if (!patientId) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Patient ID is required",
        },
        {
          status: 400,
        }
      );
    }

    await connectDB();

    const family = await User.findById(
      auth.userId
    ).select(
      "role firstName lastName isDeleted"
    );

    if (!family || family.isDeleted) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "User not found",
        },
        {
          status: 404,
        }
      );
    }

    if (family.role !== "family") {
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

    const patient = await User.findOne({
      patientId,
      role: {
        $ne: "family",
      },
      isDeleted: {
        $ne: true,
      },
    }).select(
      "_id firstName lastName patientId role"
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

    if (!patient.role) {
      await User.updateOne(
        {
          _id: patient._id,
        },
        {
          $set: {
            role: "patient",
          },
        }
      );
    }

    let monitoringRequest =
      await MonitoringRequest.findOne({
        patientId: patient._id,
        familyId: family._id,
      });

    if (
      monitoringRequest?.status === "pending"
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
      monitoringRequest?.status === "approved"
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

    if (monitoringRequest) {
      monitoringRequest.status = "pending";
      monitoringRequest.respondedAt = null;
      await monitoringRequest.save();
    } else {
      monitoringRequest =
        await MonitoringRequest.create({
          patientId: patient._id,
          familyId: family._id,
          status: "pending",
        });
    }

    await Notification.deleteMany({
      userId: patient._id,
      type: "monitoring_request",
      monitoringRequestId:
        monitoringRequest._id,
    });

    await Notification.create({
      userId: patient._id,
      type: "monitoring_request",
      title: "Monitoring Request",
      message: `${fullName(
        family
      )} wants to monitor your medication activity.`,
      monitoringRequestId:
        monitoringRequest._id,
      read: false,
    });

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        message:
          "Monitoring request sent. The Patient must approve it before access is granted.",
        data: {
          requestId:
            monitoringRequest._id.toString(),
          status: monitoringRequest.status,
          patient: {
            name: fullName(patient),
            patientId: patient.patientId,
          },
        },
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "[POST /api/patient/monitor]",
      error
    );

    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Internal server error",
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
    const auth = await getAuthUser(request);

    if (!auth) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const body = await request
      .json()
      .catch(() => ({}));

    const requestId =
      typeof body.requestId === "string"
        ? body.requestId
        : "";

    const action = body.action as
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
      ].includes(action)
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

    const patient = await User.findById(
      auth.userId
    ).select("role");

    if (
      !patient ||
      patient.role === "family"
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
      patient.role = "patient";
      await patient.save();
    }

    const monitoringRequest =
      await MonitoringRequest.findOne({
        _id: requestId,
        patientId: patient._id,
      });

    if (!monitoringRequest) {
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
      action === "revoke" &&
      monitoringRequest.status !== "approved"
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
      action !== "revoke" &&
      monitoringRequest.status !== "pending"
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

    const nextStatus: MonitoringStatus =
      action === "approve"
        ? "approved"
        : action === "decline"
          ? "declined"
          : "revoked";

    monitoringRequest.status = nextStatus;
    monitoringRequest.respondedAt =
      new Date();

    await monitoringRequest.save();

    if (nextStatus === "approved") {
      await ensureApprovedConversation(
        monitoringRequest.patientId.toString(),
        monitoringRequest.familyId.toString()
      );
    }

    await Notification.updateMany(
      {
        userId: patient._id,
        type: "monitoring_request",
        monitoringRequestId:
          monitoringRequest._id,
      },
      {
        $set: {
          read: true,
        },
      }
    );

    return NextResponse.json<ApiResponse>({
      success: true,
      message:
        nextStatus === "approved"
          ? "Monitoring access approved."
          : nextStatus === "declined"
            ? "Monitoring request declined."
            : "Monitoring access revoked.",
      data: {
        requestId,
        status: nextStatus,
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
        error: "Internal server error",
      },
      {
        status: 500,
      }
    );
  }
}