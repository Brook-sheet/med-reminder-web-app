// app/api/hardware/event/route.ts

// Deprecated compatibility alias.
// The canonical Vercel route is /api/esp32/event.

export const dynamic =
  'force-dynamic';

export {
  GET,
  POST,
} from '@/app/api/esp32/event/route';