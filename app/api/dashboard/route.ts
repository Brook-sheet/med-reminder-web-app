import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Medicine from '@/models/Medicine';
import MedicationLog from '@/models/MedicationLog';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import type { ApiResponse } from '@/lib/interfaces/data/Api';
import type { DashboardStats, WeeklyDayData, ScheduleItem } from '@/lib/interfaces/data/Dashboard';

async function getAuthUser(request: NextRequest) {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyToken(token);
}

function timeToMinutes(timeStr: string): number {
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return 0;
  let h = parseInt(match[1]);
  const m = parseInt(match[2]);
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return h * 60 + m;
}

/**
 * Weighted Adherence Rate (cumulative, only for due doses):
 * ((1.0 × On-Time) + (0.5 × Delayed)) / Total Due Scheduled Doses × 100
 *
 * Rules:
 * - On-time: status === 'taken' AND takenAt within 30 min of scheduled
 * - Delayed: status === 'taken' AND takenAt > 30 min after scheduled
 * - Missed: not confirmed AND scheduled time + 120 min has passed
 * - Pending (not yet due): EXCLUDED from calculation
 */
function computeWeightedAdherence(
  logs: Array<{
    status: string;
    scheduledDate: string;
    scheduledTime: string;
    takenAt?: Date | null;
  }>
): number {
  const now = new Date();

  let onTime = 0;
  let delayed = 0;
  let totalDue = 0;

  for (const log of logs) {
    const scheduledMinutes = timeToMinutes(log.scheduledTime);
    const scheduledDateTime = new Date(`${log.scheduledDate}T00:00:00`);
    scheduledDateTime.setMinutes(scheduledDateTime.getMinutes() + scheduledMinutes);

    // Only evaluate doses that are already due (scheduled time has passed)
    if (scheduledDateTime > now) continue;

    totalDue++;

    if (log.status === 'taken') {
      if (log.takenAt) {
        const diffMinutes = Math.round(
          (new Date(log.takenAt).getTime() - scheduledDateTime.getTime()) / 60_000
        );
        if (diffMinutes <= 30) {
          onTime++;
        } else {
          delayed++;
        }
      } else {
        // No takenAt timestamp → treat as on-time
        onTime++;
      }
    }
    // missed/pending past due = neither onTime nor delayed (counts toward totalDue but not numerator)
  }

  if (totalDue === 0) return 0;

  const weightedScore = (1.0 * onTime + 0.5 * delayed) / totalDue * 100;
  return Math.round(Math.min(weightedScore, 100));
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectDB();

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const nowMinutes = today.getHours() * 60 + today.getMinutes();

    const medicines = await Medicine.find({ userId: user.userId, isActive: true });
    const activeMedicineIds = medicines.map((med) => med._id);

    // Auto-create today's logs if missing
    for (const med of medicines) {
      for (const time of med.scheduledTimes) {
        const existing = await MedicationLog.findOne({
          userId: user.userId,
          medicineId: med._id,
          scheduledDate: todayStr,
          scheduledTime: time,
        });
        if (!existing) {
          await MedicationLog.create({
            userId: user.userId,
            medicineId: med._id,
            medicineName: med.name,
            dosage: med.dosage,
            scheduledDate: todayStr,
            scheduledTime: time,
            status: 'pending',
            source: 'auto',
          });
        }
      }
    }

    const todayLogs = await MedicationLog.find({
      userId: user.userId,
      scheduledDate: todayStr,
      medicineId: { $in: activeMedicineIds },
    });

    todayLogs.sort((a, b) =>
      timeToMinutes(a.scheduledTime) - timeToMinutes(b.scheduledTime)
    );

    const todaySchedule: ScheduleItem[] = todayLogs.map((log) => {
      const logMinutes = timeToMinutes(log.scheduledTime);
      // If the medication was already taken/missed, keep those statuses.
      // Otherwise, if current time is within the due-window after scheduled time,
      // mark it as 'Now' so the UI can highlight it as due-now.
      const DUE_WINDOW_MINUTES = 15;
      let status: ScheduleItem['status'] = 'Scheduled';
      if (log.status === 'taken') status = 'Taken';
      else if (log.status === 'missed') status = 'Missed';
      else if (nowMinutes >= logMinutes && nowMinutes < logMinutes + DUE_WINDOW_MINUTES) status = 'Now';
      else if (logMinutes > nowMinutes) status = 'Upcoming';
      else status = 'Scheduled';

      return {
        medicineId: log.medicineId.toString(),
        name: `${log.medicineName} ${log.dosage}`,
        dosage: log.dosage,
        time: log.scheduledTime,
        status,
        logId: log._id.toString(),
      };
    });

    const todayTaken = todayLogs.filter((l) => l.status === 'taken').length;
    const todayTotal = todayLogs.length;

    const upcomingLogs = todayLogs
      .filter((log) => log.status === 'pending' && timeToMinutes(log.scheduledTime) > nowMinutes)
      .sort((a, b) => timeToMinutes(a.scheduledTime) - timeToMinutes(b.scheduledTime));
    const nextLog = upcomingLogs[0] ?? null;
    const nextReminder = nextLog
      ? { time: nextLog.scheduledTime, medicineName: `${nextLog.medicineName} ${nextLog.dosage}` }
      : null;

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklyData: WeeklyDayData[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];

      const dayLogs = await MedicationLog.find({ userId: user.userId, scheduledDate: dateStr });
      const taken = dayLogs.filter((l) => l.status === 'taken').length;
      const total = dayLogs.length;

      weeklyData.push({ day: days[d.getDay()], taken, total });
    }

    // ── Weighted cumulative adherence (all historical logs, excluding future) ──
    const allLogs = await MedicationLog.find({ userId: user.userId }).lean();
    const adherenceRate = computeWeightedAdherence(
      allLogs.map((l) => ({
        status: String(l.status),
        scheduledDate: String(l.scheduledDate),
        scheduledTime: String(l.scheduledTime),
        takenAt: l.takenAt ?? null,
      }))
    );

    const stats: DashboardStats = {
      adherenceRate,
      todayProgress: { taken: todayTaken, total: todayTotal },
      nextReminder,
      weeklyData,
      todaySchedule,
    };

    return NextResponse.json<ApiResponse>({ success: true, data: stats });
  } catch (error) {
    console.error('[GET /api/dashboard]', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}