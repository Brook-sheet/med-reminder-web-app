// app/api/sensor/sched/route.ts
// Returns today's alarm schedule for the ESP32
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Medicine from '@/models/Medicine';
import User from '@/models/User';

const SENSOR_API_KEY = process.env.SENSOR_API_KEY || 'dev-sensor-key-change-me';

function parseTime(timeStr: string): { hour: number; minute: number } | null {
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return null;
  let h = parseInt(match[1]);
  const m = parseInt(match[2]);
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return { hour: h, minute: m };
}

export async function GET(request: NextRequest) {
  const key = request.headers.get('x-sensor-key') || request.headers.get('x-api-key');
  if (key !== SENSOR_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectDB();

    // The device_id should be mapped to a userId — for now use query param
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('device_id') || 'box_1';

    // In production: look up userId via DeviceMapping model
    // For now: return all active medicines for all users (demo mode)
    // or use a specific userId from env
    const userId = process.env.DEFAULT_DEVICE_USER_ID;

    let medicines;
    if (userId) {
      const today = new Date().toISOString().split('T')[0];
      medicines = await Medicine.find({
        userId,
        isActive: true,
        startDate: { $lte: today },
      });
    } else {
      medicines = await Medicine.find({ isActive: true });
    }

    // Flatten all scheduled times into alarm list
    const alarms: { hour: number; minute: number }[] = [];
    for (const med of medicines) {
      for (const t of med.scheduledTimes) {
        const parsed = parseTime(t);
        if (parsed) alarms.push(parsed);
      }
    }

    // Sort by time and deduplicate
    const unique = alarms
      .sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute))
      .filter((v, i, arr) => i === 0 || !(arr[i - 1].hour === v.hour && arr[i - 1].minute === v.minute));

    return NextResponse.json(unique);
  } catch (error) {
    console.error('[GET /api/sensor/sched]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}