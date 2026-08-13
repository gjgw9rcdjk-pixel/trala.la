// Anonymous, aggregate-only instrumentation (concept note §9).
// A random device id keeps rating honest without accounts. No identity is stored.

const DEVICE_KEY = 'tralala.device';
const LANG_KEY = 'tralala.lang';

export function deviceId() {
  if (typeof window === 'undefined') return null;
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = (crypto.randomUUID && crypto.randomUUID()) || String(Math.random()).slice(2);
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export function savedLang() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(LANG_KEY);
}

export function saveLang(lang) {
  if (typeof window !== 'undefined') localStorage.setItem(LANG_KEY, lang);
}

// Swap the body for a real endpoint (Vercel Analytics, Plausible, your own route).
export function track(event, props = {}) {
  if (typeof window === 'undefined') return;
  const payload = { event, ...props, device: deviceId(), ts: Date.now() };
  if (process.env.NODE_ENV !== 'production') console.debug('[track]', payload);
  // navigator.sendBeacon('/api/track', JSON.stringify(payload));
}

// The four MVP metrics: session_start, cards_viewed, rate, share_open.

// Sends one up/down (or null, to un-vote) for a question to the ratings backend
// and returns { id, up, down, percent }, or null if the request failed.
export async function rateQuestion(id, kind) {
  if (typeof window === 'undefined') return null;
  try {
    const res = await fetch('/api/rate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, kind, device: deviceId() }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Fetches aggregate { [questionId]: { up, down, percent } } for every question
// with at least one real vote. Returns null on failure.
export async function fetchStats() {
  try {
    const res = await fetch('/api/stats');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
