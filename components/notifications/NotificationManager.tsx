/* eslint-disable react-hooks/set-state-in-effect */
"use client";

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

type RiskLevel =
  | "Low"
  | "Moderate"
  | "High";

type NotifType =
  | "upcoming"
  | "due"
  | "intake"
  | "followup";

interface ActiveNotification {
  id: string;
  type: NotifType;
  medicineName: string;
  scheduledTime: string;
  logId?: string;
  adherenceRate?: number;
  riskLevel?: RiskLevel;
}

interface FollowUpState {
  logId: string;
  count: number;
  maxCount: number;
  intervalMinutes: number;
  nextFollowUpAt: number;
}

const STORAGE_KEYS = {
  upcoming: "notif-upcoming-fired",
  due: "notif-due-fired",
  intake: "notif-intake-fired",
};

function loadStoredSet(
  key: string
): Set<string> {
  if (
    typeof window === "undefined"
  ) {
    return new Set();
  }

  try {
    const raw =
      localStorage.getItem(key);

    return raw
      ? new Set(JSON.parse(raw))
      : new Set();
  } catch {
    return new Set();
  }
}

function saveStoredSet(
  key: string,
  value: Set<string>
) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify(
        Array.from(value)
      )
    );
  } catch (error) {
    console.error(
      "Failed to save notification state:",
      error
    );
  }
}

function timeToMinutes(
  time: string
) {
  const twelve =
    /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(
      time
    );

  if (twelve) {
    let hour =
      Number.parseInt(
        twelve[1],
        10
      );

    if (
      twelve[3].toUpperCase() ===
        "PM" &&
      hour !== 12
    ) {
      hour += 12;
    }

    if (
      twelve[3].toUpperCase() ===
        "AM" &&
      hour === 12
    ) {
      hour = 0;
    }

    return (
      hour * 60 +
      Number.parseInt(
        twelve[2],
        10
      )
    );
  }

  const plain =
    /^(\d{1,2}):(\d{2})$/.exec(
      time
    );

  return plain
    ? Number.parseInt(
        plain[1],
        10
      ) *
        60 +
        Number.parseInt(
          plain[2],
          10
        )
    : 0;
}

function normaliseRiskLevel(
  raw: string
): RiskLevel {
  const value =
    raw.toLowerCase();

  return value.startsWith("high")
    ? "High"
    : value.startsWith("moderate")
    ? "Moderate"
    : "Low";
}

function playAlarm(): () => void {
  if (
    typeof window === "undefined"
  ) {
    return () => {};
  }

  const audio =
    globalThis as unknown as {
      AudioContext?:
        typeof AudioContext;
      webkitAudioContext?:
        typeof AudioContext;
    };

  const Constructor =
    audio.AudioContext ??
    audio.webkitAudioContext;

  if (!Constructor) {
    return () => {};
  }

  const context =
    new Constructor();

  let stopped = false;

  function beep(start: number) {
    if (stopped) return;

    const oscillator =
      context.createOscillator();

    const gain =
      context.createGain();

    oscillator.connect(gain);
    gain.connect(
      context.destination
    );

    oscillator.frequency.value =
      880;

    oscillator.type = "sine";

    gain.gain.setValueAtTime(
      0.4,
      start
    );

    gain.gain.exponentialRampToValueAtTime(
      0.001,
      start + 0.5
    );

    oscillator.start(start);
    oscillator.stop(start + 0.5);
  }

  let time =
    context.currentTime;

  for (
    let i = 0;
    i < 10;
    i++
  ) {
    beep(time);
    time += 0.7;
  }

  return () => {
    stopped = true;
    context
      .close()
      .catch(console.error);
  };
}

