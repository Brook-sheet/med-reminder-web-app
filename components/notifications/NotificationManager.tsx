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
  reminderConfig:
    AdaptiveReminderConfig;

  behavioralPattern:
    AdaptiveBehavioralPattern;

  isEscalation: boolean;
  escalationMessage: string | null;
  motivationalMessage: string;
  keySignals: string[];
  interventionSummary: string;
}

interface AdherenceData {
  adherenceRate: number;
  riskLevel: RiskLevel;
  adaptiveIntervention:
    AdaptiveIntervention;
}

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
  upcoming:
    "notif-upcoming-fired",

  due:
    "notif-due-fired",

  intake:
    "notif-intake-fired",

  peakNudge:
    "notif-peak-nudge-fired",
};

function loadStoredSet(
  key: string,
): Set<string> {
  if (
    typeof window ===
    "undefined"
  ) {
    return new Set();
  }

  try {
    const raw =
      localStorage.getItem(key);

    if (!raw) {
      return new Set();
    }

    return new Set(
      JSON.parse(raw),
    );
  } catch {
    return new Set();
  }
}

function saveStoredSet(
  key: string,
  value: Set<string>,
): void {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  try {
    localStorage.setItem(
      key,
      JSON.stringify(
        Array.from(value),
      ),
    );
  } catch (error) {
    console.error(
      "Failed to save notification state:",
      error,
    );
  }
}

function timeToMinutes(
  timeString: string,
): number {
  const twelveHour =
    /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(
      timeString,
    );

  if (twelveHour) {
    let hour =
      Number.parseInt(
        twelveHour[1],
        10,
      );

    const minute =
      Number.parseInt(
        twelveHour[2],
        10,
      );

    if (
      twelveHour[3].toUpperCase() ===
        "PM" &&
      hour !== 12
    ) {
      hour += 12;
    }

    if (
      twelveHour[3].toUpperCase() ===
        "AM" &&
      hour === 12
    ) {
      hour = 0;
    }

    return (
      hour * 60 +
      minute
    );
  }

  const plain =
    /^(\d{1,2}):(\d{2})$/.exec(
      timeString,
    );

  if (plain) {
    return (
      Number.parseInt(
        plain[1],
        10,
      ) *
        60 +
      Number.parseInt(
        plain[2],
        10,
      )
    );
  }

  return 0;
}

function getCurrentMinutes(): number {
  const now =
    new Date();

  return (
    now.getHours() *
      60 +
    now.getMinutes()
  );
}

function normaliseRiskLevel(
  raw: string,
): RiskLevel {
  const lower =
    raw.toLowerCase();

  if (
    lower.startsWith(
      "high",
    )
  ) {
    return "High";
  }

  if (
    lower.startsWith(
      "moderate",
    )
  ) {
    return "Moderate";
  }

  return "Low";
}

function playAlarm(): () => void {
  if (
    typeof window ===
    "undefined"
  ) {
    return () => {};
  }

  const audioGlobal =
    globalThis as unknown as {
      AudioContext?:
        typeof AudioContext;

      webkitAudioContext?:
        typeof AudioContext;
    };

  const AudioContextConstructor =
    audioGlobal.AudioContext ??
    audioGlobal.webkitAudioContext;

  if (!AudioContextConstructor) {
    return () => {};
  }

  const context =
    new AudioContextConstructor();

  let stopped =
    false;

  function beep(
    startTime: number,
  ): void {
    if (stopped) return;

    const oscillator =
      context.createOscillator();

    const gain =
      context.createGain();

    oscillator.connect(
      gain,
    );

    gain.connect(
      context.destination,
    );

    oscillator.frequency.value =
      880;

    oscillator.type =
      "sine";

    gain.gain.setValueAtTime(
      0.4,
      startTime,
    );

    gain.gain.exponentialRampToValueAtTime(
      0.001,
      startTime + 0.5,
    );

    oscillator.start(
      startTime,
    );

    oscillator.stop(
      startTime + 0.5,
    );
  }

  let time =
    context.currentTime;

  for (
    let index = 0;
    index < 10;
    index += 1
  ) {
    beep(time);
    time += 0.7;
  }

  return () => {
    stopped = true;

    context.close().catch(
      console.error,
    );
  };
}

async function sendBrowserPush(
  title: string,
  body: string,
): Promise<void> {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  if (
    !(
      "Notification" in
      window
    )
  ) {
    return;
  }

  if (
    Notification.permission ===
    "denied"
  ) {
    return;
  }

  if (
    Notification.permission !==
    "granted"
  ) {
    await Notification.requestPermission();
  }

  if (
    Notification.permission ===
    "granted"
  ) {
    new Notification(
      title,
      {
        body,
        icon:
          "/favicon.ico",

        tag:
          `med-${Date.now()}`,
      },
    );
  }
}

