import Link from 'next/link';
import { FileText } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';

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
    <div>
      <div className="mx-auto flex max-w-7xl justify-end px-4 pt-2 sm:px-6 print:hidden">
        <Link
          href="/reports/medication"
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          <FileText className="h-4 w-4" />
          Generate Report
        </Link>
      </div>

      {children}
    </div>
  );
}