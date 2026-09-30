'use client';

import {
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import {
  X,
  Pencil,
  Loader2,
  Trash2,
  ImagePlus,
} from 'lucide-react';
import { MAX_AVATAR_SOURCE_BYTES } from '@/lib/chatMedia';
import ContactPhoto from './ContactPhoto';
import ContactPhotoCropper from './ContactPhotoCropper';

interface EditContactDialogProps {
  currentName: string;
  currentAvatarUrl: string | null;
  onClose: () => void;
  onSave: (updates: {
    contactName?: string;
    avatarUrl?: string | null;
  }) => Promise<{
    success: boolean;
    error?: string;
  }>;
}

export default function EditContactDialog({
  currentName,
  currentAvatarUrl,
  onClose,
  onSave,
}: EditContactDialogProps) {
  const [name, setName] = useState(currentName);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    currentAvatarUrl,
  );
  const [avatarChanged, setAvatarChanged] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    if (!submitting && !cropFile) {
      onClose();
    }
  };

  const handlePickImage = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    // Allow selecting the same file again.
    event.target.value = '';

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }

    if (file.size === 0) {
      setError('This image file appears to be empty.');
      return;
    }

    if (file.size > MAX_AVATAR_SOURCE_BYTES) {
      setError(
        `Image is too large. Please choose one under ${
          MAX_AVATAR_SOURCE_BYTES / (1024 * 1024)
        }MB.`,
      );
      return;
    }

    setError(null);
    setCropFile(file);
  };

  const handleApplyCrop = (dataUrl: string) => {
    setAvatarPreview(dataUrl);
    setAvatarChanged(true);
    setCropFile(null);
    setError(null);
  };

  const handleRemoveAvatar = () => {
    setAvatarPreview(null);
    setAvatarChanged(true);
    setError(null);
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (submitting || cropFile) return;

    const trimmedName = name.trim();

    if (!trimmedName) {
      setError('Contact name cannot be empty');
      return;
    }

    const updates: {
      contactName?: string;
      avatarUrl?: string | null;
    } = {};

    if (trimmedName !== currentName) {
      updates.contactName = trimmedName;
    }

    if (avatarChanged) {
      updates.avatarUrl = avatarPreview;
    }

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
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not save changes. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
        onClick={handleClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-contact-title"
          className="max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-[28px] border border-border/80 bg-card p-6 shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
                <Pencil className="h-4 w-4" />
              </div>

              <h2
                id="edit-contact-title"
                className="text-lg font-semibold text-slate-900 dark:text-white"
              >
                Edit Contact
              </h2>
            </div>

            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:hover:bg-slate-800"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <ContactPhoto
                  src={avatarPreview}
                  name={name}
                  disabled={submitting}
                  className="h-24 w-24 text-2xl shadow-sm"
                />

                <button
                  type="button"
                  onClick={handlePickImage}
                  disabled={submitting || Boolean(cropFile)}
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

              <button
                type="button"
                onClick={handlePickImage}
                disabled={submitting || Boolean(cropFile)}
                className="text-xs font-semibold text-blue-600 hover:underline disabled:opacity-60 dark:text-blue-400"
              >
                {avatarPreview ? 'Change photo' : 'Choose photo'}
              </button>

              {avatarPreview && (
                <>
                  <p className="text-xs text-slate-400">
                    Click the photo to view it full screen.
                  </p>

                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    disabled={submitting}
                    className="flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:underline disabled:opacity-60"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove photo
                  </button>
                </>
              )}
            </div>

            <div>
              <label
                htmlFor="editContactName"
                className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Contact Name
              </label>

              <input
                id="editContactName"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-2xl border border-border/80 bg-background px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:text-white"
                disabled={submitting}
                autoFocus
                maxLength={80}
              />

              <p className="mt-1.5 text-xs text-slate-400">
                This only changes how the contact appears in your chat list
                — it doesn&apos;t affect their account.
              </p>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-300"
              >
                {error}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className="flex-1 rounded-2xl border border-border/80 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submitting || Boolean(cropFile)}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                {submitting && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Save
              </button>
            </div>
          </form>
        </div>
      </div>

      {cropFile && (
        <ContactPhotoCropper
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onApply={handleApplyCrop}
        />
      )}
    </>
  );
}