import { NextRequest, NextResponse } from 'next/server';

const HARDWARE_SERVER = process.env.HARDWARE_SERVER_URL || 'http://localhost:3001';

// POST /api/hardware/alarm  — called by NotificationManager when a due alarm fires
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    await fetch(`${HARDWARE_SERVER}/alarm/on`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    // Hardware server being offline must never break the web app
  }
  return NextResponse.json({ success: true });
}

// DELETE /api/hardware/alarm  — called when pill is confirmed taken via web
export async function DELETE() {
  try {
    await fetch(`${HARDWARE_SERVER}/alarm/off`, { method: 'POST' });
  } catch {
    // Same: hardware is optional
  }
  return NextResponse.json({ success: true });
}
