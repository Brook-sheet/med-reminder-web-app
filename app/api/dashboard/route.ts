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
    }).sort({ scheduledTime: 1 });

    const todaySchedule: ScheduleItem[] = todayLogs.map((log) => {
      const logMinutes = timeToMinutes(log.scheduledTime);
      let status: ScheduleItem['status'] = 'Scheduled';
      if (log.status === 'taken') status = 'Taken';
      else if (log.status === 'missed') status = 'Missed';
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

    const upcomingLogs = todayLogs.filter((log) => {
      return log.status === 'pending' && timeToMinutes(log.scheduledTime) > nowMinutes;
    });
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

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
      .toISOString()
      .split('T')[0];
    const monthLogs = await MedicationLog.find({
      userId: user.userId,
      scheduledDate: { $gte: monthStart, $lte: todayStr },
    });
    const monthTaken = monthLogs.filter((l) => l.status === 'taken').length;
    const monthTotal = monthLogs.length;
    const adherenceRate = monthTotal > 0 ? Math.round((monthTaken / monthTotal) * 100) : 0;

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
