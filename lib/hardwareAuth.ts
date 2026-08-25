import { createHash, timingSafeEqual } from 'node:crypto';
import mongoose from 'mongoose';
import type { NextRequest } from 'next/server';
import DeviceMapping from '@/models/DeviceMapping';

export interface AuthenticatedHardwareDevice {
  deviceId: string;
  patientId: string;
  usedFallback: boolean;
}

export function hashDeviceSecret(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

export function constantTimeEqual(first: string, second: string): boolean {
  const firstBuffer = Buffer.from(first, 'utf8');
  const secondBuffer = Buffer.from(second, 'utf8');
  if (firstBuffer.length !== secondBuffer.length) return false;
  return timingSafeEqual(firstBuffer, secondBuffer);
}

export async function authenticateHardwareRequest(
  request: NextRequest,
): Promise<AuthenticatedHardwareDevice> {
  const deviceId = request.headers.get('x-device-id')?.trim() || '';
  const suppliedSecret = request.headers.get('x-sensor-key') || '';
  if (!deviceId || deviceId.length > 80) throw new Error('Missing or invalid x-device-id header.');
  if (!suppliedSecret || suppliedSecret.length > 256) throw new Error('Missing x-sensor-key header.');

  const mapping = await DeviceMapping.findOne({ deviceId, isActive: true }).select('+keyHash').lean();
  if (mapping) {
    const accepted = mapping.keyHash
      ? constantTimeEqual(hashDeviceSecret(suppliedSecret), mapping.keyHash)
      : Boolean(process.env.SENSOR_API_KEY) &&
        constantTimeEqual(suppliedSecret, process.env.SENSOR_API_KEY as string);
    if (!accepted) throw new Error('Unauthorized device credentials.');
    return { deviceId, patientId: mapping.patientId.toString(), usedFallback: false };
  }

  const fallbackPatientId = process.env.DEFAULT_DEVICE_USER_ID?.trim() || '';
  const fallbackDeviceId = process.env.DEFAULT_DEVICE_ID?.trim() || 'box_1';
  const fallbackSecret = process.env.SENSOR_API_KEY || '';
  const validFallback =
    deviceId === fallbackDeviceId &&
    mongoose.isValidObjectId(fallbackPatientId) &&
    Boolean(fallbackSecret) &&
    constantTimeEqual(suppliedSecret, fallbackSecret);
  if (!validFallback) {
    if (process.env.NODE_ENV === 'production' && !fallbackSecret) {
      console.error('[Hardware Auth] SENSOR_API_KEY is missing; access denied.');
    }
    throw new Error('Device is not mapped to an active patient.');
  }
  return { deviceId, patientId: fallbackPatientId, usedFallback: true };
}

export function authorizeInternalRequest(request: NextRequest): boolean {
  const expected = process.env.INTERNAL_API_KEY || '';
  const supplied = request.headers.get('x-internal-key') || '';
  return Boolean(expected) && Boolean(supplied) && constantTimeEqual(supplied, expected);
}

export function authorizeCronRequest(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET || '';
  const authorization = request.headers.get('authorization') || '';
  const supplied = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  return Boolean(expected) && Boolean(supplied) && constantTimeEqual(supplied, expected);
}