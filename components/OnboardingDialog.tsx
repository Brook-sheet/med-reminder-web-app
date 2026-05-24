"use client";

import React, { useState } from "react";
import { validateAge } from "@/lib/validations";

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
    // ── Validate age ──────────────────────────────────────────────────────
    const ageError = validateAge(age || "");
    // For onboarding, age is required (unlike profile where it's optional)
    if (!age || !age.trim()) {
      setError("Please enter your age.");
      return;
    }
    if (ageError) {
      setError(ageError);
      return;
    }
    // ─────────────────────────────────────────────────────────────────────

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
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-10">
      <div className="absolute inset-0 bg-slate-950/20 backdrop-blur-sm" />

      <div className="relative w-full max-w-md overflow-hidden rounded-[32px] border border-slate-200/90 bg-white shadow-[0_30px_70px_rgba(15,23,42,0.16)]">
        <div className="border-b border-slate-200 px-8 py-7 bg-slate-50">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Onboarding</p>
              <h2 className="mt-3 text-2xl font-semibold text-slate-900">Set up your profile</h2>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-sky-100 text-sky-700 font-semibold">
              {step}
            </div>
          </div>
        </div>

        <div className="p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="h-2.5 w-full rounded-full bg-slate-200">
              <div className={`h-2.5 rounded-full bg-sky-500 transition-all ${step === 1 ? 'w-1/2' : 'w-full'}`} />
            </div>
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Step {step} of 2</span>
          </div>

          {step === 1 && (
            <>
              <h3 className="text-xl font-semibold text-slate-900 mb-3">Personalize your reminders</h3>
              <p className="text-sm leading-6 text-slate-500 mb-6">
                Select your primary condition so reminders and guidance can be tailored to your needs.
              </p>

              <div className="space-y-3 mb-6">
                {CONDITIONS.map((c) => (
                  <label
                    key={c.value}
                    className={`flex items-center gap-3 rounded-3xl border p-4 transition-shadow ${
                      condition === c.value
                        ? 'border-sky-400 bg-sky-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                    }`}
                  >
                    <input
                      type="radio"
                      name="condition"
                      value={c.value}
                      checked={condition === c.value}
                      onChange={(e) => setCondition(e.target.value)}
                      className="accent-sky-600 h-4 w-4"
                    />
                    <span className={`text-sm font-medium ${condition === c.value ? 'text-slate-900' : 'text-slate-700'}`}>
                      {c.label}
                    </span>
                  </label>
                ))}
              </div>

              {error && <p className="text-sm text-rose-600 mb-4">{error}</p>}

              <button
                onClick={handleNext}
                className="w-full rounded-3xl bg-sky-600 py-3 text-sm font-semibold text-white shadow-sm shadow-sky-200 transition-colors hover:bg-sky-700"
              >
                Continue
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <h3 className="text-xl font-semibold text-slate-900 mb-3">Add your age</h3>
              <p className="text-sm leading-6 text-slate-500 mb-6">
                Enter your age to help the app tailor reminder timing and guidance.
              </p>

              <div className="mb-6">
                <label htmlFor="onboarding-age" className="mb-2 block text-sm font-medium text-slate-700">Your Age</label>
                <input
                  id="onboarding-age"
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="Enter your age"
                  min="1"
                  max="120"
                  className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-lg font-semibold text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                />
              </div>

              {error && <p className="text-sm text-rose-600 mb-4">{error}</p>}

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => { setStep(1); setError(""); }}
                  disabled={saving}
                  className="flex-1 rounded-3xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={saving}
                  className="flex-1 rounded-3xl bg-sky-600 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Complete setup"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingDialog;