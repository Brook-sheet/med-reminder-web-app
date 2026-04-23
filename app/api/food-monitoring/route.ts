// app/api/food-monitoring/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import FoodLog from '@/models/FoodLog';
import User from '@/models/User';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import { calculateFoodRisk, isFoodMonitoringApplicable } from '@/lib/foodMonitoring';
import type { ApiResponse } from '@/lib/interfaces/data/Api';
import type { FoodLogEntry } from '@/lib/foodMonitoring';

async function getAuthUser(request: NextRequest) {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyToken(token);
}

// GET /api/food-monitoring - get current risk classification
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    await connectDB();

    const userDoc = await User.findById(user.userId).select('condition');
    const condition = userDoc?.condition || 'None';

    if (!isFoodMonitoringApplicable(condition)) {
      return NextResponse.json<ApiResponse>({
        success: true,
        data: { applicable: false, condition },
      });
    }

    // Get logs from the past 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const logs = await FoodLog.find({
      userId: user.userId,
      timestamp: { $gte: thirtyDaysAgo },
    }).sort({ timestamp: -1 });

    const entries: FoodLogEntry[] = logs.map(l => ({
      questionId: l.questionId,
      answer: l.answer,
      score: l.score,
      timestamp: l.timestamp,
    }));

    const result = calculateFoodRisk(entries, condition);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { applicable: true, condition, ...result, totalEntries: entries.length },
    });
  } catch (error) {
    console.error('[GET /api/food-monitoring]', error);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/food-monitoring - submit food intake responses
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    await connectDB();

    const userDoc = await User.findById(user.userId).select('condition');
    const condition = userDoc?.condition || 'None';

    if (!isFoodMonitoringApplicable(condition)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Food monitoring is not applicable for your condition',
      }, { status: 400 });
    }

    const body = await request.json();
    const { responses, medicationLogId } = body as {
      responses: { questionId: string; answer: string; score: number }[];
      medicationLogId?: string;
    };

    if (!responses || responses.length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'responses are required' }, { status: 400 });
    }

    // Validate scores are 0-3
    for (const r of responses) {
      if (r.score < 0 || r.score > 3) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid score. Must be 0-3.' }, { status: 400 });
      }
    }

    const now = new Date();
    const logDocs = responses.map(r => ({
      userId: user.userId,
      medicationLogId: medicationLogId || null,
      questionId: r.questionId,
      answer: r.answer,
      score: r.score,
      timestamp: now,
    }));

    await FoodLog.insertMany(logDocs);

    // Recalculate risk with all available data
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const allLogs = await FoodLog.find({
      userId: user.userId,
      timestamp: { $gte: thirtyDaysAgo },
    }).sort({ timestamp: -1 });

    const entries: FoodLogEntry[] = allLogs.map(l => ({
      questionId: l.questionId,
      answer: l.answer,
      score: l.score,
      timestamp: l.timestamp,
    }));

    const result = calculateFoodRisk(entries, condition);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { ...result, totalEntries: entries.length },
      message: 'Food intake recorded successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/food-monitoring]', error);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}