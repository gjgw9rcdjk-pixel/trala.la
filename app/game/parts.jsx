'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CATEGORIES, QUESTIONS, QUESTION_BY_ID } from '@/lib/content';
import { DECK_STYLE, DECK_AUDIENCE, UI_LANGUAGES, VISIBLE_DECKS, SPICE_LEVELS, SPICE_EXAMPLE, TIMER_SECONDS, countFor, deckOffset } from '@/lib/gameMeta';
import { cards, fmt } from '@/lib/gameStrings';

const catName = (c, lang) => c.names[lang];

// ── shared bits ─────────────────────────────────────────────────────────

// The brand wordmark doubles as the "home" button on every screen.
// The neon warm-up plays once per page load, not on every screen change.
// The first (hydrated) mount always animates so server and client markup
// match; later mounts check the flag set after that first one.
export function Wordmark({ onHome, label }) {
  const [still] = useState(() => typeof window !== 'undefined' && window.__tlNeonDone === true);
  useEffect(() => {
    const t = setTimeout(() => { window.__tlNeonDone = true; }, 50);
    return () => clearTimeout(t);
  }, []);
  return (
    <button className={still ? 'tl-wordmark tl-wordmark--still' : 'tl-wordmark'} onClick={onHome} aria-label={label}>
      Tralala<span className="tl-wordmark__tld">.cards</span>
    </button>
  );
}

export function LangPill({ lang, open, onClick, label }) {
  return (
    <button className="tl-pill" onClick={onClick} aria-expanded={open} aria-label={label}>
      {lang.toUpperCase()} {open ? '▴' : '▾'}
    </button>
  );
}

export function BottomNav({ current, onGo, s, showInstall }) {
  const tabs = [
    ['play', s.navPlay],
    ['saved', s.navSaved],
    ...(showInstall ? [['install', s.navInstall]] : []),
    ['say', s.navSay],
  ];
  return (
    <nav className="tl-nav">
      {tabs.map(([id, label]) => (
        <button key={id} onClick={() => onGo(id)} aria-current={current === id ? 'page' : undefined}>
          {label}
        </button>
      ))}
    </nav>
  );
}

export function Sheet({ onClose, children, label }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="tl-scrim" onClick={onClose}>
      <div className="tl-sheet" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
        <div className="tl-grabber" />
        {children}
      </div>
    </div>
  );
}

function Toggle({ on, onChange, label }) {
  return (
    <button className="tl-toggle-row" role="switch" aria-checked={on} onClick={() => onChange(!on)}>
      <span>{label}</span>
      <span className="tl-toggle" data-on={on}><span /></span>
    </button>
  );
}

// Question text with *word* marks (the Spicy deck's *flamingo* stand-in)
// shown as a pink word, without the asterisks.
export function QText({ text }) {
  return text.split(/\*([^*]+)\*/).map((part, i) => (i % 2 ? <span key={i} className="tl-flamingo">{part}</span> : part));
}

// Step the question size down for long text (DE/PL run long).
export function qSizeClass(text) {
  if (text.length > 110) return 'tl-card__q tl-card__q--s';
  if (text.length > 80) return 'tl-card__q tl-card__q--m';
  return 'tl-card__q';
}

// ── home ────────────────────────────────────────────────────────────────

// Neon flamingo sign: standing on one long leg, S-curved neck (a nod to
// the question mark), hooked beak, body with wing and tail.
export function NeonFlamingo({ className }) {
  const tube = (
    <>
      <circle cx="40" cy="18" r="5" pathLength="1" />
      <path pathLength="1" d="M35.5 19.5 Q28 19 26 25 Q25.5 29.5 28.5 30.5" />
      <path pathLength="1" d="M44.5 20 C51 25.5 51 34 45 40 C38.5 46.5 38.5 54 46 58.5" />
      <path pathLength="1" d="M44.5 60 C44.5 50 64 50 74 56 C80 59.5 83 62 89 60 C85 66.5 80.5 70 72 72 C60 76 44.5 72 44.5 60 Z" />
      <path pathLength="1" d="M52 60.5 Q62 57.5 72 64 Q63 69.5 54 66" />
      <path pathLength="1" d="M60 74 L60 118 L53 120" className="tl-flamingo__leg" />
    </>
  );
  return (
    <svg className={className} viewBox="20 8 76 116" aria-hidden="true">
      <g className="tl-flamingo__glow">{tube}</g>
      <g className="tl-flamingo__core">{tube}</g>
      <circle className="tl-flamingo__eye" cx="41.5" cy="16.8" r="1.2" />
    </svg>
  );
}

