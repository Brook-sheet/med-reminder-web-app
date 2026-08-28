"use client";

import {
  CheckCircle,
  MessageSquareText,
  Send,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  normalizePhilippineMobileNumber,
} from "@/lib/sms/phone";

type Feedback =
  | {
      type:
        | "success"
        | "error"
        | "info";

      text:
        string;
    }
  | null;

export default function SmsNotificationCard() {
  const [
    visible,
    setVisible,
  ] =
    useState(
      false
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );

  const [
    saving,
    setSaving,
  ] =
    useState(
      false
    );

  const [
    testing,
    setTesting,
  ] =
    useState(
      false
    );

  const [
    phoneNumber,
    setPhoneNumber,
  ] =
    useState(
      ""
    );

  const [
    smsEnabled,
    setSmsEnabled,
  ] =
    useState(
      false
    );

  const [
    consented,
    setConsented,
  ] =
    useState(
      false
    );

  const [
    feedback,
    setFeedback,
  ] =
    useState<Feedback>(
      null
    );

  const loadSettings =
    useCallback(
      async () => {
        try {
          const response =
            await fetch(
              "/api/settings/notifications",
              {
                cache:
                  "no-store",
              }
            );

          /*
           * Patient accounts do not
           * display this family-only card.
           */
          if (
            response.status ===
            403
          ) {
            setVisible(
              false
            );

            return;
          }

          const result =
            await response.json();

          if (
            !response.ok ||
            !result.success
          ) {
            setVisible(
              true
            );

            setFeedback({
              type:
                "error",

              text:
                result.error ||
                "Unable to load SMS settings.",
            });

            return;
          }

          setVisible(
            true
          );

          setPhoneNumber(
            result.data
              .smsPhoneNumber ||
              ""
          );

          setSmsEnabled(
            result.data.sms ===
              true
          );

          setConsented(
            result.data
              .smsConsent ===
              true
          );
        } catch {
          setVisible(
            true
          );

          setFeedback({
            type:
              "error",

            text:
              "Network error while loading SMS settings.",
          });
        } finally {
          setLoading(
            false
          );
        }
      },
      []
    );

  useEffect(
    () => {
      void loadSettings();
    },
    [
      loadSettings,
    ]
  );

  const saveSettings =
    async () => {
      setFeedback(
        null
      );

      const normalized =
        normalizePhilippineMobileNumber(
          phoneNumber
        );

      if (
        !normalized
      ) {
        setFeedback({
          type:
            "error",

          text:
            "Enter a valid Philippine number such as 09171234567.",
        });

        return;
      }

      if (
        smsEnabled &&
        !consented
      ) {
        setFeedback({
          type:
            "error",

          text:
            "Please provide consent before enabling SMS alerts.",
        });

        return;
      }

      setSaving(
        true
      );

      try {
        const response =
          await fetch(
            "/api/settings/notifications",
            {
              method:
                "PUT",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify(
                  {
                    smsPhoneNumber:
                      normalized,

                    sms:
                      smsEnabled,

                    smsConsent:
                      consented,
                  }
                ),
            }
          );

        const result =
          await response.json();

        if (
          !response.ok ||
          !result.success
        ) {
          setFeedback({
            type:
              "error",

            text:
              result.error ||
              "Unable to save SMS settings.",
          });

          return;
        }

        setPhoneNumber(
          result.data
            .smsPhoneNumber
        );

        setSmsEnabled(
          result.data.sms ===
            true
        );

        setConsented(
          result.data
            .smsConsent ===
            true
        );

        setFeedback({
          type:
            "success",

          text:
            "Family SMS settings saved successfully.",
        });
      } catch {
        setFeedback({
          type:
            "error",

          text:
            "Network error while saving SMS settings.",
        });
      } finally {
        setSaving(
          false
        );
      }
    };

  const sendTestSms =
    async () => {
      setFeedback(
        null
      );

      setTesting(
        true
      );

      try {
        const response =
          await fetch(
            "/api/settings/notifications/test-sms",
            {
              method:
                "POST",
            }
          );

        const result =
          await response.json();

        const successful =
          response.ok &&
          result.success;

        setFeedback({
          type:
            successful
              ? "info"
              : "error",

          text:
            result.message ||
            result.error ||
            "Unable to send the test SMS.",
        });
      } catch {
        setFeedback({
          type:
            "error",

          text:
            "Network error while requesting the test SMS.",
        });
      } finally {
        setTesting(
          false
        );
      }
    };

  if (
    !visible
  ) {
    return null;
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-4 flex items-center space-x-2 border-b border-gray-100 pb-4 dark:border-gray-700">
        <MessageSquareText className="h-5 w-5 text-blue-600 dark:text-blue-400" />

        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Family SMS Alerts
        </h2>
      </div>

      {loading ? (
        <div className="h-32 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-700" />
      ) : (
        <div className="space-y-4">
          <div>
            <label
              htmlFor="smsPhoneNumber"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Your Philippine mobile number
            </label>

            <input
              id="smsPhoneNumber"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={
                phoneNumber
              }
              onChange={(
                event
              ) =>
                setPhoneNumber(
                  event
                    .target
                    .value
                )
              }
              placeholder="09171234567"
              disabled={
                saving ||
                testing
              }
              className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />

            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Accepted formats: 0917..., 917..., or +63917.... It will be saved as +63 E.164.
            </p>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-600">
            <input
              type="checkbox"
              checked={
                consented
              }
              onChange={(
                event
              ) => {
                const checked =
                  event
                    .target
                    .checked;

                setConsented(
                  checked
                );

                if (
                  !checked
                ) {
                  setSmsEnabled(
                    false
                  );
                }
              }}
              disabled={
                saving ||
                testing
              }
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600"
            />

            <span>
              <span className="block text-sm font-medium text-gray-800 dark:text-gray-200">
                I consent to receive medication SMS alerts
              </span>

              <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                Messages may appear on the phone lock screen. You can revoke consent anytime.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-center justify-between rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
            <span>
              <span className="block text-sm font-medium text-blue-800 dark:text-blue-200">
                Enable SMS alerts
              </span>

              <span className="block text-xs text-blue-600 dark:text-blue-300">
                Receive taken, late, and missed medication updates for approved patients.
              </span>
            </span>

            <input
              type="checkbox"
              checked={
                smsEnabled
              }
              onChange={(
                event
              ) =>
                setSmsEnabled(
                  event
                    .target
                    .checked
                )
              }
              disabled={
                saving ||
                testing ||
                !consented
              }
              className="h-5 w-5 rounded border-blue-300 text-blue-600 disabled:opacity-40"
            />
          </label>

          {feedback && (
            <div
              className={`rounded-lg border px-3 py-2 text-xs ${
                feedback.type ===
                "error"
                  ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
                  : feedback.type ===
                      "success"
                    ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300"
                    : "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300"
              }`}
            >
              {
                feedback.text
              }
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={
                saveSettings
              }
              disabled={
                saving ||
                testing
              }
              className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              <CheckCircle className="h-4 w-4" />

              {saving
                ? "Saving..."
                : "Save SMS Settings"}
            </button>

            <button
              type="button"
              onClick={
                sendTestSms
              }
              disabled={
                saving ||
                testing ||
                !smsEnabled ||
                !consented
              }
              className="flex items-center justify-center gap-2 rounded-lg border border-blue-600 px-4 py-2.5 text-sm font-semibold text-blue-600 transition hover:bg-blue-50 disabled:opacity-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
            >
              <Send className="h-4 w-4" />

              {testing
                ? "Requesting..."
                : "Send Test SMS"}
            </button>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            A queued result means TextBee accepted the request. Always verify that the physical phone received the SMS.
          </p>
        </div>
      )}
    </div>
  );
}