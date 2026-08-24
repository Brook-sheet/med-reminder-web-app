import {
  NextRequest,
  NextResponse,
} from "next/server";
import { signToken } from "@/lib/auth";
import { generateUniqueFamilyId } from "@/lib/generateFamilyId";
import { generateUniquePatientId } from "@/lib/generatePatientId";
import { verifyGoogleIdToken } from "@/lib/googleAuth";
import type { ApiResponse } from "@/lib/interfaces/data/Api";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";

export const runtime = "nodejs";

type ApplicationRole =
  | "patient"
  | "family";

interface MobileGoogleLoginData {
  accessToken: string;

  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: ApplicationRole;
    patientId?: string;
    familyId?: string;
    onboardingCompleted: boolean;
  };
}

export async function POST(
  request: NextRequest
) {
  try {
    const body = (await request
      .json()
      .catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const idToken =
      typeof body.idToken === "string"
        ? body.idToken.trim()
        : "";

    const requestedRole =
      body.role === "patient" ||
      body.role === "family"
        ? body.role
        : undefined;

    if (!idToken) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "Google ID token is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      body.role !== undefined &&
      requestedRole === undefined
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "Role must be either patient or family.",
        },
        {
          status: 400,
        }
      );
    }

    let identity;

    try {
      identity =
        await verifyGoogleIdToken(
          idToken
        );
    } catch (error) {
      console.error(
        "[POST /api/auth/mobile/google] Invalid Google token:",
        error
      );

      return NextResponse.json<ApiResponse>(
        {
          success: false,
          code: "INVALID_GOOGLE_TOKEN",
          error:
            "Google authentication could not be verified. Please try again.",
        },
        {
          status: 401,
        }
      );
    }

    await connectDB();

    let user = await User.findOne({
      googleSubject: identity.subject,
    }).select("+googleSubject");

    if (
      user &&
      user.email !== identity.email
    ) {
      const emailOwner =
        await User.findOne({
          email: identity.email,
        })
          .select("_id")
          .lean();

      if (
        emailOwner &&
        String(emailOwner._id) !==
          String(user._id)
      ) {
        return NextResponse.json<ApiResponse>(
          {
            success: false,
            error:
              "The verified Google email is already linked to another account.",
          },
          {
            status: 409,
          }
        );
      }
    }

    if (!user) {
      user = await User.findOne({
        email: identity.email,
      }).select("+googleSubject");
    }

    if (user?.isDeleted) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "This account has been deleted.",
        },
        {
          status: 403,
        }
      );
    }

    if (
      user?.googleSubject &&
      user.googleSubject !==
        identity.subject
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "This account is already linked to a different Google identity.",
        },
        {
          status: 409,
        }
      );
    }

    if (user) {
      const storedRole:
        ApplicationRole =
          user.role === "family"
            ? "family"
            : "patient";

      user =
        await User.findByIdAndUpdate(
          user._id,
          {
            $set: {
              email: identity.email,
              emailVerified: true,
              googleSubject:
                identity.subject,
              firstName:
                user.firstName ||
                identity.firstName,
              lastName:
                user.lastName ||
                identity.lastName,
              role: storedRole,
            },
            $unset: {
              emailVerificationTokenHash: 1,
              emailVerificationExpires: 1,
            },
          },
          {
            returnDocument: "after",
            runValidators: true,
          }
        ).select("+googleSubject");
    } else {
      if (!requestedRole) {
        return NextResponse.json<ApiResponse>(
          {
            success: false,
            code: "GOOGLE_ROLE_REQUIRED",
            error:
              "Select whether this Google account is for a patient or family member.",
          },
          {
            status: 409,
          }
        );
      }

      const patientId =
        requestedRole === "patient"
          ? await generateUniquePatientId()
          : undefined;

      const familyId =
        requestedRole === "family"
          ? await generateUniqueFamilyId()
          : undefined;

      user = await User.create({
        email: identity.email,
        emailVerified: true,
        googleSubject:
          identity.subject,
        firstName:
          identity.firstName,
        middleName: "",
        lastName:
          identity.lastName,
        role: requestedRole,
        onboardingCompleted:
          requestedRole === "family",
        patientId,
        familyId,
        monitoredPatients: [],
        authorizedMonitors: [],
      });
    }

    if (!user) {
      throw new Error(
        "Unable to create or link the Google account."
      );
    }

    const role: ApplicationRole =
      user.role === "family"
        ? "family"
        : "patient";

    const accessToken = await signToken({
      userId: String(user._id),
      email: String(user.email),
      emailVerified: true,
      role,
    });

    const data: MobileGoogleLoginData = {
      accessToken,
      user: {
        id: String(user._id),
        email: String(user.email),
        firstName: user.firstName ?? "",
        lastName: user.lastName ?? "",
        role,
        patientId: user.patientId,
        familyId: user.familyId,
        onboardingCompleted:
          role === "family"
            ? true
            : Boolean(
                user.onboardingCompleted
              ),
      },
    };

    return NextResponse.json<
      ApiResponse<MobileGoogleLoginData>
    >({
      success: true,
      message:
        "Signed in with Google successfully.",
      data,
    });
  } catch (error) {
    console.error(
      "[POST /api/auth/mobile/google]",
      error
    );

    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error:
          "Google authentication is unavailable. Please try again.",
      },
      {
        status: 500,
      }
    );
  }
}