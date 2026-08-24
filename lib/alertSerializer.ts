import type { AlertData } from '@/lib/interfaces/data/Alert';

interface PopulatedReference {
  _id: { toString(): string };
  patientId?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  dosage?: string;
}

interface PopulatedAlert {
  _id: { toString(): string };
  patientId: PopulatedReference;
  medicationId?: PopulatedReference | null;
  medicationLogId?: { toString(): string } | null;
  eventType: AlertData['eventType'];
  severity: AlertData['severity'];
  title: string;
  message: string;
  status: AlertData['status'];
  isRead: boolean;
  occurredAt: Date;
  readAt?: Date | null;
  acknowledgedAt?: Date | null;
  channels: AlertData['channels'];
  createdAt: Date;
}

export function serializeAlert(value: unknown): AlertData {
  const alert = value as PopulatedAlert;
  const patientName = `${alert.patientId.firstName || ''} ${alert.patientId.lastName || ''}`.trim();
  return {
    _id: alert._id.toString(),
    patient: {
      _id: alert.patientId._id.toString(),
      patientId: alert.patientId.patientId,
      name: patientName || 'Patient',
    },
    medication: alert.medicationId
      ? {
          _id: alert.medicationId._id.toString(),
          name: alert.medicationId.name || 'Medication',
          dosage: alert.medicationId.dosage,
        }
      : null,
    medicationLogId: alert.medicationLogId?.toString() ?? null,
    eventType: alert.eventType,
    severity: alert.severity,
    title: alert.title,
    message: alert.message,
    status: alert.status,
    isRead: alert.isRead,
    occurredAt: new Date(alert.occurredAt).toISOString(),
    readAt: alert.readAt ? new Date(alert.readAt).toISOString() : null,
    acknowledgedAt: alert.acknowledgedAt
      ? new Date(alert.acknowledgedAt).toISOString()
      : null,
    channels: alert.channels,
    createdAt: new Date(alert.createdAt).toISOString(),
  };
}