import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import Alert, {
  type AlertEventType,
  type AlertSeverity,
  type IAlertDocument,
} from '@/models/Alert';
import MonitoringRequest from '@/models/MonitoringRequest';
import User from '@/models/User';
import {
  sendConfiguredSms,
  sendWebPushToUser,
  type ChannelDeliveryResult,
} from '@/lib/notificationChannels';

export interface MedicationAlertEvent {
  eventKey: string;
  patientId: string;
  medicationId?: string | null;
  medicationLogId?: string | null;
  medicineName?: string;
  scheduledTime?: string;
  occurredAt?: Date;
  eventType: AlertEventType;
  title?: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface AlertEngineResult {
  created: number;
  duplicates: number;
  delivered: number;
  skipped: boolean;
  reason?: string;
  alertIds: string[];
}

interface AlertPolicy {
  createAlert: boolean;
  severity: AlertSeverity;
  push: boolean;
  sms: boolean;
  defaultTitle: string;
}

const ALERT_POLICIES: Record<AlertEventType, AlertPolicy> = {
  MEDICATION_VERIFIED: {
    createAlert: true,
    severity: 'INFO',
    push: true,
    sms: false,
    defaultTitle: 'Medication taken',
  },
  MEDICATION_LATE: {
    createAlert: true,
    severity: 'NOTICE',
    push: true,
    sms: false,
    defaultTitle: 'Medication taken late',
  },
  MEDICATION_MISSED: {
    createAlert: true,
    severity: 'WARNING',
    push: true,
    sms: true,
    defaultTitle: 'Medication missed',
  },
  MEDICATION_EVENT_WARNING: {
    createAlert: true,
    severity: 'WARNING',
    push: true,
    sms: false,
    defaultTitle: 'Medication event warning',
  },
  CRITICAL_MEDICATION_EVENT: {
    createAlert: true,
    severity: 'CRITICAL',
    push: true,
    sms: true,
    defaultTitle: 'Critical medication alert',
  },
  // Reserved for Phase 6. The type can be added without redesigning the model,
  // but Phase 5 intentionally does not generate excess-intake alerts.
  POSSIBLE_EXCESS_INTAKE: {
    createAlert: false,
    severity: 'CRITICAL',
    push: false,
    sms: false,
    defaultTitle: 'Potential medication incident',
  },
};

function safeObjectId(value?: string | null): mongoose.Types.ObjectId | null {
  return value && mongoose.isValidObjectId(value)
    ? new mongoose.Types.ObjectId(value)
    : null;
}

function defaultMessage(
  event: MedicationAlertEvent,
  patientName: string,
): string {
  const medicine = event.medicineName || 'a scheduled medication';
  const time = event.scheduledTime ? ` scheduled for ${event.scheduledTime}` : '';
  switch (event.eventType) {
    case 'MEDICATION_LATE':
      return `${patientName} took ${medicine} later than scheduled${time}.`;
    case 'MEDICATION_MISSED':
      return `${patientName} did not verify ${medicine} before its medication window ended${time}.`;
    case 'MEDICATION_EVENT_WARNING':
      return `${patientName} has a medication verification event that requires attention for ${medicine}.`;
    case 'CRITICAL_MEDICATION_EVENT':
      return `${patientName} has a medication event requiring immediate attention.`;
    case 'MEDICATION_VERIFIED':
      return `${patientName} took ${medicine}${time}.`;
    default:
      return `${patientName} has a medication event requiring review.`;
  }
}

async function updateDelivery(
  alert: IAlertDocument,
  pushResult: ChannelDeliveryResult,
  smsResult: ChannelDeliveryResult,
): Promise<void> {
  await Alert.updateOne(
    { _id: alert._id },
    {
      $set: {
        'delivery.pushStatus': alert.channels.push
          ? pushResult.status
          : 'NOT_REQUESTED',
        'delivery.smsStatus': alert.channels.sms
          ? smsResult.status
          : 'NOT_REQUESTED',
        'delivery.pushError': pushResult.error || '',
        'delivery.smsError': smsResult.error || '',
      },
    },
  );
}

export async function processMedicationAlertEvent(
  event: MedicationAlertEvent,
): Promise<AlertEngineResult> {
  const policy = ALERT_POLICIES[event.eventType];
  if (!policy.createAlert) {
    return {
      created: 0,
      duplicates: 0,
      delivered: 0,
      skipped: true,
      reason: event.eventType === 'POSSIBLE_EXCESS_INTAKE'
        ? 'Excess-intake detection is reserved for Phase 6.'
        : 'This informational event is stored in medication history only.',
      alertIds: [],
    };
  }
  const requestedEventKey = event.eventKey.trim();
  const finalMedicationEvent = [
    'MEDICATION_VERIFIED',
    'MEDICATION_LATE',
    'MEDICATION_MISSED',
    'MEDICATION_EVENT_WARNING',
  ].includes(event.eventType);
  const eventKey = finalMedicationEvent && event.medicationLogId
    ? `medication-final:${event.medicationLogId}`
    : requestedEventKey;

  if (!eventKey || eventKey.length > 180) {
    throw new Error('A valid alert eventKey is required.');
  }
  if (!mongoose.isValidObjectId(event.patientId)) {
    throw new Error('A valid patientId is required for alert processing.');
  }

  await connectDB();
  const patient = await User.findOne({
    _id: event.patientId,
    role: 'patient',
    isDeleted: { $ne: true },
  }).select('firstName lastName');
  if (!patient) throw new Error('Alert patient was not found.');

  const patientName = `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || 'Patient';
  const relationships = await MonitoringRequest.find({
    patientId: patient._id,
    status: 'approved',
  }).select('familyId').lean();

  const monitorIds = relationships.map((relationship) => relationship.familyId);
  const monitors = monitorIds.length > 0
    ? await User.find({
        _id: { $in: monitorIds },
        role: 'family',
        isDeleted: { $ne: true },
      })
        .select('notificationPreferences +notificationPreferences.smsPhoneNumber')
        .lean()
    : [];

  const recipients: Array<{
    id: mongoose.Types.ObjectId | null;
    pushEnabled: boolean;
    smsEnabled: boolean;
    phone?: string;
  }> = monitors.length > 0
    ? monitors.map((monitor) => ({
        id: monitor._id,
        pushEnabled: monitor.notificationPreferences?.push !== false,
        smsEnabled: monitor.notificationPreferences?.sms === true,
        phone: monitor.notificationPreferences?.smsPhoneNumber,
      }))
    : [{ id: null, pushEnabled: false, smsEnabled: false }];

  let created = 0;
  let duplicates = 0;
  let delivered = 0;
  const alertIds: string[] = [];

  for (const recipient of recipients) {
    const pushRequested = Boolean(recipient.id && policy.push && recipient.pushEnabled);
    const smsRequested = Boolean(recipient.id && policy.sms && recipient.smsEnabled);
    let alert: IAlertDocument;

    try {
      alert = await Alert.create({
        patientId: patient._id,
        monitorId: recipient.id,
        medicationId: safeObjectId(event.medicationId),
        medicationLogId: safeObjectId(event.medicationLogId),
        eventKey,
        eventType: event.eventType,
        severity: policy.severity,
        title: event.title || policy.defaultTitle,
        message: event.message || defaultMessage(event, patientName),
        status: 'UNREAD',
        isRead: false,
        occurredAt: event.occurredAt || new Date(),
        channels: {
          inApp: true,
          push: pushRequested,
          sms: smsRequested,
        },
        delivery: {
          pushStatus: pushRequested ? 'PENDING' : 'NOT_REQUESTED',
          smsStatus: smsRequested ? 'PENDING' : 'NOT_REQUESTED',
        },
        metadata: event.metadata || {},
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        duplicates += 1;
        continue;
      }
      throw error;
    }

    created += 1;
    alertIds.push(alert._id.toString());
    if (!recipient.id) continue;

    const [pushResult, smsResult] = await Promise.all([
      pushRequested
        ? sendWebPushToUser(recipient.id.toString(), {
            title: alert.title,
            body: alert.message,
            type: 'medication_alert',
            severity: alert.severity,
            alertId: alert._id.toString(),
            medicineName: event.medicineName,
            patientId: patient._id.toString(),
            logId: event.medicationLogId || undefined,
            url: '/alerts',
          })
        : Promise.resolve<ChannelDeliveryResult>({ status: 'SKIPPED' }),
      smsRequested
        ? sendConfiguredSms(
            recipient.phone,
            `Med App Reminder: ${alert.title}. ${alert.message}`,
          )
        : Promise.resolve<ChannelDeliveryResult>({ status: 'SKIPPED' }),
    ]);

    await updateDelivery(alert, pushResult, smsResult);
    if (pushResult.status === 'SENT' || smsResult.status === 'SENT') delivered += 1;
  }

  return {
    created,
    duplicates,
    delivered,
    skipped: false,
    alertIds,
  };
}