// Home: the same card stack as the app icon, headline + one-line pitch,
// then the actions, grouped low on the screen within thumb reach.
export function HomeScreen({ s, lang, onHome, onLang, onStart, resume, onResume }) {
  return (
    <div className="tl-screen">
      <div className="tl-topbar">
        <Wordmark onHome={onHome} label={s.ariaHome} />
        <LangPill lang={lang} onClick={onLang} label={s.ariaLang} />
      </div>
      <div className="tl-home">
        <button className="tl-stack" onClick={onStart} aria-label={s.start}>
          <span className="tl-stack__card tl-stack__card--blue" />
          <span className="tl-stack__card tl-stack__card--yellow" />
          <span className="tl-stack__card tl-stack__card--front"><NeonFlamingo className="tl-flamingo" /></span>
        </button>
        <h1 className="tl-home__title">{s.heroLine}</h1>
        <p className="tl-home__sub">{s.heroSub}</p>
        <div className="tl-home__actions">
          <button className="tl-btn tl-btn--primary" onClick={onStart}>{s.start}</button>
          {resume && (
            <button className="tl-btn tl-btn--secondary" onClick={onResume}>
              {fmt(s.continueAt, { i: resume.i, n: resume.n })}
            </button>
          )}
          <div className="tl-home__trust">{s.trustLine}</div>
        </div>
      </div>
    </div>
  );
}

