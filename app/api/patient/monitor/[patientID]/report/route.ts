import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import type { ApiResponse } from '@/lib/interfaces/data/Api';
import {
  buildPatientMedicationReport,
  MedicationReportError,
  resolveMedicationReportRange,
} from '@/lib/patientMedicationReport';
import { authorizeMonitoredMedicationReport } from '@/lib/patientMedicationReportAuthorization';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ patientID: string }> },
) {
  try {
    await connectDB();

    const { patientID } = await params;

    const patientObjectId = await authorizeMonitoredMedicationReport(
      request,
      patientID,
    );

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
      '[Monitored medication report API]',
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