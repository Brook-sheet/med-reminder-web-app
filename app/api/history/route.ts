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
 * Classify a log entry:
 * - taken + diff ≤ 30 min → "taken" (on-time)
 * - taken + diff > 30 min → "delayed"
 * - not taken + elapsed > 120 min → "missed"
 * - otherwise → "pending"
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

  if (rawStatus === 'taken') {
    if (takenAt) {
      const taken = new Date(takenAt);
      const diffMinutes = Math.round(
        (taken.getTime() - scheduledDateTime.getTime()) / 60_000,
      );
      if (diffMinutes <= 30) {
        return { status: 'taken', delayMinutes: null };
      }
      return { status: 'delayed', delayMinutes: diffMinutes };
    }
    return { status: 'taken', delayMinutes: null };
  }

  const elapsedMinutes = (now.getTime() - scheduledDateTime.getTime()) / 60_000;
  if (elapsedMinutes > 120) {
    return { status: 'missed', delayMinutes: null };
  }

  return { status: 'pending', delayMinutes: null };
}

/**
 * Compute weighted adherence rate across all finalized logs:
 * ((1.0 × On-Time) + (0.5 × Delayed)) / Total Due Scheduled Doses × 100
 *
 * Only includes logs whose scheduled time has already passed.
 * This ensures consistency with the Dashboard adherence calculation.
 */
function computeWeightedAdherenceRate(logs: EnrichedLog[]): number {
  const now = new Date();
  let onTime = 0;
  let delayed = 0;
  let totalDue = 0;

  for (const log of logs) {
    const scheduledMinutes = parseTimeToMinutes(log.scheduledTime);
    const scheduledDateTime = new Date(`${log.scheduledDate}T00:00:00`);
    scheduledDateTime.setMinutes(scheduledDateTime.getMinutes() + scheduledMinutes);

    // Only count doses that are already due
    if (scheduledDateTime > now) continue;

    totalDue++;
    if (log.classifiedStatus === 'taken') onTime++;
    else if (log.classifiedStatus === 'delayed') delayed++;
  }

  if (totalDue === 0) return 0;
  return Math.round(Math.min((1.0 * onTime + 0.5 * delayed) / totalDue * 100, 100));
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

    // Classify every log
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

    // Pending stays on Dashboard — history shows only finalized records
    const finalized = enriched.filter((l) => l.classifiedStatus !== 'pending');

    // Section grouping
    const today     = finalized.filter((l) => l.scheduledDate === todayStr);
    const thisWeek  = finalized.filter((l) => l.scheduledDate >= weekAgoStr  && l.scheduledDate < todayStr);
    const thisMonth = finalized.filter((l) => l.scheduledDate >= monthAgoStr && l.scheduledDate < weekAgoStr);
    const earlier   = finalized.filter((l) => l.scheduledDate < monthAgoStr);

    // Summary counts
    const onTime         = finalized.filter((l) => l.classifiedStatus === 'taken').length;
    const totalDelayed   = finalized.filter((l) => l.classifiedStatus === 'delayed').length;
    const totalConfirmed = onTime + totalDelayed;
    const totalMissed    = finalized.filter((l) => l.classifiedStatus === 'missed').length;
    const totalRecords   = finalized.length;

    // ── Weighted success rate (uses ALL enriched logs including pending)
    // This matches the Dashboard "Overall Adherence" calculation exactly
    const successRate = computeWeightedAdherenceRate(enriched);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        summary: {
          totalTaken: totalConfirmed,
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