// lib/rxBoxDevice.ts
import type {
  NextRequest,
} from 'next/server';

import User from '@/models/User';

import {
  authorizeRxBoxCredentials,
  RxBoxSecurityError,
  validateRxBoxConfiguration,
} from '@/lib/rxBoxSecurityCore';

export {
  RxBoxSecurityError as RxBoxDeviceError,
} from '@/lib/rxBoxSecurityCore';

export interface RxBoxDeviceResolution {
  deviceId: string;
  userId: string;
}

export async function resolveRxBoxDevice(
  request: NextRequest,
  providedDeviceId: string
): Promise<RxBoxDeviceResolution> {
  const configuration =
    validateRxBoxConfiguration();

  const suppliedKey =
    request.headers
      .get('x-sensor-key')
      ?.trim() ??
    '';

  authorizeRxBoxCredentials(
    configuration,
    suppliedKey,
    providedDeviceId
  );

  const patient =
    await User.findOne({
      _id:
        configuration.mappedUserId,

      role:
        'patient',

      isDeleted: {
        $ne: true,
      },
    }).select('_id');

  if (!patient) {
    throw new RxBoxSecurityError(
      'The configured Rx Box patient mapping does not exist or is not an active patient.',
      503,
      'RX_BOX_PATIENT_MAPPING_NOT_FOUND'
    );
  }

  return {
    deviceId:
      configuration.configuredDeviceId,

    userId:
      patient._id.toString(),
  };
}