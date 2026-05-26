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

interface AdherenceData {
  adherenceRate: number;
  riskLevel: RiskLevel;
}

type NotifType = "upcoming" | "due" | "intake";

interface ActiveNotification {
  id: string;
  type: NotifType;
  medicineName: string;
  scheduledTime: string;
  logId?: string;
  adherenceRate?: number;
  riskLevel?: RiskLevel;
}

// ─────────────────────────────────────────────────────────────────────────────
// Local storage keys
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEYS = {
  upcoming: "notif-upcoming-fired",
  due: "notif-due-fired",
  intake: "notif-intake-fired",
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function loadStoredSet(key: string): Set<string> {
  if (globalThis.window === undefined) return new Set();

  try {
    const raw = localStorage.getItem(key);

    if (!raw) return new Set();

    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function saveStoredSet(
  key: string,
  value: Set<string>
): void {
  if (globalThis.window === undefined) return;

  try {
    localStorage.setItem(
      key,
      JSON.stringify(Array.from(value))
    );
  } catch (err) {
    console.error("Failed to save notification state:", err);
  }
}

function timeToMinutes(timeStr: string): number {
  const ampm = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(timeStr);

  if (ampm) {
    let h = Number.parseInt(ampm[1], 10);
    const m = Number.parseInt(ampm[2], 10);

    if (ampm[3].toUpperCase() === "PM" && h !== 12) {
      h += 12;
    }

    if (ampm[3].toUpperCase() === "AM" && h === 12) {
      h = 0;
    }

    return h * 60 + m;
  }

  const plain = /^(\d{1,2}):(\d{2})$/.exec(timeStr);

  if (plain) {
    return (
      Number.parseInt(plain[1], 10) * 60 +
      Number.parseInt(plain[2], 10)
    );
  }

  return 0;
}

function getCurrentMinutes(): number {
  const now = new Date();

  return now.getHours() * 60 + now.getMinutes();
}

function normaliseRiskLevel(
  raw: string
): RiskLevel {
  const lower = raw.toLowerCase();

  if (lower.startsWith("high")) return "High";

  if (lower.startsWith("moderate")) {
    return "Moderate";
  }

  return "Low";
}

// ─────────────────────────────────────────────────────────────────────────────
// Alarm
// ─────────────────────────────────────────────────────────────────────────────

function playAlarm(): () => void {
  if (globalThis.window === undefined) {
    return () => {};
  }

  const audioGlobal = globalThis as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const AudioCtxConstructor:
    | typeof AudioContext
    | undefined =
    audioGlobal.AudioContext ?? audioGlobal.webkitAudioContext;

  if (!AudioCtxConstructor) {
    return () => {};
  }

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

    gain.gain.exponentialRampToValueAtTime(
      0.001,
      startTime + 0.5
    );

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

async function sendBrowserPush(
  title: string,
  body: string
): Promise<void> {
  if (globalThis.window === undefined) return;

  if (!("Notification" in (globalThis.window as Window))) return;

  if (Notification.permission === "denied") {
    return;
  }

  if (Notification.permission !== "granted") {
    await Notification.requestPermission();
  }

  if (Notification.permission === "granted") {
    new Notification(title, {
      body,
      icon: "/favicon.ico",
      tag: `med-${Date.now()}`,
    });
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
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });
  } catch (err) {
    console.error(
      "Failed to save notification:",
      err
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const NotificationManager: React.FC = () => {
  const [schedule, setSchedule] = useState<
    ScheduleItem[]
  >([]);

  const [userProfile, setUserProfile] =
    useState<UserProfile | null>(null);

  const [adherence, setAdherence] =
    useState<AdherenceData | null>(null);

  const [activeNotifications, setActiveNotifications] =
    useState<ActiveNotification[]>([]);

  const [showFoodModal, setShowFoodModal] =
    useState(false);

  const [currentLogId, setCurrentLogId] =
    useState<string | undefined>();

  const [
    notificationMemoryLoaded,
    setNotificationMemoryLoaded,
  ] = useState(false);

  // ───────────────────────────────────────────────────────────────────────────
  // Persistent fired sets
  // ───────────────────────────────────────────────────────────────────────────

  const firedUpcoming = useRef<Set<string>>(
    new Set()
  );

  const firedDue = useRef<Set<string>>(
    new Set()
  );

  const firedIntake = useRef<Set<string>>(
    new Set()
  );

  const alarmStopRef = useRef<
    (() => void) | null
  >(null);

  const removeNotification = useCallback(
    (id: string): void => {
      setActiveNotifications((prev) =>
        prev.filter((item) => item.id !== id)
      );
    },
    []
  );

  const enqueueNotification = useCallback(
    (notification: ActiveNotification): void => {
      setActiveNotifications((prev) => [...prev, notification]);

      setTimeout(() => {
        removeNotification(notification.id);
      }, 60000);
    },
    [removeNotification]
  );

  const handleClose = useCallback((id: string): void => {
    if (alarmStopRef.current) {
      alarmStopRef.current();
      alarmStopRef.current = null;
    }
    setActiveNotifications((prev) =>
      prev.filter((item) => item.id !== id)
    );
  }, []);

  // ───────────────────────────────────────────────────────────────────────────
  // Load notification memory
  // ───────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    firedUpcoming.current = loadStoredSet(
      STORAGE_KEYS.upcoming
    );

    firedDue.current = loadStoredSet(
      STORAGE_KEYS.due
    );

    firedIntake.current = loadStoredSet(
      STORAGE_KEYS.intake
    );

    setNotificationMemoryLoaded(true);
  }, []);

  // ───────────────────────────────────────────────────────────────────────────
  // Fetch data
  // ───────────────────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    try {
      const [
        dashRes,
        profileRes,
        adherenceRes,
      ] = await Promise.all([
        fetch("/api/dashboard"),
        fetch("/api/profile"),
        fetch("/api/adherence"),
      ]);

      const dashData = await dashRes.json();

      const profileData =
        await profileRes.json();

      const adherenceData =
        await adherenceRes.json();

      if (dashData.success) {
        setSchedule(
          dashData.data.todaySchedule ?? []
        );
      }

      if (profileData.success) {
        setUserProfile({
          condition:
            profileData.data.condition ??
            "None",

          firstName:
            profileData.data.firstName,
        });
      }

      if (adherenceData.success) {
        setAdherence({
          adherenceRate:
            adherenceData.data
              .adherenceRate,

          riskLevel: normaliseRiskLevel(
            adherenceData.data.riskLevel
          ),
        });
      }
    } catch (err) {
      console.error(
        "NotificationManager fetch error:",
        err
      );
    }
  }, []);

  // ───────────────────────────────────────────────────────────────────────────
  // Poll every 30s
  // ───────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchAll().catch(console.error);

    const interval = setInterval(() => {
      fetchAll().catch(console.error);
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchAll]);

  // ───────────────────────────────────────────────────────────────────────────
  // Browser permission
  // ───────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (globalThis.window === undefined) return;

    if (!("Notification" in (globalThis.window as Window))) {
      return;
    }

    if (Notification.permission === "default") {
      Notification.requestPermission().catch(
        console.error
      );
    }
  }, []);

  // ───────────────────────────────────────────────────────────────────────────
  // Main checker
  // ───────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!notificationMemoryLoaded) return;

    const processUpcoming = (
      item: ScheduleItem,
      scheduledMins: number,
      nowMins: number
    ): void => {
      const upcomingKey = `upcoming-${item.logId}`;
      const minsBefore = scheduledMins - nowMins;

      if (
        minsBefore >= 28 &&
        minsBefore <= 32 &&
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
          message: `${item.name} is scheduled at ${item.time}.`,
          medicineName: item.name,
        }).catch(console.error);

        sendBrowserPush(
          "Upcoming Medication Reminder",
          `${item.name} is due at ${item.time} — 30 minutes away.`
        ).catch(console.error);
      }
    };

    const processDue = (
      item: ScheduleItem,
      scheduledMins: number,
      nowMins: number
    ): void => {
      const dueKey = `due-${item.logId}`;
      const diffAtDue = Math.abs(scheduledMins - nowMins);

      if (
        diffAtDue <= 1 &&
        item.status !== "Taken" &&
        !firedDue.current.has(dueKey)
      ) {
        firedDue.current.add(dueKey);
        saveStoredSet(STORAGE_KEYS.due, firedDue.current);

        if (alarmStopRef.current) {
          alarmStopRef.current();
        }
        alarmStopRef.current = playAlarm();

        fetch("/api/hardware/alarm", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            alarmIndex: schedule.indexOf(item),
          }),
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
      }
    };

    const processIntake = (item: ScheduleItem): void => {
      const intakeKey = `intake-${item.logId}`;

      if (
        item.status === "Taken" &&
        !firedIntake.current.has(intakeKey)
      ) {
        firedIntake.current.add(intakeKey);
        saveStoredSet(STORAGE_KEYS.intake, firedIntake.current);

        if (alarmStopRef.current) {
          alarmStopRef.current();
          alarmStopRef.current = null;
        }

        fetch("/api/hardware/alarm", {
          method: "DELETE",
        }).catch(console.error);

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

    const check = (): void => {
      const nowMins = getCurrentMinutes();

      for (const item of schedule) {
        if (!item.logId) continue;

        const scheduledMins = timeToMinutes(item.time);
        processUpcoming(item, scheduledMins, nowMins);
        processDue(item, scheduledMins, nowMins);
        processIntake(item);
      }
    };

    check();

    const interval = setInterval(check, 30000);

    return () => clearInterval(interval);
  }, [
    schedule,
    adherence,
    notificationMemoryLoaded,
    enqueueNotification,
  ]);

  // ───────────────────────────────────────────────────────────────────────────
  // Handlers
  // ───────────────────────────────────────────────────────────────────────────

  const handleProceedToFood =
    useCallback(
      (id: string): void => {
        handleClose(id);
        setShowFoodModal(true);
      },
      [handleClose]
    );

  const handleFoodComplete =
    useCallback(
      (result: {
        riskLevel: string;
        normalizedScore: number;
      }): void => {
        saveNotificationToDB({
          type: "adherence_alert",
          title:
            "Dietary Risk Updated",
          message: `Dietary risk: ${result.riskLevel}`,
          riskLevel:
            result.riskLevel,
        }).catch(console.error);
      },
      []
    );

  // ───────────────────────────────────────────────────────────────────────────
  // Derived values
  // ───────────────────────────────────────────────────────────────────────────

  const condition =
    userProfile?.condition ??
    "None";

  const showFoodCheck = [
    "Diabetes",
    "Hypertension",
    "Both",
  ].includes(condition);

  // ───────────────────────────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────────────────────────

  return (
    <>
      {activeNotifications.length > 0 && (
        <div className="fixed top-4 right-4 z-150 flex flex-col items-end gap-4">
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

              {notification.type === "due" && (
                <div className="w-full bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-red-200 dark:border-red-700 overflow-hidden animate-in slide-in-from-right duration-300">
                  <div className="bg-linear-to-r from-red-500 to-red-600 px-4 py-3 flex items-center justify-between">
                    <span className="text-white font-bold text-sm">
                      Medication Due Now
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
                      Take your medication now.
                    </p>
                    <p className="text-gray-500 dark:text-gray-300 text-sm">
                      It&apos;s time to take <span className="font-semibold text-gray-700 dark:text-gray-100">{notification.medicineName}</span> — scheduled at <span className="font-semibold text-gray-700 dark:text-gray-100">{notification.scheduledTime}</span>.
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
          onClose={() =>
            setShowFoodModal(false)
          }
          condition={condition}
          medicationLogId={
            currentLogId
          }
          onComplete={
            handleFoodComplete
          }
        />
      )}
    </>
  );
};

export default NotificationManager;