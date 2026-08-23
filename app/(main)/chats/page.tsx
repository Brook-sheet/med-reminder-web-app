import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import ChatsPageClient from "@/components/chats/ChatsPageClient";

interface ChatsPageProps {
  searchParams: Promise<{
    conversation?: string | string[];
  }>;
}

export default async function ChatsPage({
  searchParams,
}: ChatsPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const resolvedSearchParams =
    await searchParams;

  const conversationParam =
    resolvedSearchParams.conversation;

  const initialConversationId =
    Array.isArray(conversationParam)
      ? conversationParam[0] ?? null
      : conversationParam ?? null;

  return (
    <div className="min-h-full bg-background p-4 pb-6 md:p-6">
      <div className="mx-auto max-w-6xl">
        <ChatsPageClient
          currentUserId={user.userId}
          role={user.role}
          initialConversationId={
            initialConversationId
          }
        />
      </div>
    </div>
  );
}