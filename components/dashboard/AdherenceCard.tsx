// components/dashboard/AdherenceCard.tsx
'use client';
import React, { useEffect, useState, useCallback } from 'react';

interface AdherenceData {
  riskLevel: 'Low' | 'Moderate' | 'High';
  adherenceRate: number;
  totalScheduled: number;
  totalTaken: number;
  totalMissed: number;
  totalPending: number;
  recentRate: number;
  weeklyTrend: 'improving' | 'declining' | 'stable';
  aiInsight: string;
}

const riskColors = {
  Low:      'bg-green-50  border-green-200  text-green-800',
  Moderate: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  High:     'bg-red-50    border-red-200    text-red-800',
};

const riskBadge = {
  Low:      'bg-green-100  text-green-800',
  Moderate: 'bg-yellow-100 text-yellow-800',
  High:     'bg-red-100    text-red-800',
};

export default function AdherenceCard() {
  const [data, setData]       = useState<AdherenceData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAdherence = useCallback(async () => {
    try {
      const res  = await fetch('/api/adherence');
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) {
      console.error('Adherence fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fix: trigger push AFTER state is set, via a separate effect ──────────
  useEffect(() => {
    fetchAdherence();
  }, [fetchAdherence]);

  useEffect(() => {
    if (!data) return;
    if (data.riskLevel === 'High' || data.riskLevel === 'Moderate') {
      sendRiskNotification(data.riskLevel, data.adherenceRate);
    }
  }, [data]);

  async function sendRiskNotification(risk: string, rate: number) {
    try {
      await fetch('/api/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-key': process.env.NEXT_PUBLIC_INTERNAL_API_KEY || '',
        },
        body: JSON.stringify({
          title: `Medication Adherence Alert — ${risk} Risk`,
          body:  `Current adherence rate is ${rate}%. Please check your medication schedule.`,
          riskLevel: risk,
        }),
      });
    } catch {}
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-4" />
        <div className="h-20 bg-gray-100 rounded" />
      </div>
    );
  }

  if (!data) return null;

  const trendIcon =
    data.weeklyTrend === 'improving' ? '↑' :
    data.weeklyTrend === 'declining' ? '↓' : '→';
  const trendColor =
    data.weeklyTrend === 'improving' ? 'text-green-600' :
    data.weeklyTrend === 'declining' ? 'text-red-600'   : 'text-gray-500';

  return (
    <div className={`rounded-lg border p-6 ${riskColors[data.riskLevel]}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">AI Adherence Analysis</h2>
        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${riskBadge[data.riskLevel]}`}>
          {data.riskLevel} Risk
        </span>
      </div>

      {/* ── Stats grid ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="bg-white/60 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500 mb-1">Overall rate</p>
          <p className="text-2xl font-bold text-gray-900">{data.adherenceRate}%</p>
        </div>
        <div className="bg-white/60 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500 mb-1">Taken / Scheduled</p>
          <p className="text-2xl font-bold text-gray-900">
            {data.totalTaken}/{data.totalScheduled}
          </p>
        </div>
        <div className="bg-white/60 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500 mb-1">Recent trend</p>
          <p className={`text-2xl font-bold ${trendColor}`}>{trendIcon}</p>
        </div>
        <div className="bg-white/60 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500 mb-1">Missed doses</p>
          <p className="text-2xl font-bold text-gray-900">{data.totalMissed}</p>
        </div>
      </div>

      {/* ── AI insight ────────────────────────────────────────────── */}
      {data.aiInsight && (
        <div className="bg-white/70 rounded-lg p-4 border border-white/50">
          <p className="text-sm font-medium text-gray-700 mb-1">AI Insight</p>
          <p className="text-sm text-gray-600">{data.aiInsight}</p>
        </div>
      )}
    </div>
  );
}
