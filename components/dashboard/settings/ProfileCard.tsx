"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Toast from "@/components/ui/Toast";
import UpdatePasswordModal from "@/components/dashboard/settings/UpdatePasswordModal";
import { User, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  validateName,
  validateOptionalName,
  validateEmail,
  validateAge,
  collectErrors,
} from "@/lib/validations";

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
      <button
        type="button"
        aria-label="Close confirmation dialog"
        onClick={onCancel}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />
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

  const [previousCondition, setPreviousCondition] = useState("");

  // Modal states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [showPasswordModal, setShowPasswordModal] = useState(false);

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
        setAge(data.data.age == null ? "" : String(data.data.age));
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
    setMessage(null);

    // ── Client-side validation ─────────────────────────────────────────────
    const validationError = collectErrors({
      firstName: validateName(firstName, "First Name"),
      middleName: validateOptionalName(middleName, "Middle Name"),
      lastName: validateName(lastName, "Last Name"),
      email: validateEmail(email),
      age: validateAge(age),
    });

    if (validationError) {
      setMessage({ type: "error", text: validationError });
      return;
    }
    // ────────────────────────────────────────────────────────────────────────

    setSaving(true);
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
          age: age === "" ? null : Number(age),
        }),
      });
      const data = await res.json();
      if (data.success) {
        const conditionLabel = CONDITIONS.find(c => c.value === condition)?.label || condition;
        if (condition === previousCondition) {
          setMessage({ type: "success", text: "Profile updated successfully!" });
        } else {
          setMessage({ type: "success", text: `Profile updated successfully! Condition set to: ${conditionLabel}` });
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
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 animate-pulse">
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="space-y-1">
              <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-9 bg-gray-100 dark:bg-gray-600 rounded" />
            </div>
          ))}
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded mt-6" />
        </div>
      </div>
    );
  }

  return (
    <>
      
      {/* ── Global Toast Notification ──────────────────────── */}
      {message && (
        <Toast
          type={message.type}
          message={message.text}
          duration={5000}
          onClose={() => setMessage(null)}
        />
      )}

      {/* ── Confirmation Modals ───────────────────────────────────────────── */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete Account and Data?"
        message="Are you sure you want to delete your account? This action will permanently remove your account and all associated data. You will be logged out immediately, and your data cannot be recovered."
        confirmLabel="Delete Account"
        confirmColor="red"
        onConfirm={handleDeleteAccount}
        onCancel={() => setShowDeleteConfirm(false)}
        loading={deleting}
      />

      {/* ── Profile Information Card ──────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center space-x-2 pb-4 mb-4 border-b border-gray-100 dark:border-gray-700">
          <User className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Profile Information</h2>
        </div>
        <div className="space-y-4">
          {/* Status message */}
          {message && (
            <div
              className={`text-sm rounded-lg px-4 py-3 border ${message.type === "success"
                  ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-700/50 dark:text-green-300"
                  : "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-700/50 dark:text-red-300"
                }`}
            >
              {message.text}
            </div>
          )}

          {/* First Name */}
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              First Name
            </label>
            <Input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Enter your first name"
              className="bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg dark:placeholder:text-gray-500"
              disabled={saving}
            />
          </div>

          {/* Middle Name */}
          <div>
            <label htmlFor="middleName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Middle Name{" "}
              <span className="text-gray-400 dark:text-gray-500 text-xs font-normal">(optional)</span>
            </label>
            <Input
              id="middleName"
              type="text"
              value={middleName}
              onChange={(e) => setMiddleName(e.target.value)}
              placeholder="Enter your middle name"
              className="bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg dark:placeholder:text-gray-500"
              disabled={saving}
            />
          </div>

          {/* Last Name */}
          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Last Name
            </label>
            <Input
              id="lastName"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Enter your last name"
              className="bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg dark:placeholder:text-gray-500"
              disabled={saving}
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg dark:placeholder:text-gray-500"
              disabled={saving}
            />
          </div>

          {/* Patient ID */}
          <div>
            <label htmlFor="patientId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Patient ID{" "}
              <span className="text-gray-400 dark:text-gray-500 text-xs font-normal">(optional)</span>
            </label>
            <Input
              id="patientId"
              type="text"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              placeholder="Enter your patient ID"
              className="bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg dark:placeholder:text-gray-500"
              disabled={saving}
            />
          </div>

          {/* Age — number input only */}
          <div>
            <label htmlFor="age" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Age{" "}
              <span className="text-gray-400 dark:text-gray-500 text-xs font-normal">(optional)</span>
            </label>
            <Input
              id="age"
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="Enter your age"
              min="1"
              max="120"
              className="bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg dark:placeholder:text-gray-500"
              disabled={saving}
            />
          </div>

          {/* Condition */}
          <div>
            <label htmlFor="condition" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Condition Managing
            </label>
            <select
              id="condition"
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              disabled={saving}
              className="w-full h-9 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3 py-1 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 disabled:opacity-50"
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

          <Button
            onClick={() => setShowPasswordModal(true)}
            disabled={saving}
            className="w-full mt-2 rounded-lg bg-slate-700 hover:bg-slate-800 text-white dark:bg-slate-600 dark:hover:bg-slate-700"
          >
            Update Password
          </Button>

          {/* Delete Account */}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={saving}
            className="w-full py-2.5 text-sm font-semibold text-red-600 border-2 border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            Delete Account
          </button>
        </div>
      </div>

      <UpdatePasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
      />
    </>
  );
};

export default ProfileCard;