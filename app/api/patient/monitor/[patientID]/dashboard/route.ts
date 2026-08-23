import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import MonitoringRequest from '@/models/MonitoringRequest';
import MedicationLog from '@/models/MedicationLog';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import type { ApiResponse } from '@/lib/interfaces/data/Api';
import { analyzeAdherence } from '@/lib/adherenceEngine';
import {
  ensureMedicationLogsForRange,
  finalizeExpiredMedicationLogs,
  scheduledDateTime,
} from '@/lib/medicationVerification';

async function getAuthUser(request: NextRequest) {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ patientID: string }> }
) {
  try {
    const auth = await getAuthUser(request);

    if (!auth) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectDB();

    const currentUser = await User.findById(auth.userId).select(
      'role monitoredPatients isDeleted'
    );

    if (!currentUser) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    if (
      currentUser.isDeleted ||
      currentUser.role !== 'family'
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            'Only Family accounts can view Patient monitoring data.',
        },
        { status: 403 }
      );
    }

    const { patientID } = await params;
    const normalizedId = patientID?.trim().toUpperCase();

    if (!normalizedId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Patient ID is required' },
        { status: 400 }
      );
    }

    const patient = await User.findOne({
      patientId: normalizedId,
      role: 'patient',
      isDeleted: { $ne: true },
    }).select(
      'firstName lastName condition patientId createdAt'
    );

    if (!patient) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Patient not found' },
        { status: 404 }
      );
    }

    const relationship = await MonitoringRequest.findOne({
      patientId: patient._id,
      familyId: currentUser._id,
    });

    if (
      relationship &&
      relationship.status !== 'approved'
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error:
            'Access denied. Monitoring approval is not active.',
        },
        { status: 403 }
      );
    }

    if (!relationship) {
      // Compatibility backfill for relationships created by the
      // previous monitoredPatients array implementation.
      const monitoredNormalized =
        currentUser.monitoredPatients.map((id: string) =>
          id.trim().toUpperCase()
        );

      if (!monitoredNormalized.includes(normalizedId)) {
        return NextResponse.json<ApiResponse>(
          {
            success: false,
            error:
              'Access denied. You are not authorized to monitor this Patient.',
          },
          { status: 403 }
        );
      }

      await MonitoringRequest.findOneAndUpdate(
        {
          patientId: patient._id,
          familyId: currentUser._id,
        },
        {
          $setOnInsert: {
            status: 'approved',
            respondedAt: new Date(),
          },
        },
        {
          upsert: true,
          runValidators: true,
        }
      );
    }

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const range = request.nextUrl.searchParams.get('range') || 'week';
    const fromDate = new Date(now);
    if (range === 'today') fromDate.setDate(fromDate.getDate());
    else if (range === 'month') fromDate.setDate(fromDate.getDate() - 29);
    else fromDate.setDate(fromDate.getDate() - 6);
    const from = range === 'today' ? today : fromDate.toISOString().split('T')[0];

    await ensureMedicationLogsForRange(patient._id.toString(), from, today);
    await finalizeExpiredMedicationLogs(patient._id.toString());

    const logs = await MedicationLog.find({
      userId: patient._id,
      scheduledDate: { $gte: from, $lte: today },
    })
      .sort({
        scheduledDate: -1,
        scheduledTime: -1,
      })
      .lean();

    const adherenceLogs = logs.filter((log) => log.countsTowardAdherence !== false);
    const rawLogs = adherenceLogs.map((log) => ({
      status: String(log.status),
      scheduledDate: String(log.scheduledDate),
      scheduledTime: String(log.scheduledTime),
      takenAt: log.takenAt ?? null,
      countsTowardAdherence: true,
    }));

    const analysis = analyzeAdherence(rawLogs);

    const recentLogs = logs.slice(0, 30).map((log) => ({
      medicineName: log.medicineName,
      scheduledDate: log.scheduledDate,
      scheduledTime: log.scheduledTime,
      status: log.status,
      takenAt: log.takenAt,
      dosage: log.dosage,
      source: log.source === 'auto' ? 'system' : log.source,
      expectedChamberId: log.expectedChamberId ?? null,
      detectedChamberId: log.detectedChamberId ?? null,
      expectedChamberIds: log.expectedChamberIds ?? [],
      verificationNote: log.verificationNote ?? '',
    }));

    const dueLogs = adherenceLogs.filter((log) =>
      scheduledDateTime(log.scheduledDate, log.scheduledTime) <= now
    );
    const todayLogs = adherenceLogs.filter((log) => log.scheduledDate === today);
    const todayDue = todayLogs.filter((log) =>
      scheduledDateTime(log.scheduledDate, log.scheduledTime) <= now
    );
    const verifiedStatuses = ['taken', 'late'];
    const reportSummary = {
      range,
      from,
      to: today,
      scheduled: dueLogs.length,
      verified: dueLogs.filter((log) => verifiedStatuses.includes(log.status)).length,
      missed: dueLogs.filter((log) => log.status === 'missed').length,
      late: dueLogs.filter((log) => log.status === 'late').length,
      incorrectChamber: logs.filter((log) => log.status === 'incorrect_chamber').length,
      unverified: logs.filter((log) => log.status === 'unverified').length,
      today: {
        scheduled: todayDue.length,
        verified: todayDue.filter((log) => verifiedStatuses.includes(log.status)).length,
        missed: todayDue.filter((log) => log.status === 'missed').length,
        late: todayDue.filter((log) => log.status === 'late').length,
        incorrectChamber: logs.filter(
          (log) => log.scheduledDate === today && log.status === 'incorrect_chamber'
        ).length,
      },
    };

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        patient: {
          patientId: patient.patientId,
          name: `${patient.firstName} ${patient.lastName}`,
          condition: patient.condition,
          memberSince: patient.createdAt,
        },
        adherence: {
          riskLevel: analysis.finalRiskLevel,
          ruleBasedRisk: analysis.ruleBased.riskLevel,
          mlRisk: analysis.mlPrediction.riskLevel,
          mlConfidence: Math.round(
            analysis.mlPrediction.confidence * 100
          ),
          adherenceRate: analysis.features.adherenceRate,
          totalScheduled: adherenceLogs.length,
          totalTaken: adherenceLogs.filter(
            (log) => verifiedStatuses.includes(log.status)
          ).length,
          totalMissed: analysis.features.missedDoses,
          consecutiveMissed:
            analysis.features.consecutiveMissed,
          delayedDoses: analysis.features.delayedDoses,
          avgDelayMinutes:
            analysis.features.avgDelayMinutes,
          recentRate:
            analysis.features.recentAdherenceRate,
          weeklyTrend: analysis.features.trend,
          insight: analysis.insight,
          recommendation: analysis.recommendation,
        },
        recentLogs,
        reportSummary,
        readOnly: true,
      },
    });
  } catch (error) {
    console.error(
      '[GET /api/patient/monitor/[patientID]/dashboard]',
      error
    );

    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}