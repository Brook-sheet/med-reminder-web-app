export type AlertEventType =
  | 'MEDICATION_LATE'
  | 'MEDICATION_MISSED'
  | 'MEDICATION_VERIFIED'
  | 'MEDICATION_EVENT_WARNING'
  | 'CRITICAL_MEDICATION_EVENT'
  | 'POSSIBLE_EXCESS_INTAKE';

export type AlertSeverity = 'INFO' | 'NOTICE' | 'WARNING' | 'CRITICAL';
export type AlertStatus = 'UNREAD' | 'READ' | 'ACKNOWLEDGED';

export interface AlertData {
  _id: string;
  patient: {
    _id: string;
    patientId?: string;
    name: string;
  };
  medication: {
    _id: string;
    name: string;
    dosage?: string;
  } | null;
  medicationLogId: string | null;
  eventType: AlertEventType;
  severity: AlertSeverity;
  title: string;
  message: string;
  status: AlertStatus;
  isRead: boolean;
  occurredAt: string;
  readAt: string | null;
  acknowledgedAt: string | null;
  channels: {
    inApp: boolean;
    push: boolean;
    sms: boolean;
  };
  createdAt: string;
}