import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import AlertsPageClient from '@/components/alerts/AlertsPageClient';

export default async function AlertsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');
  if (user.role !== 'family') redirect('/');
  return <AlertsPageClient />;
}