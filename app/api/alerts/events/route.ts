import { NextRequest, NextResponse } from 'next/server';
import { processMedicationAlertEvent } from '@/lib/alertEngine';
import type { AlertEventType } from '@/models/Alert';
import type { ApiResponse } from '@/lib/interfaces/data/Api';

const PHASE_FIVE_EVENTS: AlertEventType[] = [
  'MEDICATION_LATE',
  'MEDICATION_MISSED',
  'MEDICATION_VERIFIED',
  'MEDICATION_EVENT_WARNING',
  'CRITICAL_MEDICATION_EVENT',
];

function internallyAuthorized(request: NextRequest): boolean {
  const configuredKey = process.env.INTERNAL_API_KEY;
  const providedKey = request.headers.get('x-internal-key');
  return process.env.NODE_ENV !== 'production' || Boolean(configuredKey && providedKey === configuredKey);
}

export async function POST(request: NextRequest) {
  try {
    if (!internallyAuthorized(request)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Unauthorized internal alert event.' },
        { status: 401 },
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const eventType = String(body.eventType || '') as AlertEventType;
    if (!PHASE_FIVE_EVENTS.includes(eventType)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `eventType must be one of: ${PHASE_FIVE_EVENTS.join(', ')}.` },
        { status: 400 },
      );
    }
    if (typeof body.eventId !== 'string' || typeof body.patientId !== 'string') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'eventId and patientId are required.' },
        { status: 400 },
      );
    }

    const occurredAt = typeof body.occurredAt === 'string'
      ? new Date(body.occurredAt)
      : new Date();
    if (Number.isNaN(occurredAt.getTime())) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'occurredAt must be a valid ISO date.' },
        { status: 400 },
      );
    }

    const result = await processMedicationAlertEvent({
      eventKey: body.eventId,
      patientId: body.patientId,
      medicationId: typeof body.medicationId === 'string' ? body.medicationId : null,
      medicationLogId: typeof body.medicationLogId === 'string' ? body.medicationLogId : null,
      medicineName: typeof body.medicineName === 'string' ? body.medicineName : undefined,
      scheduledTime: typeof body.scheduledTime === 'string' ? body.scheduledTime : undefined,
      occurredAt,
      eventType,
      title: typeof body.title === 'string' ? body.title : undefined,
      message: typeof body.message === 'string' ? body.message : undefined,
      metadata: typeof body.metadata === 'object' && body.metadata !== null
        ? body.metadata as Record<string, unknown>
        : {},
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: result,
      message: result.skipped
        ? result.reason
        : `${result.created} alert(s) created; ${result.duplicates} duplicate(s) ignored.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[POST /api/alerts/events]', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: /required|valid|not found/i.test(message) ? 400 : 500 },
    );
  }
}