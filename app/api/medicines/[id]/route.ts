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

// ── GET /api/medicines/[id] ───────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Unauthorized' },
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid medicine ID' },
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    await connectDB();

    const medicine = await Medicine.findOne({ _id: id, userId: user.userId });

    if (!medicine) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Medicine not found' },
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return NextResponse.json<ApiResponse>(
      { success: true, data: medicine },
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[GET /api/medicines/[id]] Error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
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
  const { name, dosage, frequency, scheduledTimes, startDate, endDate, chamberId,
    windowBeforeMinutes, windowAfterMinutes, lateAfterMinutes } = body as {
    name?: unknown;
    dosage?: unknown;
    frequency?: unknown;
    scheduledTimes?: unknown;
    startDate?: unknown;
    endDate?: unknown;
    chamberId?: unknown;
    windowBeforeMinutes?: unknown;
    windowAfterMinutes?: unknown;
    lateAfterMinutes?: unknown;
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

  if (chamberId !== undefined && chamberId !== null && chamberId !== '') {
    const chamber = Number(chamberId);
    if (!Number.isInteger(chamber) || chamber < 1 || chamber > 3) {
      return { valid: false, error: 'Chamber must be 1, 2, or 3.' };
    }
  }

  for (const [field, value] of Object.entries({ windowBeforeMinutes, windowAfterMinutes, lateAfterMinutes })) {
    if (value !== undefined && value !== null && value !== '') {
      const minutes = Number(value);
      if (!Number.isInteger(minutes) || minutes < 0 || minutes > 720) {
        return { valid: false, error: `${field} must be a whole number from 0 to 720.` };
      }
    }
  }

  if (lateAfterMinutes !== undefined && windowAfterMinutes !== undefined &&
      Number(lateAfterMinutes) > Number(windowAfterMinutes)) {
    return { valid: false, error: 'Late threshold cannot be longer than the after-window.' };
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
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid medicine ID' },
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    await connectDB();

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch (parseErr) {
      console.error('[PUT /api/medicines/[id]] JSON parse error:', parseErr);
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid JSON body.' },
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ── Backend validation ────────────────────────────────────────────────
    const validation = validateMedicinePayload(body);
    if (!validation.valid) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: validation.error },
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { name, dosage, frequency, scheduledTimes, notes, startDate, endDate, chamberId,
      windowBeforeMinutes, windowAfterMinutes, lateAfterMinutes } = body as {
      name: string;
      dosage: string;
      frequency: string;
      scheduledTimes: string[];
      notes?: string;
      startDate?: string;
      endDate?: string;
      chamberId?: number | null;
      windowBeforeMinutes?: number;
      windowAfterMinutes?: number;
      lateAfterMinutes?: number;
    };

    const normalizedChamberId = chamberId == null ? null : Number(chamberId);
    if (normalizedChamberId !== null) {
      const chamberConflict = await Medicine.exists({
        _id: { $ne: id },
        userId: user.userId,
        isActive: true,
        chamberId: normalizedChamberId,
      });
      if (chamberConflict) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: `Chamber ${normalizedChamberId} is already assigned to another active medicine.` },
          { status: 409 },
        );
      }
    }

    const medicine = await Medicine.findOneAndUpdate(
      { _id: id, userId: user.userId },
      {
        name: name.trim(),
        dosage: dosage.trim(),
        frequency,
        scheduledTimes: (scheduledTimes as string[]).map((t) => t.trim()),
        chamberId: normalizedChamberId,
        windowBeforeMinutes: windowBeforeMinutes ?? 30,
        windowAfterMinutes: windowAfterMinutes ?? 90,
        lateAfterMinutes: lateAfterMinutes ?? 30,
        startDate: startDate && startDate.trim() ? startDate.trim() : undefined,
        endDate: endDate && endDate.trim() ? endDate.trim() : null,
        notes: typeof notes === 'string' ? notes.trim().slice(0, 500) : '',
        updatedAt: new Date(),
      },
      { new: true, runValidators: true }
    );

    if (!medicine) {
      console.warn(`[PUT /api/medicines/[id]] Medicine not found: ${id} for user ${user.userId}`);
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Medicine not found' },
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ── Regenerate medication logs for today ──────────────────────────────
    try {
      const today = new Date().toISOString().split('T')[0];
      await MedicationLog.deleteMany({
        userId: user.userId,
        medicineId: id,
        scheduledDate: today,
        status: 'pending',
      });

      // Create new logs for today with updated times
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
          eventType: 'SCHEDULED',
          expectedChamberId: medicine.chamberId ?? null,
          expectedChamberIds: medicine.chamberId ? [medicine.chamberId] : [],
          windowBeforeMinutes: medicine.windowBeforeMinutes,
          windowAfterMinutes: medicine.windowAfterMinutes,
          lateAfterMinutes: medicine.lateAfterMinutes,
          countsTowardAdherence: true,
        });
      }
    } catch (logErr) {
      console.error('[PUT /api/medicines/[id]] Error updating medication logs:', logErr);
      // Don't fail the response if log update fails, but log it
    }

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: medicine,
        message: 'Medicine updated successfully',
      },
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[PUT /api/medicines/[id]] Unhandled error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
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
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid medicine ID' },
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    await connectDB();

    const medicine = await Medicine.findOneAndUpdate(
      { _id: id, userId: user.userId },
      { isActive: false, updatedAt: new Date() },
      { new: true }
    );

    if (!medicine) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Medicine not found' },
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const todayStr = new Date().toISOString().split('T')[0];
    await MedicationLog.deleteMany({
      userId: user.userId,
      medicineId: medicine._id,
      scheduledDate: { $gte: todayStr },
      status: { $in: ['pending', 'reminder'] },
    });

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        message: 'Medicine deleted successfully',
      },
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[DELETE /api/medicines/[id]] Error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}