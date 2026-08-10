// components/chats/ChatWindow.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Send, MessageCircle, AlertTriangle, Pencil, Paperclip } from 'lucide-react';
import { useChat } from '@/hooks/useChat';
import MessageBubble from './MessageBubble';
import EditContactDialog from './EditContactDialog';
import PendingAttachmentBar from './PendingAttachmentBar';
import { validateAttachment } from '@/lib/chatMedia';
import type { ConversationSummary } from '@/lib/interfaces/data/Chat';

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || '?';
}

function dayLabel(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
}

interface ChatWindowProps {
  conversation: ConversationSummary;
  currentUserId: string;
  onBack: () => void;
  onUpdateContact: (updates: {
    contactName?: string;
    avatarUrl?: string | null;
  }) => Promise<{ success: boolean; error?: string }>;
}

export default function ChatWindow({ conversation, currentUserId, onBack, onUpdateContact }: ChatWindowProps) {
  const {
    messages,
    otherIsTyping,
    loading,
    error,
    sendMessage,
    sendAttachment,
    retryMessage,
    unsendForMe,
    unsendForEveryone,
    notifyTyping,
  } = useChat(conversation.conversationId, currentUserId);
  const [draft, setDraft] = useState('');
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const wasNearBottomRef = useRef(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to the latest message, but don't yank the view if the user
  // has scrolled up to read older history.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 160;
    if (wasNearBottomRef.current || nearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages.length, otherIsTyping]);

  // Revoke the pending-file object URL whenever it's replaced or the
  // component unmounts, so we don't leak memory on repeated attach/cancel.
  useEffect(() => {
    return () => {
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    };
  }, [pendingPreviewUrl]);

  const handleScroll = () => {
    const container = scrollRef.current;
    if (!container) return;
    wasNearBottomRef.current =
      container.scrollHeight - container.scrollTop - container.clientHeight < 160;
  };

  const handleSend = () => {
    if (pendingFile) {
      const caption = draft.trim();
      const file = pendingFile;
      setPendingFile(null);
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
      setPendingPreviewUrl(null);
      setDraft('');
      notifyTyping(false);
      void sendAttachment(file, caption);
      return;
    }
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    notifyTyping(false);
    void sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePickAttachment = () => fileInputRef.current?.click();

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;

    const validationError = validateAttachment(file);
    if (validationError) {
      setAttachError(validationError);
      return;
    }

    setAttachError(null);
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setPendingFile(file);
    setPendingPreviewUrl(file.type.startsWith('image/') ? URL.createObjectURL(file) : null);
  };

  const handleCancelAttachment = () => {
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setPendingFile(null);
    setPendingPreviewUrl(null);
  };

  // Pre-compute day-divider labels by comparing each message against the
  // previous one — no mutable accumulator needed.
  const rows = useMemo(() => {
    return messages.map((m, idx) => {
      const label = dayLabel(m.createdAt);
      const prevLabel = idx > 0 ? dayLabel(messages[idx - 1].createdAt) : null;
      return { message: m, label, showDivider: label !== prevLabel };
    });
  }, [messages]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border/70 px-4 py-3.5">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 md:hidden dark:hover:bg-slate-800"
          aria-label="Back to chats"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-sm font-semibold text-white">
          {conversation.contact.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={conversation.contact.avatarUrl}
              alt={conversation.contact.name}
              className="h-full w-full object-cover"
            />
          ) : (
            initials(conversation.contact.name)
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900 dark:text-white">{conversation.contact.name}</p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            {otherIsTyping ? (
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                {conversation.contact.name.split(' ')[0]} is typing…
              </span>
            ) : (
              `Patient ID: ${conversation.contact.patientId}`
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowEditDialog(true)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label="Edit contact"
          title="Edit contact"
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-4">
        {loading && messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            Loading conversation…
          </div>
        )}

        {!loading && error && messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-red-500">
            <AlertTriangle className="h-6 w-6" />
            {error}
          </div>
        )}

        {!loading && !error && messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-slate-400">
            <MessageCircle className="h-8 w-8 opacity-40" />
            No messages yet. Say hello to {conversation.contact.name.split(' ')[0]}!
          </div>
        )}

        <div className="space-y-3">
          {rows.map(({ message: m, label, showDivider }) => (
            <div key={m._id}>
              {showDivider && (
                <div className="my-3 flex items-center justify-center">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    {label}
                  </span>
                </div>
              )}
              <MessageBubble
                message={m}
                isOwn={m.senderId === currentUserId}
                onRetry={m.clientId ? () => retryMessage(m.clientId!) : undefined}
                onUnsendForMe={() => unsendForMe(m._id)}
                onUnsendForEveryone={() => unsendForEveryone(m._id)}
              />
            </div>
          ))}
        </div>

        {otherIsTyping && (
          <div className="mt-2 flex items-center gap-1.5 px-1">
            <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-border/70 p-3">
        {attachError && (
          <p className="mb-2 rounded-2xl bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-300">
            {attachError}
          </p>
        )}
        {pendingFile && (
          <PendingAttachmentBar file={pendingFile} previewUrl={pendingPreviewUrl} onCancel={handleCancelAttachment} />
        )}
        <div className="flex items-end gap-2 rounded-3xl border border-border/70 bg-background px-3 py-2">
          <input ref={fileInputRef} type="file" onChange={handleAttachmentChange} className="hidden" />
          <button
            type="button"
            onClick={handlePickAttachment}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Attach a photo or file"
            title="Attach a photo or file"
          >
            <Paperclip className="h-5 w-5" />
          </button>
          <textarea
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              notifyTyping(e.target.value.length > 0);
            }}
            onBlur={() => notifyTyping(false)}
            onKeyDown={handleKeyDown}
            placeholder={pendingFile ? 'Add a caption (optional)…' : 'Type a message…'}
            rows={1}
            className="max-h-32 min-h-9 flex-1 resize-none bg-transparent py-1.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!draft.trim() && !pendingFile}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showEditDialog && (
        <EditContactDialog
          currentName={conversation.contact.name}
          currentAvatarUrl={conversation.contact.avatarUrl}
          onClose={() => setShowEditDialog(false)}
          onSave={onUpdateContact}
        />
      )}
    </div>
  );
}