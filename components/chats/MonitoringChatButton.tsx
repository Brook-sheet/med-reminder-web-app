"use client";

import { useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";

interface ChatRelationship {
  status: "none" | "pending" | "accepted" | "declined";
  direction: "sent" | "received" | null;
  requestId: string | null;
  conversationId: string | null;
}

interface MonitoringChatButtonProps {
  monitoringRequestId: string;
  relationship: ChatRelationship | null;
  onUpdated?: () => void;
}

export default function MonitoringChatButton({
  monitoringRequestId,
  relationship,
  onUpdated,
}: MonitoringChatButtonProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = relationship?.status ?? "none";
  const hasActiveConversation =
    status === "accepted" && Boolean(relationship?.conversationId);

  const handleClick = async () => {
    if (hasActiveConversation && relationship?.conversationId) {
      router.push(
        `/chats?conversation=${encodeURIComponent(relationship.conversationId)}`
      );
      return;
    }

    if (status === "pending") return;

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monitoringRequestId }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        setError(result.error || "Unable to send the Message Request.");
        return;
      }
      window.dispatchEvent(new Event("chat-requests-updated"));
      window.dispatchEvent(new Event("chat-relationships-updated"));
      onUpdated?.();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const label =
    hasActiveConversation
      ? "Open Chat"
      : status === "pending"
        ? "Request Pending"
        : "Add to Chat";

  return (
    <div>
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={submitting || status === "pending"}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-300 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-800 dark:bg-slate-950 dark:text-blue-300 dark:hover:bg-blue-950/30"
      >
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <MessageCircle className="h-4 w-4" />
        )}
        {submitting ? "Sending..." : label}
      </button>
      {error && <p className="mt-1 max-w-56 text-xs text-rose-600">{error}</p>}
    </div>
  );
}