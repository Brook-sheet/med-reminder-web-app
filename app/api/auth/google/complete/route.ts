import {
  NextRequest,
  NextResponse,
} from "next/server";
import { connectDB } from "@/lib/mongodb";
import {
  COOKIE_OPTIONS,
  signToken,
} from "@/lib/auth";
import { generateUniquePatientId } from "@/lib/generatePatientId";
import { generateUniqueFamilyId } from "@/lib/generateFamilyId";
import {
  GOOGLE_PENDING_ACCOUNT_COOKIE,
  GOOGLE_PENDING_ACCOUNT_COOKIE_OPTIONS,
  verifyPendingGoogleAccountToken,
} from "@/lib/googlePendingAccount";
import User from "@/models/User";
import type { ApiResponse } from "@/lib/interfaces/data/Api";

export const runtime = "nodejs";

type ApplicationRole =
  | "patient"
  | "family";

function clearPendingAccountCookie(
  response: NextResponse
) {
  response.cookies.set({
    ...GOOGLE_PENDING_ACCOUNT_COOKIE_OPTIONS,
    value: "",
    maxAge: 0,
  });
}

export async function POST(
  request: NextRequest
) {
  try {
    const body = await request
      .json()
      .catch(() => ({}));

    const role = body.role as
      | ApplicationRole
      | undefined;

    if (
      role !== "patient" &&
      role !== "family"
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "Please select either Patient or Family.",
        },
        {
          status: 400,
        }
      );
    }

    const pendingToken =
      request.cookies.get(
        GOOGLE_PENDING_ACCOUNT_COOKIE
      )?.value;

    const identity = pendingToken
      ? await verifyPendingGoogleAccountToken(
          pendingToken
        )
      : null;

    if (!identity) {
      const response =
        NextResponse.json<ApiResponse>(
          {
            success: false,
            error:
              "Your Google sign-up session expired. Please continue with Google again.",
          },
          {
            status: 401,
          }
        );

      clearPendingAccountCookie(
        response
      );

      return response;
    }

    await connectDB();

    let user = await User.findOne({
      $or: [
        {
          googleSubject:
            identity.subject,
        },
        {
          email: identity.email,
        },
      ],
    }).select("+googleSubject");

    if (user?.isDeleted) {
      const response =
        NextResponse.json<ApiResponse>(
          {
            success: false,
            error:
              "This account has been deleted.",
          },
          {
            status: 403,
          }
        );

      clearPendingAccountCookie(
        response
      );

      return response;
    }

    if (
      user?.googleSubject &&
      user.googleSubject !==
        identity.subject
    ) {
      const response =
        NextResponse.json<ApiResponse>(
          {
            success: false,
            error:
              "This email is already linked to a different Google identity.",
          },
          {
            status: 409,
          }
        );

      clearPendingAccountCookie(
        response
      );

      return response;
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
            returnDocument:
              "after",
            runValidators: true,
          }
        ).select("+googleSubject");
    } else {
      const patientId =
        role === "patient"
          ? await generateUniquePatientId()
          : undefined;

      const familyId =
        role === "family"
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
        role,
        onboardingCompleted:
          role === "family",
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

    const storedRole:
      ApplicationRole =
        user.role === "family"
          ? "family"
          : "patient";

    const onboardingRequired =
      storedRole === "patient" &&
      !user.onboardingCompleted;

    const sessionToken =
      await signToken({
        userId: String(user._id),
        email: String(user.email),
        emailVerified: true,
        role: storedRole,
      });

    const response =
      NextResponse.json<ApiResponse>({
        success: true,
        data: {
          role: storedRole,
          onboardingRequired,
        },
      });

    response.cookies.set({
      ...COOKIE_OPTIONS,
      value: sessionToken,
    });

    clearPendingAccountCookie(
      response
    );

    return response;
  } catch (error) {
    console.error(
      "[GOOGLE_ACCOUNT_COMPLETE]",
      error
    );

    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error:
          "Unable to finish creating your account.",
      },
      {
        status: 500,
      }
    );
  }
}