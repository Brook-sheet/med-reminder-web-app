"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardHeader,
  CardDescription,
  CardContent,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import GoogleAuthButton from "@/components/auth/GoogleAuthButton";
import { toast } from "@/components/ui/Toast";
import {
  validateName,
  validateOptionalName,
  validateEmail,
  validatePassword,
  validateConfirmPassword,
  collectErrors,
} from "@/lib/validations";

const getPasswordStrength = (
  password: string
): { label: string; color: string; width: string } | null => {
  if (!password) return null;

  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);
  const len = password.length;

  if (len < 6 || !hasLetter || !hasNumber) {
    return { label: "Weak", color: "bg-red-400", width: "w-1/4" };
  }
  if (len >= 12 && hasLetter && hasNumber && hasSymbol) {
    return { label: "Strong", color: "bg-green-500", width: "w-full" };
  }
  if (len >= 10 && hasLetter && hasNumber) {
    return { label: "Good", color: "bg-blue-500", width: "w-3/4" };
  }
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

  const strength = getPasswordStrength(password);

  const handleSubmit = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

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
      toast.warning(validationError);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/register", {
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

      const data = await response.json();

      if (!response.ok || !data.success) {
        if (data.code === "EMAIL_NOT_VERIFIED") {
          toast.info("This account still needs email verification.");
          router.push(`/verify-email?status=pending&email=${encodeURIComponent(email.trim())}`);
          return;
        }

        const message = data.error || "Registration failed. Please try again.";
        setError(message);
        toast.error(message);
        return;
      }

      toast.success("Verification email sent. Check your inbox to activate your account.");
      router.push(`/verify-email?status=sent&email=${encodeURIComponent(email.trim())}`);
    } catch {
      const message = "Network error. Please check your connection.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative w-full">
      <Card className="w-full overflow-hidden rounded-[32px] border border-slate-200/80 bg-white/95 shadow-[0_28px_56px_rgba(15,23,42,0.08)]">
        <CardHeader className="px-6 pt-8">
          <CardTitle className="text-center text-2xl font-semibold text-slate-900">
            Create your account
          </CardTitle>
          <CardDescription className="mx-auto mt-2 max-w-xs text-center text-sm leading-6 text-slate-500">
            Start using Med App Reminder to keep your medication routine on track.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-8 pt-6">
          <GoogleAuthButton disabled={loading} />

          <div className="my-6 flex items-center gap-3" aria-hidden="true">
            <Separator className="flex-1" />
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">or</span>
            <Separator className="flex-1" />
          </div>

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
                onChange={(event) => setFirstName(event.target.value)}
                required
                placeholder="First Name"
                autoComplete="given-name"
                disabled={loading}
                className="rounded-3xl border-slate-200 bg-slate-50/80"
              />
              <Input
                type="text"
                value={middleName}
                onChange={(event) => setMiddleName(event.target.value)}
                placeholder="Middle Name (optional)"
                autoComplete="additional-name"
                disabled={loading}
                className="rounded-3xl border-slate-200 bg-slate-50/80"
              />
              <Input
                type="text"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                required
                placeholder="Last Name"
                autoComplete="family-name"
                disabled={loading}
                className="rounded-3xl border-slate-200 bg-slate-50/80"
              />
            </div>
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              placeholder="Email"
              autoComplete="email"
              disabled={loading}
              className="rounded-3xl border-slate-200 bg-slate-50/80"
            />
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onFocus={() => setShowPasswordReq(true)}
              onBlur={() => {
                if (!password) setShowPasswordReq(false);
              }}
              required
              placeholder="Password"
              autoComplete="new-password"
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
                <p className="mb-3 font-medium text-slate-900">Password requirements</p>
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
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              placeholder="Confirm Password"
              autoComplete="new-password"
              disabled={loading}
              className="rounded-3xl border-slate-200 bg-slate-50/80"
            />
            {confirmPassword && password && (
              <p
                className={`text-xs ${
                  confirmPassword === password ? "text-emerald-700" : "text-rose-600"
                }`}
              >
                {confirmPassword === password ? "Passwords match." : "Passwords do not match."}
              </p>
            )}
            <Button
              className="w-full rounded-3xl py-3 font-semibold shadow-sm shadow-slate-200"
              type="submit"
              disabled={loading}
            >
              {loading ? "Creating account..." : "Sign Up with Email"}
            </Button>
          </form>

          <Separator className="my-6" />

          <p className="text-center text-sm text-slate-500">
            Already have an account?{" "}
            <a href="/sign-in" className="font-semibold text-sky-600 hover:text-sky-700">
              Sign In
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Signup;