// Anonymous, aggregate-only instrumentation (concept note §9).
// A random device id keeps rating honest without accounts. No identity is stored.

const DEVICE_KEY = 'tralala.device';

export function deviceId() {
  if (typeof window === 'undefined') return null;
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = (crypto.randomUUID && crypto.randomUUID()) || String(Math.random()).slice(2);
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

// Fires one anonymous event at /api/track, which folds it into aggregate
// counters in our own database (no third-party analytics service, no
// personal data — just a random per-device id already used for ratings).
export function track(event, props = {}) {
  if (typeof window === 'undefined') return;
  const payload = { event, props, device: deviceId(), ts: Date.now() };
  if (process.env.NODE_ENV !== 'production') console.debug('[track]', payload);
  try {
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    if (!navigator.sendBeacon || !navigator.sendBeacon('/api/track', blob)) {
      fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    }
  } catch {}
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

// Submits one feedback item for the current device. Returns the created
// { id, text, ts, up, down } on success, or { error, status } on failure —
// callers check `status === 429` to show the daily-limit message.
export async function submitFeedback(text, { type, deck } = {}) {
  if (typeof window === 'undefined') return { error: 'no_window', status: 0 };
  try {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, device: deviceId(), type, deck }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ...data, status: res.status };
    return data;
  } catch {
    return { error: 'network', status: 0 };
  }
}

// Fetches the public feedback board (newest first). Returns an array, or
// null on failure.
export async function fetchFeedback() {
  try {
    const res = await fetch('/api/feedback');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Sends one up/down (or null, to un-vote) for a feedback item and returns
// { id, up, down }, or null on failure.
export async function voteFeedback(id, kind) {
  if (typeof window === 'undefined') return null;
  try {
    const res = await fetch('/api/feedback/vote', {
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
