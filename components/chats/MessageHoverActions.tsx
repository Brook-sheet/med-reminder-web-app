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

interface MenuPosition {
  left: number;
  top: number;
}

// Approximate footprint of the 2-item unsend dropdown — used only to keep
// it inside the viewport; doesn't need to be pixel-perfect since it's
// clamped either way.
const MENU_WIDTH = 176; // matches w-44
const MENU_HEIGHT = 84; // two ~40px rows + vertical padding
const VIEWPORT_MARGIN = 8;

// Anchors the unsend dropdown to where the user actually clicked, instead
// of to the trigger button's position. Prefers opening ABOVE the cursor
// (so the menu doesn't sit on top of what was just clicked), falling back
// to below when there isn't room, and clamps both axes so it never runs
// off any edge of the viewport.
//
// The menu is CENTERED under the cursor (not left-aligned to it) — the
// "More" trigger sits right beside a message bubble, often close to the
// bubble's own edge, so anchoring the menu's left edge to the cursor would
// push its full width further outward and past a short bubble. Centering
// keeps it visually anchored to the click point itself, regardless of
// which side of the bubble the trigger happens to be on.
function computeMenuPosition(clientX: number, clientY: number): MenuPosition {
  let left = clientX - MENU_WIDTH / 2;
  if (left + MENU_WIDTH + VIEWPORT_MARGIN > window.innerWidth) {
    left = window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN;
  }
  if (left < VIEWPORT_MARGIN) left = VIEWPORT_MARGIN;

  let top = clientY - MENU_HEIGHT - VIEWPORT_MARGIN; // above the cursor by default
  if (top < VIEWPORT_MARGIN) {
    top = clientY + VIEWPORT_MARGIN; // not enough room above — open below instead
  }
  if (top + MENU_HEIGHT + VIEWPORT_MARGIN > window.innerHeight) {
    top = window.innerHeight - MENU_HEIGHT - VIEWPORT_MARGIN;
  }
  if (top < VIEWPORT_MARGIN) top = VIEWPORT_MARGIN;

  return { left, top };
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
 * This hover behavior itself is unchanged — only the unsend dropdown below
 * now anchors to the click position rather than the button.
 */
export default function MessageHoverActions({
  isOwn,
  onReply,
  onCopy,
  onUnsendForMe,
  onUnsendForEveryone,
}: MessageHoverActionsProps) {
  const [unsendMenuPos, setUnsendMenuPos] = useState<MenuPosition | null>(null);
  const [confirmScope, setConfirmScope] = useState<'me' | 'everyone' | null>(null);
  const canUnsend = !!onUnsendForMe && !!onUnsendForEveryone;

  if (!onReply && !onCopy && !canUnsend) return null;

  const handleToggleUnsendMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (unsendMenuPos) {
      setUnsendMenuPos(null);
      return;
    }
    setUnsendMenuPos(computeMenuPosition(e.clientX, e.clientY));
  };

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
        <button
          type="button"
          onClick={handleToggleUnsendMenu}
          className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          aria-label="More actions"
          title="Unsend"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      )}

      {unsendMenuPos && canUnsend && (
        <>
          {/* Click-outside catcher */}
          <div className="fixed inset-0 z-40" onClick={() => setUnsendMenuPos(null)} />
          <div
            className="fixed z-50 w-44 overflow-hidden rounded-2xl border border-border/80 bg-card py-1 shadow-xl"
            style={{ left: unsendMenuPos.left, top: unsendMenuPos.top }}
          >
            <button
              type="button"
              onClick={() => {
                setUnsendMenuPos(null);
                setConfirmScope('me');
              }}
              className="w-full px-4 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Unsend for you
            </button>
            <button
              type="button"
              onClick={() => {
                setUnsendMenuPos(null);
                setConfirmScope('everyone');
              }}
              className="w-full px-4 py-2 text-left text-sm text-red-600 transition hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              Unsend for everyone
            </button>
          </div>
        </>
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