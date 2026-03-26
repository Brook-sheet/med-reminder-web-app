// app/api/history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import MedicationLog from '@/models/MedicationLog';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import type { ApiResponse } from '@/types';

async function getAuthUser(request: NextRequest) {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyToken(token);
}

// ── GET /api/history ──────────────────────────────────────────────────────────
// Query params: ?period=today|lastWeek|thisMonth (default: all)
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period');

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Calculate date ranges
    const lastWeekStart = new Date(today);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekStartStr = lastWeekStart.toISOString().split('T')[0];

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthStartStr = monthStart.toISOString().split('T')[0];

    // ── Query per section ──────────────────────────────────────────────────────
    const [todayLogs, lastWeekLogs, thisMonthLogs] = await Promise.all([
      MedicationLog.find({ userId: user.userId, scheduledDate: todayStr }).sort({ scheduledTime: 1 }),
      MedicationLog.find({
        userId: user.userId,
        scheduledDate: { $gte: lastWeekStartStr, $lt: todayStr },
      }).sort({ scheduledDate: -1, scheduledTime: 1 }),
      MedicationLog.find({
        userId: user.userId,
        scheduledDate: { $gte: monthStartStr, $lt: lastWeekStartStr },
      }).sort({ scheduledDate: -1, scheduledTime: 1 }),
    ]);

    // ── Summary stats ──────────────────────────────────────────────────────────
    const allMonthLogs = await MedicationLog.find({
      userId: user.userId,
      scheduledDate: { $gte: monthStartStr, $lte: todayStr },
    });

    const totalTaken = allMonthLogs.filter((l) => l.status === 'taken').length;
    const totalMissed = allMonthLogs.filter((l) => l.status === 'missed').length;
    const total = allMonthLogs.length;
    const successRate = total > 0 ? Math.round((totalTaken / total) * 100) : 0;

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        summary: { totalTaken, totalMissed, successRate },
        today: todayLogs,
        lastWeek: lastWeekLogs,
        thisMonth: thisMonthLogs,
      },
    });
  } catch (error) {
    console.error('[GET /api/history]', error);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ── PATCH /api/history — mark a log as taken/missed manually ─────────────────
export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const body = await request.json();
    const { logId, status } = body;

    if (!logId || !status) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'logId and status are required' }, { status: 400 });
    }

    if (!['taken', 'missed', 'pending'].includes(status)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid status' }, { status: 400 });
    }

    const log = await MedicationLog.findOneAndUpdate(
      { _id: logId, userId: user.userId },
      {
        status,
        takenAt: status === 'taken' ? new Date() : null,
        source: 'manual',
      },
      { new: true }
    );

    if (!log) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Log not found' }, { status: 404 });
    }

    return NextResponse.json<ApiResponse>({ success: true, data: log, message: `Marked as ${status}` });
  } catch (error) {
    console.error('[PATCH /api/history]', error);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
