import type {
  SmsProviderClient,
  SmsSendInput,
  SmsSendResult,
} from './types';

interface TextBeeResponse {
  data?: {
    success?: boolean;
    message?: string;
    smsBatchId?: string;
    recipientCount?: number;
    successCount?: number;
    failureCount?: number;
  };
  message?: string;
  error?: string;
}

const DEFAULT_BASE_URL =
  'https://api.textbee.dev';

function requestTimeout(): number {
  const parsed = Number(
    process.env
      .SMS_REQUEST_TIMEOUT_MS
  );

  if (!Number.isFinite(parsed)) {
    return 10_000;
  }

  return Math.min(
    30_000,
    Math.max(
      1_000,
      Math.floor(parsed)
    )
  );
}

function endpoint(): string {
  const base =
    process.env
      .TEXTBEE_API_BASE_URL
      ?.trim() ||
    DEFAULT_BASE_URL;

  return `${base.replace(
    /\/+$/,
    ''
  )}/api/v1/gateway/send-sms`;
}

function safeErrorMessage(
  response: TextBeeResponse,
  status: number
): string {
  const providerMessage =
    response.data?.message ||
    response.message ||
    response.error;

  if (status === 401) {
    return 'TextBee authentication failed. Check the server-side API key.';
  }

  if (status === 429) {
    return 'TextBee message limits have been reached.';
  }

  if (status === 400) {
    return (
      providerMessage?.slice(
        0,
        200
      ) ||
      'The TextBee Android gateway is unavailable, disabled, or unable to send.'
    );
  }

  return (
    providerMessage?.slice(
      0,
      200
    ) ||
    `TextBee returned HTTP ${status}.`
  );
}

export const textBeeClient:
  SmsProviderClient = {
  async send(
    input: SmsSendInput
  ): Promise<SmsSendResult> {
    const apiKey =
      process.env
        .TEXTBEE_API_KEY
        ?.trim();

    const deviceId =
      process.env
        .TEXTBEE_DEVICE_ID
        ?.trim();

    if (!apiKey || !deviceId) {
      return {
        accepted: false,
        provider: 'textbee',
        status: 'skipped',
        errorCode:
          'TEXTBEE_NOT_CONFIGURED',
        errorMessage:
          'TextBee is selected but TEXTBEE_API_KEY or TEXTBEE_DEVICE_ID is missing.',
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
      const response =
        await fetch(
          endpoint(),
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',

              'x-api-key':
                apiKey,
            },

            body:
              JSON.stringify({
                recipients: [
                  input.to,
                ],

                message:
                  input.message,

                deviceId,
              }),

            signal:
              controller.signal,
          }
        );

      const result =
        (await response
          .json()
          .catch(
            () => ({})
          )) as TextBeeResponse;

      if (!response.ok) {
        return {
          accepted: false,
          provider:
            'textbee',
          status: 'failed',

          errorCode:
            response.status ===
            401
              ? 'TEXTBEE_AUTH_FAILED'
              : response.status ===
                  429
                ? 'TEXTBEE_LIMIT_REACHED'
                : response.status ===
                    400
                  ? 'TEXTBEE_GATEWAY_UNAVAILABLE'
                  : 'TEXTBEE_HTTP_ERROR',

          errorMessage:
            safeErrorMessage(
              result,
              response.status
            ),
        };
      }

      const accepted =
        result.data
          ?.success === true ||
        typeof result.data
          ?.smsBatchId ===
          'string' ||
        (
          result.data
            ?.successCount ??
          0
        ) > 0;

      if (!accepted) {
        return {
          accepted: false,
          provider:
            'textbee',
          status: 'failed',

          errorCode:
            'TEXTBEE_MALFORMED_RESPONSE',

          errorMessage:
            'TextBee returned an unexpected response and the SMS was not confirmed as queued.',
        };
      }

      return {
        accepted: true,
        provider: 'textbee',

        providerMessageId:
          result.data
            ?.smsBatchId,

        /*
         * TextBee API acceptance
         * is not carrier delivery.
         */
        status: 'queued',
      };
    } catch (error) {
      const timedOut =
        error instanceof
          Error &&
        error.name ===
          'AbortError';

      return {
        accepted: false,
        provider: 'textbee',
        status: 'failed',

        errorCode:
          timedOut
            ? 'TEXTBEE_TIMEOUT'
            : 'TEXTBEE_NETWORK_ERROR',

        errorMessage:
          timedOut
            ? 'The TextBee request timed out.'
            : 'The TextBee service could not be reached.',
      };
    } finally {
      clearTimeout(
        timeoutId
      );
    }
  },
};