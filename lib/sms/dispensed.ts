import { resolveMedicationTimeZone } from '@/lib/medicationTime';
import { claimAndSendSms } from '@/lib/sms/delivery';
import { normalizePhilippineMobileNumber } from '@/lib/sms/phone';
import Alert from '@/models/Alert';
import MonitoringRequest from '@/models/MonitoringRequest';
import User from '@/models/User';

interface DispensedNotificationsInput {
  patientId: string;
  groupId: string;
  medications: { medicineName: string; chamberIds: number[] }[];
  dispensedAt: Date | null;
  receivedAt: Date;
}

function formatChambers(chamberIds: number[]): string {
  const label = chamberIds.length === 1 ? 'Chamber' : 'Chambers';
  return `${label} ${chamberIds.join(', ')}`;
}

export async function sendDispensedNotifications({
  patientId,
  groupId,
  medications,
  dispensedAt,
  receivedAt,
}: DispensedNotificationsInput): Promise<void> {
  const patient = await User.findOne({
    _id: patientId,
    role: 'patient',
    isDeleted: { $ne: true },
  }).select('firstName lastName').lean();

  if (!patient) {
    return;
  }

  const relationships = await MonitoringRequest.find({
    patientId,
    status: 'approved',
  }).select('familyId').lean();

  const familyMembers = await User.find({
    _id: { $in: relationships.map(({ familyId }) => familyId) },
    role: 'family',
    isDeleted: { $ne: true },
  }).select([
    'notificationPreferences.sms',
    'notificationPreferences.smsConsent',
    'notificationPreferences.smsPhoneNumber',
  ].join(' ')).lean();

  const patientName = [patient.firstName, patient.lastName]
    .filter(Boolean).join(' ').trim() || 'Patient';

  const timeZone = resolveMedicationTimeZone();
  const occurredAt = dispensedAt ?? receivedAt;

  const date = new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(occurredAt);

  const time = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(occurredAt);

  const medicineDetails = [...new Set(medications.map(
    ({ medicineName, chamberIds }) => `${medicineName} (${formatChambers(chamberIds)})`
  ))];
  const medicines = new Intl.ListFormat('en-US').format(medicineDetails);
  const verb = medicineDetails.length === 1 ? 'was' : 'were';
  const eventTime = dispensedAt
    ? `on ${date} at ${time}`
    : `(reported on ${date} at ${time})`;
  const message = `${medicines} ${verb} successfully dispensed for ${patientName} ${eventTime}.`;

  const usedChambers = [...new Set(medications.flatMap(({ chamberIds }) => chamberIds))]
    .sort((a, b) => a - b);
  const eventKey = `rx-box-dispensed:${patientId}:${groupId}`;
  const title = `Medication dispensed · ${formatChambers(usedChambers)}`;

  const deliveries = await Promise.allSettled(familyMembers.flatMap((member) => {
    const recipientId = member._id.toString();
    const alertDelivery = Alert.create({
      patientId,
      monitorId: member._id,
      eventKey,
      eventType: 'MEDICATION_DISPENSED',
      severity: 'INFO',
      title,
      message,
      occurredAt,
      metadata: { groupId, medications },
    }).catch((error: unknown) => {
      if (
        typeof error !== 'object' ||
        error === null ||
        !('code' in error) ||
        error.code !== 11000
      ) {
        throw error;
      }
    });

    const preferences = member.notificationPreferences;
    const to = normalizePhilippineMobileNumber(preferences?.smsPhoneNumber);

    if (preferences?.sms !== true || preferences.smsConsent !== true || !to) {
      return [alertDelivery];
    }

    return [
      alertDelivery,
      claimAndSendSms({
        dedupeKey: `${eventKey}:${recipientId}`,
        patientId,
        recipientId,
        alertType: 'OTHER',
        to,
        message: `${message} Please remind them to take their medication now.`,
      }),
    ];
  }));

  for (const delivery of deliveries) {
    if (delivery.status === 'rejected') {
      console.error('[Rx Box] Dispensed notification delivery error:', delivery.reason);
    }
  }
}