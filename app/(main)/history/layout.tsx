import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import SectionBackToTop from '@/components/ui/SectionBackToTop';

export default async function HistoryLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/sign-in');
  }

  if (user.role !== 'patient') {
    redirect('/');
  }

  return (
    <>
      {children}

      <SectionBackToTop
        targetHeading="Medication Activity"
        label="Back to the top of the History page"
        scrollToPageTop
      />
    </>
  );
}