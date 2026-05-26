import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Medicine from '@/models/Medicine';
import MedicationLog from '@/models/MedicationLog';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import type { ApiResponse } from '@/lib/interfaces/data/Api';
import mongoose from 'mongoose';

async function getAuthUser(request: NextRequest) {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyToken(token);
}

// ── Validation helpers (duplicated here to keep each route file self-contained) ──

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

function sanitizeMedicineName(raw: string): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 100) return null;
  if (!/[a-zA-Z0-9]/.test(trimmed)) return null;
  if (/^[^a-zA-Z0-9]+$/.test(trimmed)) return null;
  return trimmed;
}

function sanitizeDosage(raw: string): string | null {
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
  const { name, dosage, frequency, scheduledTimes, startDate, endDate } = body as {
    name?: unknown;
    dosage?: unknown;
    frequency?: unknown;
    scheduledTimes?: unknown;
    startDate?: unknown;
    endDate?: unknown;
  };

  // ── name ──────────────────────────────────────────────────────────────
  const cleanName = sanitizeMedicineName(name as string);
  if (!cleanName) {
    return {
      valid: false,
      error:
        'Medicine name is required, must be 1–100 characters, and must contain at least one letter or digit.',
    };
  }

  // ── dosage ────────────────────────────────────────────────────────────
  const cleanDosage = sanitizeDosage(dosage as string);
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
        error: `Invalid scheduled time "${t}". Expected format: "H:MM AM" or "H:MM PM".`,
      };
    }
  }
  const uniqueTimes = new Set(scheduledTimes.map((t) => t.trim().toUpperCase()));
  if (uniqueTimes.size !== scheduledTimes.length) {
    return { valid: false, error: 'Duplicate scheduled times are not allowed.' };
  }

  // ── startDate ─────────────────────────────────────────────────────────
  if (startDate !== undefined && startDate !== null && startDate !== '') {
    if (typeof startDate !== 'string' || !isValidDate(startDate as string)) {
      return { valid: false, error: 'Start date must be a valid date in YYYY-MM-DD format.' };
    }
  }

  // ── endDate ───────────────────────────────────────────────────────────
  if (endDate !== undefined && endDate !== null && endDate !== '') {
    if (typeof endDate !== 'string' || !isValidDate(endDate as string)) {
      return { valid: false, error: 'End date must be a valid date in YYYY-MM-DD format.' };
    }
    const sd = (startDate as string) || new Date().toISOString().split('T')[0];
    if ((endDate as string) < sd) {
      return { valid: false, error: 'End date cannot be before start date.' };
    }
  }

  return { valid: true };
}

// ── PUT /api/medicines/[id] ───────────────────────────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid medicine ID' },
        { status: 400 }
      );
    }

    await connectDB();

    let body: Record<string, unknown>;
    try {
      body = await request.json();
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

    const { name, dosage, frequency, scheduledTimes, notes, startDate, endDate } = body as {
      name: string;
      dosage: string;
      frequency: string;
      scheduledTimes: string[];
      notes?: string;
      startDate?: string;
      endDate?: string;
    };

    const medicine = await Medicine.findOneAndUpdate(
      { _id: id, userId: user.userId },
      {
        name: name.trim(),
        dosage: dosage.trim(),
        frequency,
        scheduledTimes: (scheduledTimes as string[]).map((t) => t.trim()),
        startDate: startDate && startDate.trim() ? startDate.trim() : undefined,
        endDate: endDate && endDate.trim() ? endDate.trim() : null,
        notes: typeof notes === 'string' ? notes.trim().slice(0, 500) : '',
      },
      { new: true, runValidators: true }
    );

    if (!medicine) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Medicine not found' },
        { status: 404 }
      );
    }

    const today = new Date().toISOString().split('T')[0];
    await MedicationLog.deleteMany({
      userId: user.userId,
      medicineId: id,
      scheduledDate: today,
      status: 'pending',
    });
    for (const time of scheduledTimes as string[]) {
      await MedicationLog.create({
        userId: user.userId,
        medicineId: id,
        medicineName: medicine.name,
        dosage: medicine.dosage,
        scheduledDate: today,
        scheduledTime: time.trim(),
        status: 'pending',
        source: 'auto',
      });
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: medicine,
      message: 'Medicine updated successfully',
    });
  } catch (error) {
    console.error('[PUT /api/medicines/[id]]', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ── DELETE /api/medicines/[id] ────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid medicine ID' },
        { status: 400 }
      );
    }

    await connectDB();

    const medicine = await Medicine.findOneAndUpdate(
      { _id: id, userId: user.userId },
      { isActive: false },
      { new: true }
    );

    if (!medicine) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Medicine not found' },
        { status: 404 }
      );
    }

    const todayStr = new Date().toISOString().split('T')[0];
    await MedicationLog.deleteMany({
      userId: user.userId,
      medicineId: medicine._id,
      scheduledDate: { $gte: todayStr },
      status: { $in: ['pending', 'reminder'] },
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      message: 'Medicine deleted successfully',
    });
  } catch (error) {
    console.error('[DELETE /api/medicines/[id]]', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}