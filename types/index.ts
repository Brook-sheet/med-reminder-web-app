// types/index.ts

export interface User {
  _id?: string;
  email: string;
  password?: string;
  fullName?: string;
  patientId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Medicine {
  _id?: string;
  userId: string;
  name: string;
  dosage: string;
  frequency: string;
  scheduledTimes: string[]; // e.g. ["08:00", "20:00"]
  color?: string;
  notes?: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface MedicationLog {
  _id?: string;
  userId: string;
  medicineId: string;
  medicineName: string;
  scheduledTime: string;
  scheduledDate: string; // "YYYY-MM-DD"
  takenAt?: Date;
  status: 'taken' | 'missed' | 'pending' | 'reminder';
  source: 'manual' | 'sensor' | 'auto';
  sensorData?: SensorData;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SensorData {
  _id?: string;
  userId?: string;
  deviceId: string;
  event: 'pill_taken' | 'pill_dispensed' | 'container_opened' | 'heartbeat';
  medicineId?: string;
  medicineName?: string;
  timestamp: Date;
  rawData?: Record<string, unknown>;
  processed: boolean;
  createdAt?: Date;
}

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

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface AuthPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

// types/index.ts
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}