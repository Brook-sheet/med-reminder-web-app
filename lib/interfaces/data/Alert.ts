export type AlertEventType =
  | 'MEDICATION_LATE'
  | 'MEDICATION_MISSED'
  | 'MEDICATION_VERIFIED'
  | 'MEDICATION_EVENT_WARNING'
  | 'CRITICAL_MEDICATION_EVENT'
  | 'POSSIBLE_EXCESS_INTAKE';

export type AlertSeverity =
  | 'INFO'
  | 'NOTICE'
  | 'WARNING'
  | 'CRITICAL';

export type AlertStatus =
  | 'UNREAD'
  | 'READ'
  | 'ACKNOWLEDGED';

export type AlertAnnotationType =
  | 'patient_note'
  | 'missed_explanation'
  | 'family_acknowledgment';

export interface AlertAnnotationData {
  _id: string;
  type: AlertAnnotationType;
  text: string;
  authorRole: 'patient' | 'family';
  authorName: string;
  createdAt: string;
}

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

  /**
   * These annotations are loaded dynamically from the
   * medication log associated with this alert.
   *
   * Adding an annotation does not create or resend an alert.
   */
  annotations: AlertAnnotationData[];

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