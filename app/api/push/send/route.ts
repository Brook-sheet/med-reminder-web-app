// app/api/push/send/route.ts
// Called internally by the adherence checker or sensor handler
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import PushSubscriptionModel from '@/models/PushSubscription';
import type { ApiResponse } from '@/lib/interfaces/data/Api';

// Simple VAPID-signed Web Push implementation using the web-push npm package
// Install: npm install web-push
// Generate VAPID keys: npx web-push generate-vapid-keys

export async function POST(request: NextRequest) {
  const internalKey = request.headers.get('x-internal-key');
  if (internalKey !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectDB();
    const { userId, title, body, riskLevel } = await request.json();

    const webpush = (await import('web-push')).default;
    webpush.setVapidDetails(
      `mailto:${process.env.VAPID_EMAIL || 'admin@medreminder.app'}`,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    );

    const subscriptions = await PushSubscriptionModel.find({ userId });
    const payload = JSON.stringify({ title, body, riskLevel, timestamp: Date.now() });

    const results = await Promise.allSettled(
      subscriptions.map(sub =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          payload
        )
      )
    );

    const sent = results.filter(r => r.status === 'fulfilled').length;
    return NextResponse.json<ApiResponse>({ success: true, message: `Sent ${sent} notifications` });
  } catch (error) {
    console.error('[POST /api/push/send]', error);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
