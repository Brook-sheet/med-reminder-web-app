import ExpoPushToken from "@/models/ExpoPushToken";
import PushSubscription from "@/models/PushSubscription";

export type NotificationScreen =
  | "dashboard"
  | "alerts"
  | "monitoring"
  | "chats"
  | "history"
  | "medicines"
  | "adherence"
  | "settings"
  | "account"
  | "patient_dashboard";

export interface NotificationPayload {
  title: string;
  body: string;
  type: string;

  severity?: string;
  riskLevel?: string;

  screen?: NotificationScreen;
  url?: string;

  alertId?: string;
  medicineId?: string;
  medicineName?: string;
  patientId?: string;

  conversationId?: string;
  messageId?: string;

  requestId?: string;
  monitoringRequestId?: string;
  chatRequestId?: string;

  logId?: string;
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

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  sound: "default";
  priority: "high";
  channelId: string;

  data: Record<
    string,
    string
  >;
}

const EXPO_PUSH_ENDPOINT =
  "https://exp.host/--/api/v2/push/send";

const EXPO_PUSH_BATCH_SIZE =
  100;

function pushConfigured(): boolean {
  return Boolean(
    process.env
      .NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env
        .VAPID_PRIVATE_KEY
  );
}

function optionalString(
  value:
    | string
    | undefined
    | null
): string {
  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

function buildNotificationData(
  payload: NotificationPayload
): Record<string, string> {
  return {
    type:
      optionalString(
        payload.type
      ) ||
      "notification",

    screen:
      optionalString(
        payload.screen
      ),

    url:
      optionalString(
        payload.url
      ) ||
      "/",

    severity:
      optionalString(
        payload.severity
      ),

    riskLevel:
      optionalString(
        payload.riskLevel
      ),

    alertId:
      optionalString(
        payload.alertId
      ),

    medicineId:
      optionalString(
        payload.medicineId
      ),

    medicineName:
      optionalString(
        payload.medicineName
      ),

    patientId:
      optionalString(
        payload.patientId
      ),

    conversationId:
      optionalString(
        payload.conversationId
      ),

    messageId:
      optionalString(
        payload.messageId
      ),

    requestId:
      optionalString(
        payload.requestId
      ),

    monitoringRequestId:
      optionalString(
        payload.monitoringRequestId
      ),

    chatRequestId:
      optionalString(
        payload.chatRequestId
      ),

    logId:
      optionalString(
        payload.logId
      ),

    timestamp:
      new Date().toISOString(),
  };
}

function splitIntoBatches<T>(
  items: T[],
  batchSize: number
): T[][] {
  const batches: T[][] =
    [];

  for (
    let index = 0;
    index < items.length;
    index += batchSize
  ) {
    batches.push(
      items.slice(
        index,
        index +
          batchSize
      )
    );
  }

  return batches;
}

async function deliverWebPushToUser(
  userId: string,
  payload: NotificationPayload
): Promise<ChannelDeliveryResult> {
  if (!pushConfigured()) {
    return {
      status: "SKIPPED",
      sentCount: 0,
      error:
        "Web Push is not configured.",
    };
  }

  try {
    const subscriptions =
      await PushSubscription.find({
        userId,
      }).lean();

    if (
      subscriptions.length ===
      0
    ) {
      return {
        status: "SKIPPED",
        sentCount: 0,
        error:
          "No active browser push subscription.",
      };
    }

    const webpush = (
      await import(
        "web-push"
      )
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

                  data:
                    buildNotificationData(
                      payload
                    ),

                  timestamp:
                    Date.now(),
                })
              );

              return true;
            } catch (error) {
              const statusCode =
                (
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
        (
          result
        ) =>
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

    const failedCount =
      results.length -
      sentCount;

    return {
      status: "SENT",
      sentCount,

      ...(failedCount > 0
        ? {
            error:
              `${failedCount} browser push delivery attempt(s) failed.`,
          }
        : {}),
    };
  } catch (error) {
    console.error(
      "[Web Push] Delivery failed:",
      error
    );

    return {
      status: "FAILED",
      sentCount: 0,
      error:
        "Web Push delivery failed.",
    };
  }
}

