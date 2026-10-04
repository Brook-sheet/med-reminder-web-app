import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import AlertsPageClient from '@/components/alerts/AlertsPageClient';
import SectionBackToTop from '@/components/ui/SectionBackToTop';

export default async function AlertsPage() {
  const user = await getCurrentUser();

  if (!user) redirect('/sign-in');
  if (user.role !== 'family') redirect('/');

  return (
    <>
      <AlertsPageClient />

      <SectionBackToTop
        targetSelector={'section[aria-label="Medication alert list"]'}
        label="Back to the top of the Medication Alerts page"
        scrollToPageTop
      />
    </>
  );
}