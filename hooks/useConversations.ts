// hooks/useConversations.ts
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConversationSummary } from '@/lib/interfaces/data/Chat';

const LIST_POLL_MS = 4000;

export function useConversations() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  const fetchConversations = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const res = await fetch('/api/chats');
      const json = await res.json();
      if (!isMounted.current) return;
      if (json.success) {
        setConversations(json.data);
        setError(null);
      } else {
        setError(json.error || 'Failed to load conversations');
      }
    } catch {
      if (isMounted.current) setError('Network error while loading conversations');
    } finally {
      if (isMounted.current && !opts?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    void fetchConversations();
    const interval = setInterval(() => void fetchConversations({ silent: true }), LIST_POLL_MS);
    return () => {
      isMounted.current = false;
      clearInterval(interval);
    };
  }, [fetchConversations]);

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  const addContact = useCallback(
    async (patientId: string, contactName: string) => {
      const res = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, contactName }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchConversations({ silent: true });
      }
      return json as { success: boolean; error?: string; data?: { conversationId: string } };
    },
    [fetchConversations]
  );

  const removeContact = useCallback(
    async (conversationId: string) => {
      const res = await fetch(`/api/chats/${conversationId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setConversations((prev) => prev.filter((c) => c.conversationId !== conversationId));
      }
      return json as { success: boolean; error?: string };
    },
    []
  );

  return {
    conversations,
    loading,
    error,
    totalUnread,
    refresh: fetchConversations,
    addContact,
    removeContact,
  };
}