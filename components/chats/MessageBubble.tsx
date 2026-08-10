// components/chats/MessageBubble.tsx
'use client';

import { useRef, useState } from 'react';
import { Check, CheckCheck, Clock, AlertCircle, FileText, Download, Ban } from 'lucide-react';
import type { ChatMessage } from '@/lib/interfaces/data/Chat';
import { formatFileSize } from '@/lib/chatMedia';
import MessageActionMenu from './MessageActionMenu';

const LONG_PRESS_MS = 500;

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
      return <CheckCheck className="h-3.5 w-3.5 text-white/70" />;
    case 'sent':
    default:
      return <Check className="h-3.5 w-3.5 text-white/70" />;
  }
}

const STATUS_LABEL: Record<ChatMessage['status'], string> = {
  sending: 'Sending…',
  sent: 'Sent',
  delivered: 'Delivered',
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
  onRetry?: () => void;
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
        className={`flex items-center gap-3 px-4 py-3 transition ${attachment.url ? 'hover:opacity-90' : 'pointer-events-none'}`}
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
            <div className={`mt-1.5 h-1 w-full overflow-hidden rounded-full ${isOwn ? 'bg-white/25' : 'bg-slate-200 dark:bg-slate-700'}`}>
              <div
                className={`h-full rounded-full transition-all duration-200 ${isOwn ? 'bg-white' : 'bg-blue-500'}`}
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

export default function MessageBubble({ message, isOwn, onRetry, onUnsendForMe, onUnsendForEveryone }: MessageBubbleProps) {
  const isAttachment = message.type === 'attachment' && !!message.attachment;
  const isImage = isAttachment && message.attachment!.mimeType.startsWith('image/');
  const [menuOpen, setMenuOpen] = useState(false);
  const pressTimer = useRef<NodeJS.Timeout | null>(null);

  // The unsend menu is only ever offered for the current user's own,
  // already-persisted, not-yet-unsent messages — matches the requirement
  // that this menu appears on long-pressing "their own message".
  const canUnsend =
    isOwn && !message.unsent && !message._id.startsWith('tmp-') && !!onUnsendForMe && !!onUnsendForEveryone;

  const startPress = () => {
    if (!canUnsend) return;
    pressTimer.current = setTimeout(() => setMenuOpen(true), LONG_PRESS_MS);
  };
  const cancelPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };
  const handleContextMenu = (e: React.MouseEvent) => {
    if (!canUnsend) return;
    e.preventDefault();
    setMenuOpen(true);
  };

  if (message.unsent) {
    return (
      <div className={`flex w-full ${isOwn ? 'justify-end' : 'justify-start'}`}>
        <div className={`flex max-w-[78%] flex-col gap-1 ${isOwn ? 'items-end' : 'items-start'}`}>
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
    <div className={`flex w-full ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[78%] flex-col gap-1 ${isOwn ? 'items-end' : 'items-start'}`}>
        <div
          onTouchStart={startPress}
          onTouchEnd={cancelPress}
          onTouchMove={cancelPress}
          onMouseDown={startPress}
          onMouseUp={cancelPress}
          onMouseLeave={cancelPress}
          onContextMenu={handleContextMenu}
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

        <div
          className={`flex items-center gap-1.5 px-1 text-[11px] text-slate-400 dark:text-slate-500 ${
            isOwn ? 'flex-row-reverse' : 'flex-row'
          }`}
          title={STATUS_LABEL[message.status]}
        >
          <span>{formatTime(message.createdAt)}</span>
          {isOwn && <StatusIcon status={message.status} />}
          {isOwn && message.status === 'failed' && onRetry && !isAttachment && (
            <button type="button" onClick={onRetry} className="font-semibold text-red-500 hover:underline">
              Retry
            </button>
          )}
        </div>
      </div>

      {menuOpen && canUnsend && (
        <MessageActionMenu
          onClose={() => setMenuOpen(false)}
          onUnsendForMe={onUnsendForMe!}
          onUnsendForEveryone={onUnsendForEveryone!}
        />
      )}
    </div>
  );
}