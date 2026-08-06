// app/(main)/chats/page.tsx
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import ChatsPageClient from '@/components/chats/ChatsPageClient';

export default async function ChatsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/sign-in');
  }

  return (
    <div className="min-h-full bg-background p-4 pb-6 md:p-6">
      <div className="mx-auto max-w-6xl">
        <ChatsPageClient currentUserId={user.userId} />
      </div>
    </div>
  );
}