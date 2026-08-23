/**
 * hooks/useAdherence.ts
 *
 * Shared hook for fetching and managing adherence data
 * Ensures all components use the same calculation logic and stay in sync
 *
 * Features:
 * - Automatic refetching when adherence may have changed
 * - Shared state to prevent multiple fetches
 * - Built-in error handling
 * - Real-time updates after medication status changes
 * - Listens for schedule changes to auto-refresh adherence
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

export interface AdaptiveReminderConfig {
  leadTimeMinutes: number;
  followUpCount: number;
  followUpIntervalMinutes: number;
  intensity: string;
  messageTone: string;
  highSensitivityMode: boolean;
  escalationEnabled: boolean;
  escalationPriority: string;
  motivationalMessagingEnabled: boolean;
  behavioralLeadTimeBonus: number;
}

export interface AdaptiveBehavioralPattern {
  avgIntakeDelayMinutes: number;
  delayProfile: string;
  hasClusteredMisses: boolean;
  delayTrend: string;
  currentMissStreak: number;
  maxHistoricalMissStreak: number;
  peakMissHour: number | null;
}

export interface AdaptiveIntervention {
  behavioralPattern: AdaptiveBehavioralPattern;
  reminderConfig: AdaptiveReminderConfig;
  interventionSummary: string;
  isEscalation: boolean;
  drivingRiskLevel: string;
  interventionConfidence: number;
  keySignals: string[];
  interventionReason: string;
  clinicalActionSuggestion: string;
  motivationalMessage: string;
  escalationMessage: string | null;
}

export interface BehavioralInsight {
  id: string;
  tone: 'positive' | 'warning' | 'critical' | 'neutral';
  title: string;
  detail: string;
}

export interface DailyAdherence {
  date: string;
  label: string;
  eligible: number;
  taken: number;
  adherenceRate: number | null;
}

export interface TimePattern {
  period: 'Morning' | 'Afternoon' | 'Evening';
  eligible: number;
  taken: number;
  missed: number;
  late: number;
  adherenceRate: number;
}

export interface MedicationPattern {
  medicineId: string | null;
  medicineName: string;
  eligible: number;
  taken: number;
  missed: number;
  late: number;
  incorrectChamber: number;
  adherenceRate: number;
}

export interface AdherenceData {
  analysisType: 'rule_based_behavioral';
  hasSufficientData: boolean;
  riskLevel: 'Low' | 'Moderate' | 'High';
  adherenceRate: number;
  totalEligible: number;
  totalScheduled: number;
  totalTaken: number;
  totalMissed: number;
  totalPending: number;
  totalUpcoming: number;
  consecutiveMissed: number;
  consecutiveVerified: number;
  delayedDoses: number;
  avgDelayMinutes: number;
  incorrectChamberEvents: number;
  unverifiedEvents: number;
  recentRate: number;
  previousRate: number;
  weeklyTrend: 'improving' | 'declining' | 'stable';
  trendAvailable: boolean;
  riskReasons: string[];
  insight: string;
  recommendation: string;
  behavioral: {
    timeOfDay: TimePattern[];
    byMedication: MedicationPattern[];
    dailyTrend: DailyAdherence[];
    insights: BehavioralInsight[];
  };
  adaptiveIntervention: AdaptiveIntervention;
}

interface UseAdherenceOptions {
  autoRefetch?: boolean; // Automatically refetch on intervals (default: true)
  refetchIntervalMs?: number; // Interval for auto-refetch (default: 60000 = 1 minute)
  initialLoad?: boolean; // Load on mount (default: true)
}

// Shared state for adherence data across all hook instances
let sharedAdherenceData: AdherenceData | null = null;
let sharedAdherenceError: string | null = null;
const sharedAdherenceLoading = false;
let sharedAdherenceFetching = false;
const adherenceSubscribers = new Set<(data: AdherenceData | null) => void>();

/**
 * Fetch adherence from the API
 * Internal function used by the hook
 */
