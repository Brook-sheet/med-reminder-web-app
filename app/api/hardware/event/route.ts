import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import SensorData from '@/models/SensorData';
import { processMedicationEvent } from '@/lib/medicationVerification';

const SENSOR_API_KEY = process.env.SENSOR_API_KEY || 'dev-sensor-key-change-me';

function authorized(request: NextRequest): boolean {
  const key = request.headers.get('x-sensor-key') || request.headers.get('x-api-key');
  return process.env.NODE_ENV !== 'production' || key === SENSOR_API_KEY;
}

function eventTimestamp(time: string | undefined): Date {
  if (!time) return new Date();
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) throw new Error('time must use HH:MM format.');
  const result = new Date();
  result.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return result;
}

export async function POST(request: NextRequest) {
  try {
    if (!authorized(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const body = await request.json() as Record<string, unknown>;
    const userId = request.headers.get('x-user-id') ||
      (typeof body.userId === 'string' ? body.userId : '') ||
      (typeof body.user_id === 'string' ? body.user_id : '');
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'x-user-id or userId is required to identify the patient safely.' },
        { status: 400 },
      );
    }

    const status = String(body.status || 'taken').toLowerCase();
    if (!['taken', 'missed'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'status must be taken or missed.' },
        { status: 400 },
      );
    }

    const rawChamberId = body.chamberId ?? body.chamber_id;
    const chamberId = rawChamberId == null ? null : Number(rawChamberId);
    const deviceId = request.headers.get('x-device-id') ||
      (typeof body.deviceId === 'string' ? body.deviceId : '') ||
      (typeof body.device_id === 'string' ? body.device_id : 'esp32-pillbox');
    const timestamp = eventTimestamp(typeof body.time === 'string' ? body.time : undefined);

    const sensorRecord = await SensorData.create({
      userId,
      deviceId,
      event: status === 'taken' ? 'container_opened' : 'pill_dispensed',
      timestamp,
      rawData: body,
      processed: false,
    });

    const result = await processMedicationEvent({
      userId,
      source: 'sensor',
      eventType: status === 'missed' ? 'MISSED' : 'CHAMBER_OPENED',
      timestamp,
      chamberId,
      deviceId,
    });

    await SensorData.findByIdAndUpdate(sensorRecord._id, {
      processed: result.verified,
      medicineName: result.medicineName,
    });

    return NextResponse.json({ success: true, data: result, message: result.message });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[POST /api/hardware/event]', error);
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({
    success: true,
    message: 'Hardware event API is online.',
    requiredFields: ['userId', 'chamberId', 'status'],
  });
}