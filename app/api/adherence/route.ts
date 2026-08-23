import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import MedicationLog from '@/models/MedicationLog';
import User from '@/models/User';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import type { ApiResponse } from '@/lib/interfaces/data/Api';
import { analyzeAdherence, type RawLog } from '@/lib/adherenceEngine';
import {
  analyzeAdaptiveIntervention,
  generateEscalationMessage,
  generateMotivationalMessage,
  type RawLogForBehavior,
} from '@/lib/adaptiveIntervention';
import {
  ensureMedicationLogsForRange,
  finalizeExpiredMedicationLogs,
} from '@/lib/medicationVerification';

async function getAuthUser(request: NextRequest) {
  const token = getTokenFromRequest(request);
  return token ? verifyToken(token) : null;
}

function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }

    await connectDB();
    const now = new Date();
    const fromDate = new Date(now);
    fromDate.setDate(fromDate.getDate() - 13);
    await ensureMedicationLogsForRange(
      auth.userId,
      localDateString(fromDate),
      localDateString(now),
    );
    await finalizeExpiredMedicationLogs(auth.userId, now);

    const user = await User.findById(auth.userId).select(
      'firstName lastName lastRiskLevel dataResetAt',
    );
    const query: Record<string, unknown> = { userId: auth.userId };
    if (user?.dataResetAt) query.createdAt = { $gt: user.dataResetAt };

    const logs = await MedicationLog.find(query)
      .sort({ scheduledDate: 1, scheduledTime: 1, createdAt: 1 })
      .lean();

    const rawLogs: RawLog[] = logs.map((log) => ({
      id: log._id.toString(),
      medicineId: log.medicineId?.toString() ?? null,
      medicineName: log.medicineName,
      status: String(log.status),
      scheduledDate: String(log.scheduledDate),
      scheduledTime: String(log.scheduledTime),
      takenAt: log.takenAt ?? null,
      lateAfterMinutes: log.lateAfterMinutes,
      windowAfterMinutes: log.windowAfterMinutes,
      expectedChamberId: log.expectedChamberId ?? null,
      detectedChamberId: log.detectedChamberId ?? null,
      countsTowardAdherence: log.countsTowardAdherence !== false,
    }));

    const analysis = analyzeAdherence(rawLogs, now);
    const { features } = analysis;
    const previousRiskLevel = user?.lastRiskLevel as 'Low' | 'Moderate' | 'High' | undefined;

    const behaviorLogs: RawLogForBehavior[] = rawLogs
      .filter((log) => log.countsTowardAdherence !== false)
      .map((log) => ({
        status: log.status,
        scheduledDate: log.scheduledDate,
        scheduledTime: log.scheduledTime,
        takenAt: log.takenAt ? new Date(log.takenAt) : null,
      }));

    // Adaptive reminders remain available, but the public risk result is the
    // explainable behavioral rule set above—not a simulated ML prediction.
    const adaptive = analyzeAdaptiveIntervention(
      behaviorLogs,
      features,
      analysis.finalRiskLevel,
      analysis.finalRiskLevel,
      features.hasSufficientData ? Math.min(95, 40 + features.totalDue * 5) : 0,
      previousRiskLevel,
    );

    if (
      features.hasSufficientData &&
      analysis.finalRiskLevel !== previousRiskLevel
    ) {
      await User.findByIdAndUpdate(auth.userId, {
        lastRiskLevel: analysis.finalRiskLevel,
      });
    }

    const patientName = user?.firstName
      ? `${user.firstName} ${user.lastName || ''}`.trim()
      : undefined;
    const motivationalMessage = features.hasSufficientData
      ? generateMotivationalMessage(
          analysis.finalRiskLevel,
          features.trend,
          features.adherenceRate,
        )
      : 'Medication behavior will appear after a dose is completed or its medication window ends.';
    const escalationMessage =
      features.hasSufficientData && adaptive.reminderConfig.escalationEnabled
        ? generateEscalationMessage(
            adaptive.reminderConfig.escalationPriority,
            features,
            patientName,
          )
        : null;

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        analysisType: 'rule_based_behavioral',
        hasSufficientData: features.hasSufficientData,
        riskLevel: analysis.finalRiskLevel,
        adherenceRate: features.adherenceRate,
        totalEligible: features.totalDue,
        totalScheduled: features.totalDue,
        totalTaken: features.totalTaken,
        totalMissed: features.missedDoses,
        totalPending: features.duePending,
        totalUpcoming: features.upcomingDoses,
        consecutiveMissed: features.consecutiveMissed,
        consecutiveVerified: features.consecutiveVerified,
        delayedDoses: features.delayedDoses,
        avgDelayMinutes: features.avgDelayMinutes,
        incorrectChamberEvents: features.incorrectChamberEvents,
        unverifiedEvents: features.unverifiedEvents,
        recentRate: features.recentAdherenceRate,
        previousRate: features.previousAdherenceRate,
        weeklyTrend: features.trend,
        trendAvailable: features.trendAvailable,
        riskReasons: analysis.riskReasons,
        insight: analysis.insight,
        recommendation: analysis.recommendation,
        behavioral: analysis.behavioral,
        adaptiveIntervention: {
          behavioralPattern: adaptive.behavioralPattern,
          reminderConfig: adaptive.reminderConfig,
          interventionSummary: adaptive.interventionSummary,
          isEscalation: features.hasSufficientData && adaptive.isEscalation,
          drivingRiskLevel: adaptive.drivingRiskLevel,
          interventionConfidence: adaptive.interventionConfidence,
          keySignals: adaptive.keySignals,
          interventionReason: adaptive.reminderConfig.interventionReason,
          clinicalActionSuggestion: adaptive.reminderConfig.clinicalActionSuggestion,
          motivationalMessage,
          escalationMessage,
        },
      },
    });
  } catch (error) {
    console.error('[GET /api/adherence]', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}