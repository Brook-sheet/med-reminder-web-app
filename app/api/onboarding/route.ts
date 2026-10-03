import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

async function authenticate(request: NextRequest) {
  const token = getTokenFromRequest(request);
  const auth = token ? await verifyToken(token) : null;

  if (!auth) return null;

  await connectDB();

  return User.findOne({
    _id: auth.userId,
    isDeleted: { $ne: true },
  }).select(
    "role emailVerified onboardingCompleted productTour",
  );
}

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);

    if (!user || !user.emailVerified) {
      return json({ error: "Unauthorized" }, 401);
    }

    const role = user.role === "family" ? "family" : "patient";

    return json({
      userId: String(user._id),
      role,
      ready:
        role === "family" ||
        user.onboardingCompleted === true,
      status: user.productTour?.[role] ?? "not_started",
    });
  } catch {
    return json(
      { error: "Unable to load tour preferences." },
      500,
    );
  }
}

export async function PATCH(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (origin && origin !== request.nextUrl.origin) {
    return json({ error: "Forbidden" }, 403);
  }

  let body: {
    status?: unknown;
    role?: unknown;
    userId?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (
    !body ||
    (body.status !== "skipped" && body.status !== "completed")
  ) {
    return json({ error: "Invalid tour status" }, 400);
  }

  try {
    const user = await authenticate(request);

    if (!user || !user.emailVerified) {
      return json({ error: "Unauthorized" }, 401);
    }

    const role = user.role === "family" ? "family" : "patient";

    if (
      body.userId !== String(user._id) ||
      body.role !== role
    ) {
      return json({ error: "Account role changed" }, 409);
    }

    const field = `productTour.${role}`;

    // Skipping a replay must not downgrade a completed tour.
    await User.updateOne(
      {
        _id: user._id,
        role,
        ...(body.status === "skipped"
          ? { [field]: { $ne: "completed" } }
          : {}),
      },
      {
        $set: {
          [field]: body.status,
        },
      },
      {
        runValidators: true,
      },
    );

    return json({ success: true });
  } catch {
    return json(
      { error: "Unable to save tour preferences." },
      500,
    );
  }
}