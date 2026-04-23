"use client";
// components/notifications/NotificationManager.tsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import UpcomingReminderNotification from './UpcomingReminderNotification';
import IntakeConfirmedNotification from './IntakeConfirmedNotification';
import FoodMonitoringModal from './FoodMonitoringModal';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ScheduleItem {
  logId?: string;
  medicineId: string;
  name: string;
  dosage: string;
  time: string;
  status: string;
}

interface UserProfile {
  condition: string;
  firstName?: string;
}

// /api/adherence returns "Low Risk" | "Moderate Risk" | "High Risk".
// We normalise to the short form immediately on receipt.
type RiskLevel = 'Low' | 'Moderate' | 'High';

interface AdherenceData {
  adherenceRate: number;
  riskLevel: RiskLevel;
}

type NotifType = 'upcoming' | 'due' | 'intake';

interface ActiveNotification {
  type: NotifType;
  medicineName: string;
  scheduledTime: string;
  logId?: string;
  adherenceRate?: number;
  riskLevel?: RiskLevel;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers (defined outside the component — no hook rules needed)
// ─────────────────────────────────────────────────────────────────────────────

function timeToMinutes(timeStr: string): number {
  const ampm = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampm) {
    let h = parseInt(ampm[1]);
    const m = parseInt(ampm[2]);
    if (ampm[3].toUpperCase() === 'PM' && h !== 12) h += 12;
    if (ampm[3].toUpperCase() === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  }
  const plain = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (plain) return parseInt(plain[1]) * 60 + parseInt(plain[2]);
  return 0;
}

function getCurrentMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

// The adherence API can return "Low Risk" / "Moderate Risk" / "High Risk".
// Strip the trailing word so we get the union type we need.
function normaliseRiskLevel(raw: string): RiskLevel {
  const lower = raw.toLowerCase();
  if (lower.startsWith('high'))     return 'High';
  if (lower.startsWith('moderate')) return 'Moderate';
  return 'Low';
}

// ─────────────────────────────────────────────────────────────────────────────
// Audio alarm
// FIX: explicitly type the AudioContext constructor variable so TS doesn't
//      complain about "new AudioCtx()" when its type could be undefined.
// ─────────────────────────────────────────────────────────────────────────────

function playAlarm(): () => void {
  if (typeof window === 'undefined') return () => {};

  // webkitAudioContext exists on older Safari — access it via a typed cast
  const AudioCtxConstructor: (typeof AudioContext) | undefined =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioCtxConstructor) return () => {};

  const ctx = new AudioCtxConstructor();
  let stopped = false;

