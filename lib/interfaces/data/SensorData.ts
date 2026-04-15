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