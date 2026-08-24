import ExpoPushToken from "@/models/ExpoPushToken";
import PushSubscription from "@/models/PushSubscription";

export interface NotificationPayload {
  title: string;
  body: string;
  type: string;
  severity?: string;
  alertId?: string;
  medicineName?: string;
  url?: string;
}

export interface ChannelDeliveryResult {
  status:
    | "SENT"
    | "SKIPPED"
    | "FAILED";
  sentCount?: number;
  error?: string;
}

interface ExpoPushTicket {
  status:
    | "ok"
    | "error";
  id?: string;
  message?: string;
  details?: {
    error?: string;
  };
}

interface ExpoPushResponse {
  data?:
    | ExpoPushTicket
    | ExpoPushTicket[];
  errors?: Array<{
    message?: string;
  }>;
}

function pushConfigured(): boolean {
  return Boolean(
    process.env
      .NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env
        .VAPID_PRIVATE_KEY
  );
}

async function deliverWebPushToUser(
  userId: string,
  payload: NotificationPayload
): Promise<ChannelDeliveryResult> {
  if (!pushConfigured()) {
    return {
      status: "SKIPPED",
      error:
        "Web Push is not configured.",
    };
  }

  const subscriptions =
    await PushSubscription.find({
      userId,
    }).lean();

  if (
    subscriptions.length === 0
  ) {
    return {
      status: "SKIPPED",
      error:
        "No active browser push subscription.",
    };
  }

  try {
    const webpush = (
      await import("web-push")
    ).default;

    webpush.setVapidDetails(
      process.env
        .VAPID_SUBJECT ||
        process.env
          .VAPID_EMAIL ||
        "mailto:admin@medreminder.app",
      process.env
        .NEXT_PUBLIC_VAPID_PUBLIC_KEY as string,
      process.env
        .VAPID_PRIVATE_KEY as string
    );

    const results =
      await Promise.allSettled(
        subscriptions.map(
          async (
            subscription
          ) => {
            try {
              await webpush.sendNotification(
                {
                  endpoint:
                    subscription.endpoint,
                  keys:
                    subscription.keys,
                },
                JSON.stringify({
                  ...payload,
                  timestamp:
                    Date.now(),
                })
              );

              return true;
            } catch (error) {
              const statusCode = (
                error as {
                  statusCode?: number;
                }
              ).statusCode;

              if (
                statusCode ===
                  404 ||
                statusCode ===
                  410
              ) {
                await PushSubscription.deleteOne(
                  {
                    _id:
                      subscription._id,
                  }
                );
              }

              throw error;
            }
          }
        )
      );

    const sentCount =
      results.filter(
        (result) =>
          result.status ===
          "fulfilled"
      ).length;

    if (
      sentCount === 0
    ) {
      return {
        status: "FAILED",
        sentCount: 0,
        error:
          "All Web Push deliveries failed.",
      };
    }

    return {
      status: "SENT",
      sentCount,
    };
  } catch (error) {
    console.error(
      "[Web Push] Delivery failed:",
      error
    );

    return {
      status: "FAILED",
      error:
        "Web Push delivery failed.",
    };
  }
}

