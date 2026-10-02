// Owner login for /admin: checks ADMIN_KEY + ADMIN_CODE and sets the session
// cookie. See lib/adminAuth.js for the rules (3 failed tries per IP a day).

import { logIn } from '@/lib/adminAuth';
import { clientIp } from '../../create/codes';

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { result, left } = await logIn({ key: body.key, code: body.code, ip: clientIp(request) });
  if (result === 'ok') return Response.json({ ok: true });
  if (result === 'wrong') return Response.json({ error: 'wrong_code', left }, { status: 401 });
  if (result === 'locked') return Response.json({ error: 'locked' }, { status: 429 });
  return Response.json({ error: 'not_found' }, { status: 404 });
}
