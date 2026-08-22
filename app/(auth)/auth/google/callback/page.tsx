'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import OnboardingDialog from '@/components/OnboardingDialog';

function GoogleCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams.get('status');
  const onboarding = searchParams.get('onboarding');
  const message = searchParams.get('message');
  const [showOnboarding, setShowOnboarding] = useState(
    status === 'success' && onboarding === 'required'
  );

  useEffect(() => {
    if (status === 'success' && onboarding !== 'required') {
      router.replace('/');
      router.refresh();
    }
  }, [onboarding, router, status]);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    router.replace('/');
    router.refresh();
  };

  if (status === 'success' && onboarding === 'required') {
    return (
      <OnboardingDialog
        isOpen={showOnboarding}
        onComplete={handleOnboardingComplete}
      />
    );
  }

  if (status === 'error') {
    return (
      <div className="w-full rounded-[32px] border border-red-200 bg-white p-8 text-center shadow-[0_28px_56px_rgba(15,23,42,0.08)]">
        <h1 className="text-2xl font-semibold text-slate-900">
          Google sign-in failed
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          {message || 'Unable to sign in with Google. Please try again.'}
        </p>

        <button
          type="button"
          onClick={() => router.replace('/sign-in')}
          className="mt-6 w-full rounded-3xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-sky-700"
        >
          Return to sign in
        </button>
      </div>
    );
  }

  return (
    <div className="w-full rounded-[32px] border border-slate-200 bg-white p-8 text-center shadow-[0_28px_56px_rgba(15,23,42,0.08)]">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-sky-600" />
      <p className="mt-4 text-sm text-slate-600">
        Completing Google sign-in…
      </p>
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full rounded-[32px] border border-slate-200 bg-white p-8 text-center shadow-[0_28px_56px_rgba(15,23,42,0.08)]">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-sky-600" />

          <p className="mt-4 text-sm text-slate-600">
            Completing Google sign-in…
          </p>
        </div>
      }
    >
      <GoogleCallbackContent />
    </Suspense>
  );
}