// hooks/usePushNotifications.ts
'use client';
import { useState, useEffect, useCallback } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// FIX: TypeScript 5.7+ made ArrayBuffer types stricter.
// Uint8Array.from() returns Uint8Array<ArrayBufferLike> but pushManager.subscribe()
// requires BufferSource which expects Uint8Array<ArrayBuffer>.
//
// Solution: build the array manually via new Uint8Array(length) which
// always returns Uint8Array<ArrayBuffer> (not the wider ArrayBufferLike).
// ─────────────────────────────────────────────────────────────────────────────
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  // Index-based construction guarantees Uint8Array<ArrayBuffer> (not ArrayBufferLike)
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

export function usePushNotifications() {
  const [supported, setSupported]   = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // ── Detect browser support (client-only) ───────────────────────────────────
  useEffect(() => {
    const isSupported =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window;

    setSupported(isSupported);

    if (isSupported && 'Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  // ── Subscribe ──────────────────────────────────────────────────────────────
  // Depends only on `supported`; React state setters are stable and don't need
  // to be listed in the dependency array.
  const subscribe = useCallback(async () => {
    if (!supported) {
      setError('Push notifications are not supported in this browser.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Register service worker
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // 2. Request notification permission
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== 'granted') {
        setError(
          'Notification permission denied. Please allow notifications in your browser settings.'
        );
        return;
      }

      // 3. Fetch VAPID public key from server
      const keyRes = await fetch('/api/push/vapid-public-key');
      const { publicKey } = (await keyRes.json()) as { publicKey: string };

      if (!publicKey) {
        setError(
          'Push notifications are not configured on the server (missing VAPID key). ' +
          'Please add NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to your .env.local.'
        );
        return;
      }

      // 4. Subscribe — urlBase64ToUint8Array now returns Uint8Array<ArrayBuffer>
      //    which satisfies the BufferSource type required by pushManager.subscribe()
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      // 5. Send subscription to server
      const saveRes = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });

      if (saveRes.ok) {
        setSubscribed(true);
      } else {
        setError('Failed to save push subscription. Please try again.');
      }
    } catch (err) {
      console.error('Push subscription failed:', err);
      setError('Failed to enable push notifications. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [supported]);

  // ── Unsubscribe ────────────────────────────────────────────────────────────
  const unsubscribe = useCallback(async () => {
    if (!supported) return;
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch (err) {
      console.error('Unsubscribe failed:', err);
    }
  }, [supported]);

  return { supported, subscribed, permission, loading, error, subscribe, unsubscribe };
}