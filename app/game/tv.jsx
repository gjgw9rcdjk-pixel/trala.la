'use client';

// Phone side of TV mode (see lib/tvLink.js): the TV button, the code sheet,
// and a hook that keeps a TV showing whatever card is on this phone.

import { useEffect, useRef, useState } from 'react';
import { fmt } from '@/lib/gameStrings';
import { track } from '@/lib/analytics';
import { CODE_LENGTH, cleanRoomCode, joinRoom, roomPeople } from '@/lib/tvLink';
import { Sheet } from './parts';

const ROOM_KEY = 'tralala.tv.joined';

// `card` is what the TV should show right now (a 'deck', 'text' or 'idle'
// message), or null before there's anything to show. Returns
// { room, status, error, connect(code), disconnect() }.
export function useTvRemote(card) {
  const [room, setRoom] = useState(null);
  const [status, setStatus] = useState('off'); // off | connecting | on
  const [error, setError] = useState(null); // tvNoTv | tvDown | tvFail | tvBad
  const link = useRef(null);
  const latest = useRef(card);
  latest.current = card;

  const send = (data) => {
    if (!data || !link.current) return;
    link.current.channel.publish('card', data).catch(() => {});
  };

  const disconnect = () => {
    const l = link.current;
    link.current = null;
    if (l) l.channel.publish('card', { kind: 'idle' }).catch(() => {}).finally(() => l.close());
    try { sessionStorage.removeItem(ROOM_KEY); } catch { /* private mode */ }
    setRoom(null);
    setStatus('off');
  };

  const connect = async (raw, { quiet = false } = {}) => {
    const code = cleanRoomCode(raw);
    if (!code) { setError('tvBad'); return false; }
    setError(null);
    setStatus('connecting');
    link.current?.close();
    try {
      const l = await joinRoom(code, 'phone');
      if ((await roomPeople(l.channel)).tv === 0) {
        l.close();
        throw Object.assign(new Error('no tv'), { code: 'no_tv' });
      }
      link.current = l;
      // A TV that reloads or joins later gets the current card straight away.
      l.channel.presence.subscribe('enter', (m) => { if (m.data?.role === 'tv') send(latest.current); });
      try { sessionStorage.setItem(ROOM_KEY, code); } catch { /* private mode */ }
      setRoom(code);
      setStatus('on');
      send(latest.current);
      if (!quiet) track('tv_connect');
      return true;
    } catch (err) {
      setStatus('off');
      if (!quiet) setError(err.code === 'no_tv' ? 'tvNoTv' : err.code === 'tv_unavailable' ? 'tvDown' : 'tvFail');
      return false;
    }
  };

  // Rejoin after a reload; a QR/link with ?tv=CODE joins on arrival.
  useEffect(() => {
    const url = new URL(window.location.href);
    const fromLink = url.searchParams.get('tv');
    if (fromLink) {
      url.searchParams.delete('tv');
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    }
    let saved = null;
    try { saved = sessionStorage.getItem(ROOM_KEY); } catch { /* private mode */ }
    const code = fromLink || saved;
    if (code) connect(code, { quiet: !fromLink });
    return () => link.current?.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const key = card ? JSON.stringify(card) : '';
  useEffect(() => { if (status === 'on') send(card); }, [key, status]); // eslint-disable-line react-hooks/exhaustive-deps

  return { room, status, error, connect, disconnect, clearError: () => setError(null) };
}

// A TV with a tilted card on its screen: "this card, on the TV".
export function TvIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="4" width="19" height="13" rx="2.5" />
      <rect x="8" y="7.3" width="8" height="6.4" rx="1.2" transform="rotate(-6 12 10.5)" />
      <path d="M9 21h6" />
    </svg>
  );
}

export function TvButton({ tv, label, onClick }) {
  return (
    <button className="tl-icon-sm tl-tv-btn" data-on={tv.status === 'on'} onClick={onClick} aria-label={label}>
      <TvIcon />
    </button>
  );
}

export function TvSheet({ s, tv, onClose }) {
  const [code, setCode] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    if (await tv.connect(code)) onClose();
  };
  return (
    <Sheet onClose={onClose} label={s.tvTitle}>
      <h2 className="tl-sheet-title">{s.tvTitle}</h2>
      {tv.status === 'on' ? (
        <>
          <p className="tl-sub">{fmt(s.tvOn, { code: tv.room })}</p>
          <button className="tl-btn tl-btn--secondary" style={{ marginTop: 18 }} onClick={() => { tv.disconnect(); onClose(); }}>
            {s.tvOff}
          </button>
        </>
      ) : (
        <form onSubmit={submit}>
          <p className="tl-sub">{s.tvHint}</p>
          <input
            className="tl-tv-code"
            value={code}
            onChange={(e) => { tv.clearError(); setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, CODE_LENGTH)); }}
            placeholder="ABCD"
            aria-label={s.tvCode}
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
            autoFocus
          />
          {tv.error && <p className="tl-tv-error" role="alert">{s[tv.error]}</p>}
          <button className="tl-btn tl-btn--primary" style={{ marginTop: 14 }} disabled={code.length < CODE_LENGTH || tv.status === 'connecting'}>
            {tv.status === 'connecting' ? '…' : s.tvConnect}
          </button>
        </form>
      )}
    </Sheet>
  );
}
