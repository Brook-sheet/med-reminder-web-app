export interface DashboardStats {
  adherenceRate: number;
  todayProgress: { taken: number; total: number };
  nextReminder: { time: string; medicineName: string } | null;
  weeklyData: WeeklyDayData[];
  todaySchedule: ScheduleItem[];
}
 
export interface WeeklyDayData {
  day: string;
  taken: number;
  total: number;
}
 
export interface ScheduleItem {
  medicineId: string;
  name: string;
  dosage: string;
  time: string;
  status: 'Taken' | 'Upcoming' | 'Missed' | 'Scheduled';
  logId?: string;
}