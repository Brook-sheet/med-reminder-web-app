// app/api/adherence/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import MedicationLog from '@/models/MedicationLog';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import User from '@/models/User';
import type { ApiResponse } from '@/lib/interfaces/data/Api';
import { analyzeAdherence, type RawLog } from '@/lib/adherenceEngine';
import {
  analyzeAdaptiveIntervention,
  generateMotivationalMessage,
  generateEscalationMessage,
  type RawLogForBehavior,
} from '@/lib/adaptiveIntervention';

async function getAuthUser(request: NextRequest) {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectDB();

    const userDoc = await User.findById(user.userId).select(
      'firstName lastName condition lastRiskLevel'
    );
    const patientName = userDoc?.firstName
      ? `${userDoc.firstName} ${userDoc.lastName || ''}`.trim()
      : undefined;

    // Previous risk level for escalation detection
    const previousRiskLevel = userDoc?.lastRiskLevel as
      | 'Low'
      | 'Moderate'
      | 'High'
      | undefined;

    const allLogs = await MedicationLog.find({
      userId: user.userId,
      countsTowardAdherence: { $ne: false },
    }).lean();

    const rawLogs: RawLog[] = allLogs.map((l) => ({
      status: String(l.status),
      scheduledDate: String(l.scheduledDate),
      scheduledTime: String(l.scheduledTime),
      takenAt: l.takenAt ?? null,
      countsTowardAdherence: l.countsTowardAdherence !== false,
    }));

    // Full adherence analysis (Rule-Based + Random Forest)
    const analysis = analyzeAdherence(rawLogs);
    const { features, ruleBased, mlPrediction, finalRiskLevel, insight, recommendation } =
      analysis;

    const totalScheduled = allLogs.length;
    const totalTaken = allLogs.filter((l) => ['taken', 'late'].includes(l.status)).length;
    const totalMissed = features.missedDoses;

    // Adaptive Intervention Engine
    const behaviorLogs: RawLogForBehavior[] = allLogs.map((l) => ({
      status: String(l.status),
      scheduledDate: String(l.scheduledDate),
      scheduledTime: String(l.scheduledTime),
      takenAt: l.takenAt ?? null,
    }));

    const adaptiveResult = analyzeAdaptiveIntervention(
      behaviorLogs,
      features,
      finalRiskLevel,
      mlPrediction.riskLevel,
      mlPrediction.confidence * 100,
      previousRiskLevel
    );

    // Persist the new risk level so next call can detect escalation
    if (finalRiskLevel !== previousRiskLevel) {
      await User.findByIdAndUpdate(user.userId, {
        lastRiskLevel: finalRiskLevel,
      });
    }

    // Motivational message
    const motivationalMessage = generateMotivationalMessage(
      finalRiskLevel,
      features.trend,
      features.adherenceRate
    );

    // Escalation message
    const escalationMessage = adaptiveResult.reminderConfig.escalationEnabled
      ? generateEscalationMessage(
          adaptiveResult.reminderConfig.escalationPriority,
          features,
          patientName
        )
      : null;

    // AI insight via Claude
    let aiInsight = `${insight} ${recommendation}`;

    try {
      const prompt = `You are an AI adherence analyst for a medication reminder system for patients managing hypertension and/or diabetes.

Patient adherence data:
- Weighted adherence rate: ${features.adherenceRate}% (clinical benchmark: ≥80%)
- Total due doses evaluated: ${features.totalDue}
- Missed doses: ${features.missedDoses}
- Delayed doses: ${features.delayedDoses} (avg delay: ${features.avgDelayMinutes} min)
- Consecutive missed: ${features.consecutiveMissed}
- Recent 7-day adherence: ${features.recentAdherenceRate}%
- Trend: ${features.trend}
- Behavioral delay profile: ${adaptiveResult.behavioralPattern.delayProfile}
- Average intake delay: ${adaptiveResult.behavioralPattern.avgIntakeDelayMinutes} min
- Clustered misses: ${adaptiveResult.behavioralPattern.hasClusteredMisses}

Rule-based classification: ${ruleBased.riskLevel} Risk
ML (Random Forest) prediction: ${mlPrediction.riskLevel} Risk (confidence: ${Math.round(mlPrediction.confidence * 100)}%)
Final classification: ${finalRiskLevel} Risk

Adaptive Intervention Active:
- Reminder lead time: ${adaptiveResult.reminderConfig.leadTimeMinutes} min
- Behavioral bonus: +${adaptiveResult.reminderConfig.behavioralLeadTimeBonus} min
- Follow-ups: ${adaptiveResult.reminderConfig.followUpCount} × every ${adaptiveResult.reminderConfig.followUpIntervalMinutes} min
- Escalation: ${adaptiveResult.reminderConfig.escalationPriority}
- Intensity: ${adaptiveResult.reminderConfig.intensity}

Key signals: ${adaptiveResult.keySignals.join('; ') || 'None'}

Provide a concise 2-sentence clinical insight and 1 actionable recommendation suitable for a patient with hypertension or diabetes.
Respond ONLY as valid JSON: {"riskLevel":"Low Risk","insight":"...","recommendation":"..."}`;

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 300,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.content?.[0]?.text || '';
        const clean = text.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(clean);
        const rec = parsed.recommendation || '';
        aiInsight = (parsed.insight || insight) + (rec ? ` ${rec}` : '');
      }
    } catch (aiError) {
      console.warn('[AI adherence] Claude call failed, using rule+ML analysis:', aiError);
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        // Risk levels
        riskLevel: finalRiskLevel,
        ruleBasedRisk: ruleBased.riskLevel,
        mlRisk: mlPrediction.riskLevel,
        mlConfidence: Math.round(mlPrediction.confidence * 100),

        // Core metrics
        adherenceRate: features.adherenceRate,
        totalScheduled,
        totalTaken,
        totalMissed,
        totalPending: allLogs.filter((l) => l.status === 'pending').length,

        // Behavioral features
        consecutiveMissed: features.consecutiveMissed,
        delayedDoses: features.delayedDoses,
        avgDelayMinutes: features.avgDelayMinutes,

        // Trend
        recentRate: features.recentAdherenceRate,
        weeklyTrend: features.trend,

        // Rule-based explanation
        ruleReasons: ruleBased.reasons,

        // ML explanation
        mlPrediction: mlPrediction.prediction,
        featureImportance: mlPrediction.featureImportance,

        // AI insight
        aiInsight,

        // Adaptive Intervention Data
        adaptiveIntervention: {
          behavioralPattern: {
            avgIntakeDelayMinutes: adaptiveResult.behavioralPattern.avgIntakeDelayMinutes,
            delayProfile: adaptiveResult.behavioralPattern.delayProfile,
            hasClusteredMisses: adaptiveResult.behavioralPattern.hasClusteredMisses,
            delayTrend: adaptiveResult.behavioralPattern.delayTrend,
            currentMissStreak: adaptiveResult.behavioralPattern.currentMissStreak,
            maxHistoricalMissStreak: adaptiveResult.behavioralPattern.maxHistoricalMissStreak,
            peakMissHour: adaptiveResult.behavioralPattern.peakMissHour,
          },
          reminderConfig: {
            leadTimeMinutes: adaptiveResult.reminderConfig.leadTimeMinutes,
            followUpCount: adaptiveResult.reminderConfig.followUpCount,
            followUpIntervalMinutes: adaptiveResult.reminderConfig.followUpIntervalMinutes,
            intensity: adaptiveResult.reminderConfig.intensity,
            messageTone: adaptiveResult.reminderConfig.messageTone,
            highSensitivityMode: adaptiveResult.reminderConfig.highSensitivityMode,
            escalationEnabled: adaptiveResult.reminderConfig.escalationEnabled,
            escalationPriority: adaptiveResult.reminderConfig.escalationPriority,
            motivationalMessagingEnabled:
              adaptiveResult.reminderConfig.motivationalMessagingEnabled,
            behavioralLeadTimeBonus: adaptiveResult.reminderConfig.behavioralLeadTimeBonus,
          },
          interventionSummary: adaptiveResult.interventionSummary,
          isEscalation: adaptiveResult.isEscalation,
          drivingRiskLevel: adaptiveResult.drivingRiskLevel,
          interventionConfidence: adaptiveResult.interventionConfidence,
          keySignals: adaptiveResult.keySignals,
          interventionReason: adaptiveResult.reminderConfig.interventionReason,
          clinicalActionSuggestion: adaptiveResult.reminderConfig.clinicalActionSuggestion,
          motivationalMessage,
          escalationMessage,
        },
      },
    });
  } catch (error) {
    console.error('[GET /api/adherence]', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}