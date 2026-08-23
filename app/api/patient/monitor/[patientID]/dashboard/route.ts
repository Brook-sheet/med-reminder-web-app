import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import MonitoringRequest from '@/models/MonitoringRequest';
import MedicationLog from '@/models/MedicationLog';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import type { ApiResponse } from '@/lib/interfaces/data/Api';
import { analyzeAdherence } from '@/lib/adherenceEngine';

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

    const logs = await MedicationLog.find({
      userId: patient._id,
    })
      .sort({
        scheduledDate: -1,
        scheduledTime: -1,
      })
      .lean();

    const rawLogs = logs.map((log) => ({
      status: String(log.status),
      scheduledDate: String(log.scheduledDate),
      scheduledTime: String(log.scheduledTime),
      takenAt: log.takenAt ?? null,
    }));

    const analysis = analyzeAdherence(rawLogs);

    const recentLogs = logs.slice(0, 30).map((log) => ({
      medicineName: log.medicineName,
      scheduledDate: log.scheduledDate,
      scheduledTime: log.scheduledTime,
      status: log.status,
      takenAt: log.takenAt,
      dosage: log.dosage,
    }));

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
          totalScheduled: logs.length,
          totalTaken: logs.filter(
            (log) => log.status === 'taken'
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