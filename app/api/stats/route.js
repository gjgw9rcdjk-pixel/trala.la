// Aggregate like/down tallies for every question that has at least one vote.
// Questions with no votes yet are simply absent — the client falls back to the
// seed value in lib/content.js until real votes exist.

import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const [like, down] = await Promise.all([
      kv.hgetall('tralala:like'),
      kv.hgetall('tralala:down'),
    ]);

    const ids = new Set([...Object.keys(like || {}), ...Object.keys(down || {})]);
    const stats = {};
    for (const id of ids) {
      const l = Number(like?.[id]) || 0;
      const d = Number(down?.[id]) || 0;
      const total = l + d;
      stats[id] = { like: l, down: d, percent: total ? Math.round((l / total) * 100) : null };
    }
    return NextResponse.json(stats);
  } catch {
    return NextResponse.json({ error: 'kv_unavailable' }, { status: 503 });
  }
}
