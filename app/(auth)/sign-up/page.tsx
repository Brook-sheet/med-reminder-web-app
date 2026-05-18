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

const getPasswordStrength = (password: string): { label: string; color: string; width: string } | null => {
  if (!password) return null;

  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);
  const isLong = password.length >= 10;

  const score = [hasUpper, hasLower, hasNumber, hasSpecial, isLong].filter(Boolean).length;

  if (password.length < 6) return { label: "Too short", color: "bg-red-500", width: "w-1/4" };
  if (score <= 2) return { label: "Weak", color: "bg-red-400", width: "w-1/4" };
  if (score === 3) return { label: "Fair", color: "bg-yellow-400", width: "w-2/4" };
  if (score === 4) return { label: "Good", color: "bg-blue-500", width: "w-3/4" };
  return { label: "Strong", color: "bg-green-500", width: "w-full" };
};

const Signup = () => {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const strength = getPasswordStrength(password);

  const validatePassword = (pwd: string): string | null => {
    if (!pwd) return "Password is required.";
    if (pwd.length < 6) return "Password must be at least 6 characters.";
    if (!/[a-zA-Z]/.test(pwd)) return "Password must contain at least one letter.";
    if (!/[0-9]/.test(pwd)) return "Password must contain at least one number.";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

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

            {/* Password field with strength indicator */}
            <div className="space-y-1.5">
              <Input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError("");
                }}
                required
                placeholder="Password"
                disabled={loading}
              />

              {/* Strength bar */}
              {password && strength && (
                <div className="space-y-1 px-0.5">
                  <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-300 ${strength.color} ${strength.width}`}
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    Strength: <span className="font-medium">{strength.label}</span>
                  </p>
                </div>
              )}

              {/* Requirements checklist */}
              {password && (
                <div className="bg-gray-50 rounded-md px-3 py-2 border border-gray-200 space-y-0.5">
                  {[
                    { label: "At least 6 characters", met: password.length >= 6 },
                    { label: "Contains a letter", met: /[a-zA-Z]/.test(password) },
                    { label: "Contains a number", met: /[0-9]/.test(password) },
                  ].map(({ label, met }) => (
                    <p
                      key={label}
                      className={`text-xs flex items-center gap-1.5 ${
                        met ? "text-green-600" : "text-red-500"
                      }`}
                    >
                      <span className="font-bold">{met ? "+" : "-"}</span>
                      {label}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* Confirm password field */}
            <div className="space-y-1">
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (error) setError("");
                }}
                required
                placeholder="Confirm Password"
                disabled={loading}
              />
              {/* Match indicator */}
              {confirmPassword && password && (
                <p
                  className={`text-xs px-0.5 ${
                    confirmPassword === password
                      ? "text-green-600"
                      : "text-red-500"
                  }`}
                >
                  {confirmPassword === password
                    ? "Passwords match."
                    : "Passwords do not match."}
                </p>
              )}
            </div>

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