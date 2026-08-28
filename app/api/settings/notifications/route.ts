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
  maskPhilippineMobileNumber,
  normalizePhilippineMobileNumber,
} from "@/lib/sms/phone";

import User from "@/models/User";

export const dynamic =
  "force-dynamic";

async function authenticatedFamily(
  request: NextRequest
) {
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
    return null;
  }

  return auth;
}

function noStoreJson(
  body:
    Record<
      string,
      unknown
    >,

  status = 200
) {
  return NextResponse.json(
    body,
    {
      status,

      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate",
      },
    }
  );
}

export async function GET(
  request: NextRequest
) {
  try {
    const auth =
      await authenticatedFamily(
        request
      );

    if (!auth) {
      return noStoreJson(
        {
          success:
            false,

          error:
            "Only an authenticated family account can manage SMS settings.",
        },
        403
      );
    }

    await connectDB();

    const user =
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
        /*
         * Select only non-conflicting
         * preference subfields.
         *
         * Do not select the parent object
         * and nested phone number together.
         */
        .select({
          "notificationPreferences.sms":
            1,

          "notificationPreferences.smsConsent":
            1,

          "notificationPreferences.smsConsentAt":
            1,

          "notificationPreferences.smsPhoneNumber":
            1,
        })
        .lean();

    if (!user) {
      return noStoreJson(
        {
          success:
            false,

          error:
            "Family account not found.",
        },
        404
      );
    }

    const phoneNumber =
      user
        .notificationPreferences
        ?.smsPhoneNumber ||
      "";

    return noStoreJson({
      success:
        true,

      data: {
        sms:
          user
            .notificationPreferences
            ?.sms ===
          true,

        smsConsent:
          user
            .notificationPreferences
            ?.smsConsent ===
          true,

        smsConsentAt:
          user
            .notificationPreferences
            ?.smsConsentAt ||
          null,

        smsPhoneNumber:
          phoneNumber,

        maskedPhoneNumber:
          maskPhilippineMobileNumber(
            phoneNumber
          ),
      },
    });
  } catch (error) {
    console.error(
      "[GET /api/settings/notifications]",
      error
    );

    return noStoreJson(
      {
        success:
          false,

        error:
          "Unable to load notification settings.",
      },
      500
    );
  }
}

export async function PUT(
  request: NextRequest
) {
  try {
    const auth =
      await authenticatedFamily(
        request
      );

    if (!auth) {
      return noStoreJson(
        {
          success:
            false,

          error:
            "Only an authenticated family account can manage SMS settings.",
        },
        403
      );
    }

    const body =
      (await request.json()) as {
        smsPhoneNumber?:
          unknown;

        sms?:
          unknown;

        smsConsent?:
          unknown;
      };

    if (
      typeof body.sms !==
        "boolean" ||
      typeof body.smsConsent !==
        "boolean"
    ) {
      return noStoreJson(
        {
          success:
            false,

          error:
            "sms and smsConsent must be true or false.",
        },
        400
      );
    }

    const phoneNumber =
      normalizePhilippineMobileNumber(
        body.smsPhoneNumber
      );

    if (!phoneNumber) {
      return noStoreJson(
        {
          success:
            false,

          error:
            "Enter a valid Philippine mobile number such as 09171234567.",
        },
        400
      );
    }

    if (
      body.sms &&
      !body.smsConsent
    ) {
      return noStoreJson(
        {
          success:
            false,

          error:
            "Consent is required before SMS alerts can be enabled.",
        },
        400
      );
    }

    await connectDB();

    const updated =
      await User.findOneAndUpdate(
        {
          _id:
            auth.userId,

          role:
            "family",

          isDeleted: {
            $ne:
              true,
          },
        },
        {
          $set: {
            "notificationPreferences.smsPhoneNumber":
              phoneNumber,

            "notificationPreferences.sms":
              body.sms &&
              body.smsConsent,

            "notificationPreferences.smsConsent":
              body.smsConsent,

            "notificationPreferences.smsConsentAt":
              body.smsConsent
                ? new Date()
                : null,
          },
        },
        {
          new:
            true,

          runValidators:
            true,
        }
      )
        .select({
          "notificationPreferences.sms":
            1,

          "notificationPreferences.smsConsent":
            1,

          "notificationPreferences.smsConsentAt":
            1,

          "notificationPreferences.smsPhoneNumber":
            1,
        })
        .lean();

    if (!updated) {
      return noStoreJson(
        {
          success:
            false,

          error:
            "Family account not found.",
        },
        404
      );
    }

    return noStoreJson({
      success:
        true,

      data: {
        sms:
          updated
            .notificationPreferences
            ?.sms ===
          true,

        smsConsent:
          updated
            .notificationPreferences
            ?.smsConsent ===
          true,

        smsConsentAt:
          updated
            .notificationPreferences
            ?.smsConsentAt ||
          null,

        smsPhoneNumber:
          phoneNumber,

        maskedPhoneNumber:
          maskPhilippineMobileNumber(
            phoneNumber
          ),
      },

      message:
        "Family SMS settings saved successfully.",
    });
  } catch (error) {
    console.error(
      "[PUT /api/settings/notifications]",
      error
    );

    return noStoreJson(
      {
        success:
          false,

        error:
          "Unable to save notification settings.",
      },
      500
    );
  }
}