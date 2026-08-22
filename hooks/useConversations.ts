"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ConversationSummary } from "@/lib/interfaces/data/Chat";

const LIST_POLL_MS = 4000;

export function useConversations() {
  const [
    conversations,
    setConversations,
  ] = useState<
    ConversationSummary[]
  >([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const isMounted =
    useRef(true);

  const fetchConversations =
    useCallback(
      async (options?: {
        silent?: boolean;
      }) => {
        if (!options?.silent) {
          setLoading(true);
        }

        try {
          const response =
            await fetch("/api/chats");

          const result =
            await response.json();

          if (!isMounted.current) {
            return;
          }

          if (result.success) {
            setConversations(
              result.data
            );

            setError(null);
          } else {
            setError(
              result.error ||
                "Failed to load conversations"
            );
          }
        } catch {
          if (
            isMounted.current
          ) {
            setError(
              "Network error while loading conversations"
            );
          }
        } finally {
          if (
            isMounted.current &&
            !options?.silent
          ) {
            setLoading(false);
          }
        }
      },
      []
    );

  useEffect(() => {
    isMounted.current = true;

    void fetchConversations();

    const interval =
      window.setInterval(
        () =>
          void fetchConversations({
            silent: true,
          }),
        LIST_POLL_MS
      );

    return () => {
      isMounted.current = false;

      window.clearInterval(
        interval
      );
    };
  }, [fetchConversations]);

  const totalUnread =
    conversations.reduce(
      (total, conversation) =>
        total +
        conversation.unreadCount,
      0
    );

  const addContact =
    useCallback(
      async (
        familyId: string,
        contactName?: string
      ) => {
        const response =
          await fetch(
            "/api/chats",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                familyId,
                contactName,
              }),
            }
          );

        const result =
          await response.json();

        if (result.success) {
          await fetchConversations({
            silent: true,
          });
        }

        return result as {
          success: boolean;
          error?: string;
          data?: {
            conversationId: string;
          };
        };
      },
      [fetchConversations]
    );

  const removeContact =
    useCallback(
      async (
        conversationId: string
      ) => {
        const response =
          await fetch(
            `/api/chats/${conversationId}`,
            {
              method: "DELETE",
            }
          );

        const result =
          await response.json();

        if (result.success) {
          setConversations(
            (current) =>
              current.filter(
                (conversation) =>
                  conversation.conversationId !==
                  conversationId
              )
          );
        }

        return result as {
          success: boolean;
          error?: string;
        };
      },
      []
    );

  const updateContact =
    useCallback(
      async (
        conversationId: string,
        updates: {
          contactName?: string;
          avatarUrl?:
            | string
            | null;
        }
      ) => {
        const response =
          await fetch(
            `/api/chats/${conversationId}`,
            {
              method: "PATCH",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify(
                updates
              ),
            }
          );

        const result =
          await response.json();

        if (result.success) {
          setConversations(
            (current) =>
              current.map(
                (conversation) =>
                  conversation.conversationId ===
                  conversationId
                    ? {
                        ...conversation,

                        contact: {
                          ...conversation.contact,

                          name:
                            result.data
                              .contactName ??
                            conversation
                              .contact
                              .name,

                          avatarUrl:
                            "avatarUrl" in
                            updates
                              ? result
                                  .data
                                  .avatarUrl
                              : conversation
                                  .contact
                                  .avatarUrl,
                        },
                      }
                    : conversation
              )
          );
        }

        return result as {
          success: boolean;
          error?: string;
          data?: {
            contactName:
              | string
              | null;
            avatarUrl:
              | string
              | null;
          };
        };
      },
      []
    );

  return {
    conversations,
    loading,
    error,
    totalUnread,
    refresh:
      fetchConversations,
    addContact,
    removeContact,
    updateContact,
  };
}