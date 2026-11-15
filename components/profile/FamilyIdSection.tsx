"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Loader2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { accountIdSuffix } from "@/lib/accountIdentifier";
import { copyTextToClipboard } from "@/lib/clipboard";

export default function FamilyIdSection() {
  const [familyId, setFamilyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const copyTimeout = useRef<number | undefined>(undefined);

  useEffect(() => {
    const controller = new AbortController();

    async function loadFamilyId() {
      try {
        const response = await fetch("/api/family/my-id", {
          cache: "no-store",
          signal: controller.signal,
        });
        const result = await response.json();

        if (!response.ok || !result.success || !result.data?.familyId) {
          setError(result.error || "Unable to load your Family ID.");
          return;
        }

        setFamilyId(result.data.familyId);
      } catch {
        if (!controller.signal.aborted) {
          setError("Network error. Please try again.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadFamilyId();

    return () => {
      controller.abort();
      window.clearTimeout(copyTimeout.current);
    };
  }, []);

  async function copyFamilyId() {
    if (!familyId) {
      return;
    }

    const successful = await copyTextToClipboard(accountIdSuffix(familyId));

    window.clearTimeout(copyTimeout.current);
    setCopied(successful);
    setError(successful ? "" : "Unable to copy your Family ID. Please try again.");

    if (successful) {
      copyTimeout.current = window.setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <section
      aria-labelledby="familyIdLabel"
      className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20"
    >
      <h3
        id="familyIdLabel"
        className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        Your Family ID
      </h3>

      {loading ? (
        <div role="status" className="flex min-h-12 items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading your Family ID...
        </div>
      ) : familyId ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="familyId"
            type="text"
            value={familyId}
            readOnly
            aria-labelledby="familyIdLabel"
            aria-describedby="familyIdHelp"
            className="min-h-12 min-w-0 flex-1 rounded-xl border-emerald-200 bg-white font-mono text-base font-bold tracking-[0.14em] text-gray-900 dark:border-emerald-900 dark:bg-slate-950 dark:text-gray-100"
          />

          <button
            type="button"
            onClick={() => void copyFamilyId()}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            aria-label="Copy Family ID"
          >
            {copied ? (
              <Check className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Copy className="h-4 w-4" aria-hidden="true" />
            )}

            <span aria-live="polite">{copied ? "Copied!" : "Copy Family ID"}</span>
          </button>
        </div>
      ) : null}

      <p id="familyIdHelp" className="mt-2 text-xs text-slate-600 dark:text-slate-400">
        Share this Family ID with the Patient so they can invite you from Chats.
      </p>

      {error && (
        <p role="alert" className="mt-2 text-sm text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}
    </section>
  );
}