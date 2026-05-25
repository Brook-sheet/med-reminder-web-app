"use client";

import React, { useState } from "react";
import {
  Card, CardHeader, CardDescription, CardContent, CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import OnboardingDialog from "@/components/OnboardingDialog";
import {
  validateName,
  validateOptionalName,
  validateEmail,
  validatePassword,
  validateConfirmPassword,
  collectErrors,
} from "@/lib/validations";

const getPasswordStrength = (password: string): { label: string; color: string; width: string } | null => {
  if (!password) return null;

  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);
  const len = password.length;

  // Weak: missing required parts (length <6 or missing letter/number)
  if (len < 6 || !hasLetter || !hasNumber) return { label: "Weak", color: "bg-red-400", width: "w-1/4" };

  // Strong: 12+ chars and includes symbol + letter + number
  if (len >= 12 && hasLetter && hasNumber && hasSymbol) return { label: "Strong", color: "bg-green-500", width: "w-full" };

  // Good: 10+ chars with letters and numbers
  if (len >= 10 && hasLetter && hasNumber) return { label: "Good", color: "bg-blue-500", width: "w-3/4" };

  // Fair: meets minimum requirements
  return { label: "Fair", color: "bg-yellow-400", width: "w-2/4" };
};

const Signup = () => {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswordReq, setShowPasswordReq] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const strength = getPasswordStrength(password);

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    // ── Client-side validation ──────────────────────────────────────────────
    const validationError = collectErrors({
      firstName: validateName(firstName, "First Name"),
      middleName: validateOptionalName(middleName, "Middle Name"),
      lastName: validateName(lastName, "Last Name"),
      email: validateEmail(email),
      password: validatePassword(password),
      confirmPassword: validateConfirmPassword(password, confirmPassword),
    });

    if (validationError) {
      setError(validationError);
      return;
    }
    // ───────────────────────────────────────────────────────────────────────

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          confirmPassword,
          firstName,
          middleName,
          lastName,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Registration failed. Please try again.");
        return;
      }

      setShowOnboarding(true);
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    router.push("/");
    router.refresh();
  };

  return (
    <div className="relative w-full">
      <OnboardingDialog isOpen={showOnboarding} onComplete={handleOnboardingComplete} />

      <Card className="w-full overflow-hidden rounded-[32px] border border-slate-200/80 bg-white/95 shadow-[0_28px_56px_rgba(15,23,42,0.08)]">
        <CardHeader className="px-6 pt-8">
          <CardTitle className="text-center text-2xl font-semibold text-slate-900">Create your account</CardTitle>
          <CardDescription className="mx-auto mt-2 max-w-xs text-center text-sm leading-6 text-slate-500">
            Start using Med App Reminder to keep your medication routine on track.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-8 pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
            <div className="grid gap-3">
              <Input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                placeholder="First Name"
                disabled={loading}
                className="rounded-3xl border-slate-200 bg-slate-50/80"
              />
              <Input
                type="text"
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
                placeholder="Middle Name (optional)"
                disabled={loading}
                className="rounded-3xl border-slate-200 bg-slate-50/80"
              />
              <Input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                placeholder="Last Name"
                disabled={loading}
                className="rounded-3xl border-slate-200 bg-slate-50/80"
              />
            </div>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Email"
              disabled={loading}
              className="rounded-3xl border-slate-200 bg-slate-50/80"
            />
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setShowPasswordReq(true)}
              onBlur={() => { if (!password) setShowPasswordReq(false); }}
              required
              placeholder="Password"
              disabled={loading}
              className="rounded-3xl border-slate-200 bg-slate-50/80"
            />
            {strength && (
              <div className="space-y-2">
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-300 ${strength.color} ${strength.width}`}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  Strength: <span className="font-semibold text-slate-900">{strength.label}</span>
                </p>
              </div>
            )}
            {(showPasswordReq || password) && (
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 text-xs text-slate-600">
              <p className="font-medium text-slate-900 mb-3">Password requirements</p>
              <ul className="space-y-2">
                {[
                  { label: "At least 6 characters", met: password.length >= 6 },
                  { label: "Contains a letter", met: /[a-zA-Z]/.test(password) },
                  { label: "Contains a number", met: /\d/.test(password) },
                ].map(({ label, met }) => {
                  let textClass = "text-slate-500";
                  let dotClass = "bg-slate-300";

                  if (password) {
                    if (met) {
                      textClass = "text-emerald-700";
                      dotClass = "bg-emerald-600";
                    } else {
                      textClass = "text-rose-600";
                      dotClass = "bg-rose-600";
                    }
                  }

                  return (
                    <li key={label} className={`flex items-center gap-3 ${textClass}`}>
                      <span className={`inline-flex h-3.5 w-3.5 rounded-full ${dotClass}`} />
                      <span>{label}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
            )}
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="Confirm Password"
              disabled={loading}
              className="rounded-3xl border-slate-200 bg-slate-50/80"
            />
            {confirmPassword && password && (
              <p className={`text-xs ${confirmPassword === password ? "text-emerald-700" : "text-rose-600"}`}>
                {confirmPassword === password ? "Passwords match." : "Passwords do not match."}
              </p>
            )}
            <Button className="w-full rounded-3xl py-3 font-semibold shadow-sm shadow-slate-200" type="submit" disabled={loading}>
              {loading ? "Creating account..." : "Sign Up"}
            </Button>
          </form>

          <Separator className="my-6" />

          <p className="text-sm text-center text-slate-500">
            Already have an account?{" "}
            <a href="/sign-in" className="font-semibold text-sky-600 hover:text-sky-700">Sign In</a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Signup;