import {
  NextRequest,
  NextResponse,
} from "next/server";
import { connectDB } from "@/lib/mongodb";
import {
  getTokenFromRequest,
  verifyToken,
} from "@/lib/auth";
import { generateUniqueFamilyId } from "@/lib/generateFamilyId";
import User from "@/models/User";
import type { ApiResponse } from "@/lib/interfaces/data/Api";

async function getAuthUser(
  request: NextRequest
) {
  const token =
    getTokenFromRequest(request);

  return token
    ? verifyToken(token)
    : null;
}

export async function GET(
  request: NextRequest
) {
  try {
    const auth =
      await getAuthUser(request);

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

    const user =
      await User.findById(
        auth.userId
      ).select(
        "role familyId firstName lastName isDeleted"
      );

    if (!user || user.isDeleted) {
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

    if (user.role !== "family") {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            "Family IDs are available only to Family accounts.",
        },
        {
          status: 403,
        }
      );
    }

    // Backfill Family IDs for accounts
    // created before this feature.
    if (!user.familyId) {
      user.familyId =
        await generateUniqueFamilyId();

      await user.save();
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        familyId: user.familyId,
        name: `${user.firstName} ${user.lastName}`.trim(),
      },
    });
  } catch (error) {
    console.error(
      "[GET /api/family/my-id]",
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