'use client';

import { useState } from 'react';
import {
  Check,
  Clock3,
  Loader2,
  MessageCircle,
  X,
} from 'lucide-react';
import type { ChatRequestSummary } from '@/lib/interfaces/data/Chat';

interface ChatRequestsPanelProps {
  received: ChatRequestSummary[];
  sent: ChatRequestSummary[];
  loading: boolean;
  error: string | null;
  onRespond: (
    requestId: string,
    action: 'accept' | 'decline'
  ) => Promise<{
    success: boolean;
    error?: string;
    data?: {
      conversationId?: string | null;
    };
  }>;
  onAccepted: (conversationId: string | null) => void;
}

export default function ChatRequestsPanel({
  received,
  sent,
  loading,
  error,
  onRespond,
  onAccepted,
}: ChatRequestsPanelProps) {
  const [open, setOpen] = useState(received.length > 0);
  const [actingId, setActingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const pendingSent = sent.filter((item) => item.status === 'pending');
  const declinedSent = sent.filter((item) => item.status === 'declined');

  const respond = async (
    requestId: string,
    action: 'accept' | 'decline'
  ) => {
    setActingId(requestId);
    setMessage(null);

    try {
      const result = await onRespond(requestId, action);

      if (!result.success) {
        setMessage(
          result.error || 'Unable to update this Message Request.'
        );
        return;
      }

      if (action === 'accept') {
        onAccepted(result.data?.conversationId ?? null);
      }
    } finally {
      setActingId(null);
    }
  };

  return (
    <section className="border-b border-border/70 bg-background/60">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
          <MessageCircle className="h-4 w-4 text-blue-600" />
          Message Requests
        </span>

        <span className="flex items-center gap-2 text-xs text-slate-500">
          {received.length > 0 && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 font-bold text-white">
              {received.length}
            </span>
          )}

          {open ? 'Hide' : 'View'}
        </span>
      </button>

      {open && (
        <div className="max-h-72 space-y-3 overflow-y-auto border-t border-border/60 px-4 py-3">
          {loading && (
            <p className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading requests...
            </p>
          )}

          {error && <p className="text-xs text-rose-600">{error}</p>}
          {message && <p className="text-xs text-rose-600">{message}</p>}

          {received.map((request) => (
            <article
              key={request.requestId}
              className="rounded-2xl border border-blue-200 bg-blue-50/70 p-3 dark:border-blue-900/60 dark:bg-blue-950/20"
            >
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {request.user.name}
              </p>

              <p className="text-xs text-slate-500">
                {request.user.role === 'family'
                  ? 'Family Member'
                  : 'Patient'}{' '}
                · {request.user.identifier}
              </p>

              <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                wants to connect with you through Chat.
              </p>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={actingId === request.requestId}
                  onClick={() =>
                    void respond(request.requestId, 'accept')
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {actingId === request.requestId ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}

                  Accept
                </button>

                <button
                  type="button"
                  disabled={actingId === request.requestId}
                  onClick={() =>
                    void respond(request.requestId, 'decline')
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:bg-slate-950"
                >
                  <X className="h-3.5 w-3.5" />
                  Decline
                </button>
              </div>
            </article>
          ))}

          {pendingSent.map((request) => (
            <article
              key={request.requestId}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 p-3"
            >
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                  {request.user.name}
                </p>

                <p className="text-xs text-slate-500">
                  {request.user.identifier}
                </p>
              </div>

              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
                <Clock3 className="h-3.5 w-3.5" />
                Waiting for response
              </span>
            </article>
          ))}

          {declinedSent.map((request) => (
            <article
              key={request.requestId}
              className="rounded-2xl border border-rose-200 bg-rose-50/60 p-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300"
            >
              {request.user.name} declined your Message Request.
            </article>
          ))}

          {!loading &&
            received.length === 0 &&
            sent.length === 0 && (
              <p className="py-2 text-center text-xs text-slate-500">
                No Message Requests.
              </p>
            )}
        </div>
      )}
    </section>
  );
}