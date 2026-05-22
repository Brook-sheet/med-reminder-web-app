import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Medicine from '@/models/Medicine';

const SENSOR_API_KEY =
  process.env.SENSOR_API_KEY || 'dev-sensor-key-change-me';

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

export async function GET(req: NextRequest) {
  try {
    // API KEY (query or header)
    const key =
      req.nextUrl.searchParams.get('key') ||
      req.headers.get('x-api-key');

    // The device_id should be mapped to a userId — for now use query param
    // In production: look up userId via DeviceMapping model
    // For now: return all active medicines for all users (demo mode)
    // or use a specific userId from env
    if (process.env.NODE_ENV === 'production') {
      if (key !== SENSOR_API_KEY) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    await connectDB();

    const userId = process.env.DEFAULT_DEVICE_USER_ID;

    const medicines = await Medicine.find({
      userId,
      isActive: true,
    });

    const alarms: { hour: number; minute: number }[] = [];

    for (const med of medicines) {
      for (const t of med.scheduledTimes || []) {
        const parsed = parseTime(t);
        if (parsed) alarms.push(parsed);
      }
    }

    const unique = alarms
      .sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute))
      .filter(
        (v, i, arr) =>
          i === 0 ||
          !(arr[i - 1].hour === v.hour && arr[i - 1].minute === v.minute)
      );

    return NextResponse.json({
      success: true,
      count: unique.length,
      alarms: unique,
    });
  } catch (err) {
    console.error('[ESP32 SCHED ERROR]', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}