// app/api/medicines/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Medicine from '@/models/Medicine';
import MedicationLog from '@/models/MedicationLog';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import type { ApiResponse } from '@/lib/interfaces/data/Api';

async function getAuthUser(request: NextRequest) {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyToken(token);
}

async function createLogsFromStartDate(
  userId: string, medicineId: string, medicineName: string,
  dosage: string, scheduledTimes: string[], startDate: string
) {
  const today = new Date().toISOString().split('T')[0];
  const start = startDate <= today ? startDate : today;

  for (const time of scheduledTimes) {
    const existing = await MedicationLog.findOne({
      userId, medicineId, scheduledDate: start, scheduledTime: time,
    });
    if (!existing) {
      await MedicationLog.create({
        userId, medicineId, medicineName, dosage,
        scheduledDate: start, scheduledTime: time, status: 'pending', source: 'auto',
      });
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    await connectDB();
    const medicines = await Medicine.find({ userId: user.userId, isActive: true }).sort({ createdAt: -1 });
    return NextResponse.json<ApiResponse>({ success: true, data: medicines });
  } catch (error) {
    console.error('[GET /api/medicines]', error);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    await connectDB();
    const body = await request.json();
    const { name, dosage, frequency, scheduledTimes, notes, startDate, endDate } = body;

    if (!name || !dosage || !frequency || !scheduledTimes || scheduledTimes.length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'name, dosage, frequency, and scheduledTimes are required' }, { status: 400 }
      );
    }

    const effectiveStartDate = startDate || new Date().toISOString().split('T')[0];

    const medicine = await Medicine.create({
      userId: user.userId,
      name: name.trim(),
      dosage: dosage.trim(),
      frequency,
      scheduledTimes,
      startDate: effectiveStartDate,
      endDate: endDate || null,
      notes: notes || '',
      isActive: true,
    });

    await createLogsFromStartDate(
      user.userId, medicine._id.toString(), medicine.name,
      medicine.dosage, scheduledTimes, effectiveStartDate
    );

    return NextResponse.json<ApiResponse>(
      { success: true, data: medicine, message: 'Medicine added successfully' }, { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/medicines]', error);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}