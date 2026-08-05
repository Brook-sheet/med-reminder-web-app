/* eslint-disable react-hooks/set-state-in-effect */
"use client";
// components/notifications/NotificationManager.tsx

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";

import UpcomingReminderNotification from "./UpcomingReminderNotification";
import IntakeConfirmedNotification from "./IntakeConfirmedNotification";
import FoodMonitoringModal from "./FoodMonitoringModal";
import { useAdherence } from "@/hooks/useAdherence";

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

type RiskLevel = "Low" | "Moderate" | "High";

interface AdaptiveReminderConfig {
  leadTimeMinutes: number;
  followUpCount: number;
  followUpIntervalMinutes: number;
  escalationEnabled: boolean;
  escalationPriority: string;
  motivationalMessagingEnabled: boolean;
  intensity: string;
  messageTone: string;
  highSensitivityMode: boolean;
  behavioralLeadTimeBonus: number;
}

interface AdaptiveBehavioralPattern {
  peakMissHour: number | null;
  delayProfile: string;
  avgIntakeDelayMinutes: number;
  hasClusteredMisses: boolean;
  currentMissStreak: number;
}

interface AdaptiveIntervention {
  reminderConfig: AdaptiveReminderConfig;
  behavioralPattern: AdaptiveBehavioralPattern;
  isEscalation: boolean;
  escalationMessage: string | null;
  motivationalMessage: string;
  keySignals: string[];
  interventionSummary: string;
}

interface AdherenceData {
  adherenceRate: number;
  riskLevel: RiskLevel;
  adaptiveIntervention: AdaptiveIntervention;
}

type NotifType = "upcoming" | "due" | "intake" | "followup";

interface ActiveNotification {
  id: string;
  type: NotifType;
  medicineName: string;
  scheduledTime: string;
  logId?: string;
  adherenceRate?: number;
  riskLevel?: RiskLevel;
}

// Track follow-up state per logId
interface FollowUpState {
  logId: string;
  count: number;          // how many follow-ups sent so far
  maxCount: number;       // from adaptive config
  intervalMinutes: number;
  nextFollowUpAt: number; // epoch ms
}

// ─────────────────────────────────────────────────────────────────────────────
// Local storage keys
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEYS = {
  upcoming: "notif-upcoming-fired",
  due: "notif-due-fired",
  intake: "notif-intake-fired",
  peakNudge: "notif-peak-nudge-fired", // NEW: peak miss hour nudge
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function loadStoredSet(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function saveStoredSet(key: string, value: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(value)));
  } catch (err) {
    console.error("Failed to save notification state:", err);
  }
}

function timeToMinutes(timeStr: string): number {
  const ampm = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(timeStr);
  if (ampm) {
    let h = Number.parseInt(ampm[1], 10);
    const m = Number.parseInt(ampm[2], 10);
    if (ampm[3].toUpperCase() === "PM" && h !== 12) h += 12;
    if (ampm[3].toUpperCase() === "AM" && h === 12) h = 0;
    return h * 60 + m;
  }
  const plain = /^(\d{1,2}):(\d{2})$/.exec(timeStr);
  if (plain) {
    return Number.parseInt(plain[1], 10) * 60 + Number.parseInt(plain[2], 10);
  }
  return 0;
}

function getCurrentMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function normaliseRiskLevel(raw: string): RiskLevel {
  const lower = raw.toLowerCase();
  if (lower.startsWith("high")) return "High";
  if (lower.startsWith("moderate")) return "Moderate";
  return "Low";
}

// ─────────────────────────────────────────────────────────────────────────────
// Alarm
// ─────────────────────────────────────────────────────────────────────────────

