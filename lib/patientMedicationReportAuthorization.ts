import { NextRequest } from 'next/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import { MedicationReportError } from '@/lib/patientMedicationReport';
import User from '@/models/User';
import MonitoringRequest from '@/models/MonitoringRequest';

async function authenticatedUser(request: NextRequest) {
  const token = getTokenFromRequest(request);

  return token ? verifyToken(token) : null;
}

export async function authorizeOwnMedicationReport(
  request: NextRequest,
): Promise<string> {
  const auth = await authenticatedUser(request);

  if (!auth) {
    throw new MedicationReportError('Unauthorized.', 401);
  }

  if (auth.role !== 'patient') {
    throw new MedicationReportError(
      'Only Patient accounts can use this report endpoint.',
      403,
    );
  }

  const patient = await User.findOne({
    _id: auth.userId,
    role: 'patient',
    isDeleted: { $ne: true },
  })
    .select('_id')
    .lean();

  if (!patient) {
    throw new MedicationReportError('Patient not found.', 404);
  }

  return patient._id.toString();
}

export async function authorizeMonitoredMedicationReport(
  request: NextRequest,
  requestedPatientId: string,
): Promise<string> {
  const auth = await authenticatedUser(request);

  if (!auth) {
    throw new MedicationReportError('Unauthorized.', 401);
  }

  if (auth.role !== 'family') {
    throw new MedicationReportError(
      'Only Family accounts can use the monitored-patient report endpoint.',
      403,
    );
  }

  const patientId = requestedPatientId.trim().toUpperCase();

  if (!patientId) {
    throw new MedicationReportError('Patient ID is required.', 400);
  }

  const patient = await User.findOne({
    patientId,
    role: 'patient',
    isDeleted: { $ne: true },
  })
    .select('_id')
    .lean();

  if (!patient) {
    throw new MedicationReportError('Patient not found.', 404);
  }

  const relationship = await MonitoringRequest.exists({
    patientId: patient._id,
    familyId: auth.userId,
    status: 'approved',
  });

  if (!relationship) {
    throw new MedicationReportError(
      'Access denied. An active approved monitoring relationship is required.',
      403,
    );
  }

  return patient._id.toString();
}