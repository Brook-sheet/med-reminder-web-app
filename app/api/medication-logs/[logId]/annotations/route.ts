import mongoose from 'mongoose';

import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  getTokenFromRequest,
  verifyToken,
} from '@/lib/auth';

import {
  appendFamilyAcknowledgment,
  appendPatientAnnotation,
} from '@/lib/medicationAnnotations';

import {
  connectDB,
} from '@/lib/mongodb';

export const dynamic =
  'force-dynamic';

type AnnotationRequestBody = {
  type?: unknown;
  text?: unknown;
};

export async function POST(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      logId: string;
    }>;
  }
) {
  try {
    const token =
      getTokenFromRequest(
        request
      );

    const auth =
      token
        ? await verifyToken(
            token
          )
        : null;

    if (!auth) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            'Unauthorized',
        },
        {
          status:
            401,
        }
      );
    }

    const {
      logId,
    } =
      await params;

    if (
      !mongoose.isValidObjectId(
        logId
      )
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            'A valid medication log ID is required.',
        },
        {
          status:
            400,
        }
      );
    }

    let body:
      AnnotationRequestBody;

    try {
      body =
        (
          await request.json()
        ) as
          AnnotationRequestBody;
    } catch {
      return NextResponse.json(
        {
          success:
            false,

          error:
            'A valid JSON body is required.',
        },
        {
          status:
            400,
        }
      );
    }

    const type =
      typeof body.type ===
      'string'
        ? body.type
        : '';

    await connectDB();

    if (
      auth.role ===
      'patient'
    ) {
      if (
        type !==
          'patient_note' &&
        type !==
          'missed_explanation'
      ) {
        return NextResponse.json(
          {
            success:
              false,

            error:
              'Patients may add only a patient note or missed-dose explanation.',
          },
          {
            status:
              403,
          }
        );
      }

      const annotation =
        await appendPatientAnnotation(
          {
            patientId:
              auth.userId,

            logId,

            type,

            text:
              body.text,
          }
        );

      return NextResponse.json(
        {
          success:
            true,

          duplicate:
            false,

          data:
            annotation,

          message:
            type ===
            'missed_explanation'
              ? 'Missed-dose explanation added.'
              : 'Patient note added.',
        }
      );
    }

    if (
      type !==
      'family_acknowledgment'
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            'Family accounts may add only a family acknowledgment.',
        },
        {
          status:
            403,
        }
      );
    }

    const result =
      await appendFamilyAcknowledgment(
        {
          familyId:
            auth.userId,

          logId,

          text:
            body.text,
        }
      );

    return NextResponse.json({
      success:
        true,

      duplicate:
        result.duplicate,

      data:
        result.annotation,

      message:
        result.duplicate
          ? 'This medication record was already acknowledged.'
          : 'Medication record acknowledged.',
    });
  } catch (error) {
    const message =
      error instanceof
      Error
        ? error.message
        : 'Internal server error';

    const forbidden =
      /active monitoring access|own medication record|Patient account|Family account/i.test(
        message
      );

    const clientError =
      forbidden ||
      /valid|required|only|enter|500 characters|acknowledged/i.test(
        message
      );

    console.error(
      '[POST /api/medication-logs/[logId]/annotations]',
      error
    );

    return NextResponse.json(
      {
        success:
          false,

        error:
          message,
      },
      {
        status:
          forbidden
            ? 403
            : clientError
              ? 400
              : 500,
      }
    );
  }
}