export async function sendExpoPushToUser(
  userId: string,
  payload: NotificationPayload
): Promise<ChannelDeliveryResult> {
  try {
    const tokens =
      await ExpoPushToken.find({
        userId,
      }).lean();

    if (
      tokens.length === 0
    ) {
      return {
        status: "SKIPPED",
        sentCount: 0,
        error:
          "No active Expo push token.",
      };
    }

    const notificationData =
      buildNotificationData(
        payload
      );

    const messages:
      ExpoPushMessage[] =
      tokens.map(
        (
          item
        ) => ({
          to: item.token,

          title:
            payload.title
              .trim()
              .slice(
                0,
                150
              ),

          body:
            payload.body
              .trim()
              .slice(
                0,
                1500
              ),

          sound:
            "default",

          priority:
            "high",

          channelId:
            "medication-alerts",

          data:
            notificationData,
        })
      );

    const tokenBatches =
      splitIntoBatches(
        tokens,
        EXPO_PUSH_BATCH_SIZE
      );

    const messageBatches =
      splitIntoBatches(
        messages,
        EXPO_PUSH_BATCH_SIZE
      );

    const invalidTokens:
      string[] = [];

    const deliveryErrors:
      string[] = [];

    let sentCount = 0;

    for (
      let batchIndex = 0;
      batchIndex <
      messageBatches.length;
      batchIndex += 1
    ) {
      const messageBatch =
        messageBatches[
          batchIndex
        ];

      const tokenBatch =
        tokenBatches[
          batchIndex
        ];

      try {
        const response =
          await fetch(
            EXPO_PUSH_ENDPOINT,
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
                  messageBatch
                ),
            }
          );

        const result = (
          await response
            .json()
            .catch(
              () => ({})
            )
        ) as ExpoPushResponse;

        if (!response.ok) {
          deliveryErrors.push(
            result.errors?.[0]
              ?.message ||
              `Expo Push returned HTTP ${response.status}.`
          );

          continue;
        }

        const tickets =
          Array.isArray(
            result.data
          )
            ? result.data
            : result.data
              ? [
                  result.data,
                ]
              : [];

        if (
          tickets.length ===
          0
        ) {
          deliveryErrors.push(
            "Expo Push returned no delivery tickets."
          );

          continue;
        }

        tickets.forEach(
          (
            ticket,
            ticketIndex
          ) => {
            if (
              ticket.status ===
              "ok"
            ) {
              sentCount += 1;
              return;
            }

            const token =
              tokenBatch[
                ticketIndex
              ]?.token;

            if (
              ticket.details
                ?.error ===
                "DeviceNotRegistered" &&
              token
            ) {
              invalidTokens.push(
                token
              );
            }

            deliveryErrors.push(
              ticket.message ||
                ticket.details
                  ?.error ||
                "Expo Push rejected a notification."
            );
          }
        );
      } catch (error) {
        console.error(
          "[Expo Push] Batch delivery failed:",
          error
        );

        deliveryErrors.push(
          "An Expo Push batch request failed."
        );
      }
    }

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
          deliveryErrors[0] ||
          "All Expo Push deliveries failed.",
      };
    }

    return {
      status: "SENT",
      sentCount,

      ...(deliveryErrors.length >
      0
        ? {
            error:
              `${deliveryErrors.length} Expo Push delivery attempt(s) failed.`,
          }
        : {}),
    };
  } catch (error) {
    console.error(
      "[Expo Push] Delivery failed:",
      error
    );

    return {
      status: "FAILED",
      sentCount: 0,
      error:
        "Expo Push delivery failed.",
    };
  }
}

/*
 * This name is preserved because the existing alert engine
 * already calls sendWebPushToUser().
 *
 * The function delivers through both browser Web Push and
 * native Expo Push.
 */
export async function sendWebPushToUser(
  userId: string,
  payload: NotificationPayload
): Promise<ChannelDeliveryResult> {
  const [
    webResult,
    expoResult,
  ] =
    await Promise.all([
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
    (
      webResult.sentCount ||
      0
    ) +
    (
      expoResult.sentCount ||
      0
    );

  const errors = [
    webResult.error,
    expoResult.error,
  ].filter(
    (
      error
    ): error is string =>
      Boolean(error)
  );

  if (sentCount > 0) {
    return {
      status: "SENT",
      sentCount,

      ...(errors.length > 0
        ? {
            error:
              errors.join(
                " "
              ),
          }
        : {}),
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
      error:
        errors.join(
          " "
        ),
    };
  }

  return {
    status: "FAILED",
    sentCount: 0,

    error:
      errors.join(
        " "
      ) ||
      "All notification delivery channels failed.",
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
      sentCount: 0,
      error:
        "No SMS phone number is configured.",
    };
  }

  if (!smsConfigured()) {
    return {
      status: "SKIPPED",
      sentCount: 0,
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
        To:
          phoneNumber,

        From:
          from,

        Body:
          message,
      });

    const response =
      await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method:
            "POST",

          headers: {
            Authorization:
              `Basic ${Buffer.from(
                `${accountSid}:${authToken}`
              ).toString(
                "base64"
              )}`,

            "Content-Type":
              "application/x-www-form-urlencoded",
          },

          body:
            form.toString(),
        }
      );

    if (!response.ok) {
      console.error(
        "[SMS] Provider returned status:",
        response.status
      );

      return {
        status: "FAILED",
        sentCount: 0,
        error:
          `SMS provider returned HTTP ${response.status}.`,
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
      sentCount: 0,
      error:
        "SMS delivery failed.",
    };
  }
}