// app/api/upcoming/route.ts
// Returns all medicine schedule entries that are:
//   - Scheduled for TODAY (but not yet taken) OR
//   - Scheduled for FUTURE dates (between startDate and endDate)
// Used by the Upcoming section on the Dashboard.

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Medicine from '@/models/Medicine';
import MedicationLog from '@/models/MedicationLog';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import type { ApiResponse } from '@/types';

async function getAuthUser(request: NextRequest) {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyToken(token);
}

// Helper: parse "8:00 AM" or "08:00" → minutes since midnight (for sorting)
function timeToMinutes(timeStr: string): number {
  const ampm = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampm) {
    let h = parseInt(ampm[1]);
    const m = parseInt(ampm[2]);
    if (ampm[3].toUpperCase() === 'PM' && h !== 12) h += 12;
    if (ampm[3].toUpperCase() === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  }
  const plain = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (plain) return parseInt(plain[1]) * 60 + parseInt(plain[2]);
  return 0;
}

// Format "YYYY-MM-DD" → "Mon, Apr 21"
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00'); // force local time
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export interface UpcomingItem {
  medicineId: string;
  medicineName: string;
  dosage: string;
  scheduledDate: string;          // "YYYY-MM-DD"
  scheduledDateFormatted: string; // "Mon, Apr 21" or "Today"
  scheduledTime: string;          // "8:00 AM"
  status: 'Upcoming' | 'Scheduled';
  logId?: string;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // "YYYY-MM-DD"
    const nowMinutes = today.getHours() * 60 + today.getMinutes();

    // Fetch all active medicines for this user
    const medicines = await Medicine.find({ userId: user.userId, isActive: true });

    const upcomingItems: UpcomingItem[] = [];

    // Look 30 days into the future
    const lookAheadDays = 30;

    for (const med of medicines) {
      const startDate = med.startDate || todayStr;
      // endDate: if not set, look ahead 30 days from today
      const endDate = med.endDate || '';

      // Build list of dates to check
      for (let i = 0; i <= lookAheadDays; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() + i);
        const checkDateStr = checkDate.toISOString().split('T')[0];

        // Only include dates within the medicine's active range
        if (checkDateStr < startDate) continue;
        if (endDate && checkDateStr > endDate) continue;

        for (const time of med.scheduledTimes) {
          const timeMinutes = timeToMinutes(time);

          // For TODAY: only show times that haven't passed yet
          if (checkDateStr === todayStr) {
            if (timeMinutes <= nowMinutes) continue; // already past, skip
          }

          // Check if there's already a "taken" log for this slot
          const existingLog = await MedicationLog.findOne({
            userId: user.userId,
            medicineId: med._id,
            scheduledDate: checkDateStr,
            scheduledTime: time,
          });

          // Skip if already taken
          if (existingLog && existingLog.status === 'taken') continue;

          // Determine status label
          const isToday = checkDateStr === todayStr;
          const status: 'Upcoming' | 'Scheduled' = isToday ? 'Upcoming' : 'Scheduled';

          upcomingItems.push({
            medicineId: med._id.toString(),
            medicineName: med.name,
            dosage: med.dosage,
            scheduledDate: checkDateStr,
            scheduledDateFormatted: isToday ? 'Today' : formatDate(checkDateStr),
            scheduledTime: time,
            status,
            logId: existingLog?._id?.toString(),
          });
        }
      }
    }

    // Sort by date then by time
    upcomingItems.sort((a, b) => {
      if (a.scheduledDate !== b.scheduledDate) {
        return a.scheduledDate.localeCompare(b.scheduledDate);
      }
      return timeToMinutes(a.scheduledTime) - timeToMinutes(b.scheduledTime);
    });

    // Return first 20 items to keep dashboard clean
    const limitedItems = upcomingItems.slice(0, 20);

    return NextResponse.json<ApiResponse>({ success: true, data: limitedItems });
  } catch (error) {
    console.error('[GET /api/upcoming]', error);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
