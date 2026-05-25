import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import MedicationLog from '@/models/MedicationLog';
import User from '@/models/User';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import type { ApiResponse } from '@/lib/interfaces/data/Api';

async function getAuthUser(request: NextRequest) {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyToken(token);
}

// ── Types ──────────────────────────────────────────────────────────────────

type FinalizedStatus = 'taken' | 'delayed' | 'missed' | 'pending';

interface ClassifyResult {
  status: FinalizedStatus;
  delayMinutes: number | null;
}

/**
 * Shape of every log we return to the client.
 * "taken"  = on-time (within 30 min of schedule)
 * "delayed"= confirmed but 30 min–2 hr after schedule
 * "missed" = no confirmation within 2 hr window
 * "pending"= still within window — never sent to history
 */
interface EnrichedLog {
  _id: unknown;
  userId: unknown;
  medicineId: unknown;
  medicineName: string;
  dosage: string;
  scheduledTime: string;
  scheduledDate: string;
  takenAt?: Date | null;
  status: string;
  source: string;
  sensorDeviceId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  classifiedStatus: FinalizedStatus;
  delayMinutes: number | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function parseTimeToMinutes(timeStr: string): number {
  const ampm = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampm) {
    let h = parseInt(ampm[1]);
    const m = parseInt(ampm[2]);
    if (ampm[3].toUpperCase() === 'PM' && h !== 12) h += 12;
    if (ampm[3].toUpperCase() === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  }
  const plain = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (plain) return parseInt(plain[1]) * 60 + parseInt(plain[2]);
  return 0;
}

/**
 * Single source-of-truth classification function.
 *
 * Rules:
 *   confirmed + diff ≤ 30 min  → "taken"   (on-time)
 *   confirmed + diff >  30 min → "delayed"  (late but confirmed)
 *   not confirmed + elapsed > 120 min → "missed"
 *   otherwise → "pending"  (excluded from history)
 */
function classifyLog(
  scheduledDate: string,
  scheduledTime: string,
  rawStatus: string,
  takenAt: Date | null | undefined,
): ClassifyResult {
  const scheduledMinutes = parseTimeToMinutes(scheduledTime);
  const scheduledDateTime = new Date(`${scheduledDate}T00:00:00`);
  scheduledDateTime.setMinutes(scheduledDateTime.getMinutes() + scheduledMinutes);

  const now = new Date();

  // ── Confirmed intake (sensor or manual) ───────────────────────────────
  if (rawStatus === 'taken') {
    if (takenAt) {
      const taken = new Date(takenAt);
      const diffMinutes = Math.round(
        (taken.getTime() - scheduledDateTime.getTime()) / 60_000,
      );
      // On-time: within 30-min grace window (negative diff = early = on-time)
      if (diffMinutes <= 30) {
        return { status: 'taken', delayMinutes: null };
      }
      // Late confirmation: delayed
      return { status: 'delayed', delayMinutes: diffMinutes };
    }
    // No takenAt timestamp → treat as on-time (edge case)
    return { status: 'taken', delayMinutes: null };
  }

  // ── Not confirmed ─────────────────────────────────────────────────────
  const elapsedMinutes =
    (now.getTime() - scheduledDateTime.getTime()) / 60_000;

  if (elapsedMinutes > 120) {
    return { status: 'missed', delayMinutes: null };
  }

  return { status: 'pending', delayMinutes: null };
}

// ── GET /api/history ───────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }

    await connectDB();

    const userDoc = await User.findById(user.userId).select('dataResetAt');
    const dataResetAt = userDoc?.dataResetAt ?? null;

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const weekAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const monthAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    const baseQuery: Record<string, unknown> = { userId: user.userId };
    if (dataResetAt) {
      baseQuery.createdAt = { $gt: dataResetAt };
    }

    const rawLogs = await MedicationLog.find(baseQuery)
      .sort({ scheduledDate: -1, scheduledTime: -1 })
      .lean();

    // ── Classify every log ────────────────────────────────────────────────
    const enriched: EnrichedLog[] = rawLogs.map((log) => {
      const { status, delayMinutes } = classifyLog(
        String(log.scheduledDate),
        String(log.scheduledTime),
        String(log.status),
        log.takenAt ?? null,
      );
      return {
        _id: log._id,
        userId: log.userId,
        medicineId: log.medicineId,
        medicineName: String(log.medicineName ?? ''),
        dosage: String(log.dosage ?? ''),
        scheduledTime: String(log.scheduledTime ?? ''),
        scheduledDate: String(log.scheduledDate ?? ''),
        takenAt: log.takenAt ?? null,
        status: String(log.status ?? ''),
        source: String(log.source ?? 'auto'),
        sensorDeviceId: (log.sensorDeviceId as string | null | undefined) ?? null,
        createdAt: log.createdAt,
        updatedAt: log.updatedAt,
        classifiedStatus: status,
        delayMinutes,
      };
    });

    // Pending stays on the Dashboard — history shows only finalized records
    const finalized = enriched.filter((l) => l.classifiedStatus !== 'pending');

    // ── Section grouping ──────────────────────────────────────────────────
    const today     = finalized.filter((l) => l.scheduledDate === todayStr);
    const thisWeek  = finalized.filter((l) => l.scheduledDate >= weekAgoStr  && l.scheduledDate < todayStr);
    const thisMonth = finalized.filter((l) => l.scheduledDate >= monthAgoStr && l.scheduledDate < weekAgoStr);
    const earlier   = finalized.filter((l) => l.scheduledDate < monthAgoStr);

    // ── Summary counts ────────────────────────────────────────────────────
    // onTime  = classifiedStatus === 'taken'   (confirmed within 30 min)
    // delayed = classifiedStatus === 'delayed'  (confirmed after 30 min)
    // totalConfirmed = onTime + delayed  (this is the "Total Taken" card value)
    const onTime         = finalized.filter((l) => l.classifiedStatus === 'taken').length;
    const totalDelayed   = finalized.filter((l) => l.classifiedStatus === 'delayed').length;
    const totalConfirmed = onTime + totalDelayed;   // ← displayed as "Total Taken"
    const totalMissed    = finalized.filter((l) => l.classifiedStatus === 'missed').length;
    const totalRecords   = finalized.length;
    const successRate    =
      totalRecords > 0 ? Math.round((totalConfirmed / totalRecords) * 100) : 0;

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        summary: {
          // totalTaken = ALL confirmed (on-time + delayed) — used as card headline
          totalTaken: totalConfirmed,
          // onTime and delayed broken out so the UI can show correct sub-labels
          onTime,
          totalDelayed,
          totalMissed,
          totalRecords,
          successRate,
        },
        today,
        thisWeek,
        thisMonth,
        earlier,
      },
    });
  } catch (error) {
    console.error('[GET /api/history]', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}

// ── PATCH /api/history — manual update (Dashboard only) ───────────────────

export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }

    await connectDB();
    const body = await request.json();
    const { logId, status } = body as { logId: string; status: string };

    if (!logId || !status) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'logId and status are required' },
        { status: 400 },
      );
    }

    if (!['taken', 'missed', 'pending'].includes(status)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid status' },
        { status: 400 },
      );
    }

    const log = await MedicationLog.findOneAndUpdate(
      { _id: logId, userId: user.userId },
      {
        status,
        takenAt: status === 'taken' ? new Date() : null,
        source: 'manual',
      },
      { new: true },
    );

    if (!log) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Log not found' },
        { status: 404 },
      );
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: log,
      message: `Marked as ${status}`,
    });
  } catch (error) {
    console.error('[PATCH /api/history]', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}