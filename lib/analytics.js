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
