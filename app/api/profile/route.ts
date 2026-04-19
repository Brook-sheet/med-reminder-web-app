// app/api/profile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import type { ApiResponse } from '@/types';

async function getAuthUser(request: NextRequest) {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyToken(token);
}

// ── GET /api/profile ──────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const profile = await User.findById(user.userId).select('-password');

    if (!profile) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json<ApiResponse>({ success: true, data: profile });
  } catch (error) {
    console.error('[GET /api/profile]', error);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ── PUT /api/profile ──────────────────────────────────────────────────────────
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const body = await request.json();
    const { firstName, middleName, lastName, patientId, email } = body;

    // Build fullName from parts
    const nameParts = [firstName, middleName, lastName].filter(Boolean);
    const fullName = nameParts.join(' ').trim();

    const updatedUser = await User.findByIdAndUpdate(
      user.userId,
      {
        firstName: firstName || '',
        middleName: middleName || '',
        lastName: lastName || '',
        fullName,
        patientId,
        email: email?.toLowerCase(),
      },
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json<ApiResponse>({ success: true, data: updatedUser, message: 'Profile updated successfully' });
  } catch (error) {
    console.error('[PUT /api/profile]', error);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
