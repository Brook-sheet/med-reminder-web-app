"use client";

import React, { useState } from "react";
import { RotateCcw, AlertTriangle } from "lucide-react";
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

const ConfirmModal: React.FC<ConfirmModalProps> = ({
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
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        </div>
        <p className="text-gray-600 text-sm mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 border-2 border-gray-300 text-gray-700 py-2.5 rounded-xl font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            No, Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 py-2.5 rounded-xl font-semibold text-white transition-colors disabled:opacity-50 ${confirmColor === "red"
                ? "bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
                : "bg-orange-500 hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-700"
              }`}
          >
            {loading ? "Processing..." : `Yes, ${confirmLabel}`}
          </button>
        </div>
      </div>
    </div>
  );
};

const ResetDataCard: React.FC = () => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleReset = async () => {
    setResetting(true);
    try {
      const res = await fetch("/api/profile/reset-data", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setShowConfirm(false);
        setMessage({ type: "success", text: "All your data has been reset. Starting fresh." });
        setTimeout(() => {
          setMessage(null);
          window.location.reload();
        }, 1500);
      } else {
        setShowConfirm(false);
        setMessage({ type: "error", text: data.error || "Reset failed. Please try again." });
      }
    } catch {
      setShowConfirm(false);
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setResetting(false);
    }
  };

  return (
    <>
      <ConfirmModal
        isOpen={showConfirm}
        title="Reset All Data?"
        message="This will clear all your medicines, medication logs, and history so you can start fresh. Your profile information (name, email, etc.) will remain. This cannot be undone from the app."
        confirmLabel="Reset"
        confirmColor="orange"
        onConfirm={handleReset}
        onCancel={() => setShowConfirm(false)}
        loading={resetting}
      />

      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center space-x-2 pb-4 mb-4 border-b border-orange-200 dark:border-orange-700/50">
          <RotateCcw className="h-5 w-5 text-orange-600 dark:text-orange-500" />
          <h2 className="text-lg font-semibold text-orange-700 dark:text-orange-400">Reset Data</h2>
        </div>
        <div>
          {message && (
            <div
              className={`text-sm rounded-lg px-4 py-3 border mb-3 ${message.type === "success"
                  ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-700/50 dark:text-green-300"
                  : "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-700/50 dark:text-red-300"
                }`}
            >
              {message.text}
            </div>
          )}
          <button
            onClick={() => setShowConfirm(true)}
            className="w-full flex items-center justify-center gap-2 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset All Data
          </button>
          <p className="text-xs text-gray-500 mt-3 text-center leading-relaxed">
            Clears all your medicines, medication history, and logs — giving you a clean
            fresh start. Your profile information will not be affected. Use this if you
            want to begin a completely new medication plan.
          </p>
        </div>
      </div>
    </>
  );
};

export default ResetDataCard;
