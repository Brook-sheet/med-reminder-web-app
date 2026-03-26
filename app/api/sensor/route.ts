// app/api/sensor/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// This endpoint receives data from your physical hardware (pill dispenser,
// smart pillbox, wearable, etc.).
//
// The hardware POSTs JSON like:
//   { "deviceId": "box-001", "event": "pill_taken", "medicineId": "...",
//     "userId": "...", "timestamp": "2025-01-15T08:05:00Z" }
//
// GET is provided for polling / heartbeat checks.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import SensorData from '@/models/SensorData';
import MedicationLog from '@/models/MedicationLog';
import Medicine from '@/models/Medicine';
import type { ApiResponse } from '@/types';

const SENSOR_API_KEY = process.env.SENSOR_API_KEY || 'dev-sensor-key-change-me';

function authorizeSensor(request: NextRequest): boolean {
  const key = request.headers.get('x-sensor-key') || request.headers.get('x-api-key');
  return key === SENSOR_API_KEY;
}

// ── POST /api/sensor ──────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    if (!authorizeSensor(request)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized sensor' }, { status: 401 });
    }

    await connectDB();
    const body = await request.json();
    const { deviceId, event, userId, medicineId, medicineName, timestamp, rawData } = body;

    if (!deviceId || !event) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'deviceId and event are required' }, { status: 400 });
    }

    // ── Save raw sensor record ─────────────────────────────────────────────────
    const sensorRecord = await SensorData.create({
      deviceId,
      event,
      userId: userId || null,
      medicineId: medicineId || null,
      medicineName: medicineName || null,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      rawData: rawData || {},
      processed: false,
    });

    // ── Process "pill_taken" events ───────────────────────────────────────────
    if (event === 'pill_taken' && userId) {
      const eventDate = new Date(timestamp || Date.now());
      const dateStr = eventDate.toISOString().split('T')[0];
      const eventHour = eventDate.getHours();
      const eventMin = eventDate.getMinutes();
      const eventTotal = eventHour * 60 + eventMin;

      // Find the closest pending log within ±90 minutes of event time
      const pendingLogs = await MedicationLog.find({
        userId,
        scheduledDate: dateStr,
        status: { $in: ['pending', 'reminder'] },
      });

      let closestLog = null;
      let minDiff = Infinity;

      for (const log of pendingLogs) {
        const match = log.scheduledTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (!match) continue;
        let h = parseInt(match[1]);
        const m = parseInt(match[2]);
        const ampm = match[3].toUpperCase();
        if (ampm === 'PM' && h !== 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        const logTotal = h * 60 + m;
        const diff = Math.abs(logTotal - eventTotal);
        if (diff < minDiff && diff <= 90) {
          minDiff = diff;
          closestLog = log;
        }
      }

      // If we matched a specific medicine from the sensor
      let targetLog = closestLog;
      if (medicineId && !targetLog) {
        targetLog = await MedicationLog.findOne({
          userId,
          medicineId,
          scheduledDate: dateStr,
          status: { $in: ['pending', 'reminder'] },
        });
      }

      if (targetLog) {
        await MedicationLog.findByIdAndUpdate(targetLog._id, {
          status: 'taken',
          takenAt: eventDate,
          source: 'sensor',
          sensorDeviceId: deviceId,
        });

        await SensorData.findByIdAndUpdate(sensorRecord._id, { processed: true });

        return NextResponse.json<ApiResponse>({
          success: true,
          message: 'Pill intake recorded via sensor',
          data: { logId: targetLog._id, medicineName: targetLog.medicineName },
        });
      }
    }

    // Heartbeat / other events — just acknowledge
    return NextResponse.json<ApiResponse>({
      success: true,
      message: `Sensor event "${event}" received`,
      data: { sensorId: sensorRecord._id },
    });
  } catch (error) {
    console.error('[POST /api/sensor]', error);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ── GET /api/sensor — heartbeat / status check ────────────────────────────────
export async function GET(request: NextRequest) {
  if (!authorizeSensor(request)) {
    return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized sensor' }, { status: 401 });
  }
  return NextResponse.json<ApiResponse>({ success: true, message: 'Sensor API is online', data: { timestamp: new Date() } });
}
