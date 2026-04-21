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

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectDB();

    // Get dataResetAt so we can hide logs created before that point
    const userDoc = await User.findById(user.userId).select('dataResetAt');
    const dataResetAt = userDoc?.dataResetAt ?? null;

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const lastWeekStart = new Date(today);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekStartStr = lastWeekStart.toISOString().split('T')[0];

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthStartStr = monthStart.toISOString().split('T')[0];

    // Only show logs created after the last reset
    const baseQuery: Record<string, unknown> = { userId: user.userId };
    if (dataResetAt) {
      baseQuery.createdAt = { $gt: dataResetAt };
    }

    const [todayLogs, lastWeekLogs, thisMonthLogs] = await Promise.all([
      MedicationLog.find({ ...baseQuery, scheduledDate: todayStr }).sort({ scheduledTime: 1 }),
      MedicationLog.find({
        ...baseQuery,
        scheduledDate: { $gte: lastWeekStartStr, $lt: todayStr },
      }).sort({ scheduledDate: -1, scheduledTime: 1 }),
      MedicationLog.find({
        ...baseQuery,
        scheduledDate: { $gte: monthStartStr, $lt: lastWeekStartStr },
      }).sort({ scheduledDate: -1, scheduledTime: 1 }),
    ]);

    const allMonthLogs = await MedicationLog.find({
      ...baseQuery,
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
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectDB();
    const body = await request.json();
    const { logId, status } = body;

    if (!logId || !status) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'logId and status are required' },
        { status: 400 }
      );
    }

    if (!['taken', 'missed', 'pending'].includes(status)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid status' },
        { status: 400 }
      );
    }

    const log = await MedicationLog.findOneAndUpdate(
      { _id: logId, userId: user.userId },
      { status, takenAt: status === 'taken' ? new Date() : null, source: 'manual' },
      { new: true }
    );

    if (!log) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Log not found' },
        { status: 404 }
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
      { status: 500 }
    );
  }
}