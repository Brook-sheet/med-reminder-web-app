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
    const { email, password, confirmPassword, firstName, middleName, lastName } = body;

    if (!email || !password || !confirmPassword) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'All fields are required' },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Passwords do not match' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      email: email.toLowerCase(),
      password: hashedPassword,
      firstName: firstName || '',
      middleName: middleName || '',
      lastName: lastName || '',
    });

    const token = await signToken({ userId: user._id.toString(), email: user.email });

    const response = NextResponse.json<ApiResponse>(
      {
        success: true,
        message: 'Account created successfully',
        data: {
          user: {
            id: user._id.toString(),
            email: user.email,
            firstName: user.firstName,
            middleName: user.middleName,
            lastName: user.lastName,
          },
        },
      },
      { status: 201 }
    );

    response.cookies.set({ ...COOKIE_OPTIONS, value: token });
    return response;
  } catch (error) {
    console.error('[REGISTER]', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
