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

type RouteContext = {
  params: Promise<{
    logId: string;
  }>;
};

function errorResponse(
  error: unknown,
) {
  const known =
    error instanceof
    MedicationLogAnnotationError;

  if (!known) {
    console.error(
      '[Medication log annotation API]',
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
  context: RouteContext,
) {
  try {
    const { logId } =
      await context.params;

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
  context: RouteContext,
) {
  try {
    const { logId } =
      await context.params;

    const body =
      (await request.json()) as {
        type?: string;
        annotationType?: string;
        noteType?: string;
        text?: string;
      };

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
  context: RouteContext,
) {
  return addAnnotation(
    request,
    context,
  );
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  return addAnnotation(
    request,
    context,
  );
}