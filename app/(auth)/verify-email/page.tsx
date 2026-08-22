"use client";

import React, {
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  AlertCircle,
  Loader2,
  MailCheck,
  RefreshCw,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import OnboardingDialog from "@/components/OnboardingDialog";
import { toast } from "@/components/ui/Toast";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const token = searchParams.get("token") || "";

  const [status, setStatus] = useState(
    token
      ? "ready"
      : searchParams.get("status") || "pending"
  );

  const [onboarding, setOnboarding] = useState(
    searchParams.get("onboarding")
  );

  const initialEmail =
    searchParams.get("email") || "";

  const [email, setEmail] = useState(initialEmail);
  const [resending, setResending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const [role, setRole] = useState<
    "patient" | "family"
  >(
    searchParams.get("role") === "family"
      ? "family"
      : "patient"
  );

  const content = useMemo(() => {
    if (status === "success") {
      return {
        title: "Email verified",
        description:
          "Your email address has been verified and your account is now active.",
        kind: "success" as const,
      };
    }

    if (status === "expired") {
      return {
        title: "Verification link expired",
        description:
          "Request a new verification email below. The new link will be valid for 24 hours.",
        kind: "error" as const,
      };
    }

    if (status === "invalid") {
      return {
        title: "Verification link is invalid",
        description:
          "This link may have already been used or replaced. Request a new link below.",
        kind: "error" as const,
      };
    }

    if (status === "error") {
      return {
        title: "Unable to verify email",
        description:
          "Something went wrong while verifying your email. Request a new link and try again.",
        kind: "error" as const,
      };
    }

    if (status === "ready") {
      return {
        title: "Confirm your email",
        description:
          "Select Verify email below to activate your account. This link can only be used once.",
        kind: "ready" as const,
      };
    }

    return {
      title:
        status === "sent"
          ? "Check your inbox"
          : "Verify your email",
      description:
        status === "sent"
          ? `We sent a verification link${
              initialEmail
                ? ` to ${initialEmail}`
                : ""
            }. Click it to activate your account.`
          : "Your account needs email verification before you can sign in.",
      kind: "pending" as const,
    };
  }, [initialEmail, status]);

  useEffect(() => {
    if (status !== "success") {
      return;
    }

    toast.success("Email verified successfully.");

    if (onboarding === "complete") {
      const timer = window.setTimeout(() => {
        router.replace(
          role === "family" ? "/monitor" : "/"
        );
        router.refresh();
      }, 900);

      return () => window.clearTimeout(timer);
    }
  }, [onboarding, role, router, status]);

  const handleVerify = async () => {
    if (!token) {
      setStatus("invalid");
      return;
    }

    setVerifying(true);

    try {
      const response = await fetch(
        "/api/auth/verify-email",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        if (
          data.code === "VERIFICATION_LINK_EXPIRED"
        ) {
          setStatus("expired");
        } else if (
          data.code === "INVALID_VERIFICATION_LINK"
        ) {
          setStatus("invalid");
        } else {
          setStatus("error");
        }

        toast.error(
          data.error ||
            "Unable to verify your email."
        );

        return;
      }

      const nextOnboarding =
        data.data?.onboardingRequired
          ? "required"
          : "complete";

      const verifiedRole =
        data.data?.role === "family"
          ? "family"
          : "patient";

      setRole(verifiedRole);
      setOnboarding(nextOnboarding);
      setStatus("success");

      window.history.replaceState(
        null,
        "",
        `/verify-email?status=success&onboarding=${nextOnboarding}&role=${verifiedRole}`
      );
    } catch {
      setStatus("error");

      toast.error(
        "Network error. Please check your connection."
      );
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!email.trim()) {
      toast.warning(
        "Enter the email address used for your account."
      );
      return;
    }

    setResending(true);

    try {
      const response = await fetch(
        "/api/auth/resend-verification",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        toast.error(
          data.error ||
            "Unable to resend the verification email."
        );
        return;
      }

      toast.success(
        data.message ||
          "Verification email sent."
      );
    } catch {
      toast.error(
        "Network error. Please check your connection."
      );
    } finally {
      setResending(false);
    }
  };

  const handleOnboardingComplete = () => {
    router.push("/");
    router.refresh();
  };

  const isSuccess =
    content.kind === "success";

  return (
    <div className="relative w-full">
      <OnboardingDialog
        isOpen={
          status === "success" &&
          onboarding === "required"
        }
        onComplete={handleOnboardingComplete}
      />

      <Card className="w-full overflow-hidden rounded-[32px] border border-slate-200/80 bg-white/95 shadow-[0_28px_56px_rgba(15,23,42,0.08)]">
        <CardHeader className="px-6 pt-8 text-center">
          <div
            className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${
              isSuccess
                ? "bg-emerald-50 text-emerald-600"
                : "bg-sky-50 text-sky-600"
            }`}
          >
            {content.kind === "error" ? (
              <AlertCircle
                className="h-7 w-7 text-rose-600"
                aria-hidden="true"
              />
            ) : (
              <MailCheck
                className="h-7 w-7"
                aria-hidden="true"
              />
            )}
          </div>

          <CardTitle className="text-2xl font-semibold text-slate-900">
            {content.title}
          </CardTitle>

          <CardDescription className="mx-auto mt-2 max-w-sm break-words text-sm leading-6 text-slate-500">
            {content.description}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 px-6 pb-8 pt-6">
          {content.kind === "ready" && (
            <Button
              type="button"
              onClick={handleVerify}
              disabled={verifying}
              className="w-full rounded-3xl py-3 font-semibold"
            >
              {verifying && (
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              )}

              {verifying
                ? "Verifying..."
                : "Verify email"}
            </Button>
          )}

          {!isSuccess &&
            content.kind !== "ready" && (
              <>
                <Input
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="Email address"
                  autoComplete="email"
                  disabled={resending}
                  className="rounded-3xl border-slate-200 bg-slate-50/80"
                />

                <Button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  className="w-full rounded-3xl py-3 font-semibold"
                >
                  {resending ? (
                    <Loader2
                      className="mr-2 h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <RefreshCw
                      className="mr-2 h-4 w-4"
                      aria-hidden="true"
                    />
                  )}

                  {resending
                    ? "Sending..."
                    : "Resend verification email"}
                </Button>

                <p className="text-center text-xs leading-5 text-slate-500">
                  For security, the response is the
                  same whether or not an account exists
                  for that email.
                </p>
              </>
            )}

          {isSuccess &&
            onboarding === "complete" && (
              <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                <Loader2
                  className="h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
                Opening your dashboard...
              </div>
            )}

          {!isSuccess &&
            content.kind !== "ready" && (
              <p className="text-center text-sm text-slate-500">
                Already verified?{" "}
                <a
                  href="/sign-in"
                  className="font-semibold text-sky-600 hover:text-sky-700"
                >
                  Sign in
                </a>
              </p>
            )}
        </CardContent>
      </Card>
    </div>
  );
}

function VerifyEmailFallback() {
  return (
    <Card className="w-full rounded-[32px] border border-slate-200/80 bg-white/95 p-8 text-center shadow-[0_28px_56px_rgba(15,23,42,0.08)]">
      <Loader2
        className="mx-auto h-6 w-6 animate-spin text-sky-600"
        aria-label="Loading"
      />
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyEmailFallback />}>
      <VerifyEmailContent />
    </Suspense>
  );
}