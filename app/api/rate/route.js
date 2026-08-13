// Records one anonymous vote for a question and returns its updated tally.
// `kind` matches the client's rating values: 'like' (heart) or 'down' (✕), or
// null to un-vote (see the rate() toggle in app/page.jsx).
// Storage: two Redis hashes (tralala:like, tralala:down) keyed by question
// index, plus one hash per device (tralala:voter:<device>) so a device's
// previous vote can be un-counted before the new one is applied.

import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import { QUESTIONS } from '@/lib/content';

function toStats(id, like, down) {
  const l = Number(like) || 0;
  const d = Number(down) || 0;
  const total = l + d;
  return { id, like: l, down: d, percent: total ? Math.round((l / total) * 100) : null };
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { id, kind, device } = body || {};
  if (!Number.isInteger(id) || id < 0 || id >= QUESTIONS.length) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }
  if (kind !== 'like' && kind !== 'down' && kind !== null) {
    return NextResponse.json({ error: 'invalid_kind' }, { status: 400 });
  }
  if (typeof device !== 'string' || device.length < 1 || device.length > 128) {
    return NextResponse.json({ error: 'invalid_device' }, { status: 400 });
  }

  const field = String(id);
  const voterKey = `tralala:voter:${device}`;

  try {
    const prev = await kv.hget(voterKey, field);

    if (prev !== kind) {
      const ops = [];
      if (prev === 'like') ops.push(kv.hincrby('tralala:like', field, -1));
      if (prev === 'down') ops.push(kv.hincrby('tralala:down', field, -1));
      if (kind === 'like') ops.push(kv.hincrby('tralala:like', field, 1));
      if (kind === 'down') ops.push(kv.hincrby('tralala:down', field, 1));
      ops.push(kind === null ? kv.hdel(voterKey, field) : kv.hset(voterKey, { [field]: kind }));
      await Promise.all(ops);
    }

    const [like, down] = await Promise.all([
      kv.hget('tralala:like', field),
      kv.hget('tralala:down', field),
    ]);
    return NextResponse.json(toStats(id, like, down));
  } catch {
    return NextResponse.json({ error: 'kv_unavailable' }, { status: 503 });
  }
}
