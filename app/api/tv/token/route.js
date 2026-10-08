// Hands a browser a short-lived Ably token for one TV room (see lib/tvLink.js).
// The ABLY_API_KEY never leaves the server. A TV may only listen in its room;
// a phone may also send. Without a key the TV feature answers 503
// 'tv_unavailable' and the rest of the site carries on.

import { NextResponse } from 'next/server';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { cleanRoomCode } from '@/lib/tvLink';

// Long enough for a whole game night; the client renews it if needed.
const TOKEN_TTL_MS = 4 * 60 * 60 * 1000;

// An Ably "token request", signed here with the key's secret (Ably spec
// RSA9). The browser hands it to Ably, which swaps it for a token. Done by
// hand so the server needs no Ably library.
function tokenRequest(key, { clientId, capability, ttl }) {
  const cut = key.indexOf(':');
  const keyName = key.slice(0, cut);
  const secret = key.slice(cut + 1);
  const timestamp = Date.now();
  const nonce = randomBytes(16).toString('hex');
  const text = [keyName, ttl, capability, clientId, timestamp, nonce].join('\n') + '\n';
  const mac = createHmac('sha256', secret).update(text).digest('base64');
  return { keyName, ttl, capability, clientId, timestamp, nonce, mac };
}

const RIGHTS = {
  tv: ['subscribe', 'presence', 'history'],
  phone: ['publish', 'subscribe', 'presence'],
};

export async function POST(request) {
  const key = process.env.ABLY_API_KEY;
  if (!key) return NextResponse.json({ error: 'tv_unavailable' }, { status: 503 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const room = cleanRoomCode(body?.room);
  const rights = RIGHTS[body?.role];
  if (!room || !rights) return NextResponse.json({ error: 'invalid_room' }, { status: 400 });

  if (!key.includes(':')) {
    console.error('[tv] ABLY_API_KEY is not in keyName:secret form');
    return NextResponse.json({ error: 'tv_unavailable' }, { status: 503 });
  }
  return NextResponse.json(tokenRequest(key, {
    clientId: randomUUID(),
    capability: JSON.stringify({ [`tv:${room}`]: rights }),
    ttl: TOKEN_TTL_MS,
  }));
}
