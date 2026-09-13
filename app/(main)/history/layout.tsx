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
      {/* Mobile: a full-width CTA inside the page content, clear of the
          fixed top bar. Desktop (md+): the original right-aligned button. */}
      <div className="mx-auto flex max-w-7xl px-4 pt-2 pb-1 sm:px-6 md:justify-end md:pb-0 print:hidden">
        <Link
          href="/reports/medication"
          className="rx-press inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-blue-600/25 hover:bg-blue-700 hover:shadow-md hover:shadow-blue-600/30 md:w-auto md:py-2.5"
        >
          <FileText className="h-4 w-4" />
          Generate Report
        </Link>
      </div>

      {children}
    </div>
  );
}