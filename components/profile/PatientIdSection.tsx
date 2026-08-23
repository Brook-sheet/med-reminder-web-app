"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  Eye,
  IdCard,
  Loader2,
  ShieldOff,
  UserPlus,
  XCircle,
} from "lucide-react";
import MonitoringChatButton from "@/components/chats/MonitoringChatButton";

type RequestStatus =
  | "pending"
  | "approved"
  | "declined"
  | "revoked";

interface FamilyRequest {
  requestId: string;
  patient: {
    name: string;
    patientId: string;
    condition?: string;
  };
  status: RequestStatus;
  chat: {
    status: "none" | "pending" | "accepted" | "declined";
    direction: "sent" | "received" | null;
    requestId: string | null;
    conversationId: string | null;
  } | null;
}

const STATUS_UI = {
  pending: {
    label: "Pending Patient Approval",
    description: "Waiting for the Patient to approve your monitoring request.",
    Icon: Clock3,
    className: "text-amber-700",
  },

  approved: {
    label:
      "Monitoring Access Granted",
    description: "Connected",
    Icon: CheckCircle2,
    className:
      "text-emerald-700",
  },

  declined: {
    label: "Request Declined",
    description: "The Patient declined your monitoring request.",
    Icon: XCircle,
    className: "text-rose-700",
  },

  revoked: {
    label:
      "Monitoring Access Revoked",
    description: "You no longer have permission to monitor this Patient.",
    Icon: ShieldOff,
    className: "text-slate-600",
  },
} satisfies Record<
  RequestStatus,
  {
    label: string;
    description: string;
    Icon: typeof Clock3;
    className: string;
  }
>;

