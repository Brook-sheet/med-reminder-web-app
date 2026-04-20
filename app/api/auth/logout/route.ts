import { NextResponse } from 'next/server';
import { COOKIE_OPTIONS } from '@/lib/auth';
import type { ApiResponse } from '@/lib/interfaces/data/Api';

export async function POST() {
  const response = NextResponse.json<ApiResponse>({
    success: true,
    message: 'Logged out successfully',
  });

  response.cookies.set({ ...COOKIE_OPTIONS, value: '', maxAge: 0 });
  return response;
  
}