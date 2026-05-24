"use client";

import React, { useState } from "react";
import { X, Eye, EyeOff, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UpdatePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FieldErrors {
  newPassword?: string;
  confirmPassword?: string;
}

const UpdatePasswordModal: React.FC<UpdatePasswordModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const resetState = () => {
    setNewPassword("");
    setConfirmPassword("");
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setFieldErrors({});
    setApiError("");
    setSuccessMessage("");
    setSaving(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const validateFields = (): boolean => {
    const errors: FieldErrors = {};

    if (!newPassword) {
      errors.newPassword = "New password is required.";
    }

    if (!confirmPassword) {
      errors.confirmPassword = "Please confirm your new password.";
    } else if (newPassword && confirmPassword !== newPassword) {
      errors.confirmPassword = "Passwords do not match.";
    }

    // Additional strength validation
    const hasLetter = /[a-zA-Z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasSymbol = /[^a-zA-Z0-9]/.test(newPassword);
    const len = newPassword.length;

    if (!errors.newPassword) {
      if (len < 6) {
        errors.newPassword = "Password must be at least 6 characters.";
      } else if (!hasLetter || !hasNumber) {
        errors.newPassword = "Password must contain at least one letter and one number.";
      } else {
        // Determine strength and reject Weak
        if (len >= 12 && hasLetter && hasNumber && hasSymbol) {
          // Strong - ok
        } else if (len >= 10 && hasLetter && hasNumber) {
          // Good - ok
        } else if (len >= 6 && hasLetter && hasNumber) {
          // Fair - ok
        } else {
          errors.newPassword = "Password is too weak. Make sure it has letters and numbers and is at least 6 characters.";
        }
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError("");
    setSuccessMessage("");

    if (!validateFields()) return;

    setSaving(true);
    try {
      const res = await fetch("/api/profile/update-password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword, confirmPassword }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setApiError(data.error || "Failed to update password. Please try again.");
        return;
      }

      setSuccessMessage("Password updated successfully.");
      setNewPassword("");
      setConfirmPassword("");
      setFieldErrors({});

      // Auto-close after 2 seconds on success
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch {
      setApiError("Network error. Please check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const getPasswordStrength = (): { label: string; color: string; width: string } | null => {
    if (!newPassword) return null;

    const hasLetter = /[a-zA-Z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasSymbol = /[^a-zA-Z0-9]/.test(newPassword);
    const len = newPassword.length;

    if (len < 6 || !hasLetter || !hasNumber) return { label: "Weak", color: "bg-red-400", width: "w-1/4" };
    if (len >= 12 && hasLetter && hasNumber && hasSymbol) return { label: "Strong", color: "bg-green-500", width: "w-full" };
    if (len >= 10 && hasLetter && hasNumber) return { label: "Good", color: "bg-blue-500", width: "w-3/4" };
    return { label: "Fair", color: "bg-yellow-400", width: "w-2/4" };
  };

  const strength = getPasswordStrength();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Update Password
            </h2>
          </div>
          <button
            onClick={handleClose}
            disabled={saving}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Success message */}
          {successMessage && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-sm rounded-lg px-4 py-3">
              {successMessage}
            </div>
          )}

          {/* API error */}
          {apiError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded-lg px-4 py-3">
              {apiError}
            </div>
          )}

          {/* New Password */}
          <div className="space-y-1.5">
            <label
              htmlFor="newPassword"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              New Password
            </label>
            <div className="relative">
              <input
                id="newPassword"
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (fieldErrors.newPassword) {
                    setFieldErrors((prev) => ({ ...prev, newPassword: undefined }));
                  }
                  setApiError("");
                }}
                disabled={saving || !!successMessage}
                placeholder="Enter new password"
                className={`w-full h-10 rounded-lg border pr-10 px-3 text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                  ${fieldErrors.newPassword
                    ? "border-red-400 dark:border-red-600 focus:border-red-400 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900"
                    : "border-gray-300 dark:border-gray-600 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900"
                  }`}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((v) => !v)}
                disabled={saving || !!successMessage}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50"
                tabIndex={-1}
              >
                {showNewPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Password strength indicator */}
            {newPassword && strength && (
              <div className="space-y-1">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-300 ${strength.color} ${strength.width}`}
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Strength: <span className="font-medium">{strength.label}</span>
                </p>
              </div>
            )}

            {fieldErrors.newPassword && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {fieldErrors.newPassword}
              </p>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Confirm New Password
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (fieldErrors.confirmPassword) {
                    setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                  }
                  setApiError("");
                }}
                disabled={saving || !!successMessage}
                placeholder="Confirm new password"
                className={`w-full h-10 rounded-lg border pr-10 px-3 text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                  ${fieldErrors.confirmPassword
                    ? "border-red-400 dark:border-red-600 focus:border-red-400 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900"
                    : "border-gray-300 dark:border-gray-600 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900"
                  }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                disabled={saving || !!successMessage}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50"
                tabIndex={-1}
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Match indicator */}
            {confirmPassword && newPassword && (
              <p
                className={`text-xs ${
                  confirmPassword === newPassword
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-500 dark:text-red-400"
                }`}
              >
                {confirmPassword === newPassword ? "Passwords match." : "Passwords do not match."}
              </p>
            )}

            {fieldErrors.confirmPassword && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {fieldErrors.confirmPassword}
              </p>
            )}
          </div>

          {/* Password requirements hint */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg px-4 py-3 border border-gray-200 dark:border-gray-700">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Password requirements:
            </p>
            <ul className="space-y-0.5">
              {[
                { label: "At least 6 characters", met: newPassword.length >= 6 },
                { label: "Contains a letter", met: /[a-zA-Z]/.test(newPassword) },
                { label: "Contains a number", met: /[0-9]/.test(newPassword) },
              ].map(({ label, met }) => (
                <li
                  key={label}
                  className={`text-xs flex items-center gap-1.5 ${
                    newPassword
                      ? met
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-500 dark:text-red-400"
                      : "text-gray-500 dark:text-gray-400"
                  }`}
                >
                  <span className="font-bold">{newPassword ? (met ? "+" : "-") : "-"}</span>
                  {label}
                </li>
              ))}
            </ul>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={handleClose}
              disabled={saving}
              className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <Button
              type="submit"
              disabled={saving || !!successMessage}
              className="flex-1"
            >
              {saving ? "Updating..." : "Update Password"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UpdatePasswordModal;