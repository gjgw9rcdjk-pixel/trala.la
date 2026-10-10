// Owner-only code management for /create/admin: list, create, switch off.
// Owner session only (lib/adminAuth.js); anything else gets a plain 404.

import { adminOnly } from '@/lib/adminAuth';
import { errorResponse } from '../ai';
import { createCode, disableCode, listCodes, listDecks, listProblems } from '../codes';

export async function POST(request) {
  const denied = await adminOnly();
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  try {
    const created = body.action === 'create' ? await createCode({ note: body.note, limit: body.limit }) : null;
    if (body.action === 'disable') await disableCode(body.code);
    return Response.json({ created, codes: await listCodes(), problems: await listProblems(), decks: await listDecks() });
  } catch (err) {
    return errorResponse(err);
  }
}
