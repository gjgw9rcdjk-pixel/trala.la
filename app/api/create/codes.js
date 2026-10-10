// Promo codes for /create. Each code holds a number of decks (generations),
// shared by everyone who has the code, and stops working 30 days after it
// was made. Created and listed on /create/admin.
//
// KV layout:
//   tralala:codes                     set of every code (for the admin list)
//   tralala:code:<CODE>               { note, limit, createdAt, expiresAt, disabled }
//   tralala:code:<CODE>:used          decks written with this code
//   tralala:code:<CODE>:clarify       clarify calls (not counted, only capped)
//   tralala:swaps:<CODE>:<deckId>     ↻ swaps for one deck
//   tralala:deck:<deckId>             { adult } for a week: deck ids handed out
//   tralala:adultok:<CODE>            clarify offered the 18+ switch (1 day)
//   tralala:create:problems           last 200 failures (see logProblem)
//   tralala:create:decks              last 200 written decks: timing and cost (see logDeck)
//   tralala:codefail:<ip>             wrong codes typed in the last 15 min
//
// Without KV env vars (local dev) everything lives in memory and resets
// when the dev server restarts.

import { kv } from '@vercel/kv';
import { randomBytes, randomUUID } from 'crypto';

const DAY = 24 * 60 * 60;
export const CODE_DAYS = 30;
export const SWAPS_PER_DECK = 15;
const CLARIFY_PER_DECK = 5; // clarify calls allowed per deck on the code
const MAX_FAILS = 3;
const LOCK_SECONDS = 15 * 60;

// ── tiny store: KV in production, memory locally ─────────────────────────
const useKv = () => Boolean(process.env.KV_REST_API_URL);
// key → { v, until }. On globalThis because each route is its own bundle in
// dev, and they must all see the same codes.
const mem = globalThis.tralalaCodeMem ??= new Map();
const memGet = (k) => {
  const e = mem.get(k);
  if (!e) return null;
  if (e.until && e.until < Date.now()) { mem.delete(k); return null; }
  return e.v;
};

const store = {
  get: (k) => (useKv() ? kv.get(k) : memGet(k)),
  async set(k, v, ttl) {
    if (useKv()) await kv.set(k, v, ttl ? { ex: ttl } : undefined);
    else mem.set(k, { v, until: ttl ? Date.now() + ttl * 1000 : 0 });
  },
  async incr(k, ttl) {
    if (useKv()) {
      const n = await kv.incr(k);
      if (n === 1 && ttl) await kv.expire(k, ttl);
      return n;
    }
    const n = (memGet(k) || 0) + 1;
    mem.set(k, { v: n, until: mem.get(k)?.until || (ttl ? Date.now() + ttl * 1000 : 0) });
    return n;
  },
  async decr(k) {
    if (useKv()) await kv.decr(k);
    else mem.set(k, { ...mem.get(k), v: (memGet(k) || 0) - 1 });
  },
  async addToIndex(code) {
    if (useKv()) await kv.sadd('tralala:codes', code);
    else mem.set('tralala:codes', { v: [...new Set([...(memGet('tralala:codes') || []), code])] });
  },
  index: async () => (useKv() ? kv.smembers('tralala:codes') : memGet('tralala:codes') || []),
  async push(k, v, max) {
    if (useKv()) {
      await kv.lpush(k, v);
      await kv.ltrim(k, 0, max - 1);
    } else {
      mem.set(k, { v: [v, ...(memGet(k) || [])].slice(0, max) });
    }
  },
  list: async (k, n) => (useKv() ? kv.lrange(k, 0, n - 1) : (memGet(k) || []).slice(0, n)),
};

const recKey = (code) => `tralala:code:${code}`;
const usedKey = (code) => `tralala:code:${code}:used`;
const clarifyKey = (code) => `tralala:code:${code}:clarify`;
const swapsKey = (code, deckId) => `tralala:swaps:${code}:${deckId}`;
const failKey = (ip) => `tralala:codefail:${ip}`;

// No 0/O, 1/I/L, so a code read out loud or typed from a photo still works.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function randomCode() {
  const bytes = randomBytes(8);
  const chars = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}

