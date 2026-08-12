// components/chats/MessageHoverActions.tsx
'use client';

import { useState } from 'react';
import { Reply, Copy, MoreHorizontal } from 'lucide-react';
import UnsendConfirmDialog from './UnsendConfirmDialog';

interface UnsendResult {
  success: boolean;
  error?: string;
}

interface MessageHoverActionsProps {
  isOwn: boolean;
  onReply?: () => void;
  onCopy?: () => void;
  onUnsendForMe?: () => Promise<UnsendResult>;
  onUnsendForEveryone?: () => Promise<UnsendResult>;
}

/**
 * Desktop-only, hover-revealed icon row (Reply / Copy / Unsend) shown
 * beside a message bubble, Messenger-style.
 *
 * Visibility is driven entirely by the parent's `group-hover:opacity-100`
 * CSS (see MessageBubble.tsx), not by any JS hover-tracking state — that's
 * what makes this naturally inert on touch devices (which never fire CSS
 * `:hover`) without needing any device/UA detection. `hidden sm:flex` is an
 * additional belt-and-suspenders measure so these icons never take up
 * layout space on narrow/mobile viewports even before considering hover.
 */
export default function MessageHoverActions({
  isOwn,
  onReply,
  onCopy,
  onUnsendForMe,
  onUnsendForEveryone,
}: MessageHoverActionsProps) {
  const [unsendMenuOpen, setUnsendMenuOpen] = useState(false);
  const [confirmScope, setConfirmScope] = useState<'me' | 'everyone' | null>(null);
  const canUnsend = !!onUnsendForMe && !!onUnsendForEveryone;

  if (!onReply && !onCopy && !canUnsend) return null;

  return (
    <div
      className={`hidden shrink-0 items-center gap-0.5 self-center opacity-0 transition-opacity duration-150 group-hover:opacity-100 sm:flex ${
        isOwn ? 'order-first' : 'order-last'
      }`}
    >
      {onReply && (
        <button
          type="button"
          onClick={onReply}
          className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          aria-label="Reply"
          title="Reply"
        >
          <Reply className="h-4 w-4" />
        </button>
      )}

      {onCopy && (
        <button
          type="button"
          onClick={onCopy}
          className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          aria-label="Copy message"
          title="Copy"
        >
          <Copy className="h-4 w-4" />
        </button>
      )}

      {canUnsend && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setUnsendMenuOpen((v) => !v)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="More actions"
            title="Unsend"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {unsendMenuOpen && (
            <>
              {/* Click-outside catcher */}
              <div className="fixed inset-0 z-40" onClick={() => setUnsendMenuOpen(false)} />
              <div
                className={`absolute top-full z-50 mt-1 w-44 overflow-hidden rounded-2xl border border-border/80 bg-card py-1 shadow-xl ${
                  isOwn ? 'right-0' : 'left-0'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setUnsendMenuOpen(false);
                    setConfirmScope('me');
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Unsend for you
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUnsendMenuOpen(false);
                    setConfirmScope('everyone');
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 transition hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  Unsend for everyone
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {confirmScope && onUnsendForMe && onUnsendForEveryone && (
        <UnsendConfirmDialog
          scope={confirmScope}
          onClose={() => setConfirmScope(null)}
          onConfirm={confirmScope === 'me' ? onUnsendForMe : onUnsendForEveryone}
        />
      )}
    </div>
  );
}