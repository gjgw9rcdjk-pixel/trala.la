'use client';

// Promo codes for /create: make one, copy it or its link, watch usage.
// Talks to app/api/create/codes, which checks the owner session cookie.

import { useEffect, useState } from 'react';
import '@/app/game/game.css';
import '../create.css';

async function codesApi(body) {
  const res = await fetch('/api/create/codes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Request failed (${res.status}).`);
  return res.json();
}

const day = (ms) => new Date(ms).toLocaleDateString('lt-LT');
const when = (ms) => new Date(ms).toLocaleString('lt-LT', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

// Plain names for what app/api/create logs (logProblem).
const PROBLEM = {
  disconnected: 'Connection dropped',
  daily_limit: 'Daily limit reached',
  refused: 'AI declined',
  too_long: 'AI answer cut off',
  empty: 'AI sent nothing',
  rate_limit: 'AI busy',
  auth: 'API key problem',
  api: 'AI service error',
  server: 'Server error',
};
const secs = (ms) => (ms == null ? '—' : `${Math.round(ms / 1000)} s`);
const usd = (n) => (n == null ? '—' : `$${n.toFixed(n < 1 ? 3 : 2)}`);
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const MONTH = 30 * 24 * 60 * 60 * 1000;

// Deck stats (logDeck in app/api/create/codes.js): last 30 days, finished decks.
function DeckStats({ decks, codes }) {
  const recent = decks.filter((d) => d.at > Date.now() - MONTH);
  const done = recent.filter((d) => d.ok);
  const nums = (k) => done.map((d) => d[k]).filter((v) => typeof v === 'number');
  const total = nums('cost').reduce((a, b) => a + b, 0);
  const tiles = [
    ['Decks', `${done.length}${recent.length > done.length ? ` (+${recent.length - done.length} failed)` : ''}`],
    ['First card after', secs(avg(nums('firstCardMs')))],
    ['Whole deck', secs(avg(nums('totalMs')))],
    ['Cost per deck', `${usd(avg(nums('cost')))} · ${usd(total)} total`],
  ];
  return (
    <>
      <span className="tc-label">Decks · last 30 days (averages)</span>
      <div className="ta-stats">
        {tiles.map(([k, v]) => <div key={k} className="ta-stat"><small>{k}</small><b>{v}</b></div>)}
      </div>
      <span className="tc-label">Recent decks</span>
      {decks.length === 0 ? (
        <p className="tl-note">No decks written since stats started.</p>
      ) : (
        <ul className="ta-list">
          {decks.slice(0, 30).map((d, i) => {
            const note = codes?.find((c) => c.code === d.code)?.note;
            return (
              <li key={`${d.at}-${i}`} className="ta-row">
                <div className="ta-row__main">
                  <b className={d.ok ? 'ta-row__deck' : 'ta-row__problem'}>{d.name || '(no name)'}{d.ok ? '' : ' · stopped'}</b>
                  <span>{d.code ? `${d.code}${note ? ` · ${note}` : ''}` : 'Owner'}</span>
                  <small>
                    {when(d.at)} · {d.cards}/{d.count} cards · {d.lang} · first card {secs(d.firstCardMs)} · all {secs(d.totalMs)} · {usd(d.cost)}
                    {d.fixed ? ` · ${d.fixed} fixed` : ''}
                  </small>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

const linkFor = (code) => `${window.location.origin}/create?code=${code}`;

function status(c) {
  if (c.disabled) return 'Off';
  if (c.expiresAt < Date.now()) return 'Expired';
  if (c.used >= c.limit) return 'Used up';
  return 'Active';
}

function CopyBtn({ text, label }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch { /* clipboard blocked; the text is on screen to copy by hand */ }
  };
  return <button className="tl-btn tl-btn--secondary" onClick={copy}>{done ? 'Copied ✓' : label}</button>;
}

export default function AdminCodes() {
  const [note, setNote] = useState('');
  const [limit, setLimit] = useState(5);
  const [codes, setCodes] = useState(null);
  const [problems, setProblems] = useState([]);
  const [decks, setDecks] = useState([]);
  const [created, setCreated] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const run = async (body) => {
    setBusy(true);
    setError(null);
    try {
      const r = await codesApi(body);
      setCodes(r.codes);
      setProblems(r.problems || []);
      setDecks(r.decks || []);
      return r;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { run({ action: 'list' }); }, []);

  const create = async () => {
    const r = await run({ action: 'create', note, limit });
    if (r?.created) { setCreated(r.created); setNote(''); }
  };

  const disable = (code) => {
    if (window.confirm(`Switch off ${code}? It stops working for everyone who has it.`)) run({ action: 'disable', code });
  };

  return (
    <div className="tl-shell">
      <div className="tl-app tc-app">
        <header className="tc-top">
          <span className="tl-wordmark tl-wordmark--still tc-wordmark">
            Tralala<span className="tl-wordmark__tld">.cards</span>
          </span>
          <span className="tc-proto">CODES</span>
        </header>

        <div className="tl-scroll tc-scroll">
          <div className="tc-body">
            <div className="tc-head">
              <h1 className="tl-title">New code</h1>
              <p className="tl-sub">One deck = one generation. Everyone with the code shares the same decks. Works for 30 days.</p>
            </div>

            {error && (
              <div className="tl-error tc-err" role="alert">
                <span>!</span>
                <div><b>That didn’t work</b><small>{error}</small></div>
                <button onClick={() => setError(null)} aria-label="Dismiss">✕</button>
              </div>
            )}

            <label className="tc-label" htmlFor="ta-note">Note (only you see it)</label>
            <input id="ta-note" className="tl-field" value={note} maxLength={120} placeholder="e.g. For Jonas, birthday" onChange={(e) => setNote(e.target.value)} />

            <label className="tc-label" htmlFor="ta-limit">Decks</label>
            <input
              id="ta-limit"
              className="tl-field"
              type="number"
              inputMode="numeric"
              min={1}
              max={500}
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
            />

            <button className="tl-btn tl-btn--primary ta-create" disabled={busy || !(Number(limit) >= 1)} onClick={create}>
              Create code
            </button>

            {created && (
              <div className="ta-new" role="status">
                <span className="tc-label tc-label--ai">✦ New code{created.note ? ` · ${created.note}` : ''}</span>
                <div className="ta-new__code">{created.code}</div>
                <p className="tl-note">{created.limit} decks · works until {day(created.expiresAt)}</p>
                <p className="ta-new__link">{linkFor(created.code)}</p>
                <div className="ta-new__acts">
                  <CopyBtn text={created.code} label="Copy code" />
                  <CopyBtn text={linkFor(created.code)} label="Copy link" />
                </div>
              </div>
            )}

            <span className="tc-label">All codes</span>
            {codes === null ? (
              <p className="tl-note">Loading…</p>
            ) : codes.length === 0 ? (
              <p className="tl-note">No codes yet.</p>
            ) : (
              <ul className="ta-list">
                {codes.map((c) => {
                  const st = status(c);
                  return (
                    <li key={c.code} className="ta-row" data-status={st}>
                      <div className="ta-row__main">
                        <b>{c.code}</b>
                        <span>{c.note || '—'}</span>
                        <small>{c.used}/{c.limit} decks · until {day(c.expiresAt)} · {st}</small>
                      </div>
                      <div className="ta-row__acts">
                        <CopyBtn text={linkFor(c.code)} label="Link" />
                        {st === 'Active' && <button className="tl-btn tl-btn--secondary" onClick={() => disable(c.code)}>Off</button>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <DeckStats decks={decks} codes={codes} />

            <span className="tc-label">Recent problems</span>
            {problems.length === 0 ? (
              <p className="tl-note">Nothing has gone wrong.</p>
            ) : (
              <ul className="ta-list">
                {problems.map((p) => {
                  const note = codes?.find((c) => c.code === p.code)?.note;
                  return (
                    <li key={`${p.at}-${p.route}-${p.code}`} className="ta-row">
                      <div className="ta-row__main">
                        <b className="ta-row__problem">{PROBLEM[p.kind] || p.kind}</b>
                        <span>{p.code ? `${p.code}${note ? ` · ${note}` : ''}` : 'Owner'}</span>
                        <small>{when(p.at)} · {p.route}{p.detail ? ` · ${p.detail}` : ''}</small>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
