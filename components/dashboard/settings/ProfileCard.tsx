"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Toast from "@/components/ui/Toast";
import { User, RotateCcw, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";

const CONDITIONS = [
  { value: "", label: "Not specified" },
  { value: "Diabetes", label: "Diabetes" },
  { value: "Hypertension", label: "Hypertension" },
  { value: "Both", label: "Both (Diabetes & Hypertension)" },
  { value: "Other", label: "Other" },
  { value: "None", label: "None" },
];

// ── Reusable Confirmation Modal ───────────────────────────────────────────────
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
            className={`flex-1 py-2.5 rounded-xl font-semibold text-white transition-colors disabled:opacity-50 ${
              confirmColor === "red"
                ? "bg-red-600 hover:bg-red-700"
                : "bg-orange-500 hover:bg-orange-600"
            }`}
          >
            {loading ? "Processing..." : `Yes, ${confirmLabel}`}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main ProfileCard ──────────────────────────────────────────────────────────
const ProfileCard = () => {
  const router = useRouter();

  // Profile state
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [patientId, setPatientId] = useState("");
  const [email, setEmail] = useState("");
  const [condition, setCondition] = useState("");
  const [age, setAge] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Toast state for condition updates
  const [showConditionToast, setShowConditionToast] = useState(false);
  const [conditionToastMessage, setConditionToastMessage] = useState("");
  const [previousCondition, setPreviousCondition] = useState("");

  // Modal states
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/profile");
      const data = await res.json();
      if (data.success) {
        setFirstName(data.data.firstName || "");
        setMiddleName(data.data.middleName || "");
        setLastName(data.data.lastName || "");
        setPatientId(data.data.patientId || "");
        setEmail(data.data.email || "");
        setCondition(data.data.condition || "");
        setPreviousCondition(data.data.condition || "");
        setAge(data.data.age != null ? String(data.data.age) : "");
      }
    } catch (err) {
      console.error("Failed to fetch profile:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // ── Save Profile ────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          middleName,
          lastName,
          patientId,
          email,
          condition,
          age: age !== "" ? Number(age) : null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: "success", text: "Profile updated successfully!" });
        
        // Show toast notification if condition (user type) was changed
        if (condition !== previousCondition) {
          const conditionLabel = CONDITIONS.find(c => c.value === condition)?.label || condition;
          setConditionToastMessage(`Your medical condition has been updated to: ${conditionLabel}`);
          setShowConditionToast(true);
          setPreviousCondition(condition);
        }
      } else {
        setMessage({ type: "error", text: data.error || "Failed to update profile." });
      }
    } catch {
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  // ── Reset Data ──────────────────────────────────────────────────────────────
  const handleResetData = async () => {
    setResetting(true);
    try {
      const res = await fetch("/api/profile/reset-data", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setShowResetConfirm(false);
        setMessage({ type: "success", text: "All your data has been reset. Starting fresh!" });
        setTimeout(() => {
          setMessage(null);
          router.refresh();
        }, 2000);
      } else {
        setShowResetConfirm(false);
        setMessage({ type: "error", text: data.error || "Reset failed. Please try again." });
      }
    } catch {
      setShowResetConfirm(false);
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setResetting(false);
    }
  };

  // ── Delete Account ──────────────────────────────────────────────────────────
  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/profile/delete-account", { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setShowDeleteConfirm(false);
        router.push("/sign-in");
        router.refresh();
      } else {
        setShowDeleteConfirm(false);
        setMessage({ type: "error", text: data.error || "Deletion failed. Please try again." });
      }
    } catch {
      setShowDeleteConfirm(false);
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setDeleting(false);
    }
  };

  // ── Loading Skeleton ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Card className="w-full mx-auto shadow-lg animate-pulse">
        <CardContent className="space-y-4 pt-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="space-y-1">
              <div className="h-3 w-20 bg-gray-200 rounded" />
              <div className="h-9 bg-gray-100 rounded" />
            </div>
          ))}
          <div className="h-10 bg-gray-200 rounded mt-6" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* ── Toast Notification for Condition Updates ──────────────────────── */}
      {showConditionToast && (
        <Toast
          type="success"
          message={conditionToastMessage}
          duration={5000}
          onClose={() => setShowConditionToast(false)}
        />
      )}
      
      {/* ── Confirmation Modals ───────────────────────────────────────────── */}
      <ConfirmModal
        isOpen={showResetConfirm}
        title="Reset All Data?"
        message="This will clear all your medicines, medication logs, and history so you can start fresh. Your profile information (name, email, etc.) will remain. This cannot be undone from the app."
        confirmLabel="Reset"
        confirmColor="orange"
        onConfirm={handleResetData}
        onCancel={() => setShowResetConfirm(false)}
        loading={resetting}
      />
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete Account?"
        message="Are you sure you want to delete your account? You will be logged out immediately and will no longer be able to log in. Your data is retained securely in our system."
        confirmLabel="Delete"
        confirmColor="red"
        onConfirm={handleDeleteAccount}
        onCancel={() => setShowDeleteConfirm(false)}
        loading={deleting}
      />

      {/* ── Profile Information Card ──────────────────────────────────────── */}
      <Card className="w-full mx-auto shadow-lg mb-6">
        <CardHeader className="flex items-center space-x-2 pb-4">
          <User className="h-5 w-5 text-gray-600" />
          <CardTitle className="text-lg font-semibold">Profile Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status message */}
          {message && (
            <div
              className={`text-sm rounded-lg px-4 py-3 border ${
                message.type === "success"
                  ? "bg-green-50 border-green-200 text-green-700"
                  : "bg-red-50 border-red-200 text-red-700"
              }`}
            >
              {message.text}
            </div>
          )}

          {/* First Name */}
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
              First Name
            </label>
            <Input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Enter your first name"
              className="bg-gray-50 border-gray-300 rounded-lg"
              disabled={saving}
            />
          </div>

          {/* Middle Name */}
          <div>
            <label htmlFor="middleName" className="block text-sm font-medium text-gray-700 mb-1">
              Middle Name{" "}
              <span className="text-gray-400 text-xs font-normal">(optional)</span>
            </label>
            <Input
              id="middleName"
              type="text"
              value={middleName}
              onChange={(e) => setMiddleName(e.target.value)}
              placeholder="Enter your middle name"
              className="bg-gray-50 border-gray-300 rounded-lg"
              disabled={saving}
            />
          </div>

          {/* Last Name */}
          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
              Last Name
            </label>
            <Input
              id="lastName"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Enter your last name"
              className="bg-gray-50 border-gray-300 rounded-lg"
              disabled={saving}
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="bg-gray-50 border-gray-300 rounded-lg"
              disabled={saving}
            />
          </div>

          {/* Patient ID */}
          <div>
            <label htmlFor="patientId" className="block text-sm font-medium text-gray-700 mb-1">
              Patient ID{" "}
              <span className="text-gray-400 text-xs font-normal">(optional)</span>
            </label>
            <Input
              id="patientId"
              type="text"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              placeholder="Enter your patient ID"
              className="bg-gray-50 border-gray-300 rounded-lg"
              disabled={saving}
            />
          </div>

          {/* Age — number input only */}
          <div>
            <label htmlFor="age" className="block text-sm font-medium text-gray-700 mb-1">
              Age{" "}
              <span className="text-gray-400 text-xs font-normal">(optional)</span>
            </label>
            <Input
              id="age"
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="Enter your age"
              min="1"
              max="120"
              className="bg-gray-50 border-gray-300 rounded-lg"
              disabled={saving}
            />
          </div>

          {/* Condition */}
          <div>
            <label htmlFor="condition" className="block text-sm font-medium text-gray-700 mb-1">
              Condition Managing
            </label>
            <select
              id="condition"
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              disabled={saving}
              className="w-full h-9 rounded-lg border border-gray-300 bg-gray-50 px-3 py-1 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 disabled:opacity-50"
            >
              {CONDITIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Save Changes */}
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full mt-2 rounded-lg"
          >
            {saving ? "Saving..." : "Save Changes"}
          </Button>

          {/* Delete Account */}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={saving}
            className="w-full py-2.5 text-sm font-semibold text-red-600 border-2 border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            Delete Account
          </button>
        </CardContent>
      </Card>

      {/* ── Reset Data Card ───────────────────────────────────────────────── */}
      <Card className="w-full mx-auto shadow-lg border-orange-200">
        <CardHeader className="flex items-center space-x-2 pb-2">
          <RotateCcw className="h-5 w-5 text-orange-600" />
          <CardTitle className="text-lg font-semibold text-orange-700">Reset Data</CardTitle>
        </CardHeader>
        <CardContent>
          <button
            onClick={() => setShowResetConfirm(true)}
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
        </CardContent>
      </Card>
    </>
  );
};

export default ProfileCard;