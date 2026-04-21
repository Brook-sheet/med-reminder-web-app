"use client";

import React, { useState } from "react";

interface OnboardingDialogProps {
  isOpen: boolean;
  onComplete: () => void;
}

const CONDITIONS = [
  { value: "Diabetes", label: "Diabetes" },
  { value: "Hypertension", label: "Hypertension" },
  { value: "Both", label: "Both (Diabetes & Hypertension)" },
  { value: "Other", label: "Other" },
  { value: "None", label: "None" },
];

const OnboardingDialog: React.FC<OnboardingDialogProps> = ({ isOpen, onComplete }) => {
  const [step, setStep] = useState(1);
  const [condition, setCondition] = useState("");
  const [age, setAge] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleNext = () => {
    if (!condition) {
      setError("Please select a condition.");
      return;
    }
    setError("");
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!age || isNaN(Number(age)) || Number(age) <= 0 || Number(age) > 120) {
      setError("Please enter a valid age (1–120).");
      return;
    }
    setError("");
    setSaving(true);

    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          condition,
          age: Number(age),
          onboardingCompleted: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onComplete();
      } else {
        setError(data.error || "Failed to save. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8">
        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-6">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
              step >= 1 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"
            }`}
          >
            1
          </div>
          <div className={`flex-1 h-1 rounded transition-colors ${step >= 2 ? "bg-blue-600" : "bg-gray-200"}`} />
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
              step >= 2 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"
            }`}
          >
            2
          </div>
        </div>

        {/* ── Step 1: Condition ── */}
        {step === 1 && (
          <>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Welcome! 👋</h2>
            <p className="text-gray-500 mb-6 text-sm">
              Let us personalize your experience. What condition are you managing?
            </p>

            <div className="space-y-3 mb-6">
              {CONDITIONS.map((c) => (
                <label
                  key={c.value}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    condition === c.value
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="condition"
                    value={c.value}
                    checked={condition === c.value}
                    onChange={(e) => setCondition(e.target.value)}
                    className="accent-blue-600 w-4 h-4"
                  />
                  <span
                    className={`font-medium ${
                      condition === c.value ? "text-blue-700" : "text-gray-700"
                    }`}
                  >
                    {c.label}
                  </span>
                </label>
              ))}
            </div>

            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

            <button
              onClick={handleNext}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
            >
              Next →
            </button>
          </>
        )}

        {/* ── Step 2: Age ── */}
        {step === 2 && (
          <>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Almost done! 🎉</h2>
            <p className="text-gray-500 mb-6 text-sm">
              How old are you? This helps us tailor your medication reminders.
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Age
              </label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="Enter your age"
                min="1"
                max="120"
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-lg font-semibold text-gray-900 outline-none focus:border-blue-600 transition-colors"
              />
            </div>

            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => { setStep(1); setError(""); }}
                disabled={saving}
                className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                ← Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : "Let's Go! 🚀"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default OnboardingDialog;