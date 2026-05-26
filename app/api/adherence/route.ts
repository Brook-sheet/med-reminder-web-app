import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import MedicationLog from '@/models/MedicationLog';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import type { ApiResponse } from '@/lib/interfaces/data/Api';
import { analyzeAdherence, type RawLog } from '@/lib/adherenceEngine';

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

    const allLogs = await MedicationLog.find({ userId: user.userId }).lean();

    const rawLogs: RawLog[] = allLogs.map((l) => ({
      status: String(l.status),
      scheduledDate: String(l.scheduledDate),
      scheduledTime: String(l.scheduledTime),
      takenAt: l.takenAt ?? null,
    }));

    // Run full adherence analysis (rule-based + Random Forest)
    const analysis = analyzeAdherence(rawLogs);

    const { features, ruleBased, mlPrediction, finalRiskLevel, insight, recommendation } = analysis;

    // Counts for UI display
    const totalScheduled = allLogs.length;
    const totalTaken = allLogs.filter((l) => l.status === 'taken').length;
    const totalMissed = features.missedDoses;
    const totalPending = allLogs.filter((l) => l.status === 'pending').length;

    // Optionally enhance insight with Claude AI (if available)
    let aiInsight = `${insight} ${recommendation}`;

    try {
      const prompt = `You are an AI adherence analyst for a medication reminder system.

Patient adherence data (computed using weighted scoring where on-time=1.0, delayed=0.5):
- Weighted adherence rate: ${features.adherenceRate}% (excludes future doses)
- Total due doses evaluated: ${features.totalDue}
- Missed doses: ${features.missedDoses}
- Delayed doses: ${features.delayedDoses} (avg delay: ${features.avgDelayMinutes} min)
- Consecutive missed: ${features.consecutiveMissed}
- Recent 7-day adherence: ${features.recentAdherenceRate}%
- Trend: ${features.trend}

Rule-based classification: ${ruleBased.riskLevel} Risk
Reasons: ${ruleBased.reasons.join('; ')}

ML (Random Forest) prediction: ${mlPrediction.riskLevel} Risk (confidence: ${Math.round(mlPrediction.confidence * 100)}%)

Final classification: ${finalRiskLevel} Risk

Provide a concise 2-sentence clinical insight and 1 actionable recommendation.
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
      // aiInsight already set above as fallback
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
        totalPending,

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

        // Combined AI insight
        aiInsight,
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