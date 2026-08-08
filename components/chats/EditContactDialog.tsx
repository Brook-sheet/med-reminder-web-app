// components/chats/EditContactDialog.tsx
'use client';

import { useRef, useState } from 'react';
import { X, Pencil, Loader2, Trash2, ImagePlus } from 'lucide-react';
import { fileToAvatarDataUrl, MAX_AVATAR_SOURCE_BYTES } from '@/lib/chatMedia';

function initials(name: string) {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '?'
  );
}

interface EditContactDialogProps {
  currentName: string;
  currentAvatarUrl: string | null;
  onClose: () => void;
  onSave: (updates: {
    contactName?: string;
    avatarUrl?: string | null;
  }) => Promise<{ success: boolean; error?: string }>;
}

export default function EditContactDialog({
  currentName,
  currentAvatarUrl,
  onClose,
  onSave,
}: EditContactDialogProps) {
  const [name, setName] = useState(currentName);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(currentAvatarUrl);
  const [avatarChanged, setAvatarChanged] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePickImage = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow picking the same file again later
    if (!file) return;

    if (file.size > MAX_AVATAR_SOURCE_BYTES) {
      setError(`Image is too large. Please choose one under ${MAX_AVATAR_SOURCE_BYTES / (1024 * 1024)}MB.`);
      return;
    }

    setError(null);
    setProcessingImage(true);
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      setAvatarPreview(dataUrl);
      setAvatarChanged(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not process that image.');
    } finally {
      setProcessingImage(false);
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarPreview(null);
    setAvatarChanged(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Contact name cannot be empty');
      return;
    }

    const updates: { contactName?: string; avatarUrl?: string | null } = {};
    if (trimmedName !== currentName) updates.contactName = trimmedName;
    if (avatarChanged) updates.avatarUrl = avatarPreview;

    if (Object.keys(updates).length === 0) {
      onClose();
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await onSave(updates);
      if (result.success) {
        onClose();
      } else {
        setError(result.error || 'Could not save changes');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-[28px] border border-border/80 bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
              <Pencil className="h-4 w-4" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Edit Contact</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Avatar picker */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-2xl font-semibold text-white shadow-sm">
                {processingImage ? (
                  <Loader2 className="h-7 w-7 animate-spin" />
                ) : avatarPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarPreview} alt={name || 'Contact avatar'} className="h-full w-full object-cover" />
                ) : (
                  initials(name)
                )}
              </div>
              <button
                type="button"
                onClick={handlePickImage}
                disabled={processingImage || submitting}
                className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
                aria-label="Choose photo"
                title="Choose photo"
              >
                <ImagePlus className="h-4 w-4" />
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            {avatarPreview && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                disabled={submitting}
                className="flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:underline disabled:opacity-60"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove photo
              </button>
            )}
          </div>

          <div>
            <label htmlFor="editContactName" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Contact Name
            </label>
            <input
              id="editContactName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-2xl border border-border/80 bg-background px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:text-white"
              disabled={submitting}
              autoFocus
              maxLength={80}
            />
            <p className="mt-1.5 text-xs text-slate-400">
              This only changes how the contact appears in your chat list — it doesn&apos;t affect their account.
            </p>
          </div>

          {error && (
            <p className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 rounded-2xl border border-border/80 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || processingImage}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}