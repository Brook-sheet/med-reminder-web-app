import {
  normalizePhilippineMobileNumber,
} from './phone';

import {
  textBeeClient,
} from './textbee';

import {
  twilioClient,
} from './twilio';

import type {
  SmsProvider,
  SmsSendInput,
  SmsSendResult,
} from './types';

export type {
  SmsAlertType,
  SmsProvider,
  SmsSendInput,
  SmsSendResult,
} from './types';

export function configuredSmsProvider():
  | SmsProvider
  | 'unsupported' {
  const configured =
    process.env
      .SMS_PROVIDER
      ?.trim()
      .toLowerCase();

  if (
    !configured ||
    configured ===
      'disabled'
  ) {
    return 'disabled';
  }

  if (
    configured ===
      'textbee' ||
    configured ===
      'twilio'
  ) {
    return configured;
  }

  return 'unsupported';
}

export async function sendSms(
  input: SmsSendInput
): Promise<SmsSendResult> {
  const provider =
    configuredSmsProvider();

  const to =
    normalizePhilippineMobileNumber(
      input.to
    );

  const message =
    input.message
      .replace(
        /[\u0000-\u001F\u007F]/g,
        ' '
      )
      .replace(
        /\s+/g,
        ' '
      )
      .trim()
      .slice(
        0,
        320
      );

  if (
    provider ===
    'disabled'
  ) {
    return {
      accepted: false,
      provider:
        'disabled',
      status:
        'skipped',

      errorCode:
        'SMS_DISABLED',

      errorMessage:
        'SMS delivery is disabled.',
    };
  }

  if (
    provider ===
    'unsupported'
  ) {
    console.error(
      '[SMS] Unsupported SMS_PROVIDER configuration.'
    );

    return {
      accepted: false,
      provider:
        'disabled',
      status:
        'failed',

      errorCode:
        'SMS_PROVIDER_UNSUPPORTED',

      errorMessage:
        'SMS_PROVIDER must be textbee, twilio, or disabled.',
    };
  }

  if (!to) {
    return {
      accepted: false,
      provider,
      status:
        'skipped',

      errorCode:
        'SMS_INVALID_PHONE',

      errorMessage:
        'A valid Philippine mobile number is required.',
    };
  }

  if (!message) {
    return {
      accepted: false,
      provider,
      status:
        'skipped',

      errorCode:
        'SMS_EMPTY_MESSAGE',

      errorMessage:
        'The SMS message is empty.',
    };
  }

  const normalizedInput = {
    ...input,
    to,
    message,
  };

  return provider ===
    'textbee'
    ? textBeeClient.send(
        normalizedInput
      )
    : twilioClient.send(
        normalizedInput
      );
}