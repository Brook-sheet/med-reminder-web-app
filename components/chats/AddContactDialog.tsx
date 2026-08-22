"use client";

import {
  useState,
} from "react";
import {
  Loader2,
  UserPlus,
  X,
} from "lucide-react";

interface AddContactDialogProps {
  onClose: () => void;

  onAdd: (
    familyId: string,
    contactName?: string
  ) => Promise<{
    success: boolean;
    error?: string;
    data?: {
      conversationId: string;
    };
  }>;

  onAdded: (
    conversationId: string
  ) => void;
}

export default function AddContactDialog({
  onClose,
  onAdd,
  onAdded,
}: AddContactDialogProps) {
  const [familyId, setFamilyId] =
    useState("");

  const [
    contactName,
    setContactName,
  ] = useState("");

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const handleSubmit = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    if (!familyId.trim()) {
      setError(
        "Enter the Family ID."
      );

      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await onAdd(
        familyId.trim(),
        contactName.trim() ||
          undefined
      );

      if (
        result.success &&
        result.data
      ) {
        onAdded(
          result.data
            .conversationId
        );

        onClose();
      } else {
        setError(
          result.error ||
            "Could not add this Family member."
        );
      }
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
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
              <UserPlus className="h-5 w-5" />
            </div>

            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Add Family Member
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
          Enter the Family member’s
          unique FM ID. Adding them
          explicitly grants monitoring
          and chat access.
        </p>

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <div>
            <label
              htmlFor="familyId"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Family ID
            </label>

            <input
              id="familyId"
              value={familyId}
              onChange={(event) =>
                setFamilyId(
                  event.target.value.toUpperCase()
                )
              }
              placeholder="FM-ABC123"
              maxLength={20}
              disabled={submitting}
              autoFocus
              className="w-full rounded-2xl border border-border/80 bg-background px-4 py-2.5 font-mono text-sm uppercase tracking-wider outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label
              htmlFor="contactName"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Contact Name{" "}
              <span className="font-normal text-slate-400">
                (optional)
              </span>
            </label>

            <input
              id="contactName"
              value={contactName}
              onChange={(event) =>
                setContactName(
                  event.target.value
                )
              }
              placeholder="Example: Mom"
              disabled={submitting}
              className="w-full rounded-2xl border border-border/80 bg-background px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {error && (
            <p className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 rounded-2xl border border-border/80 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                submitting ||
                !familyId.trim()
              }
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}

              Add Family
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}