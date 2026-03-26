// app/api/medicines/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Medicine from '@/models/Medicine';
import MedicationLog from '@/models/MedicationLog';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import type { ApiResponse } from '@/types';

// ── Helper: get authenticated user from request ───────────────────────────────
async function getAuthUser(request: NextRequest) {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyToken(token);
}

// ── Helper: generate today's pending logs for a medicine ─────────────────────
async function createTodayLogs(
  userId: string,
  medicineId: string,
  medicineName: string,
  dosage: string,
  scheduledTimes: string[]
) {
  const today = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"

  const logPromises = scheduledTimes.map(async (time) => {
    const existing = await MedicationLog.findOne({
      userId,
      medicineId,
      scheduledDate: today,
      scheduledTime: time,
    });
    if (!existing) {
      await MedicationLog.create({
        userId,
        medicineId,
        medicineName,
        dosage,
        scheduledDate: today,
        scheduledTime: time,
        status: 'pending',
        source: 'auto',
      });
    }
  });

  await Promise.all(logPromises);
}

// ── GET /api/medicines ────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const medicines = await Medicine.find({ userId: user.userId, isActive: true }).sort({ createdAt: -1 });

    return NextResponse.json<ApiResponse>({ success: true, data: medicines });
  } catch (error) {
    console.error('[GET /api/medicines]', error);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ── POST /api/medicines ───────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const body = await request.json();
    const { name, dosage, frequency, scheduledTimes, notes } = body;

    if (!name || !dosage || !frequency || !scheduledTimes || scheduledTimes.length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'name, dosage, frequency, and scheduledTimes are required' },
        { status: 400 }
      );
    }

    const medicine = await Medicine.create({
      userId: user.userId,
      name: name.trim(),
      dosage: dosage.trim(),
      frequency,
      scheduledTimes,
      notes: notes || '',
      isActive: true,
    });

    // Auto-create today's pending logs
    await createTodayLogs(user.userId, medicine._id.toString(), medicine.name, medicine.dosage, scheduledTimes);

    return NextResponse.json<ApiResponse>({ success: true, data: medicine, message: 'Medicine added successfully' }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/medicines]', error);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
