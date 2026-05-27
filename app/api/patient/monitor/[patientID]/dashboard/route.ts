import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
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
  { params }: { params: { patientId: string } }
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

    // Verify current user is authorized to monitor this patient
    const currentUser = await User.findById(auth.userId).select('monitoredPatients');
    if (!currentUser) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const { patientId } = params;

    if (!currentUser.monitoredPatients.includes(patientId)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Access denied. You are not authorized to monitor this patient.' },
        { status: 403 }
      );
    }

    // Fetch patient data
    const patient = await User.findOne({ patientId }).select(
      'firstName lastName condition patientId createdAt'
    );
    if (!patient) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Patient not found' },
        { status: 404 }
      );
    }

    // Fetch medication logs
    const logs = await MedicationLog.find({ userId: patient._id })
      .sort({ scheduledDate: -1, scheduledTime: -1 })
      .lean();

    // Adherence analysis
    const rawLogs = logs.map((l) => ({
      status: String(l.status),
      scheduledDate: String(l.scheduledDate),
      scheduledTime: String(l.scheduledTime),
      takenAt: l.takenAt ?? null,
    }));

    const analysis = analyzeAdherence(rawLogs);

    // Recent logs (last 30)
    const recentLogs = logs.slice(0, 30).map((l) => ({
      medicineName: l.medicineName,
      scheduledDate: l.scheduledDate,
      scheduledTime: l.scheduledTime,
      status: l.status,
      takenAt: l.takenAt,
      dosage: l.dosage,
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
          mlConfidence: Math.round(analysis.mlPrediction.confidence * 100),
          adherenceRate: analysis.features.adherenceRate,
          totalScheduled: logs.length,
          totalTaken: logs.filter((l) => l.status === 'taken').length,
          totalMissed: analysis.features.missedDoses,
          consecutiveMissed: analysis.features.consecutiveMissed,
          delayedDoses: analysis.features.delayedDoses,
          avgDelayMinutes: analysis.features.avgDelayMinutes,
          recentRate: analysis.features.recentAdherenceRate,
          weeklyTrend: analysis.features.trend,
          insight: analysis.insight,
          recommendation: analysis.recommendation,
        },
        recentLogs,
        readOnly: true,
      },
    });
  } catch (error) {
    console.error('[GET /api/patient/monitor/[patientId]/dashboard]', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}