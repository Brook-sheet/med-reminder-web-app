"use client";

import {
  Suspense,
  useEffect,
  useState,
} from "react";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  HeartPulse,
  Loader2,
  Users,
} from "lucide-react";
import OnboardingDialog from "@/components/OnboardingDialog";

type ApplicationRole =
  | "patient"
  | "family";

function GoogleCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const status =
    searchParams.get("status");

  const onboarding =
    searchParams.get("onboarding");

  const existingRole =
    searchParams.get("role");

  const message =
    searchParams.get("message");

  const [
    showOnboarding,
    setShowOnboarding,
  ] = useState(
    status === "success" &&
      onboarding === "required"
  );

  const [
    selectingRole,
    setSelectingRole,
  ] = useState<ApplicationRole | null>(
    null
  );

  const [error, setError] =
    useState("");

  useEffect(() => {
    if (
      status !== "success" ||
      onboarding === "required"
    ) {
      return;
    }

    router.replace(
      existingRole === "family"
        ? "/monitor"
        : "/"
    );

    router.refresh();
  }, [
    existingRole,
    onboarding,
    router,
    status,
  ]);

  const handleRoleSelection = async (
    role: ApplicationRole
  ) => {
    setSelectingRole(role);
    setError("");

    try {
      const response = await fetch(
        "/api/auth/google/complete",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            role,
          }),
        }
      );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.success
      ) {
        setError(
          result.error ||
            "Unable to create your account."
        );

        return;
      }

      if (
        result.data?.role ===
          "patient" &&
        result.data
          ?.onboardingRequired
      ) {
        setShowOnboarding(true);
        return;
      }

      router.replace(
        result.data?.role === "family"
          ? "/monitor"
          : "/"
      );

      router.refresh();
    } catch {
      setError(
        "Network error. Please try again."
      );
    } finally {
      setSelectingRole(null);
    }
  };

  const handleOnboardingComplete =
    () => {
      setShowOnboarding(false);
      router.replace("/");
      router.refresh();
    };

  if (showOnboarding) {
    return (
      <OnboardingDialog
        isOpen={showOnboarding}
        onComplete={
          handleOnboardingComplete
        }
      />
    );
  }

  if (status === "role_required") {
    return (
      <div className="w-full overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_28px_56px_rgba(15,23,42,0.08)]">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-7 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">
            How will you use Med App
            Reminder?
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Choose your account role.
            This determines your
            onboarding and application
            access.
          </p>
        </div>

        <div className="space-y-4 p-6">
          {error && (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={() =>
              void handleRoleSelection(
                "patient"
              )
            }
            disabled={
              selectingRole !== null
            }
            className="flex w-full items-start gap-4 rounded-3xl border border-sky-200 bg-sky-50/70 p-5 text-left transition hover:border-sky-400 hover:bg-sky-50 disabled:opacity-60"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
              {selectingRole ===
              "patient" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <HeartPulse className="h-5 w-5" />
              )}
            </span>

            <span>
              <span className="block font-semibold text-slate-900">
                Continue as Patient
              </span>

              <span className="mt-1 block text-sm leading-6 text-slate-600">
                Manage your own
                medications, reminders,
                and medication
                information.
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              void handleRoleSelection(
                "family"
              )
            }
            disabled={
              selectingRole !== null
            }
            className="flex w-full items-start gap-4 rounded-3xl border border-emerald-200 bg-emerald-50/70 p-5 text-left transition hover:border-emerald-400 hover:bg-emerald-50 disabled:opacity-60"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              {selectingRole ===
              "family" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Users className="h-5 w-5" />
              )}
            </span>

            <span>
              <span className="block font-semibold text-slate-900">
                Continue as Family
              </span>

              <span className="mt-1 block text-sm leading-6 text-slate-600">
                Monitor a Patient only
                after they approve your
                access request.
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              router.replace("/sign-in")
            }
            disabled={
              selectingRole !== null
            }
            className="w-full rounded-3xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (
    status === "error" ||
    status ===
      "configuration_error" ||
    status === "invalid_request" ||
    status === "account_deleted" ||
    status === "cancelled"
  ) {
    const fallbackMessage =
      status === "cancelled"
        ? "Google sign-in was cancelled."
        : status ===
            "account_deleted"
          ? "This account has been deleted."
          : "Unable to sign in with Google. Please try again.";

    return (
      <div className="w-full rounded-[32px] border border-red-200 bg-white p-8 text-center shadow-[0_28px_56px_rgba(15,23,42,0.08)]">
        <h1 className="text-2xl font-semibold text-slate-900">
          Google sign-in failed
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          {message || fallbackMessage}
        </p>

        <button
          type="button"
          onClick={() =>
            router.replace("/sign-in")
          }
          className="mt-6 w-full rounded-3xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-sky-700"
        >
          Return to sign in
        </button>
      </div>
    );
  }

  return (
    <div className="w-full rounded-[32px] border border-slate-200 bg-white p-8 text-center shadow-[0_28px_56px_rgba(15,23,42,0.08)]">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-sky-600" />

      <p className="mt-4 text-sm text-slate-600">
        Completing Google sign-in…
      </p>
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full rounded-[32px] border border-slate-200 bg-white p-8 text-center shadow-[0_28px_56px_rgba(15,23,42,0.08)]">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-sky-600" />

          <p className="mt-4 text-sm text-slate-600">
            Completing Google
            sign-in…
          </p>
        </div>
      }
    >
      <GoogleCallbackContent />
    </Suspense>
  );
}