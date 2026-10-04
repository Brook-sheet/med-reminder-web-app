import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function MonitoredPatientLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/sign-in');
  }

  if (user.role !== 'family') {
    redirect('/');
  }

  return <div>{children}</div>;
}