// Checks a promo code typed on /create and says how many decks are left.
// Three wrong codes in 15 minutes lock the caller out (see ../codes.js).

import { checkCode, clientIp, publicInfo } from '../codes';
import { errorResponse } from '../ai';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    return Response.json(publicInfo(await checkCode(body.code, clientIp(request))));
  } catch (err) {
    return errorResponse(err);
  }
}
