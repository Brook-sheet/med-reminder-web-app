// components/chats/ChatsPageClient.tsx
'use client';

import { useState } from 'react';
import { BellRing } from 'lucide-react';
import { useConversations } from '@/hooks/useConversations';
import { useChatNotifications } from '@/hooks/useChatNotifications';
import ChatSidebarList from './ChatSidebarList';
import ChatWindow from './ChatWindow';
import AddContactDialog from './AddContactDialog';

interface ChatsPageClientProps {
  currentUserId: string;
}

export default function ChatsPageClient({ currentUserId }: ChatsPageClientProps) {
  const { conversations, loading, error, addContact, removeContact } = useConversations();
  const { permission, requestPermission } = useChatNotifications();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);

  // Derive the active conversation directly from the latest list rather than
  // syncing it into separate state — if a conversation disappears (e.g. the
  // other participant's poll picks up a removal), this naturally becomes
  // null on the very next render with no extra effect required.
  const selectedConversation = conversations.find((c) => c.conversationId === selectedId) || null;
  // Only treat the selection as "active" for layout purposes once we know
  // it's a real, current conversation — avoids stranding mobile users on a
  // blank pane if their selected conversation was removed elsewhere.
  const activeSelectedId = selectedConversation ? selectedId : loading ? selectedId : null;

  const handleDelete = async (id: string) => {
    if (selectedId === id) setSelectedId(null);
    await removeContact(id);
  };

  return (
    <div className="flex h-[calc(100vh-3rem)] max-h-[calc(100vh-3rem)] flex-col overflow-hidden rounded-[28px] border border-border/80 bg-card shadow-sm shadow-slate-900/5">
      {permission === 'default' && (
        <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-blue-50 px-4 py-2.5 text-sm text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
          <div className="flex items-center gap-2">
            <BellRing className="h-4 w-4 shrink-0" />
            <span>Enable notifications to get alerted about new messages.</span>
          </div>
          <button
            type="button"
            onClick={requestPermission}
            className="shrink-0 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
          >
            Enable
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Conversation list — hidden on mobile once a chat is open */}
        <div
          className={`w-full shrink-0 border-r border-border/70 md:block md:w-80 ${
            activeSelectedId ? 'hidden' : 'block'
          }`}
        >
          <ChatSidebarList
            conversations={conversations}
            loading={loading}
            error={error}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onAddContact={() => setShowAddDialog(true)}
            onDeleteContact={(id) => void handleDelete(id)}
          />
        </div>

        {/* Active conversation */}
        <div className={`min-w-0 flex-1 ${activeSelectedId ? 'block' : 'hidden md:block'}`}>
          {selectedConversation ? (
            <ChatWindow
              conversation={selectedConversation}
              currentUserId={currentUserId}
              onBack={() => setSelectedId(null)}
            />
          ) : (
            <div className="hidden h-full flex-col items-center justify-center gap-2 px-6 text-center md:flex">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-500 dark:bg-blue-900/20">
                <BellRing className="h-8 w-8 opacity-0" />
              </div>
              <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">Select a conversation</p>
              <p className="max-w-xs text-sm text-slate-500 dark:text-slate-400">
                Choose a contact from the list, or add a new one using their Patient ID to start messaging.
              </p>
            </div>
          )}
        </div>
      </div>

      {showAddDialog && (
        <AddContactDialog
          onClose={() => setShowAddDialog(false)}
          onAdd={addContact}
          onAdded={(conversationId) => setSelectedId(conversationId)}
        />
      )}
    </div>
  );
}