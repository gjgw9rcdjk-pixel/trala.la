// Private view + delete for the feedback board. Owner session only
// (lib/adminAuth.js). Backs the /moderate page.

import { NextResponse } from 'next/server';
import { listFeedback, deleteFeedback } from '@/lib/feedbackKv';
import { adminOnly } from '@/lib/adminAuth';

export async function GET() {
  const denied = await adminOnly();
  if (denied) return denied;

  try {
    const items = await listFeedback();
    return NextResponse.json(items);
  } catch {
    return NextResponse.json({ error: 'kv_unavailable' }, { status: 503 });
  }
}

export async function DELETE(request) {
  const denied = await adminOnly();
  if (denied) return denied;
  const { searchParams } = new URL(request.url);

  const id = Number(searchParams.get('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  try {
    await deleteFeedback(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'kv_unavailable' }, { status: 503 });
  }
}
