'use client';

import { useEffect, useState } from 'react';
import { GAME_STRINGS } from '@/lib/gameStrings';
import { NeonFlamingo, Sheet } from './parts';

// Audience → decks it seeds on the first round (design 14a·04).
export const AUDIENCES = [
  { id: 'friends', key: 'whoFriends', glyph: '♣', color: '#FFC93C', decks: ['union', 'awkward', 'firsts'] },
  { id: 'date', key: 'whoDate', glyph: '♥', color: '#B579FF', decks: ['duo', 'night', 'dnd'] },
  { id: 'family', key: 'whoFamily', glyph: '◆', color: '#3FA9FF', decks: ['know', 'door', 'firsts'] },
  { id: 'work', key: 'whoWork', glyph: '♦', color: '#3AD07A', decks: ['reply', 'union', 'know'] },
];

export function Splash() {
  return (
    <div className="tl-splash" aria-hidden="true">
      {/* Same stack as the home screen and the app icon. */}
      <div className="tl-stack">
        <span className="tl-stack__card tl-stack__card--blue" />
        <span className="tl-stack__card tl-stack__card--yellow" />
        <span className="tl-stack__card tl-stack__card--front"><NeonFlamingo className="tl-flamingo" /></span>
      </div>
      <span className="tl-wordmark" style={{ fontSize: 40, letterSpacing: '-.03em' }}>
        Tralala<span className="tl-wordmark__tld">.cards</span>
      </span>
    </div>
  );
}

function Dots({ step, s, onSkip }) {
  return (
    <div className="tl-ob-top">
      <span className="tl-dots" aria-hidden="true">
        {[0, 1].map((i) => <span key={i} data-on={i === step} />)}
      </span>
      <button className="tl-ob-skip" onClick={onSkip}>{s.obSkip}</button>
    </div>
  );
}

export function Onboarding({ lang, onDone }) {
  const [step, setStep] = useState(0);
  const [who, setWho] = useState([]);
  const s = GAME_STRINGS[lang] || GAME_STRINGS.en;

  const finish = (start) => {
    const decks = [...new Set(AUDIENCES.filter((a) => who.includes(a.id)).flatMap((a) => a.decks))];
    onDone({ start, decks, audience: who });
  };

  return (
    <div className="tl-screen">
      <Dots step={step} s={s} onSkip={() => finish(false)} />

      {step === 0 && (
        <>
          <div className="tl-ob-example">
            <span className="tl-ob-example__back" />
            <div className="tl-card" style={{ position: 'absolute', left: 0, right: 0, top: 12, height: 224, padding: '24px 22px' }}>
              <div className="tl-card__label">{s.obExample}</div>
              <p className="tl-card__q" style={{ fontSize: 27, margin: '14px 0 0' }}>{s.obHowCard}</p>
            </div>
          </div>
          <div className="tl-ob-rows">
            <div><span className="tl-ob-key tl-ob-key--card" aria-hidden="true"><i /></span>{s.obHowTap}</div>
            <div><span className="tl-ob-key" style={{ background: 'var(--action)', color: 'var(--white)', fontSize: 10 }}>{s.next}</span>{s.obHowNext}</div>
            <div><span className="tl-ob-key" style={{ color: 'var(--yellow)' }}>★</span>{s.obHowStar}</div>
            <div><span className="tl-ob-key">✕</span>{s.obHowSkip}</div>
          </div>
          <div className="tl-ob-foot">
            <button className="tl-btn tl-btn--primary" onClick={() => setStep(1)}>{s.obGotIt}</button>
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <div className="tl-ob-head">
            <h2 className="tl-ob-title">{s.obWhoTitle}</h2>
            <div className="tl-sub" style={{ marginTop: 12 }}>{s.obWhoSub}</div>
          </div>
          <div className="tl-scroll">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '28px 24px 4px' }}>
              {AUDIENCES.map((a) => {
                const on = who.includes(a.id);
                return (
                  <button
                    key={a.id}
                    className="tl-who"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => setWho((w) => (on ? w.filter((x) => x !== a.id) : w.concat(a.id)))}
                  >
                    <span className="tl-who__glyph" style={{ background: a.color }} aria-hidden="true">{a.glyph}</span>
                    <span className="tl-who__name">{s[a.key]}</span>
                    <span className="tl-who__box" aria-hidden="true">{on ? '✓' : ''}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="tl-ob-foot">
            <button className="tl-btn tl-btn--primary" onClick={() => finish(true)}>{s.startPlaying}</button>
          </div>
        </>
      )}
    </div>
  );
}

// ── add to home screen (14d·13) ─────────────────────────────────────────

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

// Captures Chrome/Android's install event so the sheet can trigger it later.
export function useInstallPrompt() {
  const [evt, setEvt] = useState(null);
  useEffect(() => {
    const on = (e) => { e.preventDefault(); setEvt(e); };
    window.addEventListener('beforeinstallprompt', on);
    return () => window.removeEventListener('beforeinstallprompt', on);
  }, []);
  // Client-only facts, read after mount so server and client markup match.
  const [env, setEnv] = useState({ installed: false, ios: false });
  useEffect(() => { setEnv({ installed: isStandalone(), ios: isIos() }); }, []);
  // `available`: we can offer a one-tap or step-by-step install (used for the
  // automatic prompt after the first round).
  const available = !env.installed && (!!evt || env.ios);
  return { available, installed: env.installed, ios: env.ios, evt, clear: () => setEvt(null) };
}

export function InstallSheet({ s, ios, evt, onClose, onPromptUsed }) {
  const install = async () => {
    if (evt) {
      evt.prompt();
      try { await evt.userChoice; } catch {}
      onPromptUsed?.(); // the browser's prompt can only be shown once
    }
    onClose();
  };
  return (
    <Sheet onClose={onClose} label={s.installTitle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div className="tl-install-icon" aria-hidden="true">
          <span style={{ background: '#FFC93C', transform: 'rotate(-8deg)', left: 16 }} />
          <span className="tl-install-icon__front">?</span>
        </div>
        <div>
          <h2 className="tl-sheet-title" style={{ lineHeight: 1.1 }}>{s.installTitle}</h2>
          <div className="tl-sub">{s.installSub}</div>
        </div>
      </div>
      {ios ? (
        <div className="tl-install-steps">
          <div><span>1</span>{s.installStep1.split('{icon}')[0]}<b aria-hidden="true">⬆</b>{s.installStep1.split('{icon}')[1]}</div>
          <div><span>2</span>{s.installStep2}</div>
        </div>
      ) : !evt && (
        // No one-tap install in this browser: point to its own menu.
        <div className="tl-install-steps">
          <div><span>1</span>{s.installMenu1.split('{icon}')[0]}<b aria-hidden="true">⋮</b>{s.installMenu1.split('{icon}')[1]}</div>
          <div><span>2</span>{s.installMenu2}</div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
        <button className="tl-btn tl-btn--secondary" style={{ flex: 1, height: 62, fontSize: 14 }} onClick={onClose}>{s.notNow}</button>
        <button className="tl-btn tl-btn--primary" style={{ flex: 1.3, fontSize: 14 }} onClick={evt && !ios ? install : onClose}>
          {evt && !ios ? s.install : s.ok}
        </button>
      </div>
    </Sheet>
  );
}
