import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import { signToken, COOKIE_OPTIONS } from '@/lib/auth';
import type { ApiResponse } from '@/lib/interfaces/data/Api';

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const token = await signToken({ userId: user._id.toString(), email: user.email });

    const response = NextResponse.json<ApiResponse>({
      success: true,
      message: 'Logged in successfully',
      data: {
        user: {
          id: user._id.toString(),
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          patientId: user.patientId,
        },
      },
    });

    response.cookies.set({ ...COOKIE_OPTIONS, value: token });
    return response;
  } catch (error) {
    console.error('[LOGIN]', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
