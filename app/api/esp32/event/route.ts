// app/api/esp32/event/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Receives POST from the ESP32 pill box.
//
// ESP32 sendToServer() payload (exact):
//   {
//     "device_id": "box_1",
//     "status":    "taken" | "missed",
//     "time":      "HH:MM"   ← 24-hour, e.g. "08:05"
//     "snooze":    0          ← snooze count before event
//     "alarmIndex": 0         ← 0-based index of the alarm that fired
//   }
//
// Response the ESP32 doesn't actually read, but we return JSON for debugging.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import MedicationLog from '@/models/MedicationLog';
import SensorData from '@/models/SensorData';
import Medicine from '@/models/Medicine';

// ── Auth ─────────────────────────────────────────────────────────────────────
// In production set SENSOR_API_KEY in .env.local and send it as x-api-key header.
// In development all requests are allowed so you can test without headers.
const SENSOR_API_KEY = process.env.SENSOR_API_KEY ?? 'dev-sensor-key-change-me';

function isAuthorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  const key = req.headers.get('x-api-key') ?? req.headers.get('x-sensor-key');
  return key === SENSOR_API_KEY;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Parse "HH:MM" → minutes since midnight. Returns -1 on bad input. */
function hhmmToMinutes(t: string): number {
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return -1;
  return parseInt(m[1]) * 60 + parseInt(m[2]);
}

/** Parse "8:00 AM" / "08:00 PM" / "08:00" → minutes since midnight. */
function scheduledTimeToMinutes(t: string): number {
  const ampm = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampm) {
    let h = parseInt(ampm[1]);
    const min = parseInt(ampm[2]);
    if (ampm[3].toUpperCase() === 'PM' && h !== 12) h += 12;
    if (ampm[3].toUpperCase() === 'AM' && h === 12) h = 0;
    return h * 60 + min;
  }
  return hhmmToMinutes(t);
}

// ── POST ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectDB();

    // Parse body sent by the ESP32
    const body = (await req.json()) as {
      device_id?: string;
      status?: string;
      time?: string;
      snooze?: number;
      alarmIndex?: number;
    };

    const { device_id, status, time, snooze, alarmIndex } = body;

    // ── Validate ──────────────────────────────────────────────────────────────
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

    const eventMinutes = hhmmToMinutes(time);
    if (eventMinutes < 0) {
      return NextResponse.json(
        { error: 'time must be in HH:MM format' },
        { status: 400 }
      );
    }

    const deviceId = device_id ?? 'esp32-pillbox';
    const today = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"

    console.log('[ESP32 Event]', { deviceId, status, time, snooze, alarmIndex, today });

    // ── 1. Save raw sensor record ─────────────────────────────────────────────
    const sensorRecord = await SensorData.create({
      deviceId,
      event: status === 'taken' ? 'pill_taken' : 'pill_dispensed',
      timestamp: new Date(),
      rawData: { status, time, snooze, alarmIndex },
      processed: false,
    });

    // ── 2. Find the matching pending log ──────────────────────────────────────
    //
    // Strategy A – time-window match (±90 min)
    // Covers the common case where one pillbox serves one user.
    //
    const pendingLogs = await MedicationLog.find({
      scheduledDate: today,
      status: { $in: ['pending', 'reminder'] },
    });

    let targetLog = null;
    let minDiff = Infinity;

    for (const log of pendingLogs) {
      const diff = Math.abs(scheduledTimeToMinutes(log.scheduledTime) - eventMinutes);
      if (diff < minDiff && diff <= 90) {
        minDiff = diff;
        targetLog = log;
      }
    }

    // Strategy B – alarmIndex fallback
    // If time-window found nothing, look up the alarm by its ordered index,
    // mirroring the order the ESP32 fetches from /api/esp32/sched.
    if (!targetLog && alarmIndex != null && alarmIndex >= 0) {
      const medicines = await Medicine.find({ isActive: true }).sort({ createdAt: 1 });

      const allAlarms: Array<{ medicineId: string; time: string }> = [];
      for (const med of medicines) {
        for (const t of med.scheduledTimes as string[]) {
          allAlarms.push({ medicineId: (med._id as { toString(): string }).toString(), time: t });
        }
      }
      allAlarms.sort(
        (a, b) => scheduledTimeToMinutes(a.time) - scheduledTimeToMinutes(b.time)
      );

      if (alarmIndex < allAlarms.length) {
        const alarm = allAlarms[alarmIndex];
        targetLog = await MedicationLog.findOne({
          medicineId: alarm.medicineId,
          scheduledDate: today,
          status: { $in: ['pending', 'reminder'] },
        });
      }
    }

    // ── 3. Update the log ─────────────────────────────────────────────────────
    if (targetLog) {
      await MedicationLog.findByIdAndUpdate(targetLog._id, {
        status: status === 'taken' ? 'taken' : 'missed',
        takenAt: status === 'taken' ? new Date() : null,
        source: 'sensor',
        sensorDeviceId: deviceId,
      });

      // Mark the raw sensor record as processed
      await SensorData.findByIdAndUpdate(sensorRecord._id, {
        processed: true,
        medicineId: targetLog.medicineId,
      });

      console.log(
        `[ESP32 Event] ✓ ${targetLog.medicineName} → ${status}` +
          (snooze ? ` (after ${snooze} snooze(s))` : '')
      );

      return NextResponse.json({
        success: true,
        message: `Pill ${status} recorded`,
        data: {
          medicineName: targetLog.medicineName,
          scheduledTime: targetLog.scheduledTime,
          status,
          snoozeCount: snooze ?? 0,
          logId: targetLog._id,
        },
      });
    }

    // No matching log – still stored the raw event
    console.warn('[ESP32 Event] No matching pending log for time:', time);
    return NextResponse.json({
      success: true,
      message: 'Event recorded (no matching schedule found for today)',
      data: { deviceId, status, time, alarmIndex },
    });
  } catch (err) {
    console.error('[POST /api/esp32/event]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── GET – health check ────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({
    success: true,
    message: 'ESP32 event endpoint online',
    timestamp: new Date().toISOString(),
  });
}