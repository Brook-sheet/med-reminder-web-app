"use client";

import { useState } from "react";
import { Loader2, Search, UserPlus, X } from "lucide-react";

type Role = "patient" | "family";

interface SearchResult {
  user: {
    name: string;
    role: Role;
    identifier: string;
    avatarUrl: string | null;
  };
  relationship: {
    status: "none" | "pending" | "accepted" | "declined";
    direction: "sent" | "received" | null;
    conversationId: string | null;
  };
}

interface AddContactDialogProps {
  role: Role;
  onClose: () => void;
  onRequestSent: () => void;
  onOpenConversation: (conversationId: string) => void;
}

export default function AddContactDialog({
  role,
  onClose,
  onRequestSent,
  onOpenConversation,
}: AddContactDialogProps) {
  const [identifier, setIdentifier] = useState("");
  const [contactName, setContactName] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetLabel = role === "patient" ? "Family" : "Patient";
  const placeholder = role === "patient" ? "FM-ABC123" : "PT-ABC123";

  const searchAccount = async () => {
    const normalized = identifier.trim().toUpperCase();
    if (!normalized) {
      setError(`Enter the ${targetLabel} ID.`);
      return;
    }

    setSearching(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch(
        `/api/chats/search?identifier=${encodeURIComponent(normalized)}`,
        { cache: "no-store" }
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.error || `Could not find this ${targetLabel} account.`);
        return;
      }
      setResult(data.data);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  const sendRequest = async () => {
    if (!result) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: result.user.identifier,
          contactName: contactName.trim() || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.error || "Could not send the Message Request.");
        return;
      }
      onRequestSent();
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-[28px] border border-border/80 bg-card p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
              <UserPlus className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Add {targetLabel} to Chat
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-4 text-sm leading-6 text-slate-500">
          Search using the {targetLabel} ID. A Message Request will be sent and
          Chat stays locked until the recipient accepts.
        </p>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="chatAccountId"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              {targetLabel} ID
            </label>
            <div className="flex gap-2">
              <input
                id="chatAccountId"
                value={identifier}
                onChange={(event) => {
                  setIdentifier(event.target.value.toUpperCase());
                  setResult(null);
                  setError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void searchAccount();
                  }
                }}
                placeholder={placeholder}
                maxLength={20}
                disabled={searching || submitting}
                autoFocus
                className="min-w-0 flex-1 rounded-2xl border border-border/80 bg-background px-4 py-2.5 font-mono text-sm uppercase tracking-wider outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
              <button
                type="button"
                onClick={() => void searchAccount()}
                disabled={searching || submitting || !identifier.trim()}
                className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-3 text-white hover:bg-blue-700 disabled:opacity-50"
                aria-label={`Search ${targetLabel} ID`}
              >
                {searching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {result && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900/60 dark:bg-blue-950/20">
              <p className="font-semibold text-slate-900 dark:text-white">
                {result.user.name}
              </p>
              <p className="text-xs text-slate-500">
                {result.user.role === "family" ? "Family Member" : "Patient"} ·{" "}
                {result.user.identifier}
              </p>

              {result.relationship.status !== "accepted" &&
                result.relationship.status !== "pending" && (
                  <div className="mt-3">
                    <label
                      htmlFor="contactName"
                      className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300"
                    >
                      Contact Name <span className="font-normal text-slate-400">(optional)</span>
                    </label>
                    <input
                      id="contactName"
                      value={contactName}
                      onChange={(event) => setContactName(event.target.value)}
                      placeholder={role === "patient" ? "Example: Mom" : "Example: John"}
                      maxLength={80}
                      disabled={submitting}
                      className="w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-sm outline-none focus:border-blue-500"
                    />
                  </div>
                )}

              <div className="mt-3">
                {result.relationship.status === "accepted" &&
                result.relationship.conversationId ? (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenConversation(result.relationship.conversationId!);
                      onClose();
                    }}
                    className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Open Chat
                  </button>
                ) : result.relationship.status === "pending" ? (
                  <button
                    type="button"
                    disabled
                    className="w-full rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  >
                    Request Pending
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void sendRequest()}
                    disabled={submitting}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    Add Chat
                  </button>
                )}
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="w-full rounded-2xl border border-border/80 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}