export default function PatientIdSection() {
  const router = useRouter();

  const [familyId, setFamilyId] =
    useState("");

  const [requests, setRequests] =
    useState<FamilyRequest[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [copied, setCopied] =
    useState(false);

  const [error, setError] =
    useState("");

  const [patientIdInput, setPatientIdInput] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [requestFeedback, setRequestFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadData = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
      }

      try {
        const [
          idResponse,
          requestsResponse,
        ] = await Promise.all([
          fetch(
            "/api/family/my-id",
            {
              cache: "no-store",
            }
          ),

          fetch(
            "/api/patient/monitor",
            {
              cache: "no-store",
            }
          ),
        ]);

        const [
          idResult,
          requestsResult,
        ] = await Promise.all([
          idResponse.json(),
          requestsResponse.json(),
        ]);

        if (
          !idResponse.ok ||
          !idResult.success
        ) {
          setError(
            idResult.error ||
              "Unable to load your Family ID."
          );

          return;
        }

        setFamilyId(
          idResult.data.familyId
        );

        setRequests(
          requestsResponse.ok &&
            requestsResult.success
            ? requestsResult.data
                .requests ?? []
            : []
        );

        setError("");
      } catch {
        setError(
          "Network error. Please try again."
        );
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    void loadData();

    const interval =
      window.setInterval(
        () => void loadData(true),
        10_000
      );

    const handleRelationshipUpdate = () =>
      void loadData(true);

    window.addEventListener(
      "chat-relationships-updated",
      handleRelationshipUpdate
    );

    return () => {
      window.clearInterval(interval);
      window.removeEventListener(
        "chat-relationships-updated",
        handleRelationshipUpdate
      );
    };
  }, [loadData]);

  const copyFamilyId = async () => {
    if (!familyId) {
      return;
    }

    await navigator.clipboard.writeText(
      familyId
    );

    setCopied(true);

    window.setTimeout(
      () => setCopied(false),
      2000
    );
  };

  const requestMonitoringAccess = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = patientIdInput.trim().toUpperCase();

    if (!normalized) {
      setRequestFeedback({ type: "error", text: "Enter the Patient ID." });
      return;
    }

    setRequesting(true);
    setRequestFeedback(null);
    try {
      const response = await fetch("/api/patient/monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: normalized }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        setRequestFeedback({
          type: "error",
          text: result.error || "Unable to send the monitoring request.",
        });
        return;
      }

      setPatientIdInput("");
      setRequestFeedback({ type: "success", text: result.message });
      await loadData(true);
    } catch {
      setRequestFeedback({ type: "error", text: "Network error. Please try again." });
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/20">
        <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
          <IdCard className="h-5 w-5" />

          <h2 className="text-lg font-semibold">
            Your Family ID
          </h2>
        </div>

        {loading ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating your Family ID...
          </div>
        ) : familyId ? (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <div className="min-w-0 flex-1 rounded-2xl border border-emerald-200 bg-white px-5 py-4 font-mono text-xl font-bold tracking-[0.18em] text-slate-900 dark:border-emerald-900 dark:bg-slate-950 dark:text-white">
              {familyId}
            </div>

            <button
              type="button"
              onClick={() =>
                void copyFamilyId()
              }
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
              aria-label="Copy Family ID"
            >
              {copied ? (
                <Check className="h-5 w-5" />
              ) : (
                <Copy className="h-5 w-5" />
              )}

              {copied
                ? "Copied!"
                : "Copy Family ID"}
            </button>
          </div>
        ) : null}

        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
          Share this Family ID with the
          Patient. The Patient can invite
          you from Chats. This ID is
          separate from every Patient ID.
        </p>

        {error && (
          <p className="mt-3 text-sm text-rose-600">
            {error}
          </p>
        )}
      </section>

      <section className="rounded-3xl border border-border/80 bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 text-slate-900 dark:text-white">
          <UserPlus className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold">Monitor a Patient</h2>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          Enter the Patient ID of the person you want to monitor. Access is
          granted only after the Patient approves your request.
        </p>

        <form onSubmit={requestMonitoringAccess} className="mt-4 space-y-3">
          <div>
            <label
              htmlFor="monitorPatientId"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Patient ID
            </label>
            <input
              id="monitorPatientId"
              value={patientIdInput}
              onChange={(event) => {
                setPatientIdInput(event.target.value.toUpperCase());
                setRequestFeedback(null);
              }}
              placeholder="PT-ABC123"
              maxLength={20}
              disabled={requesting}
              className="w-full rounded-2xl border border-border/80 bg-background px-4 py-3 font-mono text-sm uppercase tracking-wider outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <button
            type="submit"
            disabled={requesting || !patientIdInput.trim()}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 sm:w-auto"
          >
            {requesting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            {requesting ? "Sending Request..." : "Request Access"}
          </button>

          {requestFeedback && (
            <p
              className={`rounded-xl px-3 py-2 text-sm ${
                requestFeedback.type === "success"
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                  : "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300"
              }`}
            >
              {requestFeedback.text}
            </p>
          )}
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          Patient Connections
        </h2>

        {!loading &&
        requests.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center">
            <p className="font-medium text-slate-700 dark:text-slate-200">
              No Patient connected
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Ask the Patient to add your
              Family ID from their Chats
              page.
            </p>
          </div>
        ) : (
          requests.map((request) => {
            const status =
              STATUS_UI[request.status];

            const StatusIcon =
              status.Icon;

            return (
              <article
                key={request.requestId}
                className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm"
              >
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">
                      {
                        request.patient
                          .name
                      }
                    </h3>

                    <div
                      className={`mt-2 inline-flex items-center gap-2 text-sm font-semibold ${status.className}`}
                    >
                      <StatusIcon className="h-4 w-4" />
                      {status.label}
                    </div>

                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {status.description}
                    </p>
                  </div>

                  {request.status ===
                    "approved" && (
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={() =>
                          router.push(
                            `/monitor/${encodeURIComponent(request.patient.patientId)}`
                          )
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                      >
                        <Eye className="h-4 w-4" />
                        View Monitoring
                      </button>
                      <MonitoringChatButton
                        monitoringRequestId={request.requestId}
                        relationship={request.chat}
                        onUpdated={() => void loadData(true)}
                      />
                    </div>
                  )}
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}