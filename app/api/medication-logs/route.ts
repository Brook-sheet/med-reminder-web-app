import {
  NextRequest,
  NextResponse,
} from 'next/server';
import type { ApiResponse } from '@/lib/interfaces/data/Api';
import {
  appendMedicationLogAnnotation,
  MedicationLogAnnotationError,
  readMedicationLogAnnotations,
} from '@/lib/medicationLogAnnotations';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function errorResponse(
  error: unknown,
) {
  const known =
    error instanceof
    MedicationLogAnnotationError;

  if (!known) {
    console.error(
      '[Medication log annotations API]',
      error,
    );
  }

  return NextResponse.json<ApiResponse>(
    {
      success: false,
      error: known
        ? error.message
        : 'Unable to process the medication note.',
    },
    {
      status: known
        ? error.status
        : 500,
      headers: {
        'Cache-Control':
          'no-store, max-age=0',
      },
    },
  );
}

export async function GET(
  request: NextRequest,
) {
  try {
    const logId =
      request.nextUrl.searchParams
        .get('logId')
        ?.trim() ?? '';

    if (!logId) {
      throw new MedicationLogAnnotationError(
        'The logId query parameter is required.',
        400,
      );
    }

    const data =
      await readMedicationLogAnnotations(
        request,
        logId,
      );

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data,
      },
      {
        headers: {
          'Cache-Control':
            'no-store, max-age=0',
        },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

async function addAnnotation(
  request: NextRequest,
) {
  try {
    const body =
      (await request.json()) as {
        logId?: string;
        type?: string;
        annotationType?: string;
        noteType?: string;
        text?: string;
      };

    const logId = String(
      body.logId ?? '',
    ).trim();

    if (!logId) {
      throw new MedicationLogAnnotationError(
        'Medication log ID is required.',
        400,
      );
    }

    const data =
      await appendMedicationLogAnnotation(
        request,
        logId,
        body,
      );

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data,
      },
      {
        status: 201,
        headers: {
          'Cache-Control':
            'no-store, max-age=0',
        },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  request: NextRequest,
) {
  return addAnnotation(request);
}

export async function PATCH(
  request: NextRequest,
) {
  return addAnnotation(request);
}