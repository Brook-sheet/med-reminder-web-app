import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import type { ApiResponse } from '@/lib/interfaces/data/Api';

async function getAuthUser(request: NextRequest) {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyToken(token);
}

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
    const profile = await User.findById(user.userId).select('-password');

    if (!profile) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiResponse>({ success: true, data: profile });
  } catch (error) {
    console.error('[GET /api/profile]', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectDB();
    const body = await request.json();
    const {
      firstName,
      middleName,
      lastName,
      patientId,
      email,
      condition,
      age,
      onboardingCompleted,
    } = body;

    // Build update object only with fields that were sent
    const updateData: Record<string, unknown> = {};
    if (firstName !== undefined) updateData.firstName = firstName || '';
    if (middleName !== undefined) updateData.middleName = middleName || '';
    if (lastName !== undefined) updateData.lastName = lastName || '';
    if (patientId !== undefined) updateData.patientId = patientId;
    if (email !== undefined) updateData.email = email?.toLowerCase();
    if (condition !== undefined) updateData.condition = condition;
    if (age !== undefined) updateData.age = age;
    if (onboardingCompleted !== undefined) updateData.onboardingCompleted = onboardingCompleted;

    const updatedUser = await User.findByIdAndUpdate(
      user.userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: updatedUser,
      message: 'Profile updated successfully',
    });
  } catch (error) {
    console.error('[PUT /api/profile]', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}