import { NextRequest, NextResponse } from 'next/server';

import { evaluateMedicationLog } from '@/lib/adherenceEngine';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import {
  getMedicationDateKey,
  parseMedicationTimeToMinutes,
  resolveMedicationTimeZone,
} from '@/lib/medicationTime';
import { connectDB } from '@/lib/mongodb';
import { getApprovedPatientIdsForMonitor } from '@/lib/monitoringAuthorization';
import { isValidRxBoxChamberId } from '@/lib/rxBoxPlanCore';
import MedicationLog from '@/models/MedicationLog';
import Medicine from '@/models/Medicine';
import User from '@/models/User';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const headers = { 'Cache-Control': 'private, no-store' };

async function readSchedule(familyId: string, publicPatientId: string) {
  const now = new Date();
  const timezone = resolveMedicationTimeZone();
  const date = getMedicationDateKey(now, timezone);
  const approvedIds = await getApprovedPatientIdsForMonitor(familyId);

  const patients = await User.find({
    _id: { $in: approvedIds },
    role: 'patient',
    isDeleted: { $ne: true },
    ...(publicPatientId ? { patientId: publicPatientId } : {}),
  }).select('patientId').sort({ _id: 1 }).lean();

  const patientIds = patients.map((patient) => patient._id);
  const [medicines, logs] = patientIds.length
    ? await Promise.all([
        Medicine.find({
          userId: { $in: patientIds },
          isActive: true,
          startDate: { $lte: date },
          $or: [{ endDate: null }, { endDate: '' }, { endDate: { $gte: date } }],
        }).select('userId name scheduledTimes chamberAssignments endDate').lean(),
        MedicationLog.find({
          userId: { $in: patientIds },
          scheduledDate: date,
          countsTowardAdherence: { $ne: false },
        }).select('medicineId scheduledDate scheduledTime status takenAt delayMinutes lateAfterMinutes windowAfterMinutes updatedAt')
          .sort({ updatedAt: -1, _id: -1 }).lean(),
      ])
    : [[], []];

  const logByDose = new Map<string, (typeof logs)[number]>();
  for (const log of logs) {
    const key = `${log.medicineId}:${parseMedicationTimeToMinutes(log.scheduledTime)}`;
    if (!logByDose.has(key) || (
      ['taken', 'late', 'missed', 'dispensed'].includes(log.status) &&
      !['taken', 'late', 'missed', 'dispensed'].includes(logByDose.get(key)!.status)
    )) {
      logByDose.set(key, log);
    }
  }

  const dosesByPatient = new Map<string, {
    id: string;
    name: string;
    minute: number;
    chambers: number[];
    endDate: string | null;
    status: string;
  }[]>();

  for (const medicine of medicines) {
    const patientKey = String(medicine.userId);
    const doses = dosesByPatient.get(patientKey) ?? [];
    const minutes = new Set(medicine.scheduledTimes.map(parseMedicationTimeToMinutes));

    for (const minute of minutes) {
      if (minute < 0) continue;

      const id = `${medicine._id}:${minute}`;
      const assignment = medicine.chamberAssignments?.find(
        ({ scheduledTime }) => parseMedicationTimeToMinutes(scheduledTime) === minute,
      );
      const chambers = [...new Set(assignment?.chamberIds ?? [])]
        .filter(isValidRxBoxChamberId).sort((a, b) => a - b);
      const log = logByDose.get(id);
      const scheduledTime = `${Math.floor(minute / 60)}:${String(minute % 60).padStart(2, '0')}`;
      const status = log?.status === 'dispensed'
        ? 'dispensed'
        : evaluateMedicationLog(
            log
              ? { ...log, medicineId: String(log.medicineId) }
              : { scheduledDate: date, scheduledTime, status: 'pending' },
            now,
            timezone,
          ).lifecycle;
      const displayStatus = log || status === 'upcoming' ? status : 'awaiting_status';

      doses.push({
        id,
        name: medicine.name,
        minute,
        chambers,
        endDate: medicine.endDate || null,
        status: displayStatus,
      });
    }

    dosesByPatient.set(patientKey, doses);
  }

  // Recheck approval in case access changed while reading the schedules.
  const stillApproved = new Set((await getApprovedPatientIdsForMonitor(familyId)).map(String));

  return {
    date,
    timezone,
    patients: patients
      .filter((patient) => patient.patientId && stillApproved.has(String(patient._id)))
      .map((patient) => ({
        patientId: patient.patientId!,
        doses: (dosesByPatient.get(String(patient._id)) ?? []).sort(
          (a, b) => a.minute - b.minute || a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
        ),
      })),
  };
}

export async function GET(request: NextRequest) {
  const token = getTokenFromRequest(request);
  const auth = token ? await verifyToken(token) : null;

  if (!auth || auth.role !== 'family') {
    return NextResponse.json({ error: 'Family access required.' }, { status: 403, headers });
  }

  try {
    await connectDB();

    const family = await User.exists({
      _id: auth.userId,
      role: 'family',
      isDeleted: { $ne: true },
    });

    if (!family) {
      return NextResponse.json({ error: 'Family access required.' }, { status: 403, headers });
    }

    const patientId = request.nextUrl.searchParams.get('patientId')?.trim().toUpperCase() ?? '';
    const read = () => readSchedule(auth.userId, patientId);

    if (request.nextUrl.searchParams.get('stream') !== '1') {
      return NextResponse.json(await read(), { headers });
    }

    const encoder = new TextEncoder();
    let stop = () => {};

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let closed = false;
        let busy = false;
        let previous = '';
        const timer = setInterval(() => void poll(), 3_000);
        const endTimer = setTimeout(() => stop(), 25_000);

        stop = () => {
          if (closed) return;

          closed = true;
          clearInterval(timer);
          clearTimeout(endTimer);
          request.signal.removeEventListener('abort', stop);

          try {
            controller.close();
          } catch {
            // The client may have already disconnected.
          }
        };

        async function poll() {
          if (closed || busy) return;

          busy = true;

          try {
            const snapshot = JSON.stringify(await read());

            if (!closed && snapshot !== previous) {
              controller.enqueue(encoder.encode(`data: ${snapshot}\n\n`));
              previous = snapshot;
            }
          } catch (error) {
            console.error('[Family schedule stream]', error);
            stop();
          } finally {
            busy = false;
          }
        }

        request.signal.addEventListener('abort', stop, { once: true });

        if (request.signal.aborted) {
          stop();
        } else {
          controller.enqueue(encoder.encode(': connected\n\n'));
          void poll();
        }
      },

      cancel() {
        stop();
      },
    });

    return new Response(stream, {
      headers: {
        ...headers,
        'Content-Type': 'text/event-stream; charset=utf-8',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('[Family schedule]', error);

    return NextResponse.json(
      { error: 'Unable to load today’s schedule.' },
      { status: 500, headers },
    );
  }
}