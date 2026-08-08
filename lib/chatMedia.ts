// lib/chatMedia.ts
'use client';

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB — keep in sync with models/Attachment.ts
export const MAX_AVATAR_SOURCE_BYTES = 8 * 1024 * 1024; // reject absurdly large source photos early
const AVATAR_DIMENSION = 256; // stored square size in px

// Extensions we refuse to accept as chat attachments for basic safety.
// This is a lightweight guardrail, not a substitute for server-side
// antivirus scanning — it simply blocks the most common executable types.
const BLOCKED_EXTENSIONS = new Set([
  'exe', 'msi', 'bat', 'cmd', 'com', 'scr', 'sh', 'bash', 'ps1',
  'js', 'jse', 'vbs', 'vbe', 'wsf', 'wsh', 'jar', 'apk', 'dll',
]);

export function getFileExtension(fileName: string): string {
  const idx = fileName.lastIndexOf('.');
  return idx === -1 ? '' : fileName.slice(idx + 1).toLowerCase();
}

export function validateAttachment(file: File): string | null {
  if (file.size <= 0) return 'This file appears to be empty.';
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return `File is too large. The maximum size is ${MAX_ATTACHMENT_BYTES / (1024 * 1024)}MB.`;
  }
  const ext = getFileExtension(file.name);
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return 'This file type is not allowed for security reasons.';
  }
  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Reads an image file, downsizes/crops it to a square avatar, and resolves
 * to a compressed JPEG data URI — entirely client-side via the Canvas API,
 * so no extra image-processing dependency is needed and payloads stay small
 * enough to store inline on the Conversation document.
 */
export function fileToAvatarDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please choose an image file.'));
      return;
    }
    if (file.size > MAX_AVATAR_SOURCE_BYTES) {
      reject(new Error(`Image is too large. Please choose one under ${MAX_AVATAR_SOURCE_BYTES / (1024 * 1024)}MB.`));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not load that image.'));
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = AVATAR_DIMENSION;
          canvas.height = AVATAR_DIMENSION;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Image processing is not supported in this browser.'));
            return;
          }
          // Center-crop to a square before scaling down
          const side = Math.min(img.width, img.height);
          const sx = (img.width - side) / 2;
          const sy = (img.height - side) / 2;
          ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_DIMENSION, AVATAR_DIMENSION);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } catch {
          reject(new Error('Could not process that image.'));
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}