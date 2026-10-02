// Private export of the full feedback list, for offline analysis. Owner
// session only (lib/adminAuth.js): log in on /admin, then open this URL in
// the same browser. See README "Admin".

import { NextResponse } from 'next/server';
import { listFeedback } from '@/lib/feedbackKv';
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
