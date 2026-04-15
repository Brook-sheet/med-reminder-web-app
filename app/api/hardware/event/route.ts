// app/api/hardware/event/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// ESP32 POSTs to this endpoint when a pill is taken or missed.
//
// ESP32 payload (from sendToServer()):
//   {
//     "status": "taken" | "missed",
//     "time": "08:05",           ← current time when event happened
//     "snooze": 0,               ← number of snoozes before taken/missed
//     "alarmIndex": 0            ← index in the alarms array (0-based)
//   }
//
// Optional headers the ESP32 can send:
//   x-sensor-key: your-hardware-api-key
//   x-device-id: pillbox-001
//   x-user-id: <mongoUserId>     ← set this in ESP32 firmware after login
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import MedicationLog from '@/models/MedicationLog';
import SensorData from '@/models/SensorData';
import Medicine from '@/models/Medicine';

const SENSOR_API_KEY = process.env.SENSOR_API_KEY || 'dev-sensor-key-change-me';

function authorizeSensor(request: NextRequest): boolean {
  const key =
    request.headers.get('x-sensor-key') ||
    request.headers.get('x-api-key');
  if (process.env.NODE_ENV === 'development') return true;
  return key === SENSOR_API_KEY;
}

// ── Parse "HH:MM" → minutes since midnight ────────────────────────────────────
function timeStrToMinutes(timeStr: string): number {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return -1;
  return parseInt(match[1]) * 60 + parseInt(match[2]);
}

// ── Parse "8:00 AM" → minutes since midnight ──────────────────────────────────
function scheduledTimeToMinutes(timeStr: string): number {
  const ampm = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampm) {
    let h = parseInt(ampm[1]);
    const m = parseInt(ampm[2]);
    if (ampm[3].toUpperCase() === 'PM' && h !== 12) h += 12;
    if (ampm[3].toUpperCase() === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  }
  return timeStrToMinutes(timeStr);
}

// ── POST /api/hardware/event ──────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    if (!authorizeSensor(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const body = await request.json();
    const { status, time, snooze, alarmIndex } = body;

    // Get optional headers from ESP32
    const deviceId = request.headers.get('x-device-id') || 'esp32-pillbox';
    const userId = request.headers.get('x-user-id') || null;

    console.log('[Hardware Event]', { status, time, snooze, alarmIndex, deviceId, userId });

    // ── Validate ───────────────────────────────────────────────────────────────
    if (!status || !time) {
      return NextResponse.json(
        { error: 'status and time are required' },
        { status: 400 }
      );
    }

    if (!['taken', 'missed'].includes(status)) {
      return NextResponse.json(
        { error: 'status must be "taken" or "missed"' },
        { status: 400 }
      );
    }

    const today = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
    const eventMinutes = timeStrToMinutes(time);

    // ── Save raw sensor record ─────────────────────────────────────────────────
    await SensorData.create({
      deviceId,
      event: status === 'taken' ? 'pill_taken' : 'pill_dispensed',
      userId: userId || undefined,
      timestamp: new Date(),
      rawData: { status, time, snooze, alarmIndex },
      processed: false,
    });

    // ── Find matching pending log ──────────────────────────────────────────────
    // Strategy 1: if userId provided, find their pending log closest to event time
    // Strategy 2: if no userId, find any pending log closest to event time
    const logQuery: Record<string, unknown> = {
      scheduledDate: today,
      status: { $in: ['pending', 'reminder'] },
    };
    if (userId) logQuery.userId = userId;

    const pendingLogs = await MedicationLog.find(logQuery);

    let targetLog = null;
    let minDiff = Infinity;

    for (const log of pendingLogs) {
      const logMinutes = scheduledTimeToMinutes(log.scheduledTime);
      const diff = Math.abs(logMinutes - eventMinutes);
      // Match within 90 minutes window
      if (diff < minDiff && diff <= 90) {
        minDiff = diff;
        targetLog = log;
      }
    }

    // ── If alarmIndex provided, try to match by index in medicines list ────────
    if (!targetLog && alarmIndex !== undefined && alarmIndex >= 0) {
      const medicines = await Medicine.find(
        userId ? { userId, isActive: true } : { isActive: true }
      ).sort({ createdAt: 1 });

      // Flatten all alarms in order (same as ESP32 fetchSchedule does)
      const allAlarms: Array<{ medicineId: string; time: string }> = [];
      for (const med of medicines) {
        for (const t of med.scheduledTimes) {
          allAlarms.push({ medicineId: med._id.toString(), time: t });
        }
      }

      if (alarmIndex < allAlarms.length) {
        const alarm = allAlarms[alarmIndex];
        targetLog = await MedicationLog.findOne({
          medicineId: alarm.medicineId,
          scheduledDate: today,
          status: { $in: ['pending', 'reminder'] },
        });
      }
    }

    // ── Update the log ─────────────────────────────────────────────────────────
    if (targetLog) {
      await MedicationLog.findByIdAndUpdate(targetLog._id, {
        status: status === 'taken' ? 'taken' : 'missed',
        takenAt: status === 'taken' ? new Date() : null,
        source: 'sensor',
        sensorDeviceId: deviceId,
      });

      await SensorData.findOneAndUpdate(
        { deviceId, processed: false },
        { $set: { processed: true, medicineId: targetLog.medicineId } },
        { sort: { createdAt: -1 } }
      );

      console.log(`[Hardware Event] Log updated: ${targetLog.medicineName} → ${status}`);

      return NextResponse.json({
        success: true,
        message: `Pill ${status} recorded`,
        data: {
          medicineName: targetLog.medicineName,
          scheduledTime: targetLog.scheduledTime,
          status,
          snoozeCount: snooze,
        },
      });
    }

    // No matching log found — still saved the raw sensor data
    console.warn('[Hardware Event] No matching pending log found for time:', time);
    return NextResponse.json({
      success: true,
      message: 'Event recorded (no matching schedule found)',
      data: { status, time, alarmIndex },
    });
  } catch (error) {
    console.error('[POST /api/hardware/event]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── GET /api/hardware/event — health check ────────────────────────────────────
export async function GET(request: NextRequest) {
  if (!authorizeSensor(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({
    success: true,
    message: 'Hardware event API is online',
    timestamp: new Date(),
  });
}