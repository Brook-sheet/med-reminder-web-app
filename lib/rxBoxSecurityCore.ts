// lib/rxBoxSecurityCore.ts
import {
  timingSafeEqual,
} from 'node:crypto';

export interface RxBoxServerConfiguration {
  sensorApiKey: string;
  configuredDeviceId: string;
  mappedUserId: string;
}

export class RxBoxSecurityError
  extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string
  ) {
    super(message);

    this.name =
      'RxBoxSecurityError';
  }
}

function safeEqual(
  left: string,
  right: string
): boolean {
  const leftBuffer =
    Buffer.from(left);

  const rightBuffer =
    Buffer.from(right);

  return (
    leftBuffer.length ===
      rightBuffer.length &&
    timingSafeEqual(
      leftBuffer,
      rightBuffer
    )
  );
}

export function validateRxBoxConfiguration(
  environment:
    Record<
      string,
      string | undefined
    > = process.env
): RxBoxServerConfiguration {
  const sensorApiKey =
    environment
      .SENSOR_API_KEY
      ?.trim() ??
    '';

  const configuredDeviceId =
    environment
      .RX_BOX_DEVICE_ID
      ?.trim() ??
    '';

  const mappedUserId =
    environment
      .DEFAULT_DEVICE_USER_ID
      ?.trim() ??
    '';

  if (!sensorApiKey) {
    throw new RxBoxSecurityError(
      'Rx Box server configuration is incomplete: SENSOR_API_KEY is missing.',
      503,
      'RX_BOX_SENSOR_KEY_NOT_CONFIGURED'
    );
  }

  if (!configuredDeviceId) {
    throw new RxBoxSecurityError(
      'Rx Box server configuration is incomplete: RX_BOX_DEVICE_ID is missing.',
      503,
      'RX_BOX_DEVICE_NOT_CONFIGURED'
    );
  }

  if (
    !/^[a-f\d]{24}$/i.test(
      mappedUserId
    )
  ) {
    throw new RxBoxSecurityError(
      'Rx Box server configuration is incomplete: DEFAULT_DEVICE_USER_ID is missing or invalid.',
      503,
      'RX_BOX_PATIENT_MAPPING_INVALID'
    );
  }

  return {
    sensorApiKey,
    configuredDeviceId,
    mappedUserId,
  };
}

export function authorizeRxBoxCredentials(
  configuration:
    RxBoxServerConfiguration,

  suppliedKey: string,

  providedDeviceId: string
): void {
  if (
    !suppliedKey ||
    !safeEqual(
      suppliedKey.trim(),
      configuration.sensorApiKey
    )
  ) {
    throw new RxBoxSecurityError(
      'Unauthorized Rx Box request.',
      401,
      'RX_BOX_UNAUTHORIZED'
    );
  }

  if (
    !providedDeviceId ||
    !safeEqual(
      providedDeviceId.trim(),
      configuration.configuredDeviceId
    )
  ) {
    throw new RxBoxSecurityError(
      'Unknown Rx Box device.',
      403,
      'RX_BOX_UNKNOWN_DEVICE'
    );
  }
}