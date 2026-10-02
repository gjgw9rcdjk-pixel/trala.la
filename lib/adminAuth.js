// Owner login for every private page (/admin, /insights, /moderate,
// /create/admin, the owner mode of /create) and the APIs behind them.
//
// /admin?key=ADMIN_KEY shows a code form; the right ADMIN_CODE sets a signed,
// httpOnly session cookie for 12 hours. Wrong key or code counts as a failed
// attempt: 3 per IP per 24 hours, then that IP is locked out until the window
// ends. Anything private answers a plain 404 to visitors without the cookie,
// so it looks like the page doesn't exist.
//
// The cookie is signed with ADMIN_KEY + ADMIN_CODE, so changing either one
// logs every browser out.

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { kv } from '@vercel/kv';

const PROD = process.env.NODE_ENV === 'production';
// __Host- makes the browser refuse the cookie unless it is Secure, set by
// this exact host and scoped to "/". Plain http on localhost can't use it.
const COOKIE = PROD ? '__Host-tl_admin' : 'tl_admin';
const SESSION_SECONDS = 12 * 60 * 60;
const MAX_FAILS = 3;
const FAIL_WINDOW_SECONDS = 24 * 60 * 60;

function secrets() {
  const key = process.env.ADMIN_KEY;
  const code = process.env.ADMIN_CODE;
  return key && code ? { key, code } : null;
}

// Hash both sides first so the comparison takes the same time whatever the
// lengths are.
function same(a, b) {
  const h = (v) => createHash('sha256').update(String(v ?? '')).digest();
  return timingSafeEqual(h(a), h(b));
}

function sign(exp, s) {
  return createHmac('sha256', `${s.key}\n${s.code}`).update(String(exp)).digest('base64url');
}

export function isAdminKey(key) {
  const s = secrets();
  return Boolean(s) && same(key, s.key);
}

export async function isAdmin() {
  const s = secrets();
  if (!s) return false;
  const value = (await cookies()).get(COOKIE)?.value || '';
  const [exp, sig] = value.split('.');
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
  return same(sig, sign(exp, s));
}

// For API routes: null when the caller is logged in, otherwise a 404 to send
// back as is.
export async function adminOnly() {
  return (await isAdmin()) ? null : Response.json({ error: 'not_found' }, { status: 404 });
}

// Failed attempts per IP. KV in production; in memory locally (no KV env
// vars), which resets when the dev server restarts.
const memFails = new Map();
async function failsFor(ip) {
  if (process.env.KV_REST_API_URL) return Number(await kv.get(`tralala:admin:fail:${ip}`)) || 0;
  const f = memFails.get(ip);
  return f && f.until > Date.now() ? f.n : 0;
}
async function addFail(ip) {
  if (process.env.KV_REST_API_URL) {
    const k = `tralala:admin:fail:${ip}`;
    const n = await kv.incr(k);
    if (n === 1) await kv.expire(k, FAIL_WINDOW_SECONDS);
    return;
  }
  const f = memFails.get(ip);
  if (f && f.until > Date.now()) f.n += 1;
  else memFails.set(ip, { n: 1, until: Date.now() + FAIL_WINDOW_SECONDS * 1000 });
}

// Returns 'ok', 'wrong' (with attempts left), 'locked' or 'not_found'
// (wrong key or admin not configured).
export async function logIn({ key, code, ip }) {
  const s = secrets();
  if (!s) return { result: 'not_found' };
  if ((await failsFor(ip)) >= MAX_FAILS) return { result: 'locked' };
  if (!same(key, s.key)) {
    await addFail(ip);
    return { result: 'not_found' };
  }
  if (!same(code, s.code)) {
    await addFail(ip);
    const left = MAX_FAILS - (await failsFor(ip));
    return left > 0 ? { result: 'wrong', left } : { result: 'locked' };
  }
  const exp = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  (await cookies()).set(COOKIE, `${exp}.${sign(exp, s)}`, cookieOptions(SESSION_SECONDS));
  return { result: 'ok' };
}

// A __Host- cookie is only replaced by one with the same attributes, so
// logging out writes an empty, already-expired copy rather than delete().
export async function logOut() {
  (await cookies()).set(COOKIE, '', cookieOptions(0));
}

function cookieOptions(maxAge) {
  return { httpOnly: true, secure: PROD, sameSite: 'strict', path: '/', maxAge };
}
