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
import { validateEmail, validatePassword, collectErrors } from "@/lib/validations";

const Signin = () => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // ── Client-side validation ──────────────────────────────────────────────
    const validationError = collectErrors({
      email: validateEmail(email),
      password: validatePassword(password),
    });

    if (validationError) {
      setError(validationError);
      return;
    }
    // ───────────────────────────────────────────────────────────────────────

    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Login failed. Please try again.");
        return;
      }

      if (data.data?.user?.onboardingCompleted === false) {
        setShowOnboarding(true);
        return;
      }

      router.push("/");
      router.refresh();
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
          <CardTitle className="text-center text-2xl font-semibold text-slate-900">Welcome back</CardTitle>
          <CardDescription className="mx-auto mt-2 max-w-xs text-center text-sm leading-6 text-slate-500">
            Sign in to manage your medication reminders and stay on track with your daily schedule.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-8 pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
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
              required
              placeholder="Password"
              disabled={loading}
              className="rounded-3xl border-slate-200 bg-slate-50/80"
            />
            <div className="flex justify-end">
              <a href="/forgot-password" className="text-sm font-semibold text-sky-600 hover:text-sky-700">
                Forgot password?
              </a>
            </div>
            <Button className="w-full rounded-3xl py-3 font-semibold shadow-sm shadow-slate-200" type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <Separator className="my-6" />

          <p className="text-sm text-center text-slate-500">
            New to Med App Reminder?{" "}
            <a href="/sign-up" className="font-semibold text-sky-600 hover:text-sky-700">Create an account</a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Signin;