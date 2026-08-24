import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Alert from '@/models/Alert';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import { serializeAlert } from '@/lib/alertSerializer';
import type { ApiResponse } from '@/lib/interfaces/data/Api';
import { getApprovedPatientIdsForMonitor } from '@/lib/monitoringAuthorization';

async function authorizeFamily(request: NextRequest) {
  const token = getTokenFromRequest(request);
  const auth = token ? await verifyToken(token) : null;
  return auth?.role === 'family' ? auth : null;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authorizeFamily(request);
    if (!auth) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Only authorized Family accounts can access alerts.' },
        { status: 403 },
      );
    }

    await connectDB();
    const patientIds = await getApprovedPatientIdsForMonitor(auth.userId);
    const rawLimit = Number(request.nextUrl.searchParams.get('limit') || 50);
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 50, 1), 100);
    const status = request.nextUrl.searchParams.get('status');
    const query: Record<string, unknown> = {
      monitorId: auth.userId,
      patientId: { $in: patientIds },
    };
    if (status && ['UNREAD', 'READ', 'ACKNOWLEDGED'].includes(status)) {
      query.status = status;
    }

    const alerts = await Alert.find(query)
      .populate('patientId', 'firstName lastName patientId')
      .populate('medicationId', 'name dosage')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    const unreadCount = await Alert.countDocuments({
      monitorId: auth.userId,
      patientId: { $in: patientIds },
      isRead: false,
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        alerts: alerts.map(serializeAlert),
        unreadCount,
      },
    });
  } catch (error) {
    console.error('[GET /api/alerts]', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await authorizeFamily(request);
    if (!auth) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Only authorized Family accounts can update alerts.' },
        { status: 403 },
      );
    }

    const body = (await request.json()) as { action?: string };
    if (body.action !== 'markAllRead') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'action must be markAllRead.' },
        { status: 400 },
      );
    }

    await connectDB();
    const patientIds = await getApprovedPatientIdsForMonitor(auth.userId);
    const now = new Date();
    await Alert.updateMany(
      { monitorId: auth.userId, patientId: { $in: patientIds }, isRead: false },
      { $set: { status: 'READ', isRead: true, readAt: now } },
    );
    return NextResponse.json<ApiResponse>({
      success: true,
      message: 'All alerts marked as read.',
    });
  } catch (error) {
    console.error('[PATCH /api/alerts]', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}