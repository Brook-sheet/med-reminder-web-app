import mongoose from 'mongoose';

import {
  configuredSmsProvider,
  sendSms,
} from '@/lib/sms';

import {
  maskPhilippineMobileNumber,
} from '@/lib/sms/phone';

import type {
  SmsAlertType,
  SmsSendResult,
} from '@/lib/sms/types';

import SmsDelivery from '@/models/SmsDelivery';

interface DeliverSmsInput {
  dedupeKey: string;
  recipientId: string;

  patientId?:
    | string
    | null;

  alertId?:
    | string
    | null;

  alertType:
    SmsAlertType;

  to: string;
  message: string;
}

export interface DeliverSmsResult {
  duplicate:
    boolean;

  result:
    SmsSendResult;
}

function isDuplicateKeyError(
  error: unknown
): boolean {
  return (
    typeof error ===
      'object' &&
    error !== null &&
    'code' in error &&
    (
      error as {
        code?: number;
      }
    ).code === 11000
  );
}

function objectIdOrNull(
  value?:
    | string
    | null
): mongoose.Types.ObjectId | null {
  return (
    value &&
    mongoose.isValidObjectId(
      value
    )
  )
    ? new mongoose.Types.ObjectId(
        value
      )
    : null;
}

function storedResult(
  delivery: {
    provider:
      | 'textbee'
      | 'twilio'
      | 'disabled';

    status:
      | 'processing'
      | 'queued'
      | 'sent'
      | 'skipped'
      | 'failed';

    providerMessageId?:
      string;

    errorCode?:
      string;

    errorMessage?:
      string;
  }
): SmsSendResult {
  if (
    delivery.status ===
    'processing'
  ) {
    return {
      accepted:
        false,

      provider:
        delivery.provider,

      status:
        'skipped',

      errorCode:
        'SMS_ALREADY_PROCESSING',

      errorMessage:
        'This SMS request is already being processed.',
    };
  }

  return {
    accepted:
      delivery.status ===
        'queued' ||
      delivery.status ===
        'sent',

    provider:
      delivery.provider,

    providerMessageId:
      delivery
        .providerMessageId ||
      undefined,

    status:
      delivery.status,

    errorCode:
      delivery.errorCode ||
      undefined,

    errorMessage:
      delivery.errorMessage ||
      undefined,
  };
}

export async function claimAndSendSms(
  input:
    DeliverSmsInput
): Promise<
  DeliverSmsResult
> {
  const configuredProvider =
    configuredSmsProvider();

  const initialProvider =
    configuredProvider ===
    'unsupported'
      ? 'disabled'
      : configuredProvider;

  let delivery;

  try {
    delivery =
      await SmsDelivery.create(
        {
          dedupeKey:
            input.dedupeKey,

          recipientId:
            input.recipientId,

          patientId:
            objectIdOrNull(
              input.patientId
            ),

          alertId:
            objectIdOrNull(
              input.alertId
            ),

          alertType:
            input.alertType,

          provider:
            initialProvider,

          status:
            'processing',

          maskedPhone:
            maskPhilippineMobileNumber(
              input.to
            ),
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

    const existing =
      await SmsDelivery.findOne(
        {
          dedupeKey:
            input.dedupeKey,
        }
      ).lean();

    return {
      duplicate:
        true,

      result:
        existing
          ? storedResult(
              existing
            )
          : {
              accepted:
                false,

              provider:
                initialProvider,

              status:
                'skipped',

              errorCode:
                'SMS_DUPLICATE',

              errorMessage:
                'This SMS request was already claimed.',
            },
    };
  }

  const result =
    await sendSms({
      to:
        input.to,

      message:
        input.message,

      idempotencyKey:
        input.dedupeKey,

      alertType:
        input.alertType,
    });

  await SmsDelivery.updateOne(
    {
      _id:
        delivery._id,
    },
    {
      $set: {
        provider:
          result.provider,

        status:
          result.status,

        providerMessageId:
          result
            .providerMessageId ||
          '',

        errorCode:
          result.errorCode ||
          '',

        errorMessage:
          result
            .errorMessage
            ?.slice(
              0,
              300
            ) ||
          '',
      },
    }
  );

  return {
    duplicate:
      false,

    result,
  };
}