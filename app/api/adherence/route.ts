// app/api/adherence/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import MedicationLog from '@/models/MedicationLog';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import type { ApiResponse } from '@/lib/interfaces/data/Api';

async function getAuthUser(request: NextRequest) {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user)
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );

    await connectDB();

    // ── Fetch ALL logs for this user (no date window) ──────────────────────
    const allLogs = await MedicationLog.find({ userId: user.userId });

    const totalScheduled = allLogs.length;
    const totalTaken     = allLogs.filter(l => l.status === 'taken').length;
    const totalMissed    = allLogs.filter(l => l.status === 'missed').length;
    const totalPending   = allLogs.filter(l => l.status === 'pending').length;

    // ── Adherence rate: simple ratio ───────────────────────────────────────
    // Only count logs that have been resolved (taken or missed), not pending
    const resolvedLogs = totalTaken + totalMissed;
    const adherenceRate =
      resolvedLogs > 0
        ? Math.round((totalTaken / resolvedLogs) * 100)
        : 0;

    // ── Rule-based classification (Ratio-Based Threshold) ─────────────────
    let riskLevel: 'Low' | 'Moderate' | 'High' = 'Low';

    if (adherenceRate < 40) {
      riskLevel = 'High';
    } else if (adherenceRate < 70) {
      riskLevel = 'Moderate';
    }
    // else: adherenceRate >= 70 → Low (default)

    // ── Optional: recent trend (last 7 resolved logs vs earlier) ──────────
    // Used only as extra context for Claude AI — NOT part of the rule
    const resolvedSorted = allLogs
      .filter(l => l.status === 'taken' || l.status === 'missed')
      .sort((a, b) =>
        new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()
      );

    const recent = resolvedSorted.slice(-7);
    const recentTaken = recent.filter(l => l.status === 'taken').length;
    const recentRate  = recent.length > 0
      ? Math.round((recentTaken / recent.length) * 100)
      : adherenceRate;

    const trend =
      recentRate > adherenceRate + 5
        ? 'improving'
        : recentRate < adherenceRate - 5
        ? 'declining'
        : 'stable';

    // ── Claude AI enhancement ──────────────────────────────────────────────
    let aiInsight   = '';
    let aiRiskLevel = riskLevel;

    try {
      const prompt = `You are an AI adherence analyst for a medication reminder system.

Here is a patient's overall medication adherence data:
- Total doses scheduled: ${totalScheduled}
- Total doses taken: ${totalTaken}
- Total doses missed: ${totalMissed}
- Still pending (not yet due): ${totalPending}
- Overall adherence rate: ${adherenceRate}% (based on resolved doses only)
- Recent trend (last 7 resolved doses): ${recentRate}% (${trend})
- Rule-based classification: ${riskLevel} Risk

Note: This is NOT limited to 7 days. It covers the patient's entire medication history.

Your task:
1. Confirm or adjust the risk classification to one of: Low Risk, Moderate Risk, High Risk
2. Provide a 1-2 sentence insight about the overall pattern
3. Give one actionable recommendation

Respond ONLY as valid JSON with this exact structure (no markdown, no extra text):
{"riskLevel":"Low Risk","insight":"...","recommendation":"..."}`;

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
        const text  = data.content?.[0]?.text || '';
        const clean = text.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(clean);

        const rec = parsed.recommendation || '';
        aiInsight = (parsed.insight || '') + (rec ? ` ${rec}` : '');

        const lvl = parsed.riskLevel || '';
        if (lvl.includes('High'))     aiRiskLevel = 'High';
        else if (lvl.includes('Moderate')) aiRiskLevel = 'Moderate';
        else if (lvl.includes('Low'))  aiRiskLevel = 'Low';
      }
    } catch (aiError) {
      console.warn('[AI adherence] Claude call failed, using rule-based:', aiError);
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        riskLevel:      aiRiskLevel,
        adherenceRate,          // overall rate (all time)
        totalScheduled,
        totalTaken,
        totalMissed,
        totalPending,
        recentRate,             // last 7 resolved doses
        weeklyTrend: trend,
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
