// app/api/medicines/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Medicine from '@/models/Medicine';
import MedicationLog from '@/models/MedicationLog';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import type { ApiResponse } from '@/types';
import mongoose from 'mongoose';

async function getAuthUser(request: NextRequest) {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyToken(token);
}

// ── PUT /api/medicines/[id] ───────────────────────────────────────────────────
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid medicine ID' }, { status: 400 });
    }

    await connectDB();
    const body = await request.json();
    const { name, dosage, frequency, scheduledTimes, notes } = body;

    const medicine = await Medicine.findOneAndUpdate(
      { _id: id, userId: user.userId },
      { name, dosage, frequency, scheduledTimes, notes },
      { new: true, runValidators: true }
    );

    if (!medicine) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Medicine not found' }, { status: 404 });
    }

    // Update today's pending logs to match new schedule
    const today = new Date().toISOString().split('T')[0];
    // Remove today's pending logs and recreate with new times
    await MedicationLog.deleteMany({ userId: user.userId, medicineId: id, scheduledDate: today, status: 'pending' });
    for (const time of scheduledTimes) {
      await MedicationLog.create({
        userId: user.userId,
        medicineId: id,
        medicineName: medicine.name,
        dosage: medicine.dosage,
        scheduledDate: today,
        scheduledTime: time,
        status: 'pending',
        source: 'auto',
      });
    }

    return NextResponse.json<ApiResponse>({ success: true, data: medicine, message: 'Medicine updated successfully' });
  } catch (error) {
    console.error('[PUT /api/medicines/[id]]', error);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ── DELETE /api/medicines/[id] ────────────────────────────────────────────────
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid medicine ID' }, { status: 400 });
    }

    await connectDB();

    // Soft delete — keeps history intact
    const medicine = await Medicine.findOneAndUpdate(
      { _id: id, userId: user.userId },
      { isActive: false },
      { new: true }
    );

    if (!medicine) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Medicine not found' }, { status: 404 });
    }

    return NextResponse.json<ApiResponse>({ success: true, message: 'Medicine deleted successfully' });
  } catch (error) {
    console.error('[DELETE /api/medicines/[id]]', error);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}