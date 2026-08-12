// components/chats/MessageActionMenu.tsx
'use client';

import { useState } from 'react';
import { Reply, Copy } from 'lucide-react';
import UnsendConfirmDialog from './UnsendConfirmDialog';

type Step = 'menu' | 'confirm-me' | 'confirm-everyone';

interface UnsendResult {
  success: boolean;
  error?: string;
}

interface MessageActionMenuProps {
  onClose: () => void;
  // Reply/Copy are omitted entirely (not just disabled) when not applicable
  // to this message — e.g. Copy is left out for a message with no text.
  onReply?: () => void;
  onCopy?: () => void;
  // Unsend is only ever offered for the current user's own messages —
  // MessageBubble omits both when the message isn't eligible.
  onUnsendForMe?: () => Promise<UnsendResult>;
  onUnsendForEveryone?: () => Promise<UnsendResult>;
}

/**
 * Mobile long-press action sheet for a message: Reply, Copy, and Unsend
 * (for you / for everyone, each behind its own confirmation dialog). This
 * is the touch-friendly counterpart to the desktop hover icons in
 * MessageHoverActions.tsx — same underlying actions, different trigger and
 * presentation, per the mobile-vs-desktop requirement.
 */
export default function MessageActionMenu({
  onClose,
  onReply,
  onCopy,
  onUnsendForMe,
  onUnsendForEveryone,
}: MessageActionMenuProps) {
  const [step, setStep] = useState<Step>('menu');
  const canUnsend = !!onUnsendForMe && !!onUnsendForEveryone;

  // ── Confirmation step (unsend only) ──────────────────────────────────────
  if ((step === 'confirm-me' || step === 'confirm-everyone') && canUnsend) {
    return (
      <UnsendConfirmDialog
        scope={step === 'confirm-me' ? 'me' : 'everyone'}
        onClose={onClose}
        onConfirm={step === 'confirm-me' ? onUnsendForMe! : onUnsendForEveryone!}
      />
    );
  }

  // ── Action sheet ──────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-[28px] border border-border/80 bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {onReply && (
          <button
            type="button"
            onClick={() => {
              onReply();
              onClose();
            }}
            className="flex w-full items-center gap-3 border-b border-border/70 px-6 py-4 text-left text-sm font-semibold text-slate-800 transition hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <Reply className="h-4 w-4 text-slate-400" />
            Reply
          </button>
        )}
        {onCopy && (
          <button
            type="button"
            onClick={() => {
              onCopy();
              onClose();
            }}
            className="flex w-full items-center gap-3 border-b border-border/70 px-6 py-4 text-left text-sm font-semibold text-slate-800 transition hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <Copy className="h-4 w-4 text-slate-400" />
            Copy
          </button>
        )}
        {canUnsend && (
          <>
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
          </>
        )}
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