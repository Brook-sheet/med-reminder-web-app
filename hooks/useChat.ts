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
            // Incremental update: merge newly-arrived server messages into
            // the existing list. Only messages the server just confirmed are
            // ever dropped-and-replaced by their `_id`; optimistic ("sending")
            // messages don't have a real server `_id` yet, so they're never
            // matched here and correctly survive every poll tick until the
            // in-flight send/upload actually resolves.
            setMessages((prev) => {
              const incoming: ChatMessage[] = json.data.messages;
              if (incoming.length === 0) return prev;
              const incomingIds = new Set(incoming.map((m) => m._id));
              const kept = prev.filter((m) => !incomingIds.has(m._id));
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
        type: 'text',
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

  // Sends a file (image or any other document) as an attachment message.
  // Uses XMLHttpRequest instead of fetch specifically because fetch has no
  // reliable cross-browser way to report upload progress, and showing real
  // progress for larger files is one of the stated requirements.
  const sendAttachment = useCallback(
    (file: File, caption?: string) => {
      if (!conversationId) return;

      const clientId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const isImage = file.type.startsWith('image/');
      const localPreviewUrl = isImage ? URL.createObjectURL(file) : undefined;
      const trimmedCaption = (caption || '').trim();

      const optimisticMessage: ChatMessage = {
        _id: clientId,
        clientId,
        conversationId,
        senderId: currentUserId,
        recipientId: '',
        type: 'attachment',
        text: trimmedCaption,
        attachment: {
          attachmentId: '',
          url: '',
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          fileSize: file.size,
        },
        status: 'sending',
        createdAt: new Date().toISOString(),
        uploadProgress: 0,
        localPreviewUrl,
      };
      setMessages((prev) => [...prev, optimisticMessage]);
      setSending(true);

      const formData = new FormData();
      formData.append('file', file);
      if (trimmedCaption) formData.append('caption', trimmedCaption);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/chats/${conversationId}/messages`);

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable || !isMountedRef.current) return;
        const progress = Math.round((event.loaded / event.total) * 100);
        setMessages((prev) =>
          prev.map((m) => (m.clientId === clientId ? { ...m, uploadProgress: progress } : m))
        );
      };

      xhr.onload = () => {
        if (!isMountedRef.current) return;
        setSending(false);
        try {
          const json = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300 && json.success) {
            setMessages((prev) =>
              prev.map((m) => (m.clientId === clientId ? { ...json.data, localPreviewUrl } : m))
            );
          } else {
            setMessages((prev) =>
              prev.map((m) => (m.clientId === clientId ? { ...m, status: 'failed', uploadProgress: undefined } : m))
            );
          }
        } catch {
          setMessages((prev) =>
            prev.map((m) => (m.clientId === clientId ? { ...m, status: 'failed', uploadProgress: undefined } : m))
          );
        }
      };

      xhr.onerror = () => {
        if (!isMountedRef.current) return;
        setSending(false);
        setMessages((prev) =>
          prev.map((m) => (m.clientId === clientId ? { ...m, status: 'failed', uploadProgress: undefined } : m))
        );
      };

      xhr.send(formData);
    },
    [conversationId, currentUserId]
  );

  const retryMessage = useCallback(
    (clientId: string) => {
      const failed = messages.find((m) => m.clientId === clientId);
      if (!failed) return;
      setMessages((prev) => prev.filter((m) => m.clientId !== clientId));
      if (failed.type === 'attachment') {
        // The original File object isn't retained after a failed upload
        // (only its metadata is), so a "failed" attachment simply has to be
        // re-attached by the user rather than silently retried.
        return;
      }
      void sendMessage(failed.text);
    },
    [messages, sendMessage]
  );

  // ── Message unsend ───────────────────────────────────────────────────────
  // Two distinct actions — see app/api/chats/[conversationId]/messages/[messageId]/route.ts.
  // Neither of these touches conversation/contact removal in any way.

  const unsendForMe = useCallback(
    async (messageId: string): Promise<{ success: boolean; error?: string }> => {
      if (!conversationId) return { success: false, error: 'No conversation selected' };

      // Optimistic: this only ever affects the current user's own view, so
      // it's safe to remove it from the list immediately.
      setMessages((prev) => prev.filter((m) => m._id !== messageId));

      try {
        const res = await fetch(`/api/chats/${conversationId}/messages/${messageId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scope: 'me' }),
        });
        const json = await res.json();
        if (!isMountedRef.current) return { success: true };
        if (!json.success) {
          // Re-sync from the server rather than trying to manually restore
          // the removed message — simplest way to guarantee correctness.
          void fetchMessages({ silent: true });
          return { success: false, error: json.error || 'Could not unsend message' };
        }
        return { success: true };
      } catch {
        if (isMountedRef.current) void fetchMessages({ silent: true });
        return { success: false, error: 'Network error. Please check your connection.' };
      }
    },
    [conversationId, fetchMessages]
  );

  const unsendForEveryone = useCallback(
    async (messageId: string): Promise<{ success: boolean; error?: string }> => {
      if (!conversationId) return { success: false, error: 'No conversation selected' };

      try {
        const res = await fetch(`/api/chats/${conversationId}/messages/${messageId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scope: 'everyone' }),
        });
        const json = await res.json();
        if (!isMountedRef.current) return { success: true };
        if (!json.success) {
          return { success: false, error: json.error || 'Could not unsend message' };
        }
        // Swap in the tombstone immediately for the sender; the other
        // participant picks up the same change on their next poll tick
        // (see the updatedAt-based incremental query in the messages route).
        const updated = json.data?.updatedMessage;
        if (updated) {
          setMessages((prev) => prev.map((m) => (m._id === messageId ? { ...updated } : m)));
        }
        return { success: true };
      } catch {
        return { success: false, error: 'Network error. Please check your connection.' };
      }
    },
    [conversationId]
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

  return {
    messages,
    otherIsTyping,
    loading,
    error,
    sending,
    sendMessage,
    sendAttachment,
    retryMessage,
    unsendForMe,
    unsendForEveryone,
    notifyTyping,
    refresh: fetchMessages,
  };
}