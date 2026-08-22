"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  Check,
  Loader2,
  ShieldCheck,
  UserRoundCheck,
  UserRoundX,
  X,
} from "lucide-react";

type RequestStatus =
  | "pending"
  | "approved"
  | "declined"
  | "revoked";

interface PatientRequest {
  requestId: string;
  family: {
    id: string;
    name: string;
    email?: string;
  };
  status: RequestStatus;
  createdAt: string;
  updatedAt: string;
}

export default function FamilyMonitoringCard() {
  const [role, setRole] = useState<
    "patient" | "family" | null
  >(null);

  const [requests, setRequests] = useState<
    PatientRequest[]
  >([]);

  const [loading, setLoading] = useState(true);

  const [actingId, setActingId] = useState<
    string | null
  >(null);

  const [message, setMessage] = useState("");

  const loadRequests = useCallback(async () => {
    try {
      const response = await fetch(
        "/api/patient/monitor",
        {
          cache: "no-store",
        }
      );

      const result = await response.json();

      if (response.ok && result.success) {
        setRole(result.data.role);
        setRequests(
          result.data.requests ?? []
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const updateRequest = async (
    requestId: string,
    action:
      | "approve"
      | "decline"
      | "revoke"
  ) => {
    setActingId(requestId);
    setMessage("");

    try {
      const response = await fetch(
        "/api/patient/monitor",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            requestId,
            action,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        setMessage(
          result.error ||
            "Unable to update monitoring access."
        );

        return;
      }

      setMessage(result.message);

      await loadRequests();

      window.dispatchEvent(
        new Event(
          "monitoring-requests-updated"
        )
      );
    } catch {
      setMessage(
        "Network error. Please try again."
      );
    } finally {
      setActingId(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-[28px] border border-border/80 bg-card p-6">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading Family monitoring...
        </div>
      </div>
    );
  }

  if (role !== "patient") {
    return null;
  }

  const pending = requests.filter(
    (request) =>
      request.status === "pending"
  );

  const approved = requests.filter(
    (request) =>
      request.status === "approved"
  );

  return (
    <section
      id="family-monitoring"
      className="scroll-mt-6 rounded-[28px] border border-border/80 bg-card p-6 shadow-sm"
    >
      <div className="flex items-center gap-2 border-b border-border/70 pb-4">
        <ShieldCheck className="h-5 w-5 text-blue-600" />

        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Family Monitoring
          </h2>

          <p className="text-sm text-slate-500">
            Decide who may view your
            medication monitoring information
            and chat with you.
          </p>
        </div>
      </div>

      {message && (
        <p className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-200">
          {message}
        </p>
      )}

      <div className="mt-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 dark:text-white">
            Pending Monitoring Requests
          </h3>

          {pending.length > 0 && (
            <span className="rounded-full bg-red-500 px-2.5 py-1 text-xs font-bold text-white">
              {pending.length}
            </span>
          )}
        </div>

        {pending.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-slate-500">
            No pending monitoring requests.
          </p>
        ) : (
          pending.map((request) => (
            <article
              key={request.requestId}
              className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/60 dark:bg-amber-950/20"
            >
              <p className="font-semibold text-slate-900 dark:text-white">
                {request.family.name}
              </p>

              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                wants to monitor your
                medication activity. Do you
                know this person?
              </p>

              {request.family.email && (
                <p className="mt-1 text-xs text-slate-500">
                  {request.family.email}
                </p>
              )}

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() =>
                    void updateRequest(
                      request.requestId,
                      "approve"
                    )
                  }
                  disabled={
                    actingId === request.requestId
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {actingId ===
                  request.requestId ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}

                  Allow Access
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void updateRequest(
                      request.requestId,
                      "decline"
                    )
                  }
                  disabled={
                    actingId === request.requestId
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-300 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-800 dark:bg-slate-950 dark:text-rose-300"
                >
                  <X className="h-4 w-4" />
                  Decline
                </button>
              </div>
            </article>
          ))
        )}
      </div>

      <div className="mt-7 space-y-3">
        <h3 className="font-semibold text-slate-900 dark:text-white">
          Connected Family Members
        </h3>

        {approved.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-slate-500">
            No Family member currently has
            monitoring access.
          </p>
        ) : (
          approved.map((request) => (
            <article
              key={request.requestId}
              className="flex flex-col justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 sm:flex-row sm:items-center dark:border-emerald-900/60 dark:bg-emerald-950/20"
            >
              <div className="flex items-start gap-3">
                <UserRoundCheck className="mt-0.5 h-5 w-5 text-emerald-600" />

                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {request.family.name}
                  </p>

                  <p className="text-sm text-emerald-700 dark:text-emerald-300">
                    Monitoring Access
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  void updateRequest(
                    request.requestId,
                    "revoke"
                  )
                }
                disabled={
                  actingId === request.requestId
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-300 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-800 dark:bg-slate-950 dark:text-rose-300"
              >
                {actingId ===
                request.requestId ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserRoundX className="h-4 w-4" />
                )}

                Remove Access
              </button>
            </article>
          ))
        )}
      </div>
    </section>
  );
}