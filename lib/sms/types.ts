export type SmsProvider =
  | 'textbee'
  | 'twilio'
  | 'disabled';

export type SmsAlertType =
  | 'MEDICATION_VERIFIED'
  | 'MEDICATION_LATE'
  | 'MEDICATION_MISSED'
  | 'CRITICAL_MEDICATION_EVENT'
  | 'TEST_SMS'
  | 'OTHER';

export interface SmsSendInput {
  to: string;
  message: string;
  idempotencyKey: string;
  alertType: SmsAlertType;
}

export interface SmsSendResult {
  accepted: boolean;
  provider: SmsProvider;
  providerMessageId?: string;
  status:
    | 'queued'
    | 'sent'
    | 'skipped'
    | 'failed';
  errorCode?: string;
  errorMessage?: string;
}

export interface SmsProviderClient {
  send(
    input: SmsSendInput
  ): Promise<SmsSendResult>;
}