function playAlarm(): () => void {
  if (typeof window === "undefined") return () => {};
  const audioGlobal = globalThis as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const AudioCtxConstructor = audioGlobal.AudioContext ?? audioGlobal.webkitAudioContext;
  if (!AudioCtxConstructor) return () => {};

  const ctx = new AudioCtxConstructor();
  let stopped = false;

  function beep(startTime: number): void {
    if (stopped) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = "sine";
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
    ctx.close().catch(console.error);
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Browser push
// ─────────────────────────────────────────────────────────────────────────────

async function sendBrowserPush(title: string, body: string): Promise<void> {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission === "denied") return;
  if (Notification.permission !== "granted") {
    await Notification.requestPermission();
  }
  if (Notification.permission === "granted") {
    new Notification(title, { body, icon: "/favicon.ico", tag: `med-${Date.now()}` });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Save notification to DB
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
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  } catch (err) {
    console.error("Failed to save notification:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const NotificationManager: React.FC = () => {
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [activeNotifications, setActiveNotifications] = useState<ActiveNotification[]>([]);
  const [showFoodModal, setShowFoodModal] = useState(false);
  const [currentLogId, setCurrentLogId] = useState<string | undefined>();
  const [notificationMemoryLoaded, setNotificationMemoryLoaded] = useState(false);

  // Use shared adherence hook - auto-refetches on schedule changes and intervals
  const { data: adherenceData, refetch: refetchAdherence } = useAdherence({
    autoRefetch: true,
    refetchIntervalMs: 60_000,
    initialLoad: true,
  });

  // Convert hook data to local format for compatibility
  const adherence = adherenceData
    ? {
        adherenceRate: adherenceData.adherenceRate,
        riskLevel: normaliseRiskLevel(adherenceData.riskLevel),
        adaptiveIntervention: adherenceData.adaptiveIntervention,
      }
    : null;

  // Escalation banner state
  const [escalationBanner, setEscalationBanner] = useState<string | null>(null);

  // Follow-up tracking: logId → FollowUpState
  const followUpMap = useRef<Map<string, FollowUpState>>(new Map());

  const firedUpcoming = useRef<Set<string>>(new Set());
  const firedDue = useRef<Set<string>>(new Set());
  const firedIntake = useRef<Set<string>>(new Set());
  const firedPeakNudge = useRef<Set<string>>(new Set()); // NEW
  const alarmStopRef = useRef<(() => void) | null>(null);

  const removeNotification = useCallback((id: string): void => {
    setActiveNotifications((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const removeDueNotificationsByLogId = useCallback((logId?: string): void => {
    if (!logId) return;
    setActiveNotifications((prev) =>
      prev.filter((active) => !(active.type === "due" && active.logId === logId))
    );
  }, []);

  const enqueueNotification = useCallback(
    (notification: ActiveNotification): void => {
      setActiveNotifications((prev) => [...prev, notification]);
      const duration =
        notification.type === "due" || notification.type === "followup"
          ? 15 * 60 * 1000
          : 60 * 1000;
      setTimeout(() => removeNotification(notification.id), duration);
    },
    [removeNotification]
  );

  const handleClose = useCallback((id: string): void => {
    if (alarmStopRef.current) {
      alarmStopRef.current();
      alarmStopRef.current = null;
    }
    setActiveNotifications((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // ── Load notification memory ─────────────────────────────────────────────
  useEffect(() => {
    firedUpcoming.current = loadStoredSet(STORAGE_KEYS.upcoming);
    firedDue.current = loadStoredSet(STORAGE_KEYS.due);
    firedIntake.current = loadStoredSet(STORAGE_KEYS.intake);
    firedPeakNudge.current = loadStoredSet(STORAGE_KEYS.peakNudge);
    setNotificationMemoryLoaded(true);
  }, []);

  // ── Fetch data (adherence only on mount + after intake, not every 30s) ──
  const adherenceFetchedRef = useRef(false);

  const fetchAll = useCallback(async () => {
    try {
      const [dashRes, profileRes] = await Promise.all([
        fetch("/api/dashboard"),
        fetch("/api/profile"),
      ]);
      const dashData = await dashRes.json();
      const profileData = await profileRes.json();

      if (dashData.success) setSchedule(dashData.data.todaySchedule ?? []);
      if (profileData.success) {
        setUserProfile({
          condition: profileData.data.condition ?? "None",
          firstName: profileData.data.firstName,
        });
      }
    } catch (err) {
      console.error("NotificationManager fetchAll error:", err);
    }
  }, []);

  // On mount: fetch dashboard and set up polling
  useEffect(() => {
    fetchAll().catch(console.error);
    // Poll dashboard every 30s (lightweight)
    const interval = setInterval(() => {
      fetchAll().catch(console.error);
    }, 30_000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  // Update escalation banner when adherence data changes
  useEffect(() => {
    if (!adherence?.adaptiveIntervention) return;
    const esc = adherence.adaptiveIntervention.escalationMessage;
    if (esc && adherence.adaptiveIntervention.isEscalation) {
      setEscalationBanner(esc);
    }
  }, [adherence?.adaptiveIntervention]);

  // ── Browser permission ───────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(console.error);
    }
  }, []);

  // ── Derive adaptive config with safe defaults ────────────────────────────
  const adaptiveConfig = adherence?.adaptiveIntervention?.reminderConfig;
  const leadTimeMinutes = adaptiveConfig?.leadTimeMinutes ?? 30;
  const followUpCount = adaptiveConfig?.followUpCount ?? 1;
  const followUpIntervalMinutes = adaptiveConfig?.followUpIntervalMinutes ?? 20;
  const peakMissHour =
    adherence?.adaptiveIntervention?.behavioralPattern?.peakMissHour ?? null;

  // ── Main checker ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!notificationMemoryLoaded) return;

    // ── Upcoming reminder (uses adaptive lead time) ──────────────────────
    const processUpcoming = (
      item: ScheduleItem,
      scheduledMins: number,
      nowMins: number
    ): void => {
      const upcomingKey = `upcoming-${item.logId}`;
      const minsBefore = scheduledMins - nowMins;
      const buffer = 2; // fire within ±2 min of lead time

      if (
        minsBefore >= leadTimeMinutes - buffer &&
        minsBefore <= leadTimeMinutes + buffer &&
        item.status !== "Taken" &&
        !firedUpcoming.current.has(upcomingKey)
      ) {
        firedUpcoming.current.add(upcomingKey);
        saveStoredSet(STORAGE_KEYS.upcoming, firedUpcoming.current);

        enqueueNotification({
          id: `upcoming-${item.logId}-${item.time}`,
          type: "upcoming",
          medicineName: item.name,
          scheduledTime: item.time,
          logId: item.logId,
        });

        saveNotificationToDB({
          type: "upcoming_reminder",
          title: "Upcoming Medication Reminder",
          message: `${item.name} is scheduled at ${item.time} — ${leadTimeMinutes} minutes away.`,
          medicineName: item.name,
        }).catch(console.error);

        sendBrowserPush(
          "Upcoming Medication Reminder",
          `${item.name} is due at ${item.time} — ${leadTimeMinutes} minutes away.`
        ).catch(console.error);
      }
    };

    // ── Due alarm ────────────────────────────────────────────────────────
    const processDue = (
      item: ScheduleItem,
      scheduledMins: number,
      nowMins: number
    ): void => {
      const dueKey = `due-${item.logId}`;
      const diffAtDue = Math.abs(scheduledMins - nowMins);
      const shouldFireDue = diffAtDue <= 1 || item.status === "Now";

      if (
        shouldFireDue &&
        item.status !== "Taken" &&
        !firedDue.current.has(dueKey)
      ) {
        firedDue.current.add(dueKey);
        saveStoredSet(STORAGE_KEYS.due, firedDue.current);

        if (alarmStopRef.current) alarmStopRef.current();
        alarmStopRef.current = playAlarm();

        fetch("/api/hardware/alarm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ alarmIndex: schedule.indexOf(item) }),
        }).catch(console.error);

        enqueueNotification({
          id: `due-${item.logId}-${item.time}`,
          type: "due",
          medicineName: item.name,
          scheduledTime: item.time,
          logId: item.logId,
        });

        saveNotificationToDB({
          type: "due_alarm",
          title: "Time to Take Your Medication",
          message: `It's time to take ${item.name} — Scheduled at ${item.time}.`,
          medicineName: item.name,
        }).catch(console.error);

        sendBrowserPush(
          "Medication Due Now",
          `It's time to take ${item.name} — Scheduled at ${item.time}.`
        ).catch(console.error);

        // Set up follow-up tracking if adaptive config says so
        if (followUpCount > 0 && item.logId) {
          followUpMap.current.set(item.logId, {
            logId: item.logId,
            count: 0,
            maxCount: followUpCount,
            intervalMinutes: followUpIntervalMinutes,
            nextFollowUpAt: Date.now() + followUpIntervalMinutes * 60 * 1000,
          });
        }
      }
    };

    // ── Follow-up reminders ──────────────────────────────────────────────
    const processFollowUps = (item: ScheduleItem): void => {
      if (!item.logId || item.status === "Taken") {
        // Remove from tracking if taken
        followUpMap.current.delete(item.logId ?? "");
        return;
      }

      const state = followUpMap.current.get(item.logId);
      if (!state) return;
      if (state.count >= state.maxCount) return;
      if (Date.now() < state.nextFollowUpAt) return;

      // Time to fire a follow-up
      state.count += 1;
      state.nextFollowUpAt = Date.now() + state.intervalMinutes * 60 * 1000;

      // Play alarm again for urgency
      if (alarmStopRef.current) alarmStopRef.current();
      alarmStopRef.current = playAlarm();

      const followUpId = `followup-${item.logId}-${state.count}`;

      enqueueNotification({
        id: followUpId,
        type: "followup",
        medicineName: item.name,
        scheduledTime: item.time,
        logId: item.logId,
      });

      saveNotificationToDB({
        type: "due_alarm",
        title: `Follow-up Reminder (${state.count}/${state.maxCount})`,
        message: `${item.name} still hasn't been confirmed. Please take your medication now.`,
        medicineName: item.name,
      }).catch(console.error);

      sendBrowserPush(
        `Follow-up Reminder (${state.count}/${state.maxCount})`,
        `${item.name} is still pending. Please take your medication.`
      ).catch(console.error);
    };

    // ── Intake confirmed ─────────────────────────────────────────────────
    const processIntake = (item: ScheduleItem): void => {
      const intakeKey = `intake-${item.logId}`;

      if (item.status === "Taken" && !firedIntake.current.has(intakeKey)) {
        firedIntake.current.add(intakeKey);
        saveStoredSet(STORAGE_KEYS.intake, firedIntake.current);

        if (alarmStopRef.current) {
          alarmStopRef.current();
          alarmStopRef.current = null;
        }

        removeDueNotificationsByLogId(item.logId);
        followUpMap.current.delete(item.logId ?? "");

        fetch("/api/hardware/alarm", { method: "DELETE" }).catch(console.error);

        const rate = adherence?.adherenceRate ?? 0;
        const risk = adherence?.riskLevel ?? "Low";

        enqueueNotification({
          id: `intake-${item.logId}-${item.time}`,
          type: "intake",
          medicineName: item.name,
          scheduledTime: item.time,
          logId: item.logId,
          adherenceRate: rate,
          riskLevel: risk,
        });

        setCurrentLogId(item.logId);

        // Re-fetch adherence after intake immediately so popup shows current rate
        // The useAdherence hook will notify all subscribers of the update
        refetchAdherence().catch(console.error);

        saveNotificationToDB({
          type: "intake_confirmed",
          title: "Medication Intake Confirmed",
          message: `${item.name} intake confirmed.`,
          medicineName: item.name,
          riskLevel: risk,
          adherenceRate: rate,
        }).catch(console.error);

        sendBrowserPush(
          "Medication Confirmed",
          `${item.name} intake recorded successfully.`
        ).catch(console.error);
      }
    };

    // ── Peak miss hour proactive nudge ───────────────────────────────────
    const processPeakNudge = (): void => {
      if (peakMissHour === null) return;

      const now = new Date();
      const currentHour = now.getHours();
      const todayKey = `peak-nudge-${new Date().toISOString().split("T")[0]}`;

      // Fire 1 hour before the peak miss hour
      if (
        currentHour === peakMissHour - 1 &&
        !firedPeakNudge.current.has(todayKey)
      ) {
        firedPeakNudge.current.add(todayKey);
        saveStoredSet(STORAGE_KEYS.peakNudge, firedPeakNudge.current);

        const peakTime = `${peakMissHour > 12 ? peakMissHour - 12 : peakMissHour}:00 ${
          peakMissHour >= 12 ? "PM" : "AM"
        }`;

        saveNotificationToDB({
          type: "upcoming_reminder",
          title: "Heads-up: You tend to miss doses around this time",
          message: `Based on your history, you often miss doses around ${peakTime}. Be ready!`,
        }).catch(console.error);

        sendBrowserPush(
          "Proactive Reminder",
          `You tend to miss doses around ${peakTime}. Be prepared!`
        ).catch(console.error);
      }
    };

    const check = (): void => {
      const nowMins = getCurrentMinutes();

      for (const item of schedule) {
        if (!item.logId) continue;
        const scheduledMins = timeToMinutes(item.time);
        processUpcoming(item, scheduledMins, nowMins);
        processDue(item, scheduledMins, nowMins);
        processFollowUps(item);
        processIntake(item);
      }

      processPeakNudge();
    };

    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, [
    schedule,
    adherence,
    leadTimeMinutes,
    followUpCount,
    followUpIntervalMinutes,
    peakMissHour,
    notificationMemoryLoaded,
    enqueueNotification,
    removeDueNotificationsByLogId,
    refetchAdherence,
  ]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleProceedToFood = useCallback(
    (id: string): void => {
      handleClose(id);
      setShowFoodModal(true);
    },
    [handleClose]
  );

  const handleFoodComplete = useCallback(
    (result: { riskLevel: string; normalizedScore: number }): void => {
      saveNotificationToDB({
        type: "adherence_alert",
        title: "Dietary Risk Updated",
        message: `Dietary risk: ${result.riskLevel}`,
        riskLevel: result.riskLevel,
      }).catch(console.error);
    },
    []
  );

  const condition = userProfile?.condition ?? "None";
  const showFoodCheck = ["Diabetes", "Hypertension", "Both"].includes(condition);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      {/* Escalation Banner */}
      {escalationBanner && (
        <div className="fixed top-0 left-0 right-0 z-[200] bg-red-600 text-white px-4 py-3 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-lg shrink-0">⚠️</span>
            <p className="text-sm font-semibold truncate">{escalationBanner}</p>
          </div>
          <button
            onClick={() => setEscalationBanner(null)}
            className="ml-4 shrink-0 text-white/80 hover:text-white text-xl leading-none"
            aria-label="Dismiss escalation banner"
          >
            ×
          </button>
        </div>
      )}

      {/* Notification stack */}
      {activeNotifications.length > 0 && (
        <div
          className={`fixed right-4 z-150 flex flex-col items-end gap-4 ${
            escalationBanner ? "top-16" : "top-4"
          }`}
        >
          {activeNotifications.map((notification) => (
            <div
              key={notification.id}
              className="w-[min(92vw,20rem)] pointer-events-auto"
            >
              {notification.type === "upcoming" && (
                <UpcomingReminderNotification
                  className="w-full"
                  medicineName={notification.medicineName}
                  scheduledTime={notification.scheduledTime}
                  condition={condition}
                  onClose={() => handleClose(notification.id)}
                />
              )}

              {(notification.type === "due" || notification.type === "followup") && (
                <div className="w-full bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-red-200 dark:border-red-700 overflow-hidden animate-in slide-in-from-right duration-300">
                  <div className="bg-gradient-to-r from-red-500 to-red-600 px-4 py-3 flex items-center justify-between">
                    <span className="text-white font-bold text-sm">
                      {notification.type === "followup"
                        ? "⏰ Follow-up Reminder"
                        : "Medication Due Now"}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleClose(notification.id)}
                      className="text-white/80 hover:text-white"
                    >
                      ×
                    </button>
                  </div>
                  <div className="p-4 space-y-3">
                    <p className="text-gray-800 dark:text-gray-100 font-semibold text-sm">
                      {notification.type === "followup"
                        ? "This is a follow-up reminder. Please take your medication."
                        : "Take your medication now."}
                    </p>
                    <p className="text-gray-500 dark:text-gray-300 text-sm">
                      <span className="font-semibold text-gray-700 dark:text-gray-100">
                        {notification.medicineName}
                      </span>{" "}
                      — scheduled at{" "}
                      <span className="font-semibold text-gray-700 dark:text-gray-100">
                        {notification.scheduledTime}
                      </span>
                      .
                    </p>
                  </div>
                </div>
              )}

              {notification.type === "intake" && (
                <IntakeConfirmedNotification
                  className="w-full"
                  medicineName={notification.medicineName}
                  adherenceRate={notification.adherenceRate ?? 0}
                  riskLevel={notification.riskLevel ?? "Low"}
                  showFoodMonitoring={showFoodCheck}
                  onClose={() => handleClose(notification.id)}
                  onProceed={() => handleProceedToFood(notification.id)}
                />
              )}
            </div>
          ))}
        </div>
      )}

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