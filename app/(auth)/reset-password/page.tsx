"use client";

import React, { Suspense, useState } from "react";
import {
  Card, CardHeader, CardDescription, CardContent, CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { validateEmail, validatePassword, validateConfirmPassword, collectErrors } from "@/lib/validations";

type Step = "verify" | "newPassword" | "done";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [code, setCode] = useState(searchParams.get("code") || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetToken, setResetToken] = useState("");

  const [step, setStep] = useState<Step>("verify");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResendMessage("");

    const emailError = validateEmail(email);
    if (emailError) {
      setError(emailError);
      return;
    }
    if (!/^\d{6}$/.test(code.trim())) {
      setError("Enter the 6-digit code from your email.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-reset-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code: code.trim() }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "That code is invalid or has expired.");
        return;
      }

      setResetToken(data.data.resetToken);
      setStep("newPassword");
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setResendMessage("");
    const emailError = validateEmail(email);
    if (emailError) {
      setError(emailError);
      return;
    }

    setResending(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Could not resend the code. Please try again.");
        return;
      }
      setCode("");
      setResendMessage("A new code has been sent if an account exists for that email.");
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setResending(false);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const validationError = collectErrors({
      password: validatePassword(newPassword),
      confirmPassword: validateConfirmPassword(newPassword, confirmPassword),
    });
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetToken, newPassword, confirmPassword }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Could not reset your password. Please try again.");
        return;
      }

      setStep("done");
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative w-full">
      <Card className="w-full overflow-hidden rounded-[32px] border border-slate-200/80 bg-white/95 shadow-[0_28px_56px_rgba(15,23,42,0.08)]">
        {step === "verify" && (
          <>
            <CardHeader className="px-6 pt-8">
              <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-sky-50 text-sky-600">
                <KeyRound className="h-7 w-7" />
              </div>
              <CardTitle className="text-center text-2xl font-semibold text-slate-900">Enter verification code</CardTitle>
              <CardDescription className="mx-auto mt-2 max-w-xs text-center text-sm leading-6 text-slate-500">
                We sent a 6-digit code to your email. It expires in 15 minutes.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-8 pt-6">
              <form onSubmit={handleVerify} className="space-y-4">
                {error && (
                  <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}
                {resendMessage && !error && (
                  <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {resendMessage}
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
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  placeholder="6-digit code"
                  disabled={loading}
                  maxLength={6}
                  className="rounded-3xl border-slate-200 bg-slate-50/80 text-center text-lg tracking-[0.5em]"
                />
                <Button className="w-full rounded-3xl py-3 font-semibold shadow-sm shadow-slate-200" type="submit" disabled={loading}>
                  {loading ? "Verifying..." : "Verify code"}
                </Button>
              </form>

              <Separator className="my-6" />

              <p className="text-sm text-center text-slate-500">
                Didn&apos;t get a code?{" "}
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  className="font-semibold text-sky-600 hover:text-sky-700 disabled:opacity-60"
                >
                  {resending ? "Resending..." : "Resend code"}
                </button>
              </p>
              <p className="mt-3 text-sm text-center text-slate-500">
                <a href="/sign-in" className="font-semibold text-sky-600 hover:text-sky-700">Back to sign in</a>
              </p>
            </CardContent>
          </>
        )}

        {step === "newPassword" && (
          <>
            <CardHeader className="px-6 pt-8">
              <CardTitle className="text-center text-2xl font-semibold text-slate-900">Create a new password</CardTitle>
              <CardDescription className="mx-auto mt-2 max-w-xs text-center text-sm leading-6 text-slate-500">
                Choose a new password for your account. It must be at least 6 characters with a letter and a number.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-8 pt-6">
              <form onSubmit={handleSetPassword} className="space-y-4">
                {error && (
                  <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  placeholder="New password"
                  disabled={loading}
                  autoFocus
                  className="rounded-3xl border-slate-200 bg-slate-50/80"
                />
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Confirm new password"
                  disabled={loading}
                  className="rounded-3xl border-slate-200 bg-slate-50/80"
                />
                <Button className="w-full rounded-3xl py-3 font-semibold shadow-sm shadow-slate-200" type="submit" disabled={loading}>
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Resetting password...
                    </span>
                  ) : (
                    "Reset password"
                  )}
                </Button>
              </form>
            </CardContent>
          </>
        )}

        {step === "done" && (
          <>
            <CardHeader className="px-6 pt-8">
              <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <CardTitle className="text-center text-2xl font-semibold text-slate-900">Password reset</CardTitle>
              <CardDescription className="mx-auto mt-2 max-w-xs text-center text-sm leading-6 text-slate-500">
                Your password has been changed successfully. You can now sign in with your new password.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-8 pt-6">
              <Button
                onClick={() => router.push("/sign-in")}
                className="w-full rounded-3xl py-3 font-semibold shadow-sm shadow-slate-200"
              >
                Back to sign in
              </Button>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}