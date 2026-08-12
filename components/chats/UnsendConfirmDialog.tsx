// components/chats/UnsendConfirmDialog.tsx
'use client';

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';

interface UnsendResult {
  success: boolean;
  error?: string;
}

interface UnsendConfirmDialogProps {
  scope: 'me' | 'everyone';
  onClose: () => void;
  onConfirm: () => Promise<UnsendResult>;
}

/**
 * The unsend confirmation dialog — unchanged behavior/copy from before,
 * just extracted into its own component so it can be triggered from either
 * the desktop hover menu (MessageHoverActions) or the mobile action sheet
 * (MessageActionMenu) without duplicating this UI.
 */
export default function UnsendConfirmDialog({ scope, onClose, onConfirm }: UnsendConfirmDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEveryone = scope === 'everyone';

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    const result = await onConfirm();
    setSubmitting(false);
    if (result.success) {
      onClose();
    } else {
      setError(result.error || 'Something went wrong. Please try again.');
    }
  };

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