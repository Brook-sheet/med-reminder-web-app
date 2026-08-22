"use client";

import {
  useCallback,
  useEffect,
  useState,
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
  XCircle,
} from "lucide-react";

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
}

const STATUS_UI = {
  pending: {
    label: "Waiting for approval",
    Icon: Clock3,
    className: "text-amber-700",
  },

  approved: {
    label:
      "Monitoring Access Granted",
    Icon: CheckCircle2,
    className:
      "text-emerald-700",
  },

  declined: {
    label: "Request Declined",
    Icon: XCircle,
    className: "text-rose-700",
  },

  revoked: {
    label:
      "Monitoring Access Revoked",
    Icon: ShieldOff,
    className: "text-slate-600",
  },
} satisfies Record<
  RequestStatus,
  {
    label: string;
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

    return () =>
      window.clearInterval(interval);
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
                  </div>

                  {request.status ===
                    "approved" && (
                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          `/monitor/${encodeURIComponent(
                            request.patient
                              .patientId
                          )}`
                        )
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      <Eye className="h-4 w-4" />
                      View Monitoring
                    </button>
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