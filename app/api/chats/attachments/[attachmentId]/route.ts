// app/api/chats/attachments/[attachmentId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import Attachment from '@/models/Attachment';
import Conversation from '@/models/Conversation';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import type { ApiResponse } from '@/lib/interfaces/data/Api';

async function getAuthUser(request: NextRequest) {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyToken(token);
}

// ── GET /api/chats/attachments/[attachmentId] ──────────────────────────────
// Streams the raw file back to the browser. Only a participant of the
// conversation the attachment belongs to may fetch it. Pass ?download=1 to
// force a "Save As" download instead of inline rendering (used for non-image
// files and the explicit download button).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ attachmentId: string }> }
) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { attachmentId } = await params;
    if (!mongoose.Types.ObjectId.isValid(attachmentId)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid attachment ID' }, { status: 400 });
    }

    await connectDB();

    const attachment = await Attachment.findById(attachmentId);
    if (!attachment) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Attachment not found' }, { status: 404 });
    }

    // Authorization: the requester must be a participant of the conversation
    // this attachment was shared in (this also covers the case where one
    // side has since "deleted" the conversation from their own list — they
    // can still open links to media from history they already have).
    const conversation = await Conversation.findOne({
      _id: attachment.conversationId,
      participants: auth.userId,
    }).select('_id');
    if (!conversation) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Not authorized to view this file' }, { status: 403 });
    }

    const forceDownload = new URL(request.url).searchParams.get('download') === '1';
    const disposition = forceDownload ? 'attachment' : 'inline';
    const safeName = attachment.fileName.replace(/["\r\n]/g, '');

    return new NextResponse(new Uint8Array(attachment.data), {
      status: 200,
      headers: {
        'Content-Type': attachment.mimeType || 'application/octet-stream',
        'Content-Length': String(attachment.fileSize),
        'Content-Disposition': `${disposition}; filename="${safeName}"`,
        'Cache-Control': 'private, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('[GET /api/chats/attachments/[attachmentId]]', error);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}