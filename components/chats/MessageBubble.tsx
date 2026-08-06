// components/chats/MessageBubble.tsx
'use client';

import { Check, CheckCheck, Clock, AlertCircle } from 'lucide-react';
import type { ChatMessage } from '@/lib/interfaces/data/Chat';

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

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  onRetry?: () => void;
}

export default function MessageBubble({ message, isOwn, onRetry }: MessageBubbleProps) {
  return (
    <div className={`flex w-full ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[78%] flex-col gap-1 ${isOwn ? 'items-end' : 'items-start'}`}>
        <div
          className={`whitespace-pre-wrap break-words rounded-3xl px-4 py-2.5 text-sm shadow-sm transition-opacity ${
            isOwn
              ? 'rounded-br-md bg-blue-600 text-white dark:bg-blue-500'
              : 'rounded-bl-md border border-border/70 bg-card text-slate-800 dark:text-slate-100'
          } ${message.status === 'sending' ? 'opacity-70' : ''} ${message.status === 'failed' ? 'border border-red-400/60' : ''}`}
        >
          {message.text}
        </div>
        <div
          className={`flex items-center gap-1.5 px-1 text-[11px] text-slate-400 dark:text-slate-500 ${
            isOwn ? 'flex-row-reverse' : 'flex-row'
          }`}
          title={STATUS_LABEL[message.status]}
        >
          <span>{formatTime(message.createdAt)}</span>
          {isOwn && <StatusIcon status={message.status} />}
          {isOwn && message.status === 'failed' && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="font-semibold text-red-500 hover:underline"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}