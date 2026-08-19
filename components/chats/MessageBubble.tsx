// components/chats/MessageBubble.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, CheckCheck, Clock, AlertCircle, FileText, Download, Ban, ClipboardCheck, Reply } from 'lucide-react';
import type { ChatMessage } from '@/lib/interfaces/data/Chat';
import { formatFileSize } from '@/lib/chatMedia';
import { copyTextToClipboard } from '@/lib/clipboard';
import MessageActionMenu from './MessageActionMenu';
import MessageHoverActions from './MessageHoverActions';

const LONG_PRESS_MS = 500;
const COPIED_BADGE_MS = 1500;
const SWIPE_REPLY_THRESHOLD = 64;
const SWIPE_MAX_DISTANCE = 88;
const SWIPE_DIRECTION_LOCK = 10;

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function StatusIcon({ status }: { status: ChatMessage['status'] }) {
  switch (status) {
    case 'sending':
      return <Clock className="h-3.5 w-3.5 text-white/70" />;
    case 'failed':
      return <AlertCircle className="h-3.5 w-3.5 text-red-200" />;
    case 'read':
      return <CheckCheck className="h-3.5 w-3.5 text-sky-200" />;
    case 'delivered':
      return <Check className="h-3.5 w-3.5 text-white/70 transition-colors duration-200" />;
    case 'sent':
    default:
      return <Check className="h-3.5 w-3.5 text-white/70 transition-colors duration-200" />;
  }
}

const STATUS_LABEL: Record<ChatMessage['status'], string> = {
  sending: 'Sending…',
  sent: 'Sent',
  delivered: 'Sent',
  read: 'Read',
  failed: 'Failed to send',
};

interface UnsendResult {
  success: boolean;
  error?: string;
}

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  currentUserId: string;
  contactName: string;
  onRetry?: () => void;
  onReply?: (message: ChatMessage) => void;
  onJumpToMessage?: (messageId: string) => void;
  onUnsendForMe?: () => Promise<UnsendResult>;
  onUnsendForEveryone?: () => Promise<UnsendResult>;
}

/** Placeholder shown once a message has been unsent for everyone. */
function UnsentContent({ isOwn }: { isOwn: boolean }) {
  return (
    <div
      className={`flex items-center gap-1.5 rounded-3xl px-4 py-2.5 text-sm italic text-slate-400 dark:text-slate-500 ${
        isOwn ? 'rounded-br-md bg-slate-100 dark:bg-slate-800/60' : 'rounded-bl-md border border-border/70 bg-card'
      }`}
    >
      <Ban className="h-3.5 w-3.5 shrink-0" />
      {isOwn ? 'You unsent this message' : 'This message was unsent'}
    </div>
  );
}

