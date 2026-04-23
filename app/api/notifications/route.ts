// app/api/notifications/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Notification from '@/models/Notification';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import type { ApiResponse } from '@/lib/interfaces/data/Api';

async function getAuthUser(request: NextRequest) {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyToken(token);
}

// GET /api/notifications - fetch notification history
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    await connectDB();

    const notifications = await Notification.find({ userId: user.userId })
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await Notification.countDocuments({ userId: user.userId, read: false });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { notifications, unreadCount },
    });
  } catch (error) {
    console.error('[GET /api/notifications]', error);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/notifications - create a notification
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    await connectDB();

    const body = await request.json();
    const { type, title, message, medicineId, medicineName, riskLevel, adherenceRate } = body;

    if (!type || !title || !message) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'type, title, and message are required' }, { status: 400 });
    }

    const notification = await Notification.create({
      userId: user.userId,
      type,
      title,
      message,
      medicineId: medicineId || null,
      medicineName: medicineName || null,
      riskLevel: riskLevel || null,
      adherenceRate: adherenceRate ?? null,
    });

    return NextResponse.json<ApiResponse>({ success: true, data: notification }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/notifications]', error);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/notifications - mark as read / delete
export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    await connectDB();

    const body = await request.json();
    const { action, notificationId } = body;

    if (action === 'markAllRead') {
      await Notification.updateMany({ userId: user.userId }, { read: true });
      return NextResponse.json<ApiResponse>({ success: true, message: 'All notifications marked as read' });
    }

    if (action === 'delete' && notificationId) {
      await Notification.findOneAndDelete({ _id: notificationId, userId: user.userId });
      return NextResponse.json<ApiResponse>({ success: true, message: 'Notification deleted' });
    }

    if (action === 'deleteAll') {
      await Notification.deleteMany({ userId: user.userId });
      return NextResponse.json<ApiResponse>({ success: true, message: 'All notifications deleted' });
    }

    if (action === 'markRead' && notificationId) {
      await Notification.findOneAndUpdate(
        { _id: notificationId, userId: user.userId },
        { read: true }
      );
      return NextResponse.json<ApiResponse>({ success: true, message: 'Notification marked as read' });
    }

    return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[PATCH /api/notifications]', error);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}