import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { signToken } from "@/lib/auth";
import type { ApiResponse } from "@/lib/interfaces/data/Api";

interface MobileLoginData {
  accessToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: "patient" | "family";
    patientId?: string;
    familyId?: string;
    onboardingCompleted: boolean;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    if (!email || !password) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Email and password are required.",
        },
        { status: 400 }
      );
    }

    await connectDB();

    const user = await User.findOne({ email }).select("+password");

    if (!user || !user.password) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Invalid email or password.",
        },
        { status: 401 }
      );
    }

    if (user.isDeleted) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "This account has been deleted.",
        },
        { status: 403 }
      );
    }

    const passwordValid = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordValid) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Invalid email or password.",
        },
        { status: 401 }
      );
    }

    if (user.emailVerified !== true) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          code: "EMAIL_NOT_VERIFIED",
          error: "Verify your email before signing in.",
          data: { email: user.email },
        },
        { status: 403 }
      );
    }

    const role: "patient" | "family" =
      user.role === "family" ? "family" : "patient";

    const accessToken = await signToken({
      userId: user._id.toString(),
      email: user.email,
      emailVerified: true,
      role,
    });

    const data: MobileLoginData = {
      accessToken,
      user: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName ?? "",
        lastName: user.lastName ?? "",
        role,
        patientId: user.patientId,
        familyId: user.familyId,
        onboardingCompleted:
          role === "family"
            ? true
            : Boolean(user.onboardingCompleted),
      },
    };

    return NextResponse.json<ApiResponse<MobileLoginData>>({
      success: true,
      message: "Signed in successfully.",
      data,
    });
  } catch (error) {
    console.error("[POST /api/auth/mobile/login]", error);

    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error:
          "The authentication service is unavailable. Please try again.",
      },
      { status: 500 }
    );
  }
}