/** Small quoted preview of the message being replied to, shown above the reply's own content. */
function ReplyQuote({
  replyTo,
  isOwn,
  currentUserId,
  contactName,
  onJumpToMessage,
}: {
  replyTo: NonNullable<ChatMessage['replyTo']>;
  isOwn: boolean;
  currentUserId: string;
  contactName: string;
  onJumpToMessage?: (messageId: string) => void;
}) {
  const label = replyTo.senderId === currentUserId ? 'You' : contactName;
  const snippet = replyTo.unsent ? 'Original message was unsent' : replyTo.text || 'Attachment';

  return (
    <button
      type="button"
      onClick={onJumpToMessage ? () => onJumpToMessage(replyTo.messageId) : undefined}
      className={`mb-1 flex w-full flex-col rounded-2xl border-l-[3px] px-3 py-1.5 text-left text-xs transition ${
        isOwn
          ? 'border-blue-300 bg-blue-50/80 text-blue-900 hover:bg-blue-100/80 dark:border-blue-400/50 dark:bg-blue-950/30 dark:text-blue-200'
          : 'border-slate-300 bg-slate-100/80 text-slate-600 hover:bg-slate-200/70 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-300'
      } ${onJumpToMessage ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <span className="font-semibold">{label}</span>
      <span className={`truncate ${replyTo.unsent ? 'italic opacity-70' : 'opacity-80'}`}>{snippet}</span>
    </button>
  );
}

/** Bubble body for a plain text message. */
function TextContent({ message, isOwn }: { message: ChatMessage; isOwn: boolean }) {
  return (
    <div
      className={`whitespace-pre-wrap break-words rounded-3xl px-4 py-2.5 text-sm shadow-sm transition-opacity ${
        isOwn
          ? 'rounded-br-md bg-blue-600 text-white dark:bg-blue-500'
          : 'rounded-bl-md border border-border/70 bg-card text-slate-800 dark:text-slate-100'
      } ${message.status === 'sending' ? 'opacity-70' : ''} ${
        message.status === 'failed' ? 'border border-red-400/60' : ''
      }`}
    >
      {message.text}
    </div>
  );
}

/** Bubble body for an image attachment, with an inline upload-progress overlay. */
function ImageContent({ message, isOwn }: { message: ChatMessage; isOwn: boolean }) {
  const attachment = message.attachment!;
  const isUploading = message.status === 'sending';
  const displaySrc = message.localPreviewUrl || attachment.url;

  return (
    <div
      className={`overflow-hidden rounded-3xl shadow-sm ${
        message.status === 'failed' ? 'border border-red-400/60' : ''
      }`}
    >
      <div className="relative">
        <a
          href={attachment.url || undefined}
          target="_blank"
          rel="noopener noreferrer"
          className={attachment.url ? 'block' : 'pointer-events-none block'}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displaySrc}
            alt={attachment.fileName}
            className="max-h-72 w-full max-w-[16rem] object-cover"
          />
        </a>

        {isUploading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40">
            <div className="h-1.5 w-2/3 overflow-hidden rounded-full bg-white/30">
              <div
                className="h-full rounded-full bg-white transition-all duration-200"
                style={{ width: `${message.uploadProgress ?? 0}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-white">{message.uploadProgress ?? 0}%</span>
          </div>
        )}
      </div>

      {message.text && (
        <p
          className={`whitespace-pre-wrap break-words px-4 py-2.5 text-sm ${
            isOwn ? 'bg-blue-600 text-white dark:bg-blue-500' : 'border-t border-border/70 bg-card text-slate-800 dark:text-slate-100'
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}

/** Bubble body for a non-image file attachment (document, PDF, etc.). */
function FileContent({ message, isOwn }: { message: ChatMessage; isOwn: boolean }) {
  const attachment = message.attachment!;
  const isUploading = message.status === 'sending';

  return (
    <div
      className={`overflow-hidden rounded-3xl shadow-sm ${
        isOwn
          ? 'rounded-br-md bg-blue-600 text-white dark:bg-blue-500'
          : 'rounded-bl-md border border-border/70 bg-card text-slate-800 dark:text-slate-100'
      } ${message.status === 'failed' ? 'border border-red-400/60' : ''}`}
    >
      <a
        href={attachment.url ? `${attachment.url}?download=1` : undefined}
        className={`flex items-center gap-3 px-4 py-3 transition ${
          attachment.url ? 'hover:opacity-90' : 'pointer-events-none'
        }`}
      >
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            isOwn ? 'bg-white/15' : 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300'
          }`}
        >
          <FileText className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{attachment.fileName}</p>

          <p className={`text-xs ${isOwn ? 'opacity-80' : 'text-slate-500 dark:text-slate-400'}`}>
            {isUploading ? `Uploading… ${message.uploadProgress ?? 0}%` : formatFileSize(attachment.fileSize)}
          </p>

          {isUploading && (
            <div
              className={`mt-1.5 h-1 w-full overflow-hidden rounded-full ${
                isOwn ? 'bg-white/25' : 'bg-slate-200 dark:bg-slate-700'
              }`}
            >
              <div
                className={`h-full rounded-full transition-all duration-200 ${
                  isOwn ? 'bg-white' : 'bg-blue-500'
                }`}
                style={{ width: `${message.uploadProgress ?? 0}%` }}
              />
            </div>
          )}
        </div>

        {!isUploading && attachment.url && <Download className="h-4 w-4 shrink-0 opacity-75" />}
      </a>

      {message.text && (
        <p
          className={`whitespace-pre-wrap break-words px-4 pb-3 text-sm ${
            isOwn ? '' : 'border-t border-border/70 pt-2'
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}

export default function MessageBubble({
  message,
  isOwn,
  currentUserId,
  contactName,
  onRetry,
  onReply,
  onJumpToMessage,
  onUnsendForMe,
  onUnsendForEveryone,
}: MessageBubbleProps) {
  const isAttachment = message.type === 'attachment' && !!message.attachment;
  const isImage = isAttachment && message.attachment!.mimeType.startsWith('image/');

  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const copiedTimer = useRef<NodeJS.Timeout | null>(null);
  const swipeStart = useRef({ x: 0, y: 0 });
  const swipeOffsetRef = useRef(0);
  const swipeActive = useRef(false);
  const swipeAxis = useRef<'horizontal' | 'vertical' | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      if (pressTimer.current) clearTimeout(pressTimer.current);
    };
  }, []);

  const isEligible = !message.unsent && !message._id.startsWith('tmp-');

  // Unsend stays own-message-only. Reply and Copy work for either
  // participant's messages.
  const canUnsend = isOwn && isEligible && !!onUnsendForMe && !!onUnsendForEveryone;
  const canReply = isEligible && !!onReply;
  const canCopy = isEligible && !!message.text;

  const handleReply = () => onReply?.(message);

  const handleCopy = async () => {
    const ok = await copyTextToClipboard(message.text);

    if (ok) {
      setCopied(true);

      if (copiedTimer.current) {
        clearTimeout(copiedTimer.current);
      }

      copiedTimer.current = setTimeout(() => setCopied(false), COPIED_BADGE_MS);
    }
  };

  const hasAnyAction = canReply || canCopy || canUnsend;

  const cancelPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const startPress = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!hasAnyAction) return;

    const touch = e.touches[0];
    const isMobileLayout = window.matchMedia('(max-width: 639px)').matches;

    swipeStart.current = {
      x: touch.clientX,
      y: touch.clientY,
    };

    swipeOffsetRef.current = 0;
    swipeActive.current = isMobileLayout && canReply;
    swipeAxis.current = null;

    setSwipeOffset(0);

    pressTimer.current = setTimeout(() => setMenuOpen(true), LONG_PRESS_MS);
  };

  const movePress = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    const deltaX = touch.clientX - swipeStart.current.x;
    const deltaY = touch.clientY - swipeStart.current.y;
    const swipeDirection = isOwn ? -1 : 1;

    if (
      Math.abs(deltaX) > SWIPE_DIRECTION_LOCK ||
      Math.abs(deltaY) > SWIPE_DIRECTION_LOCK
    ) {
      cancelPress();
    }

    if (!swipeActive.current) return;

    if (
      !swipeAxis.current &&
      (Math.abs(deltaX) > SWIPE_DIRECTION_LOCK ||
        Math.abs(deltaY) > SWIPE_DIRECTION_LOCK)
    ) {
      swipeAxis.current =
        Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical';
    }

    if (swipeAxis.current === 'vertical') {
      swipeActive.current = false;
      swipeOffsetRef.current = 0;

      setSwipeOffset(0);
      setIsSwiping(false);
      return;
    }

    if (swipeAxis.current !== 'horizontal') return;

    e.preventDefault();

    const nextDistance = Math.min(
      SWIPE_MAX_DISTANCE,
      Math.max(0, deltaX * swipeDirection),
    );

    swipeOffsetRef.current = nextDistance;

    setSwipeOffset(nextDistance * swipeDirection);
    setIsSwiping(true);
  };

  const endPress = () => {
    cancelPress();

    const shouldReply =
      swipeActive.current &&
      swipeOffsetRef.current >= SWIPE_REPLY_THRESHOLD;

    swipeActive.current = false;
    swipeAxis.current = null;
    swipeOffsetRef.current = 0;

    setSwipeOffset(0);
    setIsSwiping(false);

    if (shouldReply) {
      handleReply();
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!hasAnyAction) return;

    e.preventDefault();
    setMenuOpen(true);
  };

  if (message.unsent) {
    return (
      <div
        id={`msg-${message._id}`}
        className={`flex w-full ${isOwn ? 'justify-end' : 'justify-start'}`}
      >
        <div
          className={`flex max-w-[78%] flex-col gap-1 ${
            isOwn ? 'items-end' : 'items-start'
          }`}
        >
          <UnsentContent isOwn={isOwn} />

          <div
            className={`flex items-center gap-1.5 px-1 text-[11px] text-slate-400 dark:text-slate-500 ${
              isOwn ? 'flex-row-reverse' : 'flex-row'
            }`}
          >
            <span>{formatTime(message.createdAt)}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      id={`msg-${message._id}`}
      className={`group relative flex w-full flex-col ${
        isOwn ? 'items-end' : 'items-start'
      }`}
    >
      <div className="flex max-w-full items-center gap-2">
        <div
          className={`flex min-w-0 max-w-[78%] flex-col ${
            isOwn ? 'items-end' : 'items-start'
          }`}
        >
          {message.replyTo && (
            <div className="w-full">
              <ReplyQuote
                replyTo={message.replyTo}
                isOwn={isOwn}
                currentUserId={currentUserId}
                contactName={contactName}
                onJumpToMessage={onJumpToMessage}
              />
            </div>
          )}

          <div className="relative touch-pan-y">
            <div
              className={`pointer-events-none absolute inset-y-0 flex items-center sm:hidden ${
                isOwn ? 'right-3' : 'left-3'
              }`}
              style={{
                opacity: Math.min(
                  1,
                  Math.abs(swipeOffset) / SWIPE_REPLY_THRESHOLD,
                ),
                transform: `scale(${
                  0.75 +
                  Math.min(
                    0.25,
                    Math.abs(swipeOffset) /
                      SWIPE_REPLY_THRESHOLD /
                      4,
                  )
                })`,
              }}
              aria-hidden="true"
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full shadow-sm transition-colors ${
                  Math.abs(swipeOffset) >= SWIPE_REPLY_THRESHOLD
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <Reply className="h-4 w-4" />
              </span>
            </div>

            <div
              onTouchStart={startPress}
              onTouchEnd={endPress}
              onTouchCancel={endPress}
              onTouchMove={movePress}
              onContextMenu={handleContextMenu}
              className={
                isSwiping
                  ? 'transition-none'
                  : 'transition-transform duration-200 ease-out'
              }
              style={{
                transform: `translateX(${swipeOffset}px)`,
              }}
            >
              {isAttachment ? (
                isImage ? (
                  <ImageContent message={message} isOwn={isOwn} />
                ) : (
                  <FileContent message={message} isOwn={isOwn} />
                )
              ) : (
                <TextContent message={message} isOwn={isOwn} />
              )}
            </div>
          </div>
        </div>

        {/* Desktop: hover-revealed icons beside the bubble */}
        <MessageHoverActions
          isOwn={isOwn}
          onReply={canReply ? handleReply : undefined}
          onCopy={canCopy ? handleCopy : undefined}
          onUnsendForMe={canUnsend ? onUnsendForMe : undefined}
          onUnsendForEveryone={
            canUnsend ? onUnsendForEveryone : undefined
          }
        />
      </div>

      <div
        className={`mt-1 flex items-center gap-1.5 px-1 text-[11px] text-slate-400 dark:text-slate-500 ${
          isOwn ? 'flex-row-reverse' : 'flex-row'
        }`}
        title={STATUS_LABEL[message.status]}
      >
        <span>{formatTime(message.createdAt)}</span>

        {isOwn && <StatusIcon status={message.status} />}

        {isOwn &&
          message.status === 'failed' &&
          onRetry &&
          !isAttachment && (
            <button
              type="button"
              onClick={onRetry}
              className="font-semibold text-red-500 hover:underline"
            >
              Retry
            </button>
          )}

        {copied && (
          <span className="flex items-center gap-1 font-medium text-emerald-500">
            <ClipboardCheck className="h-3 w-3" />
            Copied
          </span>
        )}
      </div>

      {/* Mobile: long-press action sheet */}
      {menuOpen && (
        <MessageActionMenu
          onClose={() => setMenuOpen(false)}
          onReply={canReply ? handleReply : undefined}
          onCopy={canCopy ? handleCopy : undefined}
          onUnsendForMe={canUnsend ? onUnsendForMe : undefined}
          onUnsendForEveryone={
            canUnsend ? onUnsendForEveryone : undefined
          }
        />
      )}
    </div>
  );
}