  function beep(startTime: number): void {
    if (stopped) return;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.4, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5);
    osc.start(startTime);
    osc.stop(startTime + 0.5);
  }

  let t = ctx.currentTime;
  for (let i = 0; i < 10; i++) {
    beep(t);
    t += 0.7;
  }

  return () => {
    stopped = true;
    void ctx.close();
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Browser push helper
// ─────────────────────────────────────────────────────────────────────────────

async function sendBrowserPush(title: string, body: string): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'denied') return;
  if (Notification.permission !== 'granted') {
    await Notification.requestPermission();
  }
  if (Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: '/favicon.ico',
      tag: `med-${Date.now()}`,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DB helper
// ─────────────────────────────────────────────────────────────────────────────

async function saveNotificationToDB(params: {
  type: string;
  title: string;
  message: string;
  medicineName?: string;
  riskLevel?: string;
  adherenceRate?: number;
}): Promise<void> {
  try {
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  } catch (err) {
    console.error('Failed to save notification:', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const NotificationManager: React.FC = () => {
  const [schedule,           setSchedule]           = useState<ScheduleItem[]>([]);
  const [userProfile,        setUserProfile]         = useState<UserProfile | null>(null);
  const [adherence,          setAdherence]           = useState<AdherenceData | null>(null);
  const [activeNotification, setActiveNotification]  = useState<ActiveNotification | null>(null);
  const [showFoodModal,      setShowFoodModal]       = useState(false);
  const [currentLogId,       setCurrentLogId]        = useState<string | undefined>();

  // Track fired notifications to avoid duplicates across poll cycles
  const firedUpcoming = useRef<Set<string>>(new Set());
  const firedDue      = useRef<Set<string>>(new Set());
  const firedIntake   = useRef<Set<string>>(new Set());
  const alarmStopRef  = useRef<(() => void) | null>(null);

  // ── Data fetcher ────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async (): Promise<void> => {
    try {
      const [dashRes, profileRes, adherenceRes] = await Promise.all([
        fetch('/api/dashboard'),
        fetch('/api/profile'),
        fetch('/api/adherence'),
      ]);

      // Type the JSON responses explicitly so TypeScript is happy
      const dashData      = (await dashRes.json())      as { success: boolean; data: { todaySchedule: ScheduleItem[] } };
      const profileData   = (await profileRes.json())   as { success: boolean; data: { condition?: string; firstName?: string } };
      const adherenceData = (await adherenceRes.json()) as { success: boolean; data: { adherenceRate: number; riskLevel: string } };

      if (dashData.success) {
        setSchedule(dashData.data.todaySchedule ?? []);
      }

      if (profileData.success) {
        setUserProfile({
          condition:  profileData.data.condition  ?? 'None',
          firstName:  profileData.data.firstName,
        });
      }

      if (adherenceData.success) {
        setAdherence({
          adherenceRate: adherenceData.data.adherenceRate,
          riskLevel:     normaliseRiskLevel(adherenceData.data.riskLevel),
        });
      }
    } catch (err) {
      console.error('NotificationManager fetch error:', err);
    }
  }, []);

  // ── Poll data every 30 s ─────────────────────────────────────────────────
  // FIX: useEffect callback must be synchronous.
  // Call the async function with void to suppress the "floating promise" lint warning.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchAll();
    const interval = setInterval(() => { void fetchAll(); }, 30_000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  // ── Request notification permission once on mount ────────────────────────
  // FIX: same pattern — wrap the async call so useEffect stays synchronous
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  }, []);

  // ── Check schedule every 30 s and fire notifications ─────────────────────
  useEffect(() => {
    const check = (): void => {
      const nowMins = getCurrentMinutes();

      for (const item of schedule) {
        if (!item.logId) continue;

        const scheduledMins = timeToMinutes(item.time);
        const key           = `${item.logId}-${item.time}`;

        // ── 1. Upcoming reminder (28–32 min before) ────────────────────────
        const minsBefore = scheduledMins - nowMins;
        if (
          minsBefore >= 28 &&
          minsBefore <= 32 &&
          item.status !== 'Taken' &&
          !firedUpcoming.current.has(key)
        ) {
          firedUpcoming.current.add(key);

          setActiveNotification({
            type:          'upcoming',
            medicineName:  item.name,
            scheduledTime: item.time,
            logId:         item.logId,
          });

          void saveNotificationToDB({
            type:         'upcoming_reminder',
            title:        '⏰ Upcoming Medication Reminder',
            message:      `${item.name} is scheduled at ${item.time} — 30 minutes from now!`,
            medicineName: item.name,
          });

          void sendBrowserPush(
            '⏰ Upcoming Medication Reminder',
            `${item.name} is due at ${item.time} — 30 minutes away! Consider eating something first.`
          );

          // Auto-dismiss after 60 seconds if user hasn't closed it manually
          setTimeout(() => {
            setActiveNotification((prev) =>
              prev?.type === 'upcoming' && prev.logId === item.logId ? null : prev
            );
          }, 60_000);
        }

        // ── 2. Due alarm (±1 min of scheduled time) ────────────────────────
        const diffAtDue = Math.abs(scheduledMins - nowMins);
        if (
          diffAtDue <= 1 &&
          item.status !== 'Taken' &&
          !firedDue.current.has(key)
        ) {
          firedDue.current.add(key);

          if (alarmStopRef.current) alarmStopRef.current();
          alarmStopRef.current = playAlarm();

          setActiveNotification({
            type:          'due',
            medicineName:  item.name,
            scheduledTime: item.time,
            logId:         item.logId,
          });

          void saveNotificationToDB({
            type:         'due_alarm',
            title:        '🚨 Time to Take Your Medication!',
            message:      `It's time to take ${item.name}. Open your pillbox now.`,
            medicineName: item.name,
          });

          void sendBrowserPush(
            '🚨 Medication Due Now!',
            `Time to take your ${item.name}. Open your pillbox to confirm intake.`
          );
        }

        // ── 3. Intake confirmed (sensor changed status to 'Taken') ─────────
        if (item.status === 'Taken' && !firedIntake.current.has(key)) {
          firedIntake.current.add(key);

          // Stop the alarm if it's still ringing
          if (alarmStopRef.current) {
            alarmStopRef.current();
            alarmStopRef.current = null;
          }

          const rate = adherence?.adherenceRate ?? 0;
          const risk = adherence?.riskLevel     ?? 'Low';

          setActiveNotification({
            type:          'intake',
            medicineName:  item.name,
            scheduledTime: item.time,
            logId:         item.logId,
            adherenceRate: rate,
            riskLevel:     risk,
          });
          setCurrentLogId(item.logId);

          void saveNotificationToDB({
            type:          'intake_confirmed',
            title:         '✅ Medication Intake Confirmed',
            message:       `${item.name} intake confirmed by sensor. Adherence: ${rate}%.`,
            medicineName:  item.name,
            riskLevel:     risk,
            adherenceRate: rate,
          });

          void sendBrowserPush(
            '✅ Medication Confirmed!',
            `${item.name} intake recorded. Adherence: ${rate}% — ${risk} Risk.`
          );
        }
      }
    };

    check(); // run immediately, then on interval
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, [schedule, adherence]);

  // ── Event handlers ─────────────────────────────────────────────────────────
  const handleClose = useCallback((): void => {
    if (alarmStopRef.current) {
      alarmStopRef.current();
      alarmStopRef.current = null;
    }
    setActiveNotification(null);
  }, []);

  const handleProceedToFood = useCallback((): void => {
    setActiveNotification(null);
    setShowFoodModal(true);
  }, []);

  const handleFoodComplete = useCallback(
    (result: { riskLevel: string; normalizedScore: number }): void => {
      void saveNotificationToDB({
        type:      'adherence_alert',
        title:     '📊 Dietary Risk Updated',
        message:   `Food monitoring complete. Dietary risk: ${result.riskLevel} (score: ${result.normalizedScore}/100).`,
        riskLevel: result.riskLevel,
      });
    },
    []
  );

  // ── Derived values ─────────────────────────────────────────────────────────
  const condition = userProfile?.condition ?? 'None';
  const showFoodCheck =
    activeNotification?.type === 'intake' &&
    ['Diabetes', 'Hypertension', 'Both'].includes(condition);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Upcoming reminder popup ── */}
      {activeNotification?.type === 'upcoming' && (
        <UpcomingReminderNotification
          medicineName={activeNotification.medicineName}
          scheduledTime={activeNotification.scheduledTime}
          condition={condition}
          onClose={handleClose}
        />
      )}

      {/* ── Due alarm popup ── */}
      {activeNotification?.type === 'due' && (
        <div className="fixed top-4 right-4 z-[150] w-80 bg-white rounded-2xl shadow-2xl border border-red-200 overflow-hidden animate-in slide-in-from-right duration-300">
          <div className="bg-gradient-to-r from-red-500 to-red-600 px-4 py-3 flex items-center gap-2">
            <span className="text-xl animate-pulse">🚨</span>
            <span className="text-white font-bold text-sm">Medication Due Now!</span>
          </div>
          <div className="p-4">
            <p className="text-gray-800 font-semibold text-sm mb-1">
              Take your medication now! ⏰
            </p>
            <p className="text-gray-500 text-sm mb-3">
              It&apos;s time for{' '}
              <span className="font-semibold text-red-600">
                {activeNotification.medicineName}
              </span>{' '}
              ({activeNotification.scheduledTime}). Please open your pillbox to confirm.
            </p>
            <p className="text-xs text-gray-400">
              This notification will stop once the sensor detects your pillbox is opened.
            </p>
          </div>
        </div>
      )}

      {/* ── Intake confirmed popup ── */}
      {activeNotification?.type === 'intake' && (
        <IntakeConfirmedNotification
          medicineName={activeNotification.medicineName}
          adherenceRate={activeNotification.adherenceRate ?? 0}
          riskLevel={activeNotification.riskLevel ?? 'Low'}
          showFoodMonitoring={showFoodCheck}
          onClose={handleClose}
          onProceed={handleProceedToFood}
        />
      )}

      {/* ── Food monitoring modal ── */}
      {showFoodModal && (
        <FoodMonitoringModal
          isOpen={showFoodModal}
          onClose={() => setShowFoodModal(false)}
          condition={condition}
          medicationLogId={currentLogId}
          onComplete={handleFoodComplete}
        />
      )}
    </>
  );
};

export default NotificationManager;