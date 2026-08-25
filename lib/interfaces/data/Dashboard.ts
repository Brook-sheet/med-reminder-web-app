export interface DashboardStats {
  adherenceRate: number | null;

  todayProgress: {
    taken: number;
    total: number;
  };

  nextReminder: {
    time: string;
    medicineName: string;
  } | null;

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
  notes?: string;
  time: string;

  status:
    | 'Taken'
    | 'Late'
    | 'Upcoming'
    | 'Missed'
    | 'Wrong Chamber'
    | 'Scheduled'
    | 'Now';

  logId?: string;
}