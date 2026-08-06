// hooks/useChat.ts
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '@/lib/interfaces/data/Chat';

const MESSAGE_POLL_MS = 2000;
const TYPING_PING_MS = 2000;

export function useChat(conversationId: string | null, currentUserId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [otherIsTyping, setOtherIsTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const lastFetchedAtRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);
  const focusedRef = useRef(true);
  const lastTypingPingRef = useRef(0);

  useEffect(() => {
    const onFocus = () => (focusedRef.current = true);
    const onBlur = () => (focusedRef.current = false);
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    focusedRef.current = document.hasFocus();
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  const fetchMessages = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!conversationId) return;
      if (!opts?.silent) setLoading(true);
      try {
        const since = lastFetchedAtRef.current;
        const markRead = focusedRef.current ? '1' : '0';
        const url = `/api/chats/${conversationId}/messages?markRead=${markRead}${since ? `&since=${encodeURIComponent(since)}` : ''}`;
        const res = await fetch(url);
        const json = await res.json();
        if (!isMountedRef.current) return;
        if (json.success) {
          setError(null);
          setOtherIsTyping(json.data.otherIsTyping);
          lastFetchedAtRef.current = json.data.serverTime;

          if (since) {
            // Incremental update: merge new messages + refresh statuses of existing ones
            setMessages((prev) => {
              const incoming: ChatMessage[] = json.data.messages;
              if (incoming.length === 0) return prev;
              const incomingIds = new Set(incoming.map((m) => m._id));
              const kept = prev.filter((m) => !incomingIds.has(m._id) && !m.clientId);
              return [...kept, ...incoming].sort(
                (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
              );
            });
          } else {
            setMessages(json.data.messages);
          }
        } else {
          setError(json.error || 'Failed to load messages');
        }
      } catch {
        if (isMountedRef.current) setError('Network error while loading messages');
      } finally {
        if (isMountedRef.current && !opts?.silent) setLoading(false);
      }
    },
    [conversationId]
  );

  // Reset state and start polling whenever the selected conversation changes
  useEffect(() => {
    isMountedRef.current = true;
    setMessages([]);
    setOtherIsTyping(false);
    lastFetchedAtRef.current = null;
    if (!conversationId) {
      setLoading(false);
      return;
    }
    void fetchMessages();
    const interval = setInterval(() => void fetchMessages({ silent: true }), MESSAGE_POLL_MS);
    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !conversationId) return;

      const clientId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const optimisticMessage: ChatMessage = {
        _id: clientId,
        clientId,
        conversationId,
        senderId: currentUserId,
        recipientId: '',
        text: trimmed,
        status: 'sending',
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticMessage]);
      setSending(true);

      try {
        const res = await fetch(`/api/chats/${conversationId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: trimmed }),
        });
        const json = await res.json();
        if (!isMountedRef.current) return;
        if (json.success) {
          setMessages((prev) => prev.map((m) => (m.clientId === clientId ? { ...json.data } : m)));
        } else {
          setMessages((prev) => prev.map((m) => (m.clientId === clientId ? { ...m, status: 'failed' } : m)));
        }
      } catch {
        if (isMountedRef.current) {
          setMessages((prev) => prev.map((m) => (m.clientId === clientId ? { ...m, status: 'failed' } : m)));
        }
      } finally {
        if (isMountedRef.current) setSending(false);
      }
    },
    [conversationId, currentUserId]
  );

  const retryMessage = useCallback(
    (clientId: string) => {
      const failed = messages.find((m) => m.clientId === clientId);
      if (!failed) return;
      setMessages((prev) => prev.filter((m) => m.clientId !== clientId));
      void sendMessage(failed.text);
    },
    [messages, sendMessage]
  );

  const notifyTyping = useCallback(
    (isTyping: boolean) => {
      if (!conversationId) return;
      const now = Date.now();
      if (isTyping && now - lastTypingPingRef.current < TYPING_PING_MS) return;
      lastTypingPingRef.current = now;
      fetch(`/api/chats/${conversationId}/typing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isTyping }),
      }).catch(() => {});
    },
    [conversationId]
  );

  return { messages, otherIsTyping, loading, error, sending, sendMessage, retryMessage, notifyTyping, refresh: fetchMessages };
}