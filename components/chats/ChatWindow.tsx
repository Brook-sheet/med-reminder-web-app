// components/chats/ChatWindow.tsx
'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ArrowLeft,
  Send,
  MessageCircle,
  AlertTriangle,
  Pencil,
  Paperclip,
  Reply,
  X,
} from 'lucide-react';
import { useChat } from '@/hooks/useChat';
import MessageBubble from './MessageBubble';
import EditContactDialog from './EditContactDialog';
import PendingAttachmentBar from './PendingAttachmentBar';
import { validateAttachment } from '@/lib/chatMedia';
import type {
  ChatMessage,
  ConversationSummary,
} from '@/lib/interfaces/data/Chat';

function initials(name: string) {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) =>
        part[0]?.toUpperCase()
      )
      .join('') || '?'
  );
}

function dayLabel(iso: string) {
  const date = new Date(iso);
  const now = new Date();

  const sameDay =
    date.toDateString() ===
    now.toDateString();

  if (sameDay) {
    return 'Today';
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (
    date.toDateString() ===
    yesterday.toDateString()
  ) {
    return 'Yesterday';
  }

  return date.toLocaleDateString([], {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function replySnippet(
  message: ChatMessage
): string {
  if (message.unsent) {
    return 'Original message was unsent';
  }

  if (
    message.type === 'attachment' &&
    message.attachment
  ) {
    return message.attachment.mimeType.startsWith(
      'image/'
    )
      ? '📷 Photo'
      : `📎 ${message.attachment.fileName}`;
  }

  return message.text;
}

interface ChatWindowProps {
  conversation: ConversationSummary;
  currentUserId: string;
  onBack: () => void;
  onUpdateContact: (updates: {
    contactName?: string;
    avatarUrl?: string | null;
  }) => Promise<{
    success: boolean;
    error?: string;
  }>;
}

export default function ChatWindow({
  conversation,
  currentUserId,
  onBack,
  onUpdateContact,
}: ChatWindowProps) {
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
  } = useChat(
    conversation.conversationId,
    currentUserId
  );

  const [draft, setDraft] = useState('');
  const [showEditDialog, setShowEditDialog] =
    useState(false);

  const [pendingFile, setPendingFile] =
    useState<File | null>(null);

  const [
    pendingPreviewUrl,
    setPendingPreviewUrl,
  ] = useState<string | null>(null);

  const [attachError, setAttachError] =
    useState<string | null>(null);

  const [replyTarget, setReplyTarget] =
    useState<ChatMessage | null>(null);

  const [
    highlightedMessageId,
    setHighlightedMessageId,
  ] = useState<string | null>(null);

  const scrollRef =
    useRef<HTMLDivElement>(null);

  const bottomRef =
    useRef<HTMLDivElement>(null);

  const wasNearBottomRef = useRef(true);

  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const composerRef =
    useRef<HTMLTextAreaElement>(null);

  const highlightTimerRef =
    useRef<NodeJS.Timeout | null>(null);

  const [
    prevConversationId,
    setPrevConversationId,
  ] = useState(
    conversation.conversationId
  );

  if (
    conversation.conversationId !==
    prevConversationId
  ) {
    setPrevConversationId(
      conversation.conversationId
    );
    setReplyTarget(null);
    setHighlightedMessageId(null);
  }

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) {
        clearTimeout(
          highlightTimerRef.current
        );
      }
    };
  }, []);

  useEffect(() => {
    const container = scrollRef.current;

    if (!container) return;

    const nearBottom =
      container.scrollHeight -
        container.scrollTop -
        container.clientHeight <
      160;

    if (
      wasNearBottomRef.current ||
      nearBottom
    ) {
      bottomRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
      });
    }
  }, [messages.length, otherIsTyping]);

  useEffect(() => {
    return () => {
      if (pendingPreviewUrl) {
        URL.revokeObjectURL(
          pendingPreviewUrl
        );
      }
    };
  }, [pendingPreviewUrl]);

  const handleScroll = () => {
    const container = scrollRef.current;

    if (!container) return;

    wasNearBottomRef.current =
      container.scrollHeight -
        container.scrollTop -
        container.clientHeight <
      160;
  };

  const handleSend = () => {
    const activeReply = replyTarget;

    if (pendingFile) {
      const caption = draft.trim();
      const file = pendingFile;

      setPendingFile(null);

      if (pendingPreviewUrl) {
        URL.revokeObjectURL(
          pendingPreviewUrl
        );
      }

      setPendingPreviewUrl(null);
      setDraft('');
      setReplyTarget(null);
      notifyTyping(false);

      void sendAttachment(
        file,
        caption,
        activeReply
      );

      return;
    }

    const text = draft.trim();

    if (!text) return;

    setDraft('');
    setReplyTarget(null);
    notifyTyping(false);

    void sendMessage(text, activeReply);
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (
      event.key === 'Enter' &&
      !event.shiftKey
    ) {
      event.preventDefault();
      handleSend();
    }
  };

  const handlePickAttachment = () =>
    fileInputRef.current?.click();

  const handleAttachmentChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    event.target.value = '';

    if (!file) return;

    const validationError =
      validateAttachment(file);

    if (validationError) {
      setAttachError(validationError);
      return;
    }

    setAttachError(null);

    if (pendingPreviewUrl) {
      URL.revokeObjectURL(
        pendingPreviewUrl
      );
    }

    setPendingFile(file);

    setPendingPreviewUrl(
      file.type.startsWith('image/')
        ? URL.createObjectURL(file)
        : null
    );
  };

  const handleCancelAttachment = () => {
    if (pendingPreviewUrl) {
      URL.revokeObjectURL(
        pendingPreviewUrl
      );
    }

    setPendingFile(null);
    setPendingPreviewUrl(null);
  };

  const handleReply = (
    message: ChatMessage
  ) => {
    setReplyTarget(message);
    composerRef.current?.focus();
  };

  const handleJumpToMessage = (
    messageId: string
  ) => {
    const element = document.getElementById(
      `msg-${messageId}`
    );

    if (!element) return;

    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });

    setHighlightedMessageId(messageId);

    if (highlightTimerRef.current) {
      clearTimeout(
        highlightTimerRef.current
      );
    }

    highlightTimerRef.current =
      setTimeout(
        () =>
          setHighlightedMessageId(null),
        1200
      );
  };

  const rows = useMemo(() => {
    return messages.map(
      (message, index) => {
        const label = dayLabel(
          message.createdAt
        );

        const previousLabel =
          index > 0
            ? dayLabel(
                messages[index - 1]
                  .createdAt
              )
            : null;

        return {
          message,
          label,
          showDivider:
            label !== previousLabel,
        };
      }
    );
  }, [messages]);

  return (
    <div className="flex h-full flex-col">
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
              src={
                conversation.contact
                  .avatarUrl
              }
              alt={
                conversation.contact.name
              }
              className="h-full w-full object-cover"
            />
          ) : (
            initials(
              conversation.contact.name
            )
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900 dark:text-white">
            {conversation.contact.name}
          </p>

          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            {otherIsTyping ? (
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                {
                  conversation.contact.name.split(
                    ' '
                  )[0]
                }{' '}
                is typing…
              </span>
            ) : (
              `${
                conversation.contact.role ===
                'family'
                  ? 'Family'
                  : 'Patient'
              } ID: ${
                conversation.contact
                  .identifier
              }`
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            setShowEditDialog(true)
          }
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label="Edit contact"
          title="Edit contact"
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4"
      >
        {loading &&
          messages.length === 0 && (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              Loading conversation…
            </div>
          )}

        {!loading &&
          error &&
          messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-red-500">
              <AlertTriangle className="h-6 w-6" />
              {error}
            </div>
          )}

        {!loading &&
          !error &&
          messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-slate-400">
              <MessageCircle className="h-8 w-8 opacity-40" />
              No messages yet. Say hello to{' '}
              {
                conversation.contact.name.split(
                  ' '
                )[0]
              }
              !
            </div>
          )}

        <div className="space-y-3">
          {rows.map(
            ({
              message,
              label,
              showDivider,
            }) => (
              <div key={message._id}>
                {showDivider && (
                  <div className="my-3 flex items-center justify-center">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      {label}
                    </span>
                  </div>
                )}

                <div
                  className={`-mx-2 rounded-2xl px-2 transition-colors duration-500 ${
                    highlightedMessageId ===
                    message._id
                      ? 'bg-blue-100/70 dark:bg-blue-900/30'
                      : ''
                  }`}
                >
                  <MessageBubble
                    message={message}
                    isOwn={
                      message.senderId ===
                      currentUserId
                    }
                    currentUserId={
                      currentUserId
                    }
                    contactName={
                      conversation.contact
                        .name
                    }
                    onRetry={
                      message.clientId
                        ? () =>
                            retryMessage(
                              message.clientId!
                            )
                        : undefined
                    }
                    onReply={handleReply}
                    onJumpToMessage={
                      handleJumpToMessage
                    }
                    onUnsendForMe={() =>
                      unsendForMe(message._id)
                    }
                    onUnsendForEveryone={() =>
                      unsendForEveryone(
                        message._id
                      )
                    }
                  />
                </div>
              </div>
            )
          )}
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

      <div className="border-t border-border/70 p-3">
        {attachError && (
          <p className="mb-2 rounded-2xl bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-300">
            {attachError}
          </p>
        )}

        {replyTarget && (
          <div className="mb-2 flex items-center gap-2 rounded-2xl border border-border/70 bg-background px-3 py-2">
            <Reply className="h-4 w-4 shrink-0 text-blue-500" />

            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                Replying to{' '}
                {replyTarget.senderId ===
                currentUserId
                  ? 'yourself'
                  : conversation.contact
                      .name}
              </p>

              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {replySnippet(replyTarget)}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setReplyTarget(null)
              }
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              aria-label="Cancel reply"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {pendingFile && (
          <PendingAttachmentBar
            file={pendingFile}
            previewUrl={
              pendingPreviewUrl
            }
            onCancel={
              handleCancelAttachment
            }
          />
        )}

        <div className="flex items-end gap-2 rounded-3xl border border-border/70 bg-background px-3 py-2">
          <input
            ref={fileInputRef}
            type="file"
            onChange={
              handleAttachmentChange
            }
            className="hidden"
          />

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
            ref={composerRef}
            value={draft}
            onChange={(event) => {
              setDraft(
                event.target.value
              );

              notifyTyping(
                event.target.value.length >
                  0
              );
            }}
            onBlur={() =>
              notifyTyping(false)
            }
            onKeyDown={handleKeyDown}
            placeholder={
              pendingFile
                ? 'Add a caption (optional)…'
                : replyTarget
                  ? 'Write a reply…'
                  : 'Type a message…'
            }
            rows={1}
            className="max-h-32 min-h-9 flex-1 resize-none bg-transparent py-1.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
          />

          <button
            type="button"
            onClick={handleSend}
            disabled={
              !draft.trim() &&
              !pendingFile
            }
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showEditDialog && (
        <EditContactDialog
          currentName={
            conversation.contact.name
          }
          currentAvatarUrl={
            conversation.contact
              .avatarUrl
          }
          onClose={() =>
            setShowEditDialog(false)
          }
          onSave={onUpdateContact}
        />
      )}
    </div>
  );
}