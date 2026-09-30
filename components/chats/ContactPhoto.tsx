'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

function initials(name: string) {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '?'
  );
}

interface ContactPhotoProps {
  src: string | null;
  name: string;
  className?: string;
  disabled?: boolean;
}

function PhotoViewer({
  src,
  name,
  onClose,
}: {
  src: string;
  name: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    dialog.showModal();

    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-label={`${name || 'Contact'} photo`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => event.stopPropagation()}
      className="fixed inset-0 m-0 h-[100dvh] max-h-none w-screen max-w-none border-0 bg-slate-950/95 p-0 text-white backdrop:bg-slate-950/80"
    >
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">
              {name || 'Contact'}
            </h2>
            <p className="text-xs text-slate-300">
              Contact photo
            </p>
          </div>

          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label="Close photo viewer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4 sm:p-8"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              onClose();
            }
          }}
        >
          {failed ? (
            <p role="alert" className="text-sm text-slate-300">
              This photo could not be loaded.
            </p>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={`${name || 'Contact'} full photo`}
              draggable={false}
              onError={() => setFailed(true)}
              className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
            />
          )}
        </div>

        <p className="shrink-0 px-4 pb-4 text-center text-xs text-slate-400">
          Press Escape or use the close button to return.
        </p>
      </div>
    </dialog>
  );
}

export default function ContactPhoto({
  src,
  name,
  className = 'h-10 w-10 text-sm',
  disabled = false,
}: ContactPhotoProps) {
  const [viewerOpen, setViewerOpen] = useState(false);

  const avatarClassName =
    `flex shrink-0 items-center justify-center overflow-hidden ` +
    `rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 ` +
    `font-semibold text-white ${className}`;

  if (!src) {
    return (
      <div className={avatarClassName}>
        {initials(name)}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          setViewerOpen(true);
        }}
        aria-label={`View ${name || 'contact'} photo`}
        title="View photo"
        className={`${avatarClassName} cursor-zoom-in transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-default disabled:opacity-60`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={name || 'Contact'}
          draggable={false}
          className="h-full w-full object-cover"
        />
      </button>

      {viewerOpen && (
        <PhotoViewer
          key={src}
          src={src}
          name={name}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </>
  );
}