const NotificationManager:
  React.FC = () => {
  const [schedule, setSchedule] =
    useState<ScheduleItem[]>([]);

  const [userProfile, setUserProfile] =
    useState<UserProfile | null>(
      null
    );

  const [
    activeNotifications,
    setActiveNotifications,
  ] = useState<
    ActiveNotification[]
  >([]);

  const [
    showFoodModal,
    setShowFoodModal,
  ] = useState(false);

  const [
    currentLogId,
    setCurrentLogId,
  ] = useState<
    string | undefined
  >();

  const [
    memoryLoaded,
    setMemoryLoaded,
  ] = useState(false);

  const {
    data: adherence,
    refetch: refetchAdherence,
  } = useAdherence({
    autoRefetch: true,
    refetchIntervalMs: 60000,
    initialLoad: true,
  });

  const [
    escalationBanner,
    setEscalationBanner,
  ] = useState<
    string | null
  >(null);

  const followUps = useRef(
    new Map<
      string,
      FollowUpState
    >()
  );

  const firedUpcoming =
    useRef(
      new Set<string>()
    );

  const firedDue =
    useRef(
      new Set<string>()
    );

  const firedIntake =
    useRef(
      new Set<string>()
    );

  const alarmStop = useRef<
    (() => void) | null
  >(null);

  const removeNotification =
    useCallback(
      (id: string) => {
        setActiveNotifications(
          (previous) =>
            previous.filter(
              (item) =>
                item.id !== id
            )
        );
      },
      []
    );

  const enqueueNotification =
    useCallback(
      (
        notification:
          ActiveNotification
      ) => {
        setActiveNotifications(
          (previous) => [
            ...previous,
            notification,
          ]
        );

        const duration = [
          "due",
          "followup",
        ].includes(
          notification.type
        )
          ? 15 * 60000
          : 60000;

        setTimeout(
          () =>
            removeNotification(
              notification.id
            ),
          duration
        );
      },
      [removeNotification]
    );

  const handleClose =
    useCallback(
      (id: string) => {
        alarmStop.current?.();
        alarmStop.current = null;

        setActiveNotifications(
          (previous) =>
            previous.filter(
              (item) =>
                item.id !== id
            )
        );
      },
      []
    );

  const removeDue =
    useCallback(
      (logId?: string) => {
        if (!logId) return;

        setActiveNotifications(
          (previous) =>
            previous.filter(
              (item) =>
                !(
                  item.type ===
                    "due" &&
                  item.logId ===
                    logId
                )
            )
        );
      },
      []
    );

  useEffect(() => {
    firedUpcoming.current =
      loadStoredSet(
        STORAGE_KEYS.upcoming
      );

    firedDue.current =
      loadStoredSet(
        STORAGE_KEYS.due
      );

    firedIntake.current =
      loadStoredSet(
        STORAGE_KEYS.intake
      );

    setMemoryLoaded(true);
  }, []);

  const fetchAll =
    useCallback(async () => {
      try {
        const [
          dashboardResponse,
          profileResponse,
        ] = await Promise.all([
          fetch("/api/dashboard"),
          fetch("/api/profile"),
        ]);

        const dashboard =
          await dashboardResponse.json();

        const profile =
          await profileResponse.json();

        if (
          dashboard.success
        ) {
          setSchedule(
            dashboard.data
              .todaySchedule ??
              []
          );
        }

        if (profile.success) {
          setUserProfile({
            condition:
              profile.data
                .condition ??
              "None",
            firstName:
              profile.data
                .firstName,
          });
        }
      } catch (error) {
        console.error(
          "NotificationManager fetchAll error:",
          error
        );
      }
    }, []);

  useEffect(() => {
    void fetchAll();

    const interval =
      setInterval(
        () => void fetchAll(),
        30000
      );

    return () =>
      clearInterval(interval);
  }, [fetchAll]);

  useEffect(() => {
    const adaptive =
      adherence
        ?.adaptiveIntervention;

    if (
      adaptive?.isEscalation &&
      adaptive.escalationMessage
    ) {
      setEscalationBanner(
        adaptive.escalationMessage
      );
    }
  }, [
    adherence
      ?.adaptiveIntervention,
  ]);

  const config =
    adherence
      ?.adaptiveIntervention
      ?.reminderConfig;

  const lead =
    config?.leadTimeMinutes ??
    30;

  const followUpCount =
    config?.followUpCount ??
    1;

  const followUpInterval =
    config
      ?.followUpIntervalMinutes ??
    20;

  useEffect(() => {
    if (!memoryLoaded) return;

    const upcoming = (
      item: ScheduleItem,
      minutes: number,
      current: number
    ) => {
      const key =
        `upcoming-${item.logId}`;

      const before =
        minutes - current;

      if (
        before < lead - 2 ||
        before > lead + 2 ||
        item.status !==
          "Upcoming" ||
        firedUpcoming.current.has(
          key
        )
      ) {
        return;
      }

      firedUpcoming.current.add(
        key
      );

      saveStoredSet(
        STORAGE_KEYS.upcoming,
        firedUpcoming.current
      );

      enqueueNotification({
        id:
          `upcoming-${item.logId}-${item.time}`,
        type: "upcoming",
        medicineName:
          item.name,
        scheduledTime:
          item.time,
        logId: item.logId,
      });
    };

    const due = (
      item: ScheduleItem,
      minutes: number,
      current: number
    ) => {
      const key =
        `due-${item.logId}`;

      const shouldFire =
        Math.abs(
          minutes - current
        ) <= 1 ||
        item.status === "Now";

      if (
        !shouldFire ||
        ![
          "Upcoming",
          "Now",
        ].includes(item.status) ||
        firedDue.current.has(key)
      ) {
        return;
      }

      firedDue.current.add(key);

      saveStoredSet(
        STORAGE_KEYS.due,
        firedDue.current
      );

      alarmStop.current?.();

      alarmStop.current =
        playAlarm();

      enqueueNotification({
        id:
          `due-${item.logId}-${item.time}`,
        type: "due",
        medicineName:
          item.name,
        scheduledTime:
          item.time,
        logId: item.logId,
      });

      if (
        followUpCount > 0 &&
        item.logId
      ) {
        followUps.current.set(
          item.logId,
          {
            logId:
              item.logId,
            count: 0,
            maxCount:
              followUpCount,
            intervalMinutes:
              followUpInterval,
            nextFollowUpAt:
              Date.now() +
              followUpInterval *
                60000,
          }
        );
      }
    };

    const followUp = (
      item: ScheduleItem
    ) => {
      if (
        !item.logId ||
        [
          "Taken",
          "Late",
          "Missed",
          "Wrong Chamber",
        ].includes(item.status)
      ) {
        followUps.current.delete(
          item.logId ?? ""
        );
        return;
      }

      const state =
        followUps.current.get(
          item.logId
        );

      if (
        !state ||
        state.count >=
          state.maxCount ||
        Date.now() <
          state.nextFollowUpAt
      ) {
        return;
      }

      state.count++;

      state.nextFollowUpAt =
        Date.now() +
        state.intervalMinutes *
          60000;

      alarmStop.current?.();

      alarmStop.current =
        playAlarm();

      enqueueNotification({
        id:
          `followup-${item.logId}-${state.count}`,
        type: "followup",
        medicineName:
          item.name,
        scheduledTime:
          item.time,
        logId: item.logId,
      });
    };

    const intake = (
      item: ScheduleItem
    ) => {
      const key =
        `intake-${item.logId}`;

      if (
        ![
          "Taken",
          "Late",
        ].includes(item.status) ||
        firedIntake.current.has(
          key
        )
      ) {
        return;
      }

      firedIntake.current.add(
        key
      );

      saveStoredSet(
        STORAGE_KEYS.intake,
        firedIntake.current
      );

      alarmStop.current?.();
      alarmStop.current = null;

      removeDue(item.logId);

      followUps.current.delete(
        item.logId ?? ""
      );

      enqueueNotification({
        id:
          `intake-${item.logId}-${item.time}`,
        type: "intake",
        medicineName:
          item.name,
        scheduledTime:
          item.time,
        logId: item.logId,
        adherenceRate:
          adherence
            ?.adherenceRate ??
          0,
        riskLevel:
          normaliseRiskLevel(
            adherence
              ?.riskLevel ??
              "Low"
          ),
      });

      setCurrentLogId(
        item.logId
      );

      refetchAdherence().catch(
        console.error
      );
    };

    const check = () => {
      const now = new Date();

      const current =
        now.getHours() * 60 +
        now.getMinutes();

      for (
        const item of schedule
      ) {
        if (!item.logId) {
          continue;
        }

        const minutes =
          timeToMinutes(
            item.time
          );

        upcoming(
          item,
          minutes,
          current
        );

        due(
          item,
          minutes,
          current
        );

        followUp(item);
        intake(item);
      }
    };

    check();

    const interval =
      setInterval(
        check,
        30000
      );

    return () =>
      clearInterval(interval);
  }, [
    schedule,
    adherence,
    lead,
    followUpCount,
    followUpInterval,
    memoryLoaded,
    enqueueNotification,
    removeDue,
    refetchAdherence,
  ]);

  const proceedToFood =
    useCallback(
      (id: string) => {
        handleClose(id);
        setShowFoodModal(true);
      },
      [handleClose]
    );

  const foodComplete =
    useCallback(
      (result: {
        riskLevel: string;
        normalizedScore: number;
      }) => {
        fetch(
          "/api/notifications",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              type:
                "adherence_alert",
              title:
                "Dietary Risk Updated",
              message:
                `Dietary risk: ${result.riskLevel}`,
              riskLevel:
                result.riskLevel,
            }),
          }
        ).catch(console.error);
      },
      []
    );

  const condition =
    userProfile?.condition ??
    "None";

  const showFoodCheck = [
    "Diabetes",
    "Hypertension",
    "Both",
  ].includes(condition);

  return (
    <>
      {escalationBanner && (
        <div className="fixed top-0 left-0 right-0 z-[200] bg-red-600 text-white px-4 py-3 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-lg shrink-0">
              ⚠️
            </span>
            <p className="text-sm font-semibold truncate">
              {escalationBanner}
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setEscalationBanner(
                null
              )
            }
            className="ml-4 shrink-0 text-white/80 hover:text-white text-xl leading-none"
            aria-label="Dismiss escalation banner"
          >
            ×
          </button>
        </div>
      )}

      {activeNotifications.length >
        0 && (
        <div
          className={`fixed right-4 z-150 flex flex-col items-end gap-4 ${
            escalationBanner
              ? "top-16"
              : "top-4"
          }`}
        >
          {activeNotifications.map(
            (notification) => (
              <div
                key={
                  notification.id
                }
                className="w-[min(92vw,20rem)] pointer-events-auto"
              >
                {notification.type ===
                  "upcoming" && (
                  <UpcomingReminderNotification
                    className="w-full"
                    medicineName={
                      notification.medicineName
                    }
                    scheduledTime={
                      notification.scheduledTime
                    }
                    condition={
                      condition
                    }
                    onClose={() =>
                      handleClose(
                        notification.id
                      )
                    }
                  />
                )}

                {[
                  "due",
                  "followup",
                ].includes(
                  notification.type
                ) && (
                  <div className="w-full bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-red-200 dark:border-red-700 overflow-hidden animate-in slide-in-from-right duration-300">
                    <div className="bg-gradient-to-r from-red-500 to-red-600 px-4 py-3 flex items-center justify-between">
                      <span className="text-white font-bold text-sm">
                        {notification.type ===
                        "followup"
                          ? "⏰ Follow-up Reminder"
                          : "Medication Due Now"}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          handleClose(
                            notification.id
                          )
                        }
                        className="text-white/80 hover:text-white"
                        aria-label="Close medication notification"
                      >
                        ×
                      </button>
                    </div>

                    <div className="p-4 space-y-3">
                      <p className="text-gray-800 dark:text-gray-100 font-semibold text-sm">
                        {notification.type ===
                        "followup"
                          ? "This is a follow-up reminder. Please take your medication."
                          : "Take your medication now."}
                      </p>

                      <p className="text-gray-500 dark:text-gray-300 text-sm">
                        <span className="font-semibold text-gray-700 dark:text-gray-100">
                          {
                            notification.medicineName
                          }
                        </span>{" "}
                        — scheduled at{" "}
                        <span className="font-semibold text-gray-700 dark:text-gray-100">
                          {
                            notification.scheduledTime
                          }
                        </span>
                        .
                      </p>
                    </div>
                  </div>
                )}

                {notification.type ===
                  "intake" && (
                  <IntakeConfirmedNotification
                    className="w-full"
                    medicineName={
                      notification.medicineName
                    }
                    adherenceRate={
                      notification.adherenceRate ??
                      0
                    }
                    riskLevel={
                      notification.riskLevel ??
                      "Low"
                    }
                    showFoodMonitoring={
                      showFoodCheck
                    }
                    onClose={() =>
                      handleClose(
                        notification.id
                      )
                    }
                    onProceed={() =>
                      proceedToFood(
                        notification.id
                      )
                    }
                  />
                )}
              </div>
            )
          )}
        </div>
      )}

      {showFoodModal && (
        <FoodMonitoringModal
          isOpen={showFoodModal}
          onClose={() =>
            setShowFoodModal(
              false
            )
          }
          condition={condition}
          medicationLogId={
            currentLogId
          }
          onComplete={
            foodComplete
          }
        />
      )}
    </>
  );
};

export default NotificationManager;