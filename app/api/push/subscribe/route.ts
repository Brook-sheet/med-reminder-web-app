// app/api/push/subscribe/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import PushSubscription from '@/models/PushSubscription';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import type { ApiResponse } from '@/lib/interfaces/data/Api';

export async function POST(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request);
    if (!token) return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifyToken(token);
    if (!user) return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });

    await connectDB();
    const { endpoint, keys } = await request.json();
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid subscription data' }, { status: 400 });
    }

    await PushSubscription.findOneAndUpdate(
      { userId: user.userId, endpoint },
      { userId: user.userId, endpoint, keys },
      { upsert: true, new: true }
    );

    return NextResponse.json<ApiResponse>({ success: true, message: 'Subscription saved' });
  } catch (error) {
    console.error('[POST /api/push/subscribe]', error);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}