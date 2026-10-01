// Owner-only code management for /create/admin: list, create, switch off.
// Needs CREATE_PREVIEW_KEY; anything else gets a plain 404.

import { badKey, errorResponse } from '../ai';
import { createCode, disableCode, listCodes, listProblems } from '../codes';

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  if (badKey(body.key)) return Response.json({ error: 'not_found' }, { status: 404 });
  try {
    const created = body.action === 'create' ? await createCode({ note: body.note, limit: body.limit }) : null;
    if (body.action === 'disable') await disableCode(body.code);
    return Response.json({ created, codes: await listCodes(), problems: await listProblems() });
  } catch (err) {
    return errorResponse(err);
  }
}
