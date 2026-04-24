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
              required
              placeholder="Password"
              disabled={loading}
            />
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="Confirm Password"
              disabled={loading}
            />
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