// "abcd efgh", "ABCD-EFGH" and "abcdefgh" are all the same code.
export function normalizeCode(raw) {
  const s = String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4)}` : '';
}

export function clientIp(request) {
  return (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'local';
}

export class CodeError extends Error {
  constructor(code, status = 403) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

// ── admin ────────────────────────────────────────────────────────────────
export async function createCode({ note, limit }) {
  let code;
  do code = randomCode(); while (await store.get(recKey(code)));
  const now = Date.now();
  const rec = {
    note: String(note ?? '').slice(0, 120).trim(),
    limit: Math.min(500, Math.max(1, Math.floor(Number(limit) || 1))),
    createdAt: now,
    expiresAt: now + CODE_DAYS * DAY * 1000,
    disabled: false,
  };
  await store.set(recKey(code), rec);
  await store.addToIndex(code);
  return { code, ...rec, used: 0 };
}

export async function listCodes() {
  const codes = await store.index();
  const rows = await Promise.all(codes.map(async (code) => {
    const rec = await store.get(recKey(code));
    if (!rec) return null;
    return { code, ...rec, used: Math.max(0, Number(await store.get(usedKey(code))) || 0) };
  }));
  return rows.filter(Boolean).sort((a, b) => b.createdAt - a.createdAt);
}

export async function disableCode(raw) {
  const code = normalizeCode(raw);
  const rec = code && await store.get(recKey(code));
  if (!rec) throw new CodeError('code_bad', 404);
  await store.set(recKey(code), { ...rec, disabled: true });
}

// ── players ──────────────────────────────────────────────────────────────
// Looks a code up. Wrong codes count against the caller's IP: after three
// in 15 minutes, every check is refused until the time is up (even a right
// code), so codes can't be guessed.
export async function checkCode(raw, ip) {
  const fails = Number(await store.get(failKey(ip))) || 0;
  if (fails >= MAX_FAILS) throw new CodeError('locked', 429);
  const code = normalizeCode(raw);
  const rec = code && await store.get(recKey(code));
  if (!rec) {
    const n = await store.incr(failKey(ip), LOCK_SECONDS);
    throw new CodeError(n >= MAX_FAILS ? 'locked' : 'code_bad', n >= MAX_FAILS ? 429 : 403);
  }
  if (rec.disabled) throw new CodeError('code_off');
  if (rec.expiresAt < Date.now()) throw new CodeError('code_expired');
  const used = Math.max(0, Number(await store.get(usedKey(code))) || 0);
  return { code, rec, left: Math.max(0, rec.limit - used) };
}

// What the page shows: how many decks are left and until when.
export const publicInfo = ({ code, rec, left }) => ({ code, left, limit: rec.limit, expiresAt: rec.expiresAt });

// Clarify offered the 18+ switch for this code's idea. Only then may a deck
// on the code be 18+; without it a tampered request still gets a normal deck.
export async function allowAdult(raw) {
  await store.set(`tralala:adultok:${normalizeCode(raw)}`, 1, DAY);
}

// One deck = one generation. Returns { left, deckId, adult, refund };
// refund() gives the generation back if the deck failed before any card
// was written.
export async function takeGeneration(raw, ip, wantAdult) {
  const { code, rec } = await checkCode(raw, ip);
  const n = await store.incr(usedKey(code));
  if (n > rec.limit) {
    await store.decr(usedKey(code));
    throw new CodeError('code_used_up');
  }
  const adult = Boolean(wantAdult) && Boolean(await store.get(`tralala:adultok:${code}`));
  const deckId = randomUUID();
  await store.set(`tralala:deck:${deckId}`, { adult }, 7 * DAY);
  return { left: rec.limit - n, deckId, adult, refund: () => store.decr(usedKey(code)) };
}

// Clarify is free but capped, so one code can't be used to ask questions
// forever. Needs at least one deck left.
export async function allowClarify(raw, ip) {
  const { code, rec, left } = await checkCode(raw, ip);
  if (left < 1) throw new CodeError('code_used_up');
  const n = await store.incr(clarifyKey(code));
  if (n > rec.limit * CLARIFY_PER_DECK) throw new CodeError('clarify_used_up');
}

// ↻ is free but limited per deck. The deck id comes from takeGeneration,
// so a made-up id gets nothing, and the deck's 18+ setting comes from there
// too. Works even when the code has no decks left. refund() gives the swap
// back if the AI call fails.
export async function takeSwap(raw, ip, deckId) {
  const { code } = await checkCode(raw, ip);
  const id = String(deckId ?? '');
  const deck = /^[0-9a-f-]{36}$/.test(id) && await store.get(`tralala:deck:${id}`);
  if (!deck) throw new CodeError('swaps_used_up');
  const n = await store.incr(swapsKey(code, id), 7 * DAY);
  if (n > SWAPS_PER_DECK) {
    await store.decr(swapsKey(code, id));
    throw new CodeError('swaps_used_up');
  }
  return { swapsLeft: SWAPS_PER_DECK - n, adult: Boolean(deck.adult), refund: () => store.decr(swapsKey(code, id)) };
}

// ── failures, for the admin page ────────────────────────────────────────
// Vercel keeps runtime logs for about an hour, so failures are also kept
// here: what broke, where, on which code, how far the deck got. No idea
// text or cards are stored.
const PROBLEMS_KEY = 'tralala:create:problems';
const PROBLEMS_MAX = 200;

export async function logProblem({ route, kind, code, detail }) {
  try {
    await store.push(PROBLEMS_KEY, {
      at: Date.now(),
      route,
      kind,
      code: normalizeCode(code) || null,
      detail: String(detail ?? '').slice(0, 200),
    }, PROBLEMS_MAX);
  } catch (err) {
    console.error('[create] could not log problem', err);
  }
}

export async function listProblems(n = 50) {
  const rows = await store.list(PROBLEMS_KEY, n);
  return rows.map((r) => (typeof r === 'string' ? JSON.parse(r) : r));
}

// ── deck stats, for the admin page ──────────────────────────────────────
// One row per deck the AI wrote (or started writing): how long until the
// first card showed up, how long the whole deck took, what it cost. Only the
// deck's short name is kept, no idea text or cards.
const DECKS_KEY = 'tralala:create:decks';
const DECKS_MAX = 200;

export async function logDeck({ code, name, lang, count, cards, firstCardMs, totalMs, cost, fixed, ok }) {
  try {
    await store.push(DECKS_KEY, {
      at: Date.now(),
      code: normalizeCode(code) || null,
      name: String(name ?? '').slice(0, 40),
      lang: String(lang ?? '').slice(0, 40),
      count,
      cards,
      firstCardMs: firstCardMs ?? null,
      totalMs: totalMs ?? null,
      cost: cost ?? null,
      fixed: fixed || 0,
      ok: Boolean(ok),
    }, DECKS_MAX);
  } catch (err) {
    console.error('[create] could not log deck', err);
  }
}

export async function listDecks(n = DECKS_MAX) {
  const rows = await store.list(DECKS_KEY, n);
  return rows.map((r) => (typeof r === 'string' ? JSON.parse(r) : r));
}
