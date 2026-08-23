// Compatibility alias. Existing ESP32 payloads may continue using snake_case
// fields such as device_id, user_id, and chamber_id.
export { GET, POST } from '@/app/api/hardware/event/route';