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
  const hasNumber = /[0-9]/.test(password);
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

  const handleSubmit = async (e: React.FormEvent) => {
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
    <div className="h-full flex items-center justify-center bg-gray-800">
      <OnboardingDialog isOpen={showOnboarding} onComplete={handleOnboardingComplete} />

      <Card className="md:h-auto w-[80%] sm:w-[420px] p-4 sm:p-8">
        <CardHeader>
          <CardTitle className="text-center">Create Account</CardTitle>
          <CardDescription className="text-sm text-center text-accent-foreground">
            Enter your details to create your account
          </CardDescription>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
          <form onSubmit={handleSubmit} className="space-y-3">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2">
                {error}
              </div>
            )}
            <Input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              placeholder="First Name"
              disabled={loading}
            />
            <Input
              type="text"
              value={middleName}
              onChange={(e) => setMiddleName(e.target.value)}
              placeholder="Middle Name (optional)"
              disabled={loading}
            />
            <Input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              placeholder="Last Name"
              disabled={loading}
            />
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Email"
              disabled={loading}
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
            />
            {strength && (
              <div className="space-y-2">
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
            {(showPasswordReq || password) && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-3 border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300">
              <p className="font-medium mb-1">Password requirements:</p>
              <ul className="space-y-0.5">
                {[
                  { label: "At least 6 characters", met: password.length >= 6 },
                  { label: "Contains a letter", met: /[a-zA-Z]/.test(password) },
                  { label: "Contains a number", met: /[0-9]/.test(password) },
                ].map(({ label, met }) => (
                  <li
                    key={label}
                    className={`flex items-center gap-2 ${password
                      ? met
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-500 dark:text-red-400"
                      : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    <span className="font-semibold">{password ? (met ? "✓" : "✕") : "•"}</span>
                    {label}
                  </li>
                ))}
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
            />
            {confirmPassword && password && (
              <p className={`text-xs ${confirmPassword === password ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                {confirmPassword === password ? "Passwords match." : "Passwords do not match."}
              </p>
            )}
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? "Creating account..." : "Sign Up"}
            </Button>
          </form>

          <Separator className="my-4" />

          <p className="text-sm text-center text-muted-foreground mt-2">
            Already have an account?{" "}
            <a href="/sign-in" className="text-blue-500 hover:underline cursor-pointer">Sign In</a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Signup;