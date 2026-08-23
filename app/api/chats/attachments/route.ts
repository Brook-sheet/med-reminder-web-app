import { NextResponse } from 'next/server';

// Attachment uploads are handled by:
// POST /api/chats/[conversationId]/messages
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error:
        'Upload attachments through an accepted conversation.',
    },
    {
      status: 405,
      headers: {
        Allow: 'POST /api/chats/[conversationId]/messages',
      },
    }
  );
}