// Milliseconds left on the per-card timer; restarts whenever resetKey changes.
function useCountdown(resetKey) {
  const total = TIMER_SECONDS * 1000;
  const [left, setLeft] = useState(total);
  useEffect(() => {
    const end = performance.now() + total;
    let raf;
    const tick = () => {
      const ms = Math.max(0, end - performance.now());
      setLeft(ms);
      if (ms > 0) raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [resetKey, total]);
  return left;
}

// Digital countdown (seconds:hundredths) shown under the card when
// "Timer per card" is on.
export function CardTimer({ s, resetKey }) {
  const ms = useCountdown(resetKey);
  const sec = Math.floor(ms / 1000);
  const hundredths = Math.floor((ms % 1000) / 10);
  const state = ms === 0 ? 'done' : sec < 10 ? 'low' : 'ok';
  return (
    <div className="tl-timer" data-state={state} role="timer" aria-label={ms === 0 ? s.timeUp : fmt(s.timerBadge, { n: Math.ceil(ms / 1000) })}>
      {String(sec).padStart(2, '0')}:{String(hundredths).padStart(2, '0')}
    </div>
  );
}

export function QuestionCard({ s, lang, row, filtered, cardRef, dragX, onPointerDown, onPointerMove, onPointerUp, onShare }) {
  const cat = CATEGORIES.find((c) => c.id === row[0]);
  const text = row[2][lang];
  const showSkipped = dragX < -60;
  // Filtered decks: the offset takes the colour of this card's deck tile.
  const off = filtered ? deckOffset(cat.id) : null;
  const tint = off ? { '--offset': `rgba(${off.rgb}, .92)`, '--glow': `rgba(${off.rgb}, .2)`, '--label': off.label } : undefined;

  // Shrink the question until the card fits its area (long text, short
  // screens, timer on). Re-runs when the text or the area's size changes.
  const qRef = useRef(null);
  useLayoutEffect(() => {
    const p = qRef.current;
    const card = p?.parentElement;
    const area = card?.parentElement;
    if (!p || !area) return undefined;
    const fit = () => {
      p.style.fontSize = '';
      const cs = getComputedStyle(area);
      const room = area.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      let size = parseFloat(getComputedStyle(p).fontSize);
      while (card.offsetHeight > room && size > 18) {
        size -= 1;
        p.style.fontSize = `${size}px`;
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(area);
    return () => ro.disconnect();
  }, [text]);

  return (
    <div
      ref={cardRef}
      className="tl-card"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={dragX ? {
        ...tint,
        transform: `translateX(${dragX}px) rotate(${-1.4 + dragX / 30}deg)`,
        transition: 'none',
        boxShadow: dragX < 0 ? (() => {
          // Offset (and its glow) fade toward 55% as the card is swiped away.
          const k = Math.max(0.55, 0.92 + dragX / 400);
          const rgb = off ? off.rgb : '255,78,125';
          return `14px 16px 0 0 rgba(${rgb},${k}), 14px 16px 18px 0 rgba(${rgb},${k * 0.24}), 0 30px 50px -24px rgba(0,0,0,.8)`;
        })() : undefined,
      } : tint}
    >
      <div className="tl-card__label">{catName(cat, lang)}</div>
      <button
        className="tl-share-mark"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onShare}
        aria-label={s.ariaShare}
      >
        ↗
      </button>
      <p ref={qRef} className={qSizeClass(text)} lang={lang}><QText text={text} /></p>
      <div className="tl-card__badges">
        {cat.note && <span className="tl-badge">{cat.note}</span>}
      </div>
      {showSkipped && <span className="tl-card__skipped">{s.skipped}</span>}
    </div>
  );
}

// ── decks picker ────────────────────────────────────────────────────────

function DeckTile({ s, lang, cat, on, count, onToggle, tileRef }) {
  // The Spicy deck shrinks with the spice level; show how much is left in play.
  const fullCount = countFor(cat.id, 'nomercy');
  const style = DECK_STYLE[cat.id];
  const raised = !style.color;
  const audience = DECK_AUDIENCE[cat.id]?.[lang] || DECK_AUDIENCE[cat.id]?.en;
  return (
    <button
      ref={tileRef}
      className={`tl-tile${raised ? ' tl-tile--raised' : ''}`}
      style={raised ? undefined : { background: style.color }}
      aria-pressed={on}
      onClick={() => onToggle(cat.id)}
    >
      {cat.note ? <span className="tl-tag">{s.adultTag}</span> : <span className="tl-tile__glyph" aria-hidden="true">{style.glyph}</span>}
      <span>
        <span className="tl-tile__name">{catName(cat, lang)}</span>
        {audience && <span className="tl-tile__for">{audience}</span>}
        <span className="tl-tile__count">{count < fullCount ? fmt(s.cardsOf, { n: count, total: fullCount }) : cards(s, count)}</span>
      </span>
      {on && <span className="tl-tile__check" aria-hidden="true">✓</span>}
    </button>
  );
}

export function DecksScreen({ s, lang, draft, spice, timerOn, fullCount, playCount, onToggle, onClear, onBack, onPlay, onSpice, onTimer }) {
  const visible = CATEGORIES.slice(0, VISIBLE_DECKS);
  const hidden = CATEGORIES.slice(VISIBLE_DECKS);
  const hiddenPicked = hidden.filter((c) => draft.includes(c.id)).length;
  // "+N more" expands the rest of the decks inline, below the grid. Opens
  // already expanded when one of the hidden decks is picked.
  const [expanded, setExpanded] = useState(hiddenPicked > 0);
  const firstHiddenRef = useRef(null);
  const expand = () => {
    setExpanded(true);
    requestAnimationFrame(() => firstHiddenRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  return (
    <div className="tl-screen">
      <div className="tl-decks-head">
        <button className="tl-icon-sm" onClick={onBack} aria-label={s.ariaBack}>‹</button>
        <h2 className="tl-title">{s.decksTitle}</h2>
        {draft.length > 0 && <button className="tl-link" style={{ marginLeft: 'auto' }} onClick={onClear}>{s.clear}</button>}
      </div>
      <div className="tl-scroll tl-decks-body">
        <div className={`tl-grid tl-grid--compact${expanded ? ' tl-grid--expanded' : ''}`}>
          <button className="tl-tile tl-tile--all" aria-pressed={draft.length === 0} onClick={onClear}>
            <span className="tl-tile__glyph" aria-hidden="true">✳</span>
            <span>
              <span className="tl-tile__name">{s.allCards}</span>
              <span className="tl-tile__count">{cards(s, fullCount)}</span>
            </span>
            {draft.length === 0 && <span className="tl-tile__check" aria-hidden="true">✓</span>}
          </button>
          {/* AI deck generator (app/(en)/create); asks for a promo code first. */}
          <a className="tl-tile tl-tile--dashed tl-tile--link" href={lang === 'lt' ? '/create?ui=lt' : '/create'}>
            <span className="tl-tile__glyph" aria-hidden="true">✦</span>
            <span className="tl-tile__name">{s.makeOwn}</span>
          </a>
          {visible.map((c) => (
            <DeckTile key={c.id} s={s} lang={lang} cat={c} on={draft.includes(c.id)} count={countFor(c.id, spice)} onToggle={onToggle} />
          ))}
          {expanded ? hidden.map((c, i) => (
            <DeckTile
              key={c.id}
              tileRef={i === 0 ? firstHiddenRef : undefined}
              s={s}
              lang={lang}
              cat={c}
              on={draft.includes(c.id)}
              count={countFor(c.id, spice)}
              onToggle={onToggle}
            />
          )) : (
            <button className="tl-tile tl-tile--dashed" onClick={expand} aria-expanded={false}>
              <span className="tl-tile__glyph" aria-hidden="true">+</span>
              <span>
                <span className="tl-tile__name">{fmt(s.moreDecks, { n: hidden.length })}</span>
                <span className="tl-tile__count">{`${hidden.slice(0, 3).map((c) => catName(c, lang)).join(' · ')} …`}</span>
              </span>
            </button>
          )}
        </div>
        {draft.includes('spicy') && (
          <div style={{ flex: 'none', padding: '0 24px 8px' }}>
            <SpicePicker s={s} lang={lang} spice={spice} onSpice={onSpice} />
          </div>
        )}
      </div>
      <div style={{ flex: 'none', padding: '0 24px 20px' }}>
        <Toggle on={timerOn} onChange={onTimer} label={`${s.timer} · ${TIMER_SECONDS}s`} />
        <button style={{ marginTop: 14 }} className="tl-btn tl-btn--primary" onClick={onPlay}>{fmt(s.playN, { n: playCount })}</button>
      </div>
    </div>
  );
}

// ── sheets ──────────────────────────────────────────────────────────────

export function LanguageSheet({ s, lang, onPick, onClose }) {
  return (
    <Sheet onClose={onClose} label={s.langTitle}>
      <h2 className="tl-sheet-title">{s.langTitle}</h2>
      <div className="tl-sub">{s.langNote}</div>
      <div className="tl-lang-list">
        {UI_LANGUAGES.map(({ code, name }) => (
          <button key={code} className="tl-lang" aria-pressed={code === lang} onClick={() => onPick(code)}>
            <span className="tl-lang__code">{code.toUpperCase()}</span>
            <span className="tl-lang__name">{name}</span>
            <span className="tl-lang__right">{code === lang ? '✓' : QUESTIONS.length}</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

// Spice level for the Spicy deck only — shown on the decks screen while
// Spicy is picked.
function SpicePicker({ s, lang, spice, onSpice }) {
  const example = QUESTION_BY_ID.get(SPICE_EXAMPLE[spice]);
  const ref = useRef(null);
  // Picking Spicy reveals this panel below the fold — bring it into view.
  useEffect(() => { ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, []);
  return (
    <div className="tl-spice" ref={ref}>
      <div className="tl-spice__title">{s.spiceTitle}</div>
      <div className="tl-sub" style={{ marginTop: 4 }}>{s.spiceNote}</div>
      <div className="tl-segmented" role="group" aria-label={s.spice}>
        {SPICE_LEVELS.map((lvl) => (
          <button key={lvl} aria-pressed={spice === lvl} onClick={() => onSpice(lvl)}>{s[lvl]}</button>
        ))}
      </div>
      {example && <div className="tl-quote">“<QText text={example[2][lang]} />”</div>}
    </div>
  );
}

// ── end of deck ─────────────────────────────────────────────────────────

export function EndScreen({ s, total, played, skipped, starred, onClose, onAgain, onDecks, onStarred }) {
  const headRef = useRef(null);
  useEffect(() => { headRef.current?.focus(); }, []);
  return (
    <div className="tl-screen">
      <div className="tl-topbar tl-topbar--deck" style={{ height: 'auto', paddingTop: 56 }}>
        <button className="tl-icon-sm" onClick={onClose} aria-label={s.ariaClose}>✕</button>
        <span className="tl-topbar__center">{total} / {total}</span>
        <span style={{ width: 38 }} />
      </div>
      <div className="tl-progress" style={{ marginTop: 12 }}><div style={{ width: '100%' }} /></div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 26px' }}>
        <div className="tl-card tl-card--yellow" style={{ padding: '30px 26px' }}>
          <div className="tl-card__label">{s.roundDone}</div>
          <p ref={headRef} tabIndex={-1} className="tl-card__q" style={{ lineHeight: 1.1, letterSpacing: '-.03em', margin: '14px 0 22px', outline: 'none' }}>
            {s.wholeDeck}
          </p>
          <div className="tl-stats">
            <div className="tl-stat"><b>{played}</b><span>{s.played}</span></div>
            <div className="tl-stat"><b>{skipped}</b><span>{s.skippedStat}</span></div>
            <div className="tl-stat tl-stat--dark"><b>{starred}</b><span>{s.starred}</span></div>
          </div>
        </div>
      </div>
      <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 10, padding: '0 26px 16px' }}>
        <button className="tl-btn tl-btn--primary" onClick={onAgain}>{s.again}</button>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="tl-btn tl-btn--secondary" onClick={onDecks}>{s.otherDecks}</button>
          <button className="tl-btn tl-btn--secondary" style={{ color: 'var(--yellow)' }} onClick={onStarred} disabled={!starred}>
            {fmt(s.seeStarred, { n: starred })}
          </button>
        </div>
      </div>
    </div>
  );
}
