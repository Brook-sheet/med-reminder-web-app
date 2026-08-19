// components/chats/ChatSidebarList.tsx
'use client';

import { useRef, useState } from 'react';
import { MessageCircle, Plus, Trash2, Search } from 'lucide-react';
import type { ConversationSummary } from '@/lib/interfaces/data/Chat';

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || '?';
}

function formatTimestamp(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

interface ChatSidebarListProps {
  conversations: ConversationSummary[];
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddContact: () => void;
  onDeleteContact: (id: string) => void;
}

export default function ChatSidebarList({
  conversations,
  loading,
  error,
  selectedId,
  onSelect,
  onAddContact,
  onDeleteContact,
}: ChatSidebarListProps) {
  const [query, setQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const pressTimer = useRef<NodeJS.Timeout | null>(null);

  const filtered = conversations.filter((c) =>
    c.contact.name.toLowerCase().includes(query.trim().toLowerCase())
  );

  // Mobile-only: touch long-press reveals the remove confirmation. Not
  // bound to mouse events — desktop uses the hover-revealed trash icon
  // instead (see the button beside the timestamp below), so a mouse
  // "long press" would just be a second, conflicting way to trigger the
  // same thing. Right-click is kept as an additional desktop shortcut,
  // which is orthogonal to hover and doesn't conflict with it either.
  const startPress = (id: string) => {
    pressTimer.current = setTimeout(() => setConfirmDeleteId(id), 550);
  };
  const cancelPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  const handleRowKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, id: string, isConfirming: boolean) => {
    if (isConfirming) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(id);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-4">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Chats</h1>
        <button
          type="button"
          onClick={onAddContact}
          className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm transition hover:bg-blue-700"
          aria-label="Add contact"
          title="Add contact"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      <div className="px-4 py-3">
        <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-background px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations"
            className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-200"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {loading && conversations.length === 0 && (
          <div className="space-y-2 px-2 pt-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/60" />
            ))}
          </div>
        )}

        {!loading && error && conversations.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-red-500">{error}</div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-500 dark:bg-blue-900/20">
              <MessageCircle className="h-7 w-7" />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {conversations.length === 0
                ? 'No conversations yet. Add a contact by their Patient ID to start chatting.'
                : 'No conversations match your search.'}
            </p>
            {conversations.length === 0 && (
              <button
                type="button"
                onClick={onAddContact}
                className="mt-1 rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Add a contact
              </button>
            )}
          </div>
        )}

        <ul className="space-y-1">
          {filtered.map((c) => {
            const isSelected = c.conversationId === selectedId;
            const isConfirming = confirmDeleteId === c.conversationId;
            return (
              <li key={c.conversationId} className="group relative">
                {/* This is a div (not a <button>) specifically so the
                    hover-revealed delete button below can be a real,
                    independently-clickable sibling control rather than an
                    invalid button-inside-button. role="button" + tabIndex +
                    onKeyDown keep it keyboard/screen-reader accessible. */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => (isConfirming ? undefined : onSelect(c.conversationId))}
                  onKeyDown={(e) => handleRowKeyDown(e, c.conversationId, isConfirming)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setConfirmDeleteId(c.conversationId);
                  }}
                  onTouchStart={() => startPress(c.conversationId)}
                  onTouchEnd={cancelPress}
                  onTouchMove={cancelPress}
                  className={`flex w-full cursor-pointer items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-900/30'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-900'
                  }`}
                >
                  <div className="relative shrink-0">
                    <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-sm font-semibold text-white">
                      {c.contact.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.contact.avatarUrl} alt={c.contact.name} className="h-full w-full object-cover" />
                      ) : (
                        initials(c.contact.name)
                      )}
                    </div>
                    {c.isTyping && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card bg-emerald-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-semibold text-sm text-slate-900 dark:text-white">
                        {c.contact.name}
                      </p>

                      {/* Timestamp / hover delete-icon swap — desktop only.
                          The timestamp occupies this slot normally; hovering
                          the row (sm breakpoint and up) swaps it for a
                          delete button in the same spot, so no layout shift
                          and no interference with mobile's long-press. */}
                      <div className="flex h-5 shrink-0 items-center">
                        {c.lastMessage && (
                          <span className="text-[11px] text-slate-400 sm:group-hover:hidden">
                            {formatTimestamp(c.lastMessage.createdAt)}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(c.conversationId);
                          }}
                          className="hidden h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-red-50 hover:text-red-600 sm:group-hover:flex dark:hover:bg-red-900/20"
                          aria-label={`Remove ${c.contact.name}`}
                          title="Remove contact"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={`truncate text-xs ${
                          c.isTyping
                            ? 'font-medium text-emerald-600 dark:text-emerald-400'
                            : c.unreadCount > 0
                              ? 'font-medium text-slate-700 dark:text-slate-200'
                              : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {c.isTyping ? 'Typing…' : c.lastMessage?.text || 'Say hello 👋'}
                      </p>
                      {c.unreadCount > 0 && (
                        <span className="ml-2 flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[11px] font-bold text-white">
                          {c.unreadCount > 99 ? '99+' : c.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {isConfirming && (
                  <div
                    className="absolute inset-0 z-10 flex items-center justify-between gap-2 rounded-2xl bg-card/95 px-3 shadow-lg ring-1 ring-red-200 dark:ring-red-900/40"
                  >
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      Remove {c.contact.name}?
                    </span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteContact(c.conversationId);
                          setConfirmDeleteId(null);
                        }}
                        className="flex items-center gap-1 rounded-xl bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}