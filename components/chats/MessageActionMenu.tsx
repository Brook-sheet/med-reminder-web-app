// components/chats/MessageActionMenu.tsx
'use client';

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';

type Step = 'menu' | 'confirm-me' | 'confirm-everyone';

interface UnsendResult {
  success: boolean;
  error?: string;
}

interface MessageActionMenuProps {
  onClose: () => void;
  onUnsendForMe: () => Promise<UnsendResult>;
  onUnsendForEveryone: () => Promise<UnsendResult>;
}

/**
 * Messenger-style long-press menu for a message: "Unsend for you" and
 * "Unsend for everyone", each behind its own confirmation step. This is
 * intentionally separate from the Chats List "Remove contact" confirmation
 * in ChatSidebarList.tsx — different feature, different data, different UI.
 */
export default function MessageActionMenu({ onClose, onUnsendForMe, onUnsendForEveryone }: MessageActionMenuProps) {
  const [step, setStep] = useState<Step>('menu');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    const result = step === 'confirm-me' ? await onUnsendForMe() : await onUnsendForEveryone();
    setSubmitting(false);
    if (result.success) {
      onClose();
    } else {
      setError(result.error || 'Something went wrong. Please try again.');
    }
  };

  // ── Step 1: action sheet ─────────────────────────────────────────────────
  if (step === 'menu') {
    return (
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 sm:items-center"
        onClick={onClose}
      >
        <div
          className="w-full max-w-sm overflow-hidden rounded-[28px] border border-border/80 bg-card shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setStep('confirm-me')}
            className="w-full border-b border-border/70 px-6 py-4 text-left text-sm font-semibold text-slate-800 transition hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            Unsend for you
          </button>
          <button
            type="button"
            onClick={() => setStep('confirm-everyone')}
            className="w-full border-b border-border/70 px-6 py-4 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            Unsend for everyone
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full px-6 py-4 text-center text-sm font-semibold text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── Step 2: confirmation dialog ──────────────────────────────────────────
  const isEveryone = step === 'confirm-everyone';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      onClick={submitting ? undefined : onClose}
    >
      <div
        className="w-full max-w-sm rounded-[28px] border border-border/80 bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {isEveryone ? 'Unsend for everyone?' : 'Unsend for you?'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-5 text-sm text-slate-600 dark:text-slate-300">
          {isEveryone
            ? 'Are you sure you want to unsend this message for everyone?'
            : 'Are you sure you want to unsend this message for you?'}
        </p>

        {error && (
          <p className="mb-4 rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 rounded-2xl border border-border/80 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Unsend
          </button>
        </div>
      </div>
    </div>
  );
}