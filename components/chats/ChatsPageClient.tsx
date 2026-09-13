"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  BellRing,
  UserPlus,
} from "lucide-react";

import { useConversations } from "@/hooks/useConversations";
import { useChatNotifications } from "@/hooks/useChatNotifications";
import { useChatRequests } from "@/hooks/useChatRequests";

import ChatSidebarList from "./ChatSidebarList";
import ChatWindow from "./ChatWindow";
import AddContactDialog from "./AddContactDialog";
import ChatRequestsPanel from "./ChatRequestsPanel";

interface ChatsPageClientProps {
  currentUserId: string;
  role: "patient" | "family";
  initialConversationId?: string | null;
}

export default function ChatsPageClient({
  currentUserId,
  role,
  initialConversationId = null,
}: ChatsPageClientProps) {
  const {
    conversations,
    loading,
    error,
    removeContact,
    updateContact,
    refresh: refreshConversations,
  } = useConversations();

  const {
    permission,
    requestPermission,
  } = useChatNotifications();

  const {
    received,
    sent,
    loading: requestsLoading,
    error: requestsError,
    refresh: refreshRequests,
    respond,
  } = useChatRequests();

  const [selectedId, setSelectedId] = useState<string | null>(
    initialConversationId
  );

  const [showAddContact, setShowAddContact] = useState(false);

  const chatRef = useRef<HTMLDivElement>(null);

  const selectedConversation =
    conversations.find(
      (conversation) => conversation.conversationId === selectedId
    ) || null;

  const activeSelectedId = selectedConversation
    ? selectedId
    : loading
      ? selectedId
      : null;

  // Keep the mobile composer above the on-screen keyboard.
  // These variables are consumed only by the mobile stylesheet.
  useEffect(() => {
    const element = chatRef.current;
    const viewport = window.visualViewport;
    const mobile = window.matchMedia("(max-width: 767px)");

    if (!element || !viewport || !activeSelectedId) {
      return;
    }

    const updateViewport = () => {
      if (mobile.matches && viewport.scale === 1) {
        element.style.setProperty(
          "--chat-height",
          `${viewport.height}px`
        );

        element.style.setProperty(
          "--chat-top",
          `${viewport.offsetTop}px`
        );
      } else {
        element.style.removeProperty("--chat-height");
        element.style.removeProperty("--chat-top");
      }
    };

    updateViewport();

    viewport.addEventListener("resize", updateViewport);
    viewport.addEventListener("scroll", updateViewport);
    mobile.addEventListener("change", updateViewport);

    return () => {
      viewport.removeEventListener("resize", updateViewport);
      viewport.removeEventListener("scroll", updateViewport);
      mobile.removeEventListener("change", updateViewport);

      element.style.removeProperty("--chat-height");
      element.style.removeProperty("--chat-top");
    };
  }, [activeSelectedId]);

  const handleDelete = async (conversationId: string) => {
    if (selectedId === conversationId) {
      setSelectedId(null);
    }

    await removeContact(conversationId);
  };

  const handleAccepted = async (
    conversationId: string | null
  ) => {
    await refreshConversations({ silent: true });

    if (conversationId) {
      setSelectedId(conversationId);
    }
  };

  const targetLabel = role === "patient" ? "Family" : "Patient";
  const targetPrefix = role === "patient" ? "FM" : "PT";

  return (
    <div
      ref={chatRef}
      data-conversation-open={Boolean(activeSelectedId)}
      className="rx-chats flex h-[calc(100vh-3rem)] max-h-[calc(100vh-3rem)] flex-col overflow-hidden rounded-[28px] border border-border/80 bg-card shadow-sm shadow-slate-900/5"
    >
      <div className="rx-chat-list-tools contents">
        <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-slate-50 px-4 py-3 dark:bg-slate-900/50">
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Connect with {targetLabel}
            </p>

            <p className="text-xs text-slate-500">
              Search using the {targetLabel} member&apos;s{" "}
              {targetPrefix} ID.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAddContact(true)}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <UserPlus className="h-4 w-4" />
            Add {targetLabel}
          </button>
        </div>

        <ChatRequestsPanel
          received={received}
          sent={sent}
          loading={requestsLoading}
          error={requestsError}
          onRespond={respond}
          onAccepted={(conversationId) => {
            void handleAccepted(conversationId);
          }}
        />

        {permission === "default" && (
          <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-blue-50 px-4 py-2.5 text-sm text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
            <div className="flex items-center gap-2">
              <BellRing className="h-4 w-4 shrink-0" />

              <span>
                Enable notifications to get alerted about new
                messages.
              </span>
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
      </div>

      <div className="rx-chat-panes flex min-h-0 flex-1">
        <div
          className={`w-full shrink-0 border-r border-border/70 md:block md:w-80 ${
            activeSelectedId ? "hidden" : "block"
          }`}
        >
          <ChatSidebarList
            conversations={conversations}
            loading={loading}
            error={error}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onDeleteContact={(conversationId) => {
              void handleDelete(conversationId);
            }}
          />
        </div>

        <div
          className={`rx-conversation min-w-0 flex-1 ${
            activeSelectedId ? "block" : "hidden md:block"
          }`}
        >
          {selectedConversation ? (
            <ChatWindow
              conversation={selectedConversation}
              currentUserId={currentUserId}
              onBack={() => setSelectedId(null)}
              onUpdateContact={(updates) =>
                updateContact(
                  selectedConversation.conversationId,
                  updates
                )
              }
            />
          ) : (
            <>
              {activeSelectedId && (
                <div
                  className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center md:hidden"
                  role="status"
                >
                  <p className="text-sm text-slate-500">
                    Loading conversation…
                  </p>

                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className="rounded-xl border border-border px-4 py-2 text-sm md:hidden"
                  >
                    Back to chats
                  </button>
                </div>
              )}

              <div className="hidden h-full flex-col items-center justify-center gap-2 px-6 text-center md:flex">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-500 dark:bg-blue-900/20">
                  <BellRing className="h-8 w-8 opacity-0" />
                </div>

                <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">
                  Select a conversation
                </p>

                <p className="max-w-xs text-sm text-slate-500 dark:text-slate-400">
                  Search by ID and send a Message Request. Chat
                  becomes available after the recipient accepts.
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {showAddContact && (
        <AddContactDialog
          role={role}
          onClose={() => setShowAddContact(false)}
          onRequestSent={() => {
            void refreshRequests(true);

            window.dispatchEvent(
              new Event("chat-requests-updated")
            );

            window.dispatchEvent(
              new Event("chat-relationships-updated")
            );
          }}
          onOpenConversation={setSelectedId}
        />
      )}
    </div>
  );
}