import Link from 'next/link';
import { FileText } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function MonitoredPatientLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{
    patientID: string;
  }>;
}>) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/sign-in');
  }

  if (user.role !== 'family') {
    redirect('/');
  }

  const { patientID } = await params;

  return (
    <div>
      <div className="mx-auto flex max-w-4xl justify-end px-4 pt-2 print:hidden">
        <Link
          href={
            `/reports/medication?patientID=` +
            encodeURIComponent(patientID)
          }
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          <FileText className="h-4 w-4" />
          View Report
        </Link>
      </div>

      {children}
    </div>
  );
}