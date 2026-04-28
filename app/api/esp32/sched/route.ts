// app/api/esp32/sched/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Returns the alarm schedule that the ESP32 fetches on boot and every 5 min.
//
// ESP32 fetchSchedule() reads:
//   for (JsonObject obj : doc.as<JsonArray>()) {
//     a.hour   = obj["hour"];
//     a.minute = obj["minute"];
//   }
//
// So this endpoint returns:
//   [ { "hour": 8, "minute": 0 }, { "hour": 20, "minute": 0 }, ... ]
//
// Optional query params:
//   ?userId=<mongoId>   – filter to a single user's medicines
//   ?device=box_1       – future: device-to-user mapping
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Medicine from '@/models/Medicine';

const SENSOR_API_KEY = process.env.SENSOR_API_KEY ?? 'dev-sensor-key-change-me';

function isAuthorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  const key = req.headers.get('x-api-key') ?? req.headers.get('x-sensor-key');
  return key === SENSOR_API_KEY;
}

// ── Parse any time string → { hour, minute } ─────────────────────────────────
function parseTime(t: string): { hour: number; minute: number } | null {
  // "8:00 AM" / "08:30 PM"
  const ampm = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampm) {
    let h = parseInt(ampm[1]);
    const m = parseInt(ampm[2]);
    if (ampm[3].toUpperCase() === 'PM' && h !== 12) h += 12;
    if (ampm[3].toUpperCase() === 'AM' && h === 12) h = 0;
    return { hour: h, minute: m };
  }
  // "08:00" / "8:00"
  const plain = t.match(/^(\d{1,2}):(\d{2})$/);
  if (plain) return { hour: parseInt(plain[1]), minute: parseInt(plain[2]) };
  return null;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') ?? process.env.DEFAULT_DEVICE_USER_ID ?? null;
    const today = new Date().toISOString().split('T')[0];

    // Build query
    const query: Record<string, unknown> = { isActive: true };
    if (userId) {
      query.userId = userId;
      // Only include medicines whose schedule covers today
      query.$or = [
        { startDate: { $lte: today }, endDate: null },
        { startDate: { $lte: today }, endDate: { $gte: today } },
        { startDate: { $exists: false } },
      ];
    }

    const medicines = await Medicine.find(query);

    // Flatten all scheduled times into alarm objects
    const alarms: Array<{
      hour: number;
      minute: number;
      medicineId: string;
      medicineName: string;
      dosage: string;
    }> = [];

    for (const med of medicines) {
      for (const timeStr of med.scheduledTimes as string[]) {
        const parsed = parseTime(timeStr);
        if (parsed) {
          alarms.push({
            hour: parsed.hour,
            minute: parsed.minute,
            medicineId: (med._id as { toString(): string }).toString(),
            medicineName: med.name as string,
            dosage: med.dosage as string,
          });
        }
      }
    }

    // Sort by time ascending (same order the ESP32 assigns alarmIndex)
    alarms.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));

    // Remove exact duplicates (same hour+minute from multiple medicines)
    // keeping the richer object so the dashboard can still read medicineId
    const seen = new Set<string>();
    const deduplicated = alarms.filter((a) => {
      const key = `${a.hour}:${a.minute}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`[ESP32 Sched] Returning ${deduplicated.length} alarm(s)`);

    // The ESP32 only reads "hour" and "minute"; the extra fields are ignored
    // by the firmware but useful for debugging from a browser.
    return NextResponse.json(deduplicated);
  } catch (err) {
    console.error('[GET /api/esp32/sched]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}