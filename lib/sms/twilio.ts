import type {
  SmsProviderClient,
  SmsSendInput,
  SmsSendResult,
} from './types';

interface TwilioResponse {
  sid?: string;
  status?: string;
  code?: number;
  message?: string;
}

function requestTimeout(): number {
  const parsed = Number(
    process.env
      .SMS_REQUEST_TIMEOUT_MS
  );

  return Number.isFinite(
    parsed
  )
    ? Math.min(
        30_000,
        Math.max(
          1_000,
          Math.floor(parsed)
        )
      )
    : 10_000;
}

export const twilioClient:
  SmsProviderClient = {
  async send(
    input: SmsSendInput
  ): Promise<SmsSendResult> {
    const accountSid =
      process.env
        .TWILIO_ACCOUNT_SID
        ?.trim();

    const authToken =
      process.env
        .TWILIO_AUTH_TOKEN
        ?.trim();

    const from =
      process.env
        .TWILIO_FROM_NUMBER
        ?.trim();

    if (
      !accountSid ||
      !authToken ||
      !from
    ) {
      return {
        accepted: false,
        provider: 'twilio',
        status: 'skipped',

        errorCode:
          'TWILIO_NOT_CONFIGURED',

        errorMessage:
          'Twilio is selected but its server-side credentials are incomplete.',
      };
    }

    const controller =
      new AbortController();

    const timeoutId =
      setTimeout(
        () =>
          controller.abort(),
        requestTimeout()
      );

    try {
      const form =
        new URLSearchParams({
          To:
            input.to,

          From:
            from,

          Body:
            input.message,
        });

      const response =
        await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
            accountSid
          )}/Messages.json`,
          {
            method:
              'POST',

            headers: {
              Authorization:
                `Basic ${Buffer.from(
                  `${accountSid}:${authToken}`
                ).toString(
                  'base64'
                )}`,

              'Content-Type':
                'application/x-www-form-urlencoded',
            },

            body:
              form.toString(),

            signal:
              controller.signal,
          }
        );

      const result =
        (await response
          .json()
          .catch(
            () => ({})
          )) as TwilioResponse;

      if (
        !response.ok ||
        !result.sid
      ) {
        return {
          accepted: false,
          provider:
            'twilio',
          status:
            'failed',

          errorCode:
            result.code
              ? `TWILIO_${result.code}`
              : `TWILIO_HTTP_${response.status}`,

          errorMessage:
            result.message
              ?.slice(
                0,
                200
              ) ||
            `Twilio returned HTTP ${response.status}.`,
        };
      }

      return {
        accepted: true,
        provider: 'twilio',

        providerMessageId:
          result.sid,

        status:
          result.status ===
          'sent'
            ? 'sent'
            : 'queued',
      };
    } catch (error) {
      const timedOut =
        error instanceof
          Error &&
        error.name ===
          'AbortError';

      return {
        accepted: false,
        provider: 'twilio',
        status: 'failed',

        errorCode:
          timedOut
            ? 'TWILIO_TIMEOUT'
            : 'TWILIO_NETWORK_ERROR',

        errorMessage:
          timedOut
            ? 'The Twilio request timed out.'
            : 'The Twilio service could not be reached.',
      };
    } finally {
      clearTimeout(
        timeoutId
      );
    }
  },
};