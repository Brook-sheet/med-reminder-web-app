"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import Toast from "@/components/ui/Toast";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  confirmColor: "red" | "orange";
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

const ConfirmModal: React.FC<
  ConfirmModalProps
> = ({
  isOpen,
  title,
  message,
  confirmLabel,
  confirmColor,
  onConfirm,
  onCancel,
  loading,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        type="button"
        aria-label="Close confirmation dialog"
        onClick={onCancel}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />

      <div className="relative mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>

          <h3 className="text-lg font-bold text-gray-900">
            {title}
          </h3>
        </div>

        <p className="mb-6 text-sm leading-relaxed text-gray-600">
          {message}
        </p>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-xl border-2 border-gray-300 py-2.5 font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            No, Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 rounded-xl py-2.5 font-semibold text-white transition-colors disabled:opacity-50 ${
              confirmColor === "red"
                ? "bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
                : "bg-orange-500 hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-700"
            }`}
          >
            {loading
              ? "Processing..."
              : `Yes, ${confirmLabel}`}
          </button>
        </div>
      </div>
    </div>
  );
};

const ResetDataCard: React.FC = () => {
  const [showConfirm, setShowConfirm] =
    useState(false);

  const [resetting, setResetting] =
    useState(false);

  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleReset = async () => {
    setResetting(true);

    try {
      const response = await fetch(
        "/api/profile/reset-data",
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (data.success) {
        setShowConfirm(false);

        setMessage({
          type: "success",
          text: "All your data has been reset. Starting fresh.",
        });

        setTimeout(() => {
          setMessage(null);
          window.location.reload();
        }, 1500);
      } else {
        setShowConfirm(false);

        setMessage({
          type: "error",
          text:
            data.error ||
            "Unable to reset your data. Please try again.",
        });
      }
    } catch {
      setShowConfirm(false);

      setMessage({
        type: "error",
        text:
          "Unable to reset your data. Please check your connection.",
      });
    } finally {
      setResetting(false);
    }
  };

  return (
    <>
      {message && (
        <Toast
          type={message.type}
          message={message.text}
          onClose={() =>
            setMessage(null)
          }
        />
      )}

      <ConfirmModal
        isOpen={showConfirm}
        title="Reset All Data?"
        message="This will permanently delete all your medicines, medication logs, dashboard stats, and history. Everything will be cleared except your profile information (name, email, etc.). This cannot be undone."
        confirmLabel="Reset"
        confirmColor="red"
        onConfirm={handleReset}
        onCancel={() =>
          setShowConfirm(false)
        }
        loading={resetting}
      />

      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-4 flex items-center space-x-2 border-b border-red-200 pb-4 dark:border-red-700/50">
          <RotateCcw className="h-5 w-5 text-red-600 dark:text-red-500" />

          <h2 className="text-lg font-semibold text-red-700 dark:text-red-400">
            Reset Data
          </h2>
        </div>

        <div>
          <button
            type="button"
            onClick={() =>
              setShowConfirm(true)
            }
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 py-3 font-semibold text-white transition-colors hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
          >
            <RotateCcw className="h-4 w-4" />
            Reset All Data
          </button>

          <p className="mt-3 text-center text-xs leading-relaxed text-gray-500 dark:text-gray-400">
            Permanently deletes all your
            medicines, medication history,
            dashboard logs, and statistics.
            Everything will be cleared—giving
            you a completely fresh start. Only
            your profile information will be
            retained.
          </p>
        </div>
      </div>
    </>
  );
};

export default ResetDataCard;