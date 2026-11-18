import { isFamilyAdvanceWindow } from "./reminderTiming";
import { medicationScheduledAt } from '@/lib/medicationTime';
import { claimAndSendSms } from '@/lib/sms/delivery';
import { normalizePhilippineMobileNumber } from '@/lib/sms/phone';
import Alert from '@/models/Alert';
import MonitoringRequest from '@/models/MonitoringRequest';
import User from '@/models/User';

interface AdvanceDose {
  _id: { toString(): string };
  userId: { toString(): string };
  medicineId?: { toString(): string } | null;
  medicineName: string;
  scheduledDate: string;
  scheduledTime: string;
}

/** Independent of patient notification preferences; only approved family members. */
export async function sendFamilyAdvanceReminders(log: AdvanceDose, now: Date, timeZone: string) {
  const scheduled = medicationScheduledAt(log.scheduledDate, log.scheduledTime, timeZone);
  if (!isFamilyAdvanceWindow(now, scheduled)) return;
  const patientId = log.userId.toString();
  const patient = await User.findOne({ _id: patientId, role: 'patient', isDeleted: { $ne: true } })
    .select('firstName lastName').lean();
  if (!patient) return;
  const links = await MonitoringRequest.find({ patientId, status: 'approved' }).select('familyId').lean();
  const members = await User.find({ _id: { $in: links.map(l => l.familyId) }, role: 'family', isDeleted: { $ne: true } })
    .select('notificationPreferences').lean();
  const name = [patient.firstName, patient.lastName].filter(Boolean).join(' ') || 'Patient';
  const message = `${name} has an upcoming medication schedule: ${log.medicineName} on ${log.scheduledDate} at ${log.scheduledTime} (${timeZone}). Please remind them to take their medicine at the scheduled time.`;
  const eventKey = `family-upcoming:${log._id}:${scheduled.toISOString()}`;
  for (const member of members) {
    // Recheck authorization before external delivery.
    if (!await MonitoringRequest.exists({ patientId, familyId: member._id, status: 'approved' })) continue;
    try {
      const filter = { eventKey, monitorId: member._id };
      let alert;
      try {
        alert = await Alert.findOneAndUpdate(filter, { $setOnInsert: {
          ...filter, patientId, medicationId: log.medicineId?.toString(), medicationLogId: log._id.toString(),
          eventType: 'MEDICATION_UPCOMING', severity: 'INFO', title: 'Upcoming Medication', message,
          occurredAt: now, channels: { inApp: true, push: false, sms: member.notificationPreferences?.sms === true },
          metadata: { scheduledFor: scheduled.toISOString(), leadMinutes: 30 },
        } }, { upsert: true, new: true, runValidators: true });
      } catch (error) {
        if ((error as { code?: number }).code !== 11000) throw error;
        alert = await Alert.findOne(filter);
      }
      const prefs = member.notificationPreferences;
      const to = normalizePhilippineMobileNumber(prefs?.smsPhoneNumber);
      if (alert && prefs?.sms === true && prefs.smsConsent === true && to) {
        const delivery = await claimAndSendSms({ dedupeKey: `${eventKey}:${member._id}`, patientId,
          recipientId: member._id.toString(), alertId: alert._id.toString(), alertType: 'OTHER', to, message });
        if (delivery.result.errorCode !== 'SMS_ALREADY_PROCESSING') {
          await Alert.updateOne({ _id: alert._id }, { $set: {
            'delivery.smsStatus': delivery.result.status.toUpperCase(),
            'delivery.smsError': delivery.result.errorMessage || '',
          } });
        }
      }
    } catch (error) {
      console.error('[Family advance reminder]', { eventKey, recipientId: member._id.toString(), error });
    }
  }
}