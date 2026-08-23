import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import { getChatRelationshipSummary } from '@/lib/chatRelationship';
import User from '@/models/User';
import type { ApiResponse } from '@/lib/interfaces/data/Api';

async function getAuthUser(request: NextRequest) {
  const token = getTokenFromRequest(request);
  return token ? verifyToken(token) : null;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthUser(request);

    if (!auth) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const identifier = (request.nextUrl.searchParams.get('identifier') ?? '')
      .trim()
      .toUpperCase();

    if (!identifier) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'An account ID is required.' },
        { status: 400 }
      );
    }

    await connectDB();

    const currentUser = await User.findById(auth.userId).select(
      'role isDeleted'
    );

    if (!currentUser || currentUser.isDeleted) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const isPatient = currentUser.role === 'patient';
    const expectedPrefix = isPatient ? 'FM-' : 'PT-';

    if (!identifier.startsWith(expectedPrefix)) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: isPatient
            ? 'Patients must search using a Family ID beginning with FM-.'
            : 'Family members must search using a Patient ID beginning with PT-.',
        },
        { status: 400 }
      );
    }

    const target = await User.findOne({
      ...(isPatient ? { familyId: identifier } : { patientId: identifier }),
      role: isPatient ? 'family' : 'patient',
      isDeleted: { $ne: true },
    }).select('_id firstName middleName lastName patientId familyId role');

    if (!target) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'No matching account was found with this ID.' },
        { status: 404 }
      );
    }

    const relationship = await getChatRelationshipSummary(
      currentUser._id,
      target._id
    );

    const name = [target.firstName, target.middleName, target.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        user: {
          name: name || 'Unknown user',
          role: target.role,
          identifier:
            target.role === 'family' ? target.familyId : target.patientId,
          avatarUrl: null,
        },
        relationship,
      },
    });
  } catch (error) {
    console.error('[GET /api/chats/search]', error);

    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}