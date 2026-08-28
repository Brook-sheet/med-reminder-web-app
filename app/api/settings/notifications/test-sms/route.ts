import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getTokenFromRequest,
  verifyToken,
} from "@/lib/auth";

import {
  connectDB,
} from "@/lib/mongodb";

import {
  claimAndSendSms,
} from "@/lib/sms/delivery";

import {
  maskPhilippineMobileNumber,
  normalizePhilippineMobileNumber,
} from "@/lib/sms/phone";

import SmsTestAttempt from "@/models/SmsTestAttempt";
import User from "@/models/User";

export const dynamic =
  "force-dynamic";

function json(
  body:
    Record<
      string,
      unknown
    >,

  status = 200,

  retryAfter?:
    number
) {
  return NextResponse.json(
    body,
    {
      status,

      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate",

        ...(retryAfter
          ? {
              "Retry-After":
                String(
                  retryAfter
                ),
            }
          : {}),
      },
    }
  );
}

function isDuplicateKeyError(
  error: unknown
): boolean {
  return (
    typeof error ===
      "object" &&
    error !== null &&
    "code" in error &&
    (
      error as {
        code?: number;
      }
    ).code ===
      11000
  );
}

export async function POST(
  request: NextRequest
) {
  try {
    const token =
      getTokenFromRequest(
        request
      );

    const auth =
      token
        ? await verifyToken(
            token
          )
        : null;

    if (
      !auth ||
      auth.role !==
        "family"
    ) {
      return json(
        {
          success:
            false,

          error:
            "Only an authenticated family account can send a test SMS.",
        },
        403
      );
    }

    await connectDB();

    /*
     * The destination number is always
     * loaded from the authenticated family
     * account.
     *
     * No number from the request body is
     * accepted or trusted.
     */
    const family =
      await User.findOne(
        {
          _id:
            auth.userId,

          role:
            "family",

          isDeleted: {
            $ne:
              true,
          },
        }
      )
        .select({
          "notificationPreferences.sms":
            1,

          "notificationPreferences.smsConsent":
            1,

          "notificationPreferences.smsPhoneNumber":
            1,
        })
        .lean();

    if (!family) {
      return json(
        {
          success:
            false,

          error:
            "Family account not found.",
        },
        404
      );
    }

    const preferences =
      family
        .notificationPreferences;

    const phoneNumber =
      normalizePhilippineMobileNumber(
        preferences
          ?.smsPhoneNumber
      );

    if (
      preferences?.sms !==
        true ||
      preferences
        .smsConsent !==
        true ||
      !phoneNumber
    ) {
      return json(
        {
          success:
            false,

          status:
            "skipped",

          error:
            "Save a valid number, provide consent, and enable SMS alerts first.",
        },
        400
      );
    }

    const now =
      new Date();

    const dayStart =
      new Date(
        now
      );

    dayStart.setUTCHours(
      0,
      0,
      0,
      0
    );

    const dailyCount =
      await SmsTestAttempt.countDocuments(
        {
          userId:
            family._id,

          createdAt: {
            $gte:
              dayStart,
          },
        }
      );

    if (
      dailyCount >= 5
    ) {
      return json(
        {
          success:
            false,

          status:
            "skipped",

          error:
            "The daily limit of five test SMS requests has been reached.",
        },
        429,
        60
      );
    }

    const minuteBucket =
      now
        .toISOString()
        .slice(
          0,
          16
        );

    try {
      await SmsTestAttempt.create(
        {
          userId:
            family._id,

          minuteBucket,
        }
      );
    } catch (error) {
      if (
        !isDuplicateKeyError(
          error
        )
      ) {
        throw error;
      }

      return json(
        {
          success:
            false,

          status:
            "skipped",

          error:
            "Please wait 60 seconds before sending another test SMS.",
        },
        429,
        60
      );
    }

    const delivery =
      await claimAndSendSms(
        {
          dedupeKey:
            `TEST_SMS:${family._id.toString()}:${now.toISOString()}`,

          recipientId:
            family._id.toString(),

          alertType:
            "TEST_SMS",

          to:
            phoneNumber,

          message:
            "Rx Box test alert: Family SMS notifications are connected successfully.",
        }
      );

    const result =
      delivery.result;

    const success =
      result.status ===
        "queued" ||
      result.status ===
        "sent";

    return json(
      {
        success,

        status:
          result.status,

        provider:
          result.provider,

        accepted:
          result.accepted,

        maskedPhoneNumber:
          maskPhilippineMobileNumber(
            phoneNumber
          ),

        providerMessageId:
          result
            .providerMessageId,

        errorCode:
          result.errorCode,

        message:
          success
            ? result.status ===
              "queued"
              ? "Test SMS was queued. Check TextBee history and verify that it arrived on the physical phone."
              : "Test SMS was sent. Verify that it arrived on the physical phone."
            : result
                .errorMessage ||
              "The test SMS could not be sent. In-app alerts remain available.",
      },
      success
        ? 200
        : 503
    );
  } catch (error) {
    console.error(
      "[POST /api/settings/notifications/test-sms]",
      error
    );

    return json(
      {
        success:
          false,

        status:
          "failed",

        error:
          "The test SMS request could not be completed.",
      },
      500
    );
  }
}