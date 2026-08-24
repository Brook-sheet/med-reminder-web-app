import PushSubscription from '@/models/PushSubscription';

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
  status: 'SENT' | 'SKIPPED' | 'FAILED';
  sentCount?: number;
  error?: string;
}

function pushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY,
  );
}

export async function sendWebPushToUser(
  userId: string,
  payload: NotificationPayload,
): Promise<ChannelDeliveryResult> {
  if (!pushConfigured()) {
    return { status: 'SKIPPED', error: 'Web Push is not configured.' };
  }

  const subscriptions = await PushSubscription.find({ userId }).lean();
  if (subscriptions.length === 0) {
    return { status: 'SKIPPED', error: 'No active push subscription.' };
  }

  try {
    const webpush = (await import('web-push')).default;
    webpush.setVapidDetails(
      `mailto:${process.env.VAPID_EMAIL || 'admin@medreminder.app'}`,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string,
      process.env.VAPID_PRIVATE_KEY as string,
    );

    const results = await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: subscription.keys,
            },
            JSON.stringify({ ...payload, timestamp: Date.now() }),
          );
          return true;
        } catch (error) {
          const statusCode = (error as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await PushSubscription.deleteOne({ _id: subscription._id });
          }
          throw error;
        }
      }),
    );

    const sentCount = results.filter((result) => result.status === 'fulfilled').length;
    if (sentCount === 0) {
      return { status: 'FAILED', sentCount: 0, error: 'All Web Push deliveries failed.' };
    }
    return { status: 'SENT', sentCount };
  } catch (error) {
    console.error('[Web Push] Delivery failed:', error);
    return { status: 'FAILED', error: 'Web Push delivery failed.' };
  }
}

function smsConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER,
  );
}

export async function sendConfiguredSms(
  phoneNumber: string | undefined,
  message: string,
): Promise<ChannelDeliveryResult> {
  if (!phoneNumber) {
    return { status: 'SKIPPED', error: 'No SMS phone number is configured.' };
  }
  if (!smsConfigured()) {
    return { status: 'SKIPPED', error: 'SMS provider is not configured.' };
  }

  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID as string;
    const authToken = process.env.TWILIO_AUTH_TOKEN as string;
    const from = process.env.TWILIO_FROM_NUMBER as string;
    const form = new URLSearchParams({ To: phoneNumber, From: from, Body: message });
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      },
    );

    if (!response.ok) {
      console.error('[SMS] Provider returned status', response.status);
      return { status: 'FAILED', error: `SMS provider returned ${response.status}.` };
    }
    return { status: 'SENT', sentCount: 1 };
  } catch (error) {
    console.error('[SMS] Delivery failed:', error);
    return { status: 'FAILED', error: 'SMS delivery failed.' };
  }
}