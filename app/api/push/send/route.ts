import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { sendWebPushToUser } from '@/lib/notificationChannels';
import type { ApiResponse } from '@/lib/interfaces/data/Api';

export async function POST(request: NextRequest) {
  if (request.headers.get('x-internal-key') !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    await connectDB();
    const body = (await request.json()) as {
      userId?: string;
      title?: string;
      body?: string;
      riskLevel?: string;
      type?: string;
      url?: string;
    };
    if (!body.userId || !body.title || !body.body) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'userId, title, and body are required.' },
        { status: 400 },
      );
    }

    const result = await sendWebPushToUser(body.userId, {
      title: body.title,
      body: body.body,
      type: body.type || 'adherence_alert',
      severity: body.riskLevel,
      url: body.url || '/',
    });
    return NextResponse.json<ApiResponse>({
      success: result.status !== 'FAILED',
      data: result,
      message: result.status === 'SENT'
        ? `Sent ${result.sentCount || 0} notification(s).`
        : result.error,
    });
  } catch (error) {
    console.error('[POST /api/push/send]', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}