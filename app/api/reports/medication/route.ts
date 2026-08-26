import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import type { ApiResponse } from '@/lib/interfaces/data/Api';
import {
  buildPatientMedicationReport,
  MedicationReportError,
  resolveMedicationReportRange,
} from '@/lib/patientMedicationReport';
import { authorizeOwnMedicationReport } from '@/lib/patientMedicationReportAuthorization';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const patientObjectId = await authorizeOwnMedicationReport(request);
    const range = resolveMedicationReportRange(
      request.nextUrl.searchParams,
    );

    const report = await buildPatientMedicationReport({
      patientObjectId,
      from: range.from,
      to: range.to,
      numberOfDays: range.numberOfDays,
    });

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: report,
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          Pragma: 'no-cache',
        },
      },
    );
  } catch (error) {
    const known = error instanceof MedicationReportError;

    console.error(
      '[Medication report API]',
      known ? error.message : 'Report generation failed.',
    );

    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: known
          ? error.message
          : 'Unable to generate the medication report.',
      },
      {
        status: known ? error.status : 500,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      },
    );
  }
}