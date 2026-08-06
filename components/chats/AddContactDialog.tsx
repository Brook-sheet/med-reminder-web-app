// components/chats/AddContactDialog.tsx
'use client';

import { useState } from 'react';
import { X, UserPlus, Loader2 } from 'lucide-react';

interface AddContactDialogProps {
  onClose: () => void;
  onAdd: (patientId: string, contactName: string) => Promise<{ success: boolean; error?: string; data?: { conversationId: string } }>;
  onAdded: (conversationId: string) => void;
}

export default function AddContactDialog({ onClose, onAdd, onAdded }: AddContactDialogProps) {
  const [patientId, setPatientId] = useState('');
  const [contactName, setContactName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId.trim() || !contactName.trim()) {
      setError('Please fill in both fields');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await onAdd(patientId.trim(), contactName.trim());
      if (result.success && result.data) {
        onAdded(result.data.conversationId);
        onClose();
      } else {
        setError(result.error || 'Could not add this contact');
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
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
              <UserPlus className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Add Contact</h2>
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="patientId" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Patient ID
            </label>
            <input
              id="patientId"
              type="text"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              placeholder="e.g. PT-4821"
              className="w-full rounded-2xl border border-border/80 bg-background px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:text-white"
              disabled={submitting}
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="contactName" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Contact Name
            </label>
            <input
              id="contactName"
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="e.g. Mom"
              className="w-full rounded-2xl border border-border/80 bg-background px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:text-white"
              disabled={submitting}
            />
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
              disabled={submitting}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Add
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}