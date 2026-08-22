import {
  NextRequest,
  NextResponse,
} from "next/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import {
  getTokenFromRequest,
  verifyToken,
} from "@/lib/auth";
import type { ApiResponse } from "@/lib/interfaces/data/Api";

async function getAuthUser(
  request: NextRequest
) {
  const token =
    getTokenFromRequest(request);

  if (!token) {
    return null;
  }

  return verifyToken(token);
}

export async function GET(
  request: NextRequest
) {
  try {
    const user =
      await getAuthUser(request);

    if (!user) {
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

    const profile =
      await User.findById(
        user.userId
      ).select(
        "-password -emailVerificationTokenHash -emailVerificationExpires -googleSubject"
      );

    if (!profile) {
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

    const profileData =
      profile.toObject() as Record<
        string,
        unknown
      >;

    const role =
      profile.role === "family"
        ? "family"
        : "patient";

    profileData.role = role;

    if (role === "family") {
      delete profileData.age;
      delete profileData.condition;
      delete profileData.patientId;
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: profileData,
    });
  } catch (error) {
    console.error(
      "[GET /api/profile]",
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

export async function PUT(
  request: NextRequest
) {
  try {
    const user =
      await getAuthUser(request);

    if (!user) {
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

    const body =
      await request.json();

    const {
      firstName,
      middleName,
      lastName,
      email,
      condition,
      age,
      onboardingCompleted,
    } = body;

    const existingUser =
      await User.findById(
        user.userId
      ).select("role");

    if (!existingUser) {
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

    const existingRole =
      existingUser.role === "family"
        ? "family"
        : "patient";

    if (!existingUser.role) {
      await User.updateOne(
        {
          _id: existingUser._id,
        },
        {
          $set: {
            role: "patient",
          },
        }
      );
    }

    const updateData: Record<
      string,
      unknown
    > = {};

    if (firstName !== undefined) {
      updateData.firstName =
        firstName || "";
    }

    if (middleName !== undefined) {
      updateData.middleName =
        middleName || "";
    }

    if (lastName !== undefined) {
      updateData.lastName =
        lastName || "";
    }

    if (email !== undefined) {
      updateData.email =
        email?.toLowerCase();
    }

    if (existingRole === "patient") {
      if (condition !== undefined) {
        updateData.condition =
          condition;
      }

      if (age !== undefined) {
        updateData.age = age;
      }

      if (
        onboardingCompleted !==
        undefined
      ) {
        updateData.onboardingCompleted =
          onboardingCompleted;
      }
    }

    const updateOperation: {
      $set: Record<string, unknown>;
      $unset?: Record<string, 1>;
    } = {
      $set: updateData,
    };

    if (existingRole === "family") {
      updateOperation.$set.onboardingCompleted =
        true;

      updateOperation.$unset = {
        age: 1,
        condition: 1,
        patientId: 1,
      };
    }

    const updatedUser =
      await User.findByIdAndUpdate(
        user.userId,
        updateOperation,
        {
          new: true,
          runValidators: true,
        }
      ).select("-password");

    if (!updatedUser) {
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

    const responseData =
      updatedUser.toObject() as Record<
        string,
        unknown
      >;

    responseData.role =
      existingRole;

    if (
      existingRole === "family"
    ) {
      delete responseData.age;
      delete responseData.condition;
      delete responseData.patientId;
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: responseData,
      message:
        "Profile updated successfully",
    });
  } catch (error) {
    console.error(
      "[PUT /api/profile]",
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