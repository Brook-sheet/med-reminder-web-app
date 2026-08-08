// components/chats/PendingAttachmentBar.tsx
'use client';

import { X, FileText } from 'lucide-react';
import { formatFileSize } from '@/lib/chatMedia';

interface PendingAttachmentBarProps {
  file: File;
  previewUrl: string | null;
  onCancel: () => void;
}

export default function PendingAttachmentBar({ file, previewUrl, onCancel }: PendingAttachmentBarProps) {
  return (
    <div className="mb-2 flex items-center gap-3 rounded-2xl border border-border/70 bg-background px-3 py-2">
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt={file.name} className="h-12 w-12 shrink-0 rounded-xl object-cover" />
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-500 dark:bg-blue-900/30 dark:text-blue-300">
          <FileText className="h-6 w-6" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{file.name}</p>
        <p className="text-xs text-slate-400">{formatFileSize(file.size)}</p>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
        aria-label="Remove attachment"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}