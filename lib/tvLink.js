// TV mode: a TV (or laptop on a TV) opens /tv and shows a room code; a phone
// joins that room and sends it the card on screen. Both sides talk through
// one Ably channel per room, `tv:<CODE>`. The Ably key stays on the server
// (app/api/tv/token); browsers only get a short-lived token for their room.
//
// Messages (all named 'card', so a TV that joins late gets the last one via
// rewind):
//   { kind: 'deck', id, lang, i, n, timer }  a card from the built-in decks
//   { kind: 'text', text, lang, label, i, n } a /create card (only on this phone)
//   { kind: 'idle' }                          the phone left the deck screen

// No I or O: they read like 1 and 0 across a room.
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const CODE_LENGTH = 4;

export function newRoomCode() {
  const pick = new Uint32Array(CODE_LENGTH);
  crypto.getRandomValues(pick);
  return Array.from(pick, (n) => LETTERS[n % LETTERS.length]).join('');
}

// Upper-cases, drops anything that isn't a code letter; '' if it can't be one.
export function cleanRoomCode(raw) {
  const code = String(raw || '').toUpperCase().replace(/[^A-Z]/g, '');
  return code.length === CODE_LENGTH && [...code].every((c) => LETTERS.includes(c)) ? code : '';
}

// Ably's official browser build (npm ably@2.29.0, build/ably.min.js), served
// as a static file: bundling it breaks, Next's compiler rewrites a `super`
// call inside an arrow function. To upgrade, copy the new build/ably.min.js
// into public/vendor/ under the new version's name. Loaded only when TV mode
// is used.
const ABLY_SRC = '/vendor/ably-2.29.0.min.js';
let ablyLoading = null;
function loadAbly() {
  if (window.Ably) return Promise.resolve(window.Ably);
  ablyLoading ??= new Promise((resolve, reject) => {
    const tag = document.createElement('script');
    tag.src = ABLY_SRC;
    tag.async = true;
    tag.onload = () => resolve(window.Ably);
    tag.onerror = () => { ablyLoading = null; reject(new Error('ably')); };
    document.head.appendChild(tag);
  });
  return ablyLoading;
}

// Connects to a room as 'tv' or 'phone'. Resolves to { channel, close } or
// throws an Error whose .code is 'tv_unavailable' (no key on the server) or
// 'connection_failed'.
export async function joinRoom(room, role) {
  let Ably;
  try {
    Ably = await loadAbly();
  } catch {
    throw Object.assign(new Error('tv'), { code: 'connection_failed' });
  }
  const client = new Ably.Realtime({
    authCallback: async (_params, done) => {
      try {
        const res = await fetch('/api/tv/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ room, role }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw Object.assign(new Error(data.error || 'token'), { code: data.error });
        done(null, data);
      } catch (err) {
        // A 403 tells Ably to give up instead of retrying forever.
        done({ message: err.code || 'token', code: 40300, statusCode: err.code === 'tv_unavailable' ? 403 : 500 }, null);
      }
    },
    closeOnUnload: true,
  });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), 15000);
      client.connection.once('connected', () => { clearTimeout(timer); resolve(); });
      client.connection.once('failed', (change) => { clearTimeout(timer); reject(change?.reason || new Error('failed')); });
    });
  } catch (err) {
    client.close();
    const unavailable = err?.code === 'tv_unavailable' || /tv_unavailable/.test(err?.message || '');
    throw Object.assign(new Error('tv'), { code: unavailable ? 'tv_unavailable' : 'connection_failed' });
  }
  // The TV asks for the last message on attach, so a reloaded TV shows the
  // current card at once.
  const channel = client.channels.get(`tv:${room}`, role === 'tv' ? { params: { rewind: '1' } } : undefined);
  await channel.presence.enter({ role });
  return { channel, client, close: () => client.close() };
}

// Who else is in the room, by role: { tv: n, phone: n }.
export async function roomPeople(channel) {
  const members = await channel.presence.get();
  const count = { tv: 0, phone: 0 };
  for (const m of members) if (m.data?.role in count) count[m.data.role] += 1;
  return count;
}
