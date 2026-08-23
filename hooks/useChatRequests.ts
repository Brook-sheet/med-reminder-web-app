'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ChatRequestSummary } from '@/lib/interfaces/data/Chat';

const POLL_MS = 6000;

export function useChatRequests() {
  const [received, setReceived] = useState<ChatRequestSummary[]>([]);
  const [sent, setSent] = useState<ChatRequestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch('/api/chats/requests', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok || !result.success) {
        setError(result.error || 'Unable to load Message Requests.');
        return;
      }
      setReceived(result.data.received ?? []);
      setSent(result.data.sent ?? []);
      setError(null);
    } catch {
      setError('Network error while loading Message Requests.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(true), POLL_MS);
    const handleUpdate = () => void refresh(true);
    window.addEventListener('chat-requests-updated', handleUpdate);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('chat-requests-updated', handleUpdate);
    };
  }, [refresh]);

  const respond = useCallback(
    async (requestId: string, action: 'accept' | 'decline') => {
      const response = await fetch('/api/chats/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action }),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        await refresh(true);
        window.dispatchEvent(new Event('chat-requests-updated'));
        window.dispatchEvent(new Event('chat-relationships-updated'));
      }
      return result as {
        success: boolean;
        error?: string;
        message?: string;
        data?: { conversationId?: string | null };
      };
    },
    [refresh]
  );

  return { received, sent, loading, error, refresh, respond };
}