export async function sendExpoPushToUser(
  userId: string,
  payload: NotificationPayload
): Promise<ChannelDeliveryResult> {
  const tokens =
    await ExpoPushToken.find({
      userId,
    }).lean();

  if (
    tokens.length === 0
  ) {
    return {
      status: "SKIPPED",
      error:
        "No active Expo push token.",
    };
  }

  try {
    const messages =
      tokens.map(
        (item) => ({
          to: item.token,
          title:
            payload.title,
          body:
            payload.body,
          sound: "default",
          priority: "high",
          channelId:
            "medication-alerts",
          data: {
            type:
              payload.type,
            severity:
              payload.severity ||
              "",
            alertId:
              payload.alertId ||
              "",
            medicineName:
              payload.medicineName ||
              "",
            url:
              payload.url ||
              "/",
          },
        })
      );

    const response =
      await fetch(
        "https://exp.host/--/api/v2/push/send",
        {
          method: "POST",
          headers: {
            Accept:
              "application/json",
            "Content-Type":
              "application/json",
            ...(process.env
              .EXPO_ACCESS_TOKEN
              ? {
                  Authorization:
                    `Bearer ${process.env.EXPO_ACCESS_TOKEN}`,
                }
              : {}),
          },
          body:
            JSON.stringify(
              messages
            ),
        }
      );

    const result = (
      await response
        .json()
        .catch(() => ({}))
    ) as ExpoPushResponse;

    if (!response.ok) {
      return {
        status: "FAILED",
        sentCount: 0,
        error:
          result.errors?.[0]
            ?.message ||
          `Expo Push returned ${response.status}.`,
      };
    }

    const tickets =
      Array.isArray(
        result.data
      )
        ? result.data
        : result.data
          ? [result.data]
          : [];

    const invalidTokens:
      string[] = [];

    let sentCount = 0;

    tickets.forEach(
      (
        ticket,
        index
      ) => {
        if (
          ticket.status ===
          "ok"
        ) {
          sentCount += 1;
          return;
        }

        if (
          ticket.details
            ?.error ===
          "DeviceNotRegistered"
        ) {
          const invalidToken =
            tokens[index]
              ?.token;

          if (
            invalidToken
          ) {
            invalidTokens.push(
              invalidToken
            );
          }
        }
      }
    );

    if (
      invalidTokens.length >
      0
    ) {
      await ExpoPushToken.deleteMany(
        {
          token: {
            $in:
              invalidTokens,
          },
        }
      );
    }

    if (
      sentCount === 0
    ) {
      return {
        status: "FAILED",
        sentCount: 0,
        error:
          tickets.find(
            (ticket) =>
              ticket.message
          )?.message ||
          "All Expo Push deliveries failed.",
      };
    }

    return {
      status: "SENT",
      sentCount,
    };
  } catch (error) {
    console.error(
      "[Expo Push] Delivery failed:",
      error
    );

    return {
      status: "FAILED",
      error:
        "Expo Push delivery failed.",
    };
  }
}

/*
 * The existing alert engine already calls
 * sendWebPushToUser().
 *
 * We preserve that function name, but it now
 * delivers through browser Web Push and Expo Push.
 *
 * This avoids changing or duplicating the alert
 * engine and preserves existing web functionality.
 */
export async function sendWebPushToUser(
  userId: string,
  payload: NotificationPayload
): Promise<ChannelDeliveryResult> {
  const [
    webResult,
    expoResult,
  ] = await Promise.all([
    deliverWebPushToUser(
      userId,
      payload
    ),
    sendExpoPushToUser(
      userId,
      payload
    ),
  ]);

  const sentCount =
    (webResult.sentCount ||
      0) +
    (expoResult.sentCount ||
      0);

  if (sentCount > 0) {
    return {
      status: "SENT",
      sentCount,
    };
  }

  if (
    webResult.status ===
      "SKIPPED" &&
    expoResult.status ===
      "SKIPPED"
  ) {
    return {
      status: "SKIPPED",
      sentCount: 0,
      error: [
        webResult.error,
        expoResult.error,
      ]
        .filter(Boolean)
        .join(" "),
    };
  }

  return {
    status: "FAILED",
    sentCount: 0,
    error: [
      webResult.error,
      expoResult.error,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

function smsConfigured(): boolean {
  return Boolean(
    process.env
      .TWILIO_ACCOUNT_SID &&
      process.env
        .TWILIO_AUTH_TOKEN &&
      process.env
        .TWILIO_FROM_NUMBER
  );
}

export async function sendConfiguredSms(
  phoneNumber:
    | string
    | undefined,
  message: string
): Promise<ChannelDeliveryResult> {
  if (!phoneNumber) {
    return {
      status: "SKIPPED",
      error:
        "No SMS phone number is configured.",
    };
  }

  if (!smsConfigured()) {
    return {
      status: "SKIPPED",
      error:
        "SMS provider is not configured.",
    };
  }

  try {
    const accountSid =
      process.env
        .TWILIO_ACCOUNT_SID as string;

    const authToken =
      process.env
        .TWILIO_AUTH_TOKEN as string;

    const from =
      process.env
        .TWILIO_FROM_NUMBER as string;

    const form =
      new URLSearchParams({
        To: phoneNumber,
        From: from,
        Body: message,
      });

    const response =
      await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization:
              `Basic ${Buffer.from(
                `${accountSid}:${authToken}`
              ).toString("base64")}`,
            "Content-Type":
              "application/x-www-form-urlencoded",
          },
          body:
            form.toString(),
        }
      );

    if (!response.ok) {
      console.error(
        "[SMS] Provider returned status",
        response.status
      );

      return {
        status: "FAILED",
        error:
          `SMS provider returned ${response.status}.`,
      };
    }

    return {
      status: "SENT",
      sentCount: 1,
    };
  } catch (error) {
    console.error(
      "[SMS] Delivery failed:",
      error
    );

    return {
      status: "FAILED",
      error:
        "SMS delivery failed.",
    };
  }
}