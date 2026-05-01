// app/api/hardware/sched/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// ESP32 fetches this on boot and daily reset.
// Returns: [{ hour: 8, minute: 0 }, { hour: 20, minute: 0 }, ...]
// The ESP32 code uses: obj["hour"] and obj["minute"]
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Medicine from '@/models/Medicine';

const SENSOR_API_KEY = process.env.SENSOR_API_KEY || 'dev-sensor-key-change-me';

function authorizeSensor(request: NextRequest): boolean {
  const key =
    request.headers.get('x-sensor-key') ||
    request.headers.get('x-api-key');
  // In development allow requests without a key so you can test easily
  if (process.env.NODE_ENV === 'development') return true;
  return key === SENSOR_API_KEY;
}

// ── Parse "8:00 AM" / "08:00" / "8:00" → { hour, minute } ───────────────────
function parseTime(timeStr: string): { hour: number; minute: number } | null {
  // Format: "8:00 AM" or "08:00 PM"
  const ampmMatch = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampmMatch) {
    let hour = parseInt(ampmMatch[1]);
    const minute = parseInt(ampmMatch[2]);
    const ampm = ampmMatch[3].toUpperCase();
    if (ampm === 'PM' && hour !== 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
    return { hour, minute };
  }

  // Format: "08:00" or "8:00"
  const plainMatch = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (plainMatch) {
    return {
      hour: parseInt(plainMatch[1]),
      minute: parseInt(plainMatch[2]),
    };
  }

  return null;
}

// ── GET /api/hardware/sched ───────────────────────────────────────────────────
// Optional query param: ?userId=xxx  (if not provided, returns all active schedules)
export async function GET(request: NextRequest) {
  try {
    if (!authorizeSensor(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    // Build query
    const query: Record<string, unknown> = { isActive: true };
    if (userId) query.userId = userId;

    const medicines = await Medicine.find(query);

    // Flatten all scheduled times from all medicines into alarm objects
    const alarms: Array<{
      hour: number;
      minute: number;
      medicineId: string;
      medicineName: string;
      dosage: string;
    }> = [];

    for (const med of medicines) {
      for (const timeStr of med.scheduledTimes) {
        const parsed = parseTime(timeStr);
        if (parsed) {
          alarms.push({
            hour: parsed.hour,
            minute: parsed.minute,
            medicineId: med._id.toString(),
            medicineName: med.name,
            dosage: med.dosage,
          });
        }
      }
    }

    // Sort by hour then minute
    alarms.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));

    // Return array — ESP32 iterates with: for (JsonObject obj : doc.as<JsonArray>())
    return NextResponse.json(alarms);
  } catch (error) {
    console.error('[GET /api/hardware/sched]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