async function fetchAdherenceData(): Promise<{
  data: AdherenceData | null;
  error: string | null;
}> {
  // Prevent concurrent requests
  if (sharedAdherenceFetching) {
    return { data: sharedAdherenceData, error: sharedAdherenceError };
  }

  sharedAdherenceFetching = true;

  try {
    const response = await fetch('/api/adherence');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();
    if (!json.success) {
      throw new Error(json.error || 'Failed to fetch adherence data');
    }

    sharedAdherenceData = json.data;
    sharedAdherenceError = null;

    // Notify all subscribers of the update
    adherenceSubscribers.forEach((cb) => cb(sharedAdherenceData));

    return { data: sharedAdherenceData, error: null };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    sharedAdherenceError = errorMsg;
    console.error('[useAdherence] Fetch error:', err);
    return { data: null, error: errorMsg };
  } finally {
    sharedAdherenceFetching = false;
  }
}

/**
 * Hook for fetching and managing adherence data
 * Ensures consistent adherence rates across the entire app
 *
 * Usage:
 * const { data, loading, error, refetch } = useAdherence();
 *
 * When medication status changes, call refetch() to get updated adherence
 * When medicine schedule changes, adherence will automatically refetch
 */
export function useAdherence(
  options: UseAdherenceOptions = {}
): {
  data: AdherenceData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const {
    autoRefetch = true,
    refetchIntervalMs = 60_000, // 1 minute
    initialLoad = true,
  } = options;

  const [localData, setLocalData] = useState<AdherenceData | null>(sharedAdherenceData);
  const [localLoading, setLocalLoading] = useState(sharedAdherenceLoading);
  const [localError, setLocalError] = useState<string | null>(sharedAdherenceError);
  const refetchIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const scheduleChangeListenerRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);

  // Subscribe to shared state changes
  useEffect(() => {
    const handleUpdate = (data: AdherenceData | null) => {
      if (mountedRef.current) {
        setLocalData(data);
      }
    };

    adherenceSubscribers.add(handleUpdate);

    return () => {
      adherenceSubscribers.delete(handleUpdate);
    };
  }, []);

  // Manual refetch function
  const refetch = useCallback(async () => {
    if (mountedRef.current) {
      setLocalLoading(true);
    }

    const { data, error } = await fetchAdherenceData();

    if (mountedRef.current) {
      setLocalData(data);
      setLocalError(error);
      setLocalLoading(false);
    }
  }, []);

  // Initial load on mount
  useEffect(() => {
    if (!initialLoad) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) refetch().catch(console.error);
    });
    return () => {
      cancelled = true;
    };
  }, [initialLoad, refetch]);

  // Listen for medicine schedule changes and refresh adherence
  useEffect(() => {
    scheduleChangeListenerRef.current = () => {
      console.log('[useAdherence] Medicine schedule changed, refetching adherence...');
      refetch().catch(console.error);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('medicineScheduleChanged', scheduleChangeListenerRef.current);
    }

    return () => {
      if (scheduleChangeListenerRef.current && typeof window !== 'undefined') {
        window.removeEventListener('medicineScheduleChanged', scheduleChangeListenerRef.current);
      }
    };
  }, [refetch]);

  // Set up auto-refetch interval
  useEffect(() => {
    if (!autoRefetch) return;

    // Start interval for periodic refetch
    refetchIntervalRef.current = setInterval(() => {
      refetch().catch(console.error);
    }, refetchIntervalMs);

    return () => {
      if (refetchIntervalRef.current) {
        clearInterval(refetchIntervalRef.current);
      }
    };
  }, [autoRefetch, refetchIntervalMs, refetch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (refetchIntervalRef.current) {
        clearInterval(refetchIntervalRef.current);
      }
    };
  }, []);

  return {
    data: localData,
    loading: localLoading,
    error: localError,
    refetch,
  };
}

/**
 * Trigger adherence refetch from anywhere (e.g., after medication status changes)
 * This can be called from API handlers, event listeners, etc.
 */
export function invalidateAdherence(): void {
  sharedAdherenceData = null;
  fetchAdherenceData().catch(console.error);
}

/**
 * Get current adherence data synchronously (for immediate reads)
 * Useful in contexts where you need the value without React
 */
export function getAdherenceDataSync(): AdherenceData | null {
  return sharedAdherenceData;
}

/**
 * Subscribe to adherence data changes outside of React components
 * Returns unsubscribe function
 */
export function subscribeToAdherence(
  callback: (data: AdherenceData | null) => void
): () => void {
  adherenceSubscribers.add(callback);
  // Immediately call with current data
  callback(sharedAdherenceData);
  // Return unsubscribe function
  return () => {
    adherenceSubscribers.delete(callback);
  };
}