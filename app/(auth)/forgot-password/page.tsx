"use client";

import React, { useState } from "react";
import {
  Card, CardHeader, CardDescription, CardContent, CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { MailCheck, ArrowLeft } from "lucide-react";
import { validateEmail } from "@/lib/validations";

const ForgotPasswordPage = () => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const validationError = validateEmail(email);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const goToVerify = () => {
    router.push(`/reset-password?email=${encodeURIComponent(email.trim())}`);
  };

  return (
    <div className="relative w-full">
      <Card className="w-full overflow-hidden rounded-[32px] border border-slate-200/80 bg-white/95 shadow-[0_28px_56px_rgba(15,23,42,0.08)]">
        {submitted ? (
          <>
            <CardHeader className="px-6 pt-8">
              <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-sky-50 text-sky-600">
                <MailCheck className="h-7 w-7" />
              </div>
              <CardTitle className="text-center text-2xl font-semibold text-slate-900">Check your email</CardTitle>
              <CardDescription className="mx-auto mt-2 max-w-xs text-center text-sm leading-6 text-slate-500">
                If an account exists for <span className="font-medium text-slate-700">{email.trim()}</span>, we&apos;ve sent a
                6-digit verification code. Enter it on the next page to reset your password.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-8 pt-6">
              <Button
                onClick={goToVerify}
                className="w-full rounded-3xl py-3 font-semibold shadow-sm shadow-slate-200"
              >
                Enter verification code
              </Button>

              <Separator className="my-6" />

              <p className="text-sm text-center text-slate-500">
                Didn&apos;t get an email?{" "}
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="font-semibold text-sky-600 hover:text-sky-700"
                >
                  Try a different address
                </button>
              </p>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader className="px-6 pt-8">
              <CardTitle className="text-center text-2xl font-semibold text-slate-900">Forgot your password?</CardTitle>
              <CardDescription className="mx-auto mt-2 max-w-xs text-center text-sm leading-6 text-slate-500">
                Enter the email address on your account and we&apos;ll send you a verification code to reset your password.
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
                  autoFocus
                  className="rounded-3xl border-slate-200 bg-slate-50/80"
                />
                <Button className="w-full rounded-3xl py-3 font-semibold shadow-sm shadow-slate-200" type="submit" disabled={loading}>
                  {loading ? "Sending code..." : "Send verification code"}
                </Button>
              </form>

              <Separator className="my-6" />

              <p className="flex items-center justify-center gap-1.5 text-sm text-center text-slate-500">
                <ArrowLeft className="h-3.5 w-3.5" />
                <a href="/sign-in" className="font-semibold text-sky-600 hover:text-sky-700">Back to sign in</a>
              </p>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
};

export default ForgotPasswordPage;