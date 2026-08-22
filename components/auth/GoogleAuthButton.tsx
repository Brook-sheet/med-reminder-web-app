"use client";

import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GoogleAuthButtonProps {
  disabled?: boolean;
}

export default function GoogleAuthButton({ disabled = false }: GoogleAuthButtonProps) {
  const [redirecting, setRedirecting] = useState(false);

  const handleGoogleAuth = () => {
    setRedirecting(true);
    window.location.assign("/api/auth/google");
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleGoogleAuth}
      disabled={disabled || redirecting}
      className="w-full rounded-3xl border-slate-200 bg-white py-3 font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
    >
      {redirecting ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M21.6 12.23c0-.71-.06-1.23-.2-1.78H12v3.4h5.52a4.72 4.72 0 0 1-2.05 3.1l-.02.12 2.98 2.3.21.02c1.93-1.78 2.96-4.4 2.96-7.16Z"
          />
          <path
            fill="#34A853"
            d="M12 22c2.7 0 4.96-.89 6.64-2.41l-3.17-2.45c-.85.59-1.98 1-3.47 1a6.02 6.02 0 0 1-5.69-4.16l-.12.01-3.1 2.4-.04.12A10.02 10.02 0 0 0 12 22Z"
          />
          <path
            fill="#FBBC05"
            d="M6.31 13.98A6.18 6.18 0 0 1 5.98 12c0-.69.12-1.36.32-1.98v-.12L3.17 7.46l-.1.05A10.02 10.02 0 0 0 2 12c0 1.62.39 3.15 1.06 4.49l3.25-2.51Z"
          />
          <path
            fill="#EA4335"
            d="M12 5.86c1.88 0 3.15.81 3.88 1.48l2.82-2.75A9.58 9.58 0 0 0 12 2a10.02 10.02 0 0 0-8.94 5.51l3.24 2.51A6.04 6.04 0 0 1 12 5.86Z"
          />
        </svg>
      )}
      {redirecting ? "Connecting to Google..." : "Continue with Google"}
    </Button>
  );
}