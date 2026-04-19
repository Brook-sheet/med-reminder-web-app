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

function computeStats(dailyRates: number[]) {
  if (dailyRates.length === 0) return { mean: 0, median: 0 };
  const mean = dailyRates.reduce((a, b) => a + b, 0) / dailyRates.length;
  const sorted = [...dailyRates].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
  return { mean: Math.round(mean * 100) / 100, median: Math.round(median * 100) / 100 };
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });

    await connectDB();

    // Build 7-day window
    const today = new Date();
    const days: { dateStr: string; taken: number; total: number; rate: number }[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const logs = await MedicationLog.find({ userId: user.userId, scheduledDate: dateStr });
      const taken = logs.filter(l => l.status === 'taken').length;
      const total = logs.length;
      const rate = total > 0 ? taken / total : 0;
      days.push({ dateStr, taken, total, rate });
    }

    const rates = days.map(d => d.rate);
    const { mean, median } = computeStats(rates);

    // Missed dose frequency (days with 0% adherence)
    const missedDays = days.filter(d => d.total > 0 && d.rate === 0).length;
    const partialDays = days.filter(d => d.rate > 0 && d.rate < 1).length;
    const perfectDays = days.filter(d => d.total > 0 && d.rate === 1).length;

    // Time-of-access variance (variance in when doses are taken vs scheduled)
    const weeklyTrend = rates.length >= 2
      ? rates[rates.length - 1] - rates[0]
      : 0;

    // --- Rule-based classification ---
    let riskLevel: 'Low' | 'Moderate' | 'High' = 'Low';
    if (missedDays >= 3 || mean < 0.4 || median < 0.4) {
      riskLevel = 'High';
    } else if (missedDays >= 1 || mean < 0.7 || median < 0.7 || partialDays >= 3) {
      riskLevel = 'Moderate';
    }

    // --- Claude AI enhancement ---
    let aiInsight = '';
    let aiRiskLevel = riskLevel;

    try {
      const prompt = `You are an AI adherence analyst for a medication reminder system.

Here is a patient's 7-day medication adherence data:
${days.map(d => `- ${d.dateStr}: ${d.taken}/${d.total} doses taken (${Math.round(d.rate * 100)}%)`).join('\n')}

Statistics:
- Mean adherence rate: ${Math.round(mean * 100)}%
- Median adherence rate: ${Math.round(median * 100)}%
- Days with zero adherence: ${missedDays}
- Days with partial adherence: ${partialDays}
- Days with perfect adherence: ${perfectDays}
- Weekly trend direction: ${weeklyTrend >= 0.1 ? 'improving' : weeklyTrend <= -0.1 ? 'declining' : 'stable'}
- Rule-based classification: ${riskLevel} Risk

Your task:
1. Confirm or adjust the risk classification to one of: Low Risk, Moderate Risk, High Risk
2. Provide a 1-2 sentence clinical insight about the pattern
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
        const text = data.content?.[0]?.text || '';
        const clean = text.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(clean);
        aiInsight = parsed.insight || '';
        const rec = parsed.recommendation || '';
        aiInsight = aiInsight + (rec ? ` ${rec}` : '');
        const lvl = parsed.riskLevel || '';
        if (lvl.includes('High')) aiRiskLevel = 'High';
        else if (lvl.includes('Moderate')) aiRiskLevel = 'Moderate';
        else if (lvl.includes('Low')) aiRiskLevel = 'Low';
      }
    } catch (aiError) {
      console.warn('[AI adherence] Claude call failed, using rule-based:', aiError);
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        riskLevel: aiRiskLevel,
        meanAdherence: Math.round(mean * 100),
        medianAdherence: Math.round(median * 100),
        weeklyData: days,
        missedDays,
        partialDays,
        perfectDays,
        weeklyTrend: weeklyTrend >= 0.1 ? 'improving' : weeklyTrend <= -0.1 ? 'declining' : 'stable',
        aiInsight,
      },
    });
  } catch (error) {
    console.error('[GET /api/adherence]', error);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
