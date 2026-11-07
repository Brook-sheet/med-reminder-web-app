import { resolveMedicationTimeZone } from '@/lib/medicationTime';
import { claimAndSendSms } from '@/lib/sms/delivery';
import { normalizePhilippineMobileNumber } from '@/lib/sms/phone';
import MonitoringRequest from '@/models/MonitoringRequest';
import User from '@/models/User';

interface DispensedSmsInput {
  patientId: string;
  groupId: string;
  medicineNames: string[];
  dispensedAt: Date;
}

export async function sendDispensedSms({
  patientId,
  groupId,
  medicineNames,
  dispensedAt,
}: DispensedSmsInput): Promise<void> {
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
    'notificationPreferences.sms': true,
    'notificationPreferences.smsConsent': true,
  }).select('notificationPreferences.smsPhoneNumber').lean();

  const patientName = [patient.firstName, patient.lastName]
    .filter(Boolean).join(' ').trim() || 'Patient';

  const timeZone = resolveMedicationTimeZone();

  const date = new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(dispensedAt);

  const time = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(dispensedAt);

  const medicines = new Intl.ListFormat('en-US').format(medicineNames);
  const verb = medicineNames.length === 1 ? 'has' : 'have';
  const message = `Reminder: ${medicines} ${verb} been successfully dispensed for ${patientName} on ${date} at ${time}. Please remind them to take their medication now.`;

  const deliveries = await Promise.allSettled(familyMembers.map(async (member) => {
    const to = normalizePhilippineMobileNumber(
      member.notificationPreferences?.smsPhoneNumber
    );

    if (!to) {
      return;
    }

    const recipientId = member._id.toString();

    await claimAndSendSms({
      dedupeKey: `rx-box-dispensed:${patientId}:${groupId}:${recipientId}`,
      patientId,
      recipientId,
      alertType: 'OTHER',
      to,
      message,
    });
  }));

  for (const delivery of deliveries) {
    if (delivery.status === 'rejected') {
      console.error('[Rx Box] Dispensed SMS delivery error:', delivery.reason);
    }
  }
}