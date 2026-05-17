import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Medicine from '@/models/Medicine';
import MedicationLog from '@/models/MedicationLog';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import type { ApiResponse } from '@/lib/interfaces/data/Api';
import type { IMedicineDocument } from '@/models/Medicine';

async function getAuthUser(request: NextRequest) {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyToken(token);
}

// ── Validation helpers ────────────────────────────────────────────────────

const VALID_FREQUENCIES = [
  'Once daily',
  'Twice daily',
  'Three times daily',
  'Every 4 hours',
  'Every 6 hours',
  'Every 8 hours',
  'Weekly',
  'As needed',
];

const TIME_REGEX = /^(1[0-2]|[1-9]):[0-5][0-9]\s(AM|PM)$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(dateStr: string): boolean {
  if (!DATE_REGEX.test(dateStr)) return false;
  const d = new Date(dateStr + 'T00:00:00');
  return !isNaN(d.getTime());
}

function isValidTime(timeStr: string): boolean {
  return TIME_REGEX.test(timeStr.trim());
}

function sanitizeMedicineName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 100) return null;
  if (!/[a-zA-Z0-9]/.test(trimmed)) return null;
  if (/^[^a-zA-Z0-9]+$/.test(trimmed)) return null;
  return trimmed;
}

function sanitizeDosage(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 50) return null;
  if (!/[a-zA-Z0-9]/.test(trimmed)) return null;
  return trimmed;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
}

function validateMedicinePayload(body: Record<string, unknown>): ValidationResult {
  const { name, dosage, frequency, scheduledTimes, startDate, endDate } = body;

  // ── name ──────────────────────────────────────────────────────────────
  const cleanName = sanitizeMedicineName(name);
  if (!cleanName) {
    return {
      valid: false,
      error:
        'Medicine name is required, must be 1–100 characters, and must contain at least one letter or digit.',
    };
  }

  // ── dosage ────────────────────────────────────────────────────────────
  const cleanDosage = sanitizeDosage(dosage);
  if (!cleanDosage) {
    return {
      valid: false,
      error:
        'Dosage is required, must be 1–50 characters, and must contain at least one letter or digit.',
    };
  }

  // ── frequency ─────────────────────────────────────────────────────────
  if (!frequency || typeof frequency !== 'string') {
    return { valid: false, error: 'Frequency is required.' };
  }
  if (!VALID_FREQUENCIES.includes(frequency)) {
    return {
      valid: false,
      error: `Frequency must be one of: ${VALID_FREQUENCIES.join(', ')}.`,
    };
  }

  // ── scheduledTimes ────────────────────────────────────────────────────
  if (!Array.isArray(scheduledTimes) || scheduledTimes.length === 0) {
    return { valid: false, error: 'At least one scheduled time is required.' };
  }
  if (scheduledTimes.length > 24) {
    return { valid: false, error: 'A maximum of 24 scheduled times is allowed.' };
  }
  for (const t of scheduledTimes) {
    if (typeof t !== 'string' || !isValidTime(t)) {
      return {
        valid: false,
        error: `Invalid scheduled time "${String(t)}". Expected format: "H:MM AM" or "H:MM PM".`,
      };
    }
  }
  const uniqueTimes = new Set((scheduledTimes as string[]).map((t) => t.trim().toUpperCase()));
  if (uniqueTimes.size !== scheduledTimes.length) {
    return { valid: false, error: 'Duplicate scheduled times are not allowed.' };
  }

  // ── startDate ─────────────────────────────────────────────────────────
  if (startDate !== undefined && startDate !== null && startDate !== '') {
    if (typeof startDate !== 'string' || !isValidDate(startDate)) {
      return { valid: false, error: 'Start date must be a valid date in YYYY-MM-DD format.' };
    }
  }

  // ── endDate ───────────────────────────────────────────────────────────
  if (endDate !== undefined && endDate !== null && endDate !== '') {
    if (typeof endDate !== 'string' || !isValidDate(endDate)) {
      return { valid: false, error: 'End date must be a valid date in YYYY-MM-DD format.' };
    }
    const sd = typeof startDate === 'string' && startDate
      ? startDate
      : new Date().toISOString().split('T')[0];
    if (endDate < sd) {
      return { valid: false, error: 'End date cannot be before start date.' };
    }
  }

  return { valid: true };
}

// ── Helpers ───────────────────────────────────────────────────────────────

async function createLogsFromStartDate(
  userId: string,
  medicineId: string,
  medicineName: string,
  dosage: string,
  scheduledTimes: string[],
  startDate: string
) {
  const today = new Date().toISOString().split('T')[0];
  const start = startDate <= today ? startDate : today;

  for (const time of scheduledTimes) {
    const existing = await MedicationLog.findOne({
      userId,
      medicineId,
      scheduledDate: start,
      scheduledTime: time,
    });
    if (!existing) {
      await MedicationLog.create({
        userId,
        medicineId,
        medicineName,
        dosage,
        scheduledDate: start,
        scheduledTime: time,
        status: 'pending',
        source: 'auto',
      });
    }
  }
}

// ── GET /api/medicines ────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    await connectDB();
    const medicines = await Medicine.find({ userId: user.userId, isActive: true }).sort({
      createdAt: -1,
    });
    return NextResponse.json<ApiResponse>({ success: true, data: medicines });
  } catch (error) {
    console.error('[GET /api/medicines]', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ── POST /api/medicines ───────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    await connectDB();

    let body: Record<string, unknown>;
    try {
      body = await request.json() as Record<string, unknown>;
    } catch {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid JSON body.' },
        { status: 400 }
      );
    }

    // ── Backend validation ────────────────────────────────────────────────
    const validation = validateMedicinePayload(body);
    if (!validation.valid) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    // Safe to cast after validation passes
    const name = (body.name as string).trim();
    const dosage = (body.dosage as string).trim();
    const frequency = body.frequency as string;
    const scheduledTimes = (body.scheduledTimes as string[]).map((t) => t.trim());
    const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 500) : '';
    const startDate = typeof body.startDate === 'string' && body.startDate.trim()
      ? body.startDate.trim()
      : new Date().toISOString().split('T')[0];
    const endDate = typeof body.endDate === 'string' && body.endDate.trim()
      ? body.endDate.trim()
      : null;

    const medicine: IMedicineDocument = await Medicine.create({
      userId: user.userId,
      name,
      dosage,
      frequency,
      scheduledTimes,
      startDate,
      endDate,
      notes,
      isActive: true,
    });

    await createLogsFromStartDate(
      user.userId,
      medicine._id.toString(),
      medicine.name,
      medicine.dosage,
      medicine.scheduledTimes as string[],
      startDate
    );

    return NextResponse.json<ApiResponse>(
      { success: true, data: medicine, message: 'Medicine added successfully' },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/medicines]', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}