async function saveNotificationToDB(
  params: {
    type: string;
    title: string;
    message: string;
    medicineName?: string;
    riskLevel?: string;
    adherenceRate?: number;
  },
): Promise<void> {
  try {
    await fetch(
      "/api/notifications",
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify(
            params,
          ),
      },
    );
  } catch (error) {
    console.error(
      "Failed to save notification:",
      error,
    );
  }
}

const NotificationManager:
  React.FC = () => {
    const [
      schedule,
      setSchedule,
    ] =
      useState<ScheduleItem[]>(
        [],
      );

    const [
      userProfile,
      setUserProfile,
    ] =
      useState<UserProfile | null>(
        null,
      );

    const [
      activeNotifications,
      setActiveNotifications,
    ] =
      useState<
        ActiveNotification[]
      >([]);

    const [
      showFoodModal,
      setShowFoodModal,
    ] =
      useState(false);

    const [
      currentLogId,
      setCurrentLogId,
    ] =
      useState<
        string | undefined
      >();

    const [
      notificationMemoryLoaded,
      setNotificationMemoryLoaded,
    ] =
      useState(false);

    const {
      data:
        adherenceData,

      refetch:
        refetchAdherence,
    } = useAdherence({
      autoRefetch:
        true,

      refetchIntervalMs:
        60_000,

      initialLoad:
        true,
    });

    const adherence =
      adherenceData
        ? {
            adherenceRate:
              adherenceData.adherenceRate,

            riskLevel:
              normaliseRiskLevel(
                adherenceData.riskLevel,
              ),

            adaptiveIntervention:
              adherenceData.adaptiveIntervention,
          }
        : null;

    const [
      escalationBanner,
      setEscalationBanner,
    ] =
      useState<string | null>(
        null,
      );

    const followUpMap =
      useRef<
        Map<
          string,
          FollowUpState
        >
      >(
        new Map(),
      );

    const firedUpcoming =
      useRef<Set<string>>(
        new Set(),
      );

    const firedDue =
      useRef<Set<string>>(
        new Set(),
      );

    const firedIntake =
      useRef<Set<string>>(
        new Set(),
      );

    const firedPeakNudge =
      useRef<Set<string>>(
        new Set(),
      );

    const alarmStopRef =
      useRef<
        (() => void) | null
      >(
        null,
      );

    const removeNotification =
      useCallback(
        (id: string): void => {
          setActiveNotifications(
            (previous) =>
              previous.filter(
                (item) =>
                  item.id !== id,
              ),
          );
        },
        [],
      );

    const removeDueNotificationsByLogId =
      useCallback(
        (
          logId?: string,
        ): void => {
          if (!logId) return;

          setActiveNotifications(
            (previous) =>
              previous.filter(
                (active) =>
                  !(
                    active.type ===
                      "due" &&
                    active.logId ===
                      logId
                  ),
              ),
          );
        },
        [],
      );

    const enqueueNotification =
      useCallback(
        (
          notification:
            ActiveNotification,
        ): void => {
          setActiveNotifications(
            (previous) => [
              ...previous,
              notification,
            ],
          );

          const duration =
            notification.type ===
              "due" ||
            notification.type ===
              "followup"
              ? 15 * 60 * 1000
              : 60 * 1000;

          setTimeout(
            () =>
              removeNotification(
                notification.id,
              ),
            duration,
          );
        },
        [
          removeNotification,
        ],
      );

    const handleClose =
      useCallback(
        (id: string): void => {
          if (
            alarmStopRef.current
          ) {
            alarmStopRef.current();

            alarmStopRef.current =
              null;
          }

          setActiveNotifications(
            (previous) =>
              previous.filter(
                (item) =>
                  item.id !== id,
              ),
          );
        },
        [],
      );

    useEffect(() => {
      firedUpcoming.current =
        loadStoredSet(
          STORAGE_KEYS.upcoming,
        );

      firedDue.current =
        loadStoredSet(
          STORAGE_KEYS.due,
        );

      firedIntake.current =
        loadStoredSet(
          STORAGE_KEYS.intake,
        );

      firedPeakNudge.current =
        loadStoredSet(
          STORAGE_KEYS.peakNudge,
        );

      setNotificationMemoryLoaded(
        true,
      );
    }, []);

    const adherenceFetchedRef =
      useRef(false);

    const fetchAll =
      useCallback(async () => {
        try {
          const [
            dashboardResponse,
            profileResponse,
          ] =
            await Promise.all([
              fetch(
                "/api/dashboard",
              ),

              fetch(
                "/api/profile",
              ),
            ]);

          const dashboardData =
            await dashboardResponse.json();

          const profileData =
            await profileResponse.json();

          if (
            dashboardData.success
          ) {
            setSchedule(
              dashboardData.data
                .todaySchedule ??
                [],
            );
          }

          if (
            profileData.success
          ) {
            setUserProfile({
              condition:
                profileData.data
                  .condition ??
                "None",

              firstName:
                profileData.data
                  .firstName,
            });
          }
        } catch (error) {
          console.error(
            "NotificationManager fetchAll error:",
            error,
          );
        }
      }, []);

    useEffect(() => {
      fetchAll().catch(
        console.error,
      );

      const interval =
        setInterval(
          () => {
            fetchAll().catch(
              console.error,
            );
          },
          30_000,
        );

      return () =>
        clearInterval(
          interval,
        );
    }, [
      fetchAll,
    ]);

    useEffect(() => {
      if (
        !adherence
          ?.adaptiveIntervention
      ) {
        return;
      }

      const escalation =
        adherence
          .adaptiveIntervention
          .escalationMessage;

      if (
        escalation &&
        adherence
          .adaptiveIntervention
          .isEscalation
      ) {
        setEscalationBanner(
          escalation,
        );
      }
    }, [
      adherence
        ?.adaptiveIntervention,
    ]);

    useEffect(() => {
      if (
        typeof window ===
        "undefined"
      ) {
        return;
      }

      if (
        !(
          "Notification" in
          window
        )
      ) {
        return;
      }

      if (
        Notification.permission ===
        "default"
      ) {
        Notification.requestPermission().catch(
          console.error,
        );
      }
    }, []);

    const adaptiveConfig =
      adherence
        ?.adaptiveIntervention
        ?.reminderConfig;

    const leadTimeMinutes =
      adaptiveConfig
        ?.leadTimeMinutes ??
      30;

    const followUpCount =
      adaptiveConfig
        ?.followUpCount ??
      1;

    const followUpIntervalMinutes =
      adaptiveConfig
        ?.followUpIntervalMinutes ??
      20;

    const peakMissHour =
      adherence
        ?.adaptiveIntervention
        ?.behavioralPattern
        ?.peakMissHour ??
      null;

    useEffect(() => {
      if (
        !notificationMemoryLoaded
      ) {
        return;
      }

      const processUpcoming = (
        item: ScheduleItem,
        scheduledMinutes: number,
        currentMinutes: number,
      ): void => {
        const upcomingKey =
          `upcoming-${item.logId}`;

        const minutesBefore =
          scheduledMinutes -
          currentMinutes;

        const buffer =
          2;

        if (
          minutesBefore >=
            leadTimeMinutes -
              buffer &&
          minutesBefore <=
            leadTimeMinutes +
              buffer &&
          item.status ===
            "Upcoming" &&
          !firedUpcoming.current.has(
            upcomingKey,
          )
        ) {
          firedUpcoming.current.add(
            upcomingKey,
          );

          saveStoredSet(
            STORAGE_KEYS.upcoming,
            firedUpcoming.current,
          );

          enqueueNotification({
            id:
              `upcoming-${item.logId}-${item.time}`,

            type:
              "upcoming",

            medicineName:
              item.name,

            scheduledTime:
              item.time,

            logId:
              item.logId,
          });

          saveNotificationToDB({
            type:
              "upcoming_reminder",

            title:
              "Upcoming Medication Reminder",

            message:
              `${item.name} is scheduled at ${item.time} — ${leadTimeMinutes} minutes away.`,

            medicineName:
              item.name,
          }).catch(
            console.error,
          );

          sendBrowserPush(
            "Upcoming Medication Reminder",
            `${item.name} is due at ${item.time} — ${leadTimeMinutes} minutes away.`,
          ).catch(
            console.error,
          );
        }
      };

      const processDue = (
        item: ScheduleItem,
        scheduledMinutes: number,
        currentMinutes: number,
      ): void => {
        const dueKey =
          `due-${item.logId}`;

        const differenceAtDue =
          Math.abs(
            scheduledMinutes -
            currentMinutes,
          );

        const shouldFireDue =
          differenceAtDue <= 1 ||
          item.status === "Now";

        if (
          shouldFireDue &&
          [
            "Upcoming",
            "Now",
          ].includes(
            item.status,
          ) &&
          !firedDue.current.has(
            dueKey,
          )
        ) {
          firedDue.current.add(
            dueKey,
          );

          saveStoredSet(
            STORAGE_KEYS.due,
            firedDue.current,
          );

          if (
            alarmStopRef.current
          ) {
            alarmStopRef.current();
          }

          alarmStopRef.current =
            playAlarm();

          fetch(
            "/api/hardware/alarm",
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  alarmIndex:
                    schedule.indexOf(
                      item,
                    ),
                }),
            },
          ).catch(
            console.error,
          );

          enqueueNotification({
            id:
              `due-${item.logId}-${item.time}`,

            type:
              "due",

            medicineName:
              item.name,

            scheduledTime:
              item.time,

            logId:
              item.logId,
          });

          saveNotificationToDB({
            type:
              "due_alarm",

            title:
              "Time to Take Your Medication",

            message:
              `It's time to take ${item.name} — Scheduled at ${item.time}.`,

            medicineName:
              item.name,
          }).catch(
            console.error,
          );

          sendBrowserPush(
            "Medication Due Now",
            `It's time to take ${item.name} — Scheduled at ${item.time}.`,
          ).catch(
            console.error,
          );

          if (
            followUpCount > 0 &&
            item.logId
          ) {
            followUpMap.current.set(
              item.logId,
              {
                logId:
                  item.logId,

                count:
                  0,

                maxCount:
                  followUpCount,

                intervalMinutes:
                  followUpIntervalMinutes,

                nextFollowUpAt:
                  Date.now() +
                  followUpIntervalMinutes *
                    60 *
                    1000,
              },
            );
          }
        }
      };

      const processFollowUps = (
        item: ScheduleItem,
      ): void => {
        const finalStatuses = [
          "Taken",
          "Late",
          "Missed",
          "Wrong Chamber",
        ];

        if (
          !item.logId ||
          finalStatuses.includes(
            item.status,
          )
        ) {
          followUpMap.current.delete(
            item.logId ?? "",
          );

          return;
        }

        const state =
          followUpMap.current.get(
            item.logId,
          );

        if (!state) return;

        if (
          state.count >=
          state.maxCount
        ) {
          return;
        }

        if (
          Date.now() <
          state.nextFollowUpAt
        ) {
          return;
        }

        state.count += 1;

        state.nextFollowUpAt =
          Date.now() +
          state.intervalMinutes *
            60 *
            1000;

        if (
          alarmStopRef.current
        ) {
          alarmStopRef.current();
        }

        alarmStopRef.current =
          playAlarm();

        const followUpId =
          `followup-${item.logId}-${state.count}`;

        enqueueNotification({
          id:
            followUpId,

          type:
            "followup",

          medicineName:
            item.name,

          scheduledTime:
            item.time,

          logId:
            item.logId,
        });

        saveNotificationToDB({
          type:
            "due_alarm",

          title:
            `Follow-up Reminder (${state.count}/${state.maxCount})`,

          message:
            `${item.name} still hasn't been confirmed. Please take your medication now.`,

          medicineName:
            item.name,
        }).catch(
          console.error,
        );

        sendBrowserPush(
          `Follow-up Reminder (${state.count}/${state.maxCount})`,
          `${item.name} is still pending. Please take your medication.`,
        ).catch(
          console.error,
        );
      };

      const processIntake = (
        item: ScheduleItem,
      ): void => {
        const intakeKey =
          `intake-${item.logId}`;

        if (
          (
            item.status ===
              "Taken" ||
            item.status ===
              "Late"
          ) &&
          !firedIntake.current.has(
            intakeKey,
          )
        ) {
          firedIntake.current.add(
            intakeKey,
          );

          saveStoredSet(
            STORAGE_KEYS.intake,
            firedIntake.current,
          );

          if (
            alarmStopRef.current
          ) {
            alarmStopRef.current();

            alarmStopRef.current =
              null;
          }

          removeDueNotificationsByLogId(
            item.logId,
          );

          followUpMap.current.delete(
            item.logId ?? "",
          );

          fetch(
            "/api/hardware/alarm",
            {
              method:
                "DELETE",
            },
          ).catch(
            console.error,
          );

          const rate =
            adherence
              ?.adherenceRate ??
            0;

          const risk =
            adherence
              ?.riskLevel ??
            "Low";

          enqueueNotification({
            id:
              `intake-${item.logId}-${item.time}`,

            type:
              "intake",

            medicineName:
              item.name,

            scheduledTime:
              item.time,

            logId:
              item.logId,

            adherenceRate:
              rate,

            riskLevel:
              risk,
          });

          setCurrentLogId(
            item.logId,
          );

          refetchAdherence().catch(
            console.error,
          );

          saveNotificationToDB({
            type:
              "intake_confirmed",

            title:
              "Medication Intake Confirmed",

            message:
              `${item.name} intake confirmed.`,

            medicineName:
              item.name,

            riskLevel:
              risk,

            adherenceRate:
              rate,
          }).catch(
            console.error,
          );

          sendBrowserPush(
            "Medication Confirmed",
            `${item.name} intake recorded successfully.`,
          ).catch(
            console.error,
          );
        }
      };

      const processPeakNudge =
        (): void => {
          if (
            peakMissHour ===
            null
          ) {
            return;
          }

          const now =
            new Date();

          const currentHour =
            now.getHours();

          const todayKey =
            `peak-nudge-${new Date()
              .toISOString()
              .split("T")[0]}`;

          if (
            currentHour ===
              peakMissHour -
                1 &&
            !firedPeakNudge.current.has(
              todayKey,
            )
          ) {
            firedPeakNudge.current.add(
              todayKey,
            );

            saveStoredSet(
              STORAGE_KEYS.peakNudge,
              firedPeakNudge.current,
            );

            const peakTime =
              `${peakMissHour > 12
                ? peakMissHour - 12
                : peakMissHour}:00 ${
                peakMissHour >= 12
                  ? "PM"
                  : "AM"
              }`;

            saveNotificationToDB({
              type:
                "upcoming_reminder",

              title:
                "Heads-up: You tend to miss doses around this time",

              message:
                `Based on your history, you often miss doses around ${peakTime}. Be ready!`,
            }).catch(
              console.error,
            );

            sendBrowserPush(
              "Proactive Reminder",
              `You tend to miss doses around ${peakTime}. Be prepared!`,
            ).catch(
              console.error,
            );
          }
        };

      const check =
        (): void => {
          const currentMinutes =
            getCurrentMinutes();

          for (
            const item of
            schedule
          ) {
            if (!item.logId) {
              continue;
            }

            const scheduledMinutes =
              timeToMinutes(
                item.time,
              );

            processUpcoming(
              item,
              scheduledMinutes,
              currentMinutes,
            );

            processDue(
              item,
              scheduledMinutes,
              currentMinutes,
            );

            processFollowUps(
              item,
            );

            processIntake(
              item,
            );
          }

          processPeakNudge();
        };

      check();

      const interval =
        setInterval(
          check,
          30_000,
        );

      return () =>
        clearInterval(
          interval,
        );
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

    const handleProceedToFood =
      useCallback(
        (id: string): void => {
          handleClose(id);

          setShowFoodModal(
            true,
          );
        },
        [
          handleClose,
        ],
      );

    const handleFoodComplete =
      useCallback(
        (
          result: {
            riskLevel: string;
            normalizedScore: number;
          },
        ): void => {
          saveNotificationToDB({
            type:
              "adherence_alert",

            title:
              "Dietary Risk Updated",

            message:
              `Dietary risk: ${result.riskLevel}`,

            riskLevel:
              result.riskLevel,
          }).catch(
            console.error,
          );
        },
        [],
      );

    const condition =
      userProfile?.condition ??
      "None";

    const showFoodCheck =
      [
        "Diabetes",
        "Hypertension",
        "Both",
      ].includes(
        condition,
      );

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
              onClick={() =>
                setEscalationBanner(
                  null,
                )
              }
              className="ml-4 shrink-0 text-white/80 hover:text-white text-xl leading-none"
              aria-label="Dismiss escalation banner"
            >
              ×
            </button>
          </div>
        )}

        {activeNotifications.length > 0 && (
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
                  key={notification.id}
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
                          notification.id,
                        )
                      }
                    />
                  )}

                  {(notification.type ===
                    "due" ||
                    notification.type ===
                      "followup") && (
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
                              notification.id,
                            )
                          }
                          className="text-white/80 hover:text-white"
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
                          notification.id,
                        )
                      }
                      onProceed={() =>
                        handleProceedToFood(
                          notification.id,
                        )
                      }
                    />
                  )}
                </div>
              ),
            )}
          </div>
        )}

        {showFoodModal && (
          <FoodMonitoringModal
            isOpen={
              showFoodModal
            }
            onClose={() =>
              setShowFoodModal(
                false,
              )
            }
            condition={
              condition
            }
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