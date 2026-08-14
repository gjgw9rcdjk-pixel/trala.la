'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORIES, QUESTIONS, CORE, OPT_IN, TINTS, STRINGS, SURFACE_OPTIONS } from '@/lib/content';
import { buildOrder, shuffle } from '@/lib/deck';
import { savedLang, saveLang, track, rateQuestion, fetchStats } from '@/lib/analytics';

const SURFACE = 'Warm paper'; // 'Warm paper' | 'Ash grey' | 'Category tint' | 'Ink card'

const INK = '#e8e6e1';
const SCREEN = '#0c0c0d';
const mono = (size, weight = 500, tracking = '.12em') => ({
  font: `${weight} ${size}px var(--font-mono), monospace`,
  letterSpacing: tracking,
});

export default function App() {
  const [lang, setLang] = useState('en');
  const [view, setView] = useState('intro');
  const [sel, setSel] = useState(CORE);
  // Deterministic (unshuffled) on first render so server and client markup
  // match exactly — shuffling here would differ between the two and trigger
  // a hydration mismatch. The deck view is hidden behind the intro overlay
  // at this point anyway, so shuffling once client-side right after mount
  // (below) is invisible to the player.
  const [order, setOrder] = useState(() => buildOrder(QUESTIONS, CORE, { shuffle: false }));
  const [pos, setPos] = useState(0);
  const [loop, setLoop] = useState(0);
  const [ratings, setRatings] = useState({});
  const [liveStats, setLiveStats] = useState({});
  const [shareIdx, setShareIdx] = useState(null);
  const [shareDone, setShareDone] = useState('');
  const [copyDone, setCopyDone] = useState('');
  const [sent, setSent] = useState(false);

  const frontRef = useRef(null);
  const busy = useRef(false);
  const loopNext = useRef(false);
  const startX = useRef(0);

  useEffect(() => {
    const s = savedLang();
    if (s) setLang(s);
  }, []);

  // Client-only shuffle of the deterministic initial order (see useState above).
  useEffect(() => {
    setOrder((o) => shuffle(o));
  }, []);

  useEffect(() => {
    fetchStats().then((s) => {
      if (s) setLiveStats((prev) => ({ ...prev, ...s }));
    });
  }, []);

  const chooseLang = (l) => {
    setLang(l);
    saveLang(l);
  };

  const ui = STRINGS[lang];
  const L = lang;

  const idx = order[pos] ?? 0;
  const q = QUESTIONS[idx];
  const cat = CATEGORIES.find((c) => c.id === q[0]);
  const peekPos = Math.min(pos + 1, order.length - 1);
  const pq = QUESTIONS[order[peekPos] ?? 0];
  const pcat = CATEGORIES.find((c) => c.id === pq[0]);

  const surf = SURFACE_OPTIONS[SURFACE] || SURFACE_OPTIONS['Warm paper'];
  const cardBg = surf.bg || TINTS[cat.id];
  const onDark = surf.dark;
  const cardInk = onDark ? 'oklch(0.94 0.008 85)' : '#131316';
  const cardMuted = onDark ? 'rgba(236,233,226,.5)' : 'rgba(19,19,22,.45)';
  const cardFaint = onDark ? 'rgba(236,233,226,.3)' : 'rgba(19,19,22,.32)';

  const label = (c) => `${c.icon}  ${(L === 'en' ? c.en : c.lt).toUpperCase()}`;
  const text = (row) => (L === 'en' ? row[1] : row[2]);

  const allSelected = sel.length === CORE.length && sel.every((id) => CORE.includes(id));

  const reshuffle = useCallback((next) => {
    setSel(next);
    setOrder(buildOrder(QUESTIONS, next));
    setPos(0);
    setLoop(0);
    setView('deck');
  }, []);

  const pickCategory = (id) => {
    const next = allSelected
      ? [id]
      : sel.includes(id)
      ? sel.filter((x) => x !== id)
      : sel.concat(id);
    reshuffle(next.length ? next : CORE);
  };

  const advance = (d) => {
    if (!order.length) return;
    let nextPos = pos + d;
    let looped = false;
    if (nextPos >= order.length) { nextPos = 0; looped = true; }
    if (nextPos < 0) { nextPos = order.length - 1; looped = true; }
    if (looped) loopNext.current = true;

    const el = frontRef.current;
    if (!el || !el.animate || busy.current) { setPos(nextPos); return; }
    busy.current = true;

    const out = el.animate(
      [
        { transform: 'translateX(0) rotate(0deg)', opacity: 1 },
        {
          transform: `translateX(${d > 0 ? -120 : 120}%) rotate(${d > 0 ? -8 : 8}deg)`,
          opacity: 0,
        },
      ],
      { duration: 420, easing: 'cubic-bezier(.4,.05,.3,1)', fill: 'forwards' }
    );

    out.onfinish = () => {
      setPos(nextPos);
      if (loopNext.current) {
        loopNext.current = false;
        setLoop((n) => n + 1);
        setOrder((o) => shuffle(o));
      }
      requestAnimationFrame(() => {
        out.cancel();
        el.animate(
          [
            { transform: 'translateY(15px) scale(.99)', opacity: 0.5 },
            { transform: 'none', opacity: 1 },
          ],
          { duration: 240, easing: 'ease-out' }
        );
        busy.current = false;
      });
      track('cards_viewed', { pos: nextPos });
    };
  };

  const rate = (kind) => {
    const nextKind = ratings[idx] === kind ? null : kind;
    setRatings((r) => {
      const n = { ...r };
      if (nextKind === null) delete n[idx];
      else n[idx] = nextKind;
      return n;
    });
    track('rate', { question: idx, kind });
    rateQuestion(idx, nextKind).then((res) => {
      if (res) setLiveStats((s) => ({ ...s, [idx]: res }));
    });
  };

  const rating = ratings[idx] || null;
  const favIds = useMemo(
    () => Object.keys(ratings).filter((i) => ratings[i] !== 'down').map(Number),
    [ratings]
  );

  const shareRow = shareIdx != null ? QUESTIONS[shareIdx] : null;
  const shareCat = shareRow ? CATEGORIES.find((c) => c.id === shareRow[0]) : null;

  const doShare = async () => {
    const body = `${text(shareRow)}\n\n— Tralala.cards\nhttps://tralala.cards`;
    if (navigator.share) {
      try { await navigator.share({ text: body }); } catch {}
    }
    setShareDone('done');
    track('share_open', { question: shareIdx });
  };

  const doCopy = async () => {
    try { await navigator.clipboard.writeText(`${text(shareRow)} — https://tralala.cards`); } catch {}
    setCopyDone('done');
  };

  const stats = useMemo(
    () =>
      QUESTIONS.map((row, i) => ({ row, i, percent: liveStats[i]?.percent ?? row[3] }))
        .sort((a, b) => b.percent - a.percent)
        .slice(0, 8),
    [liveStats]
  );

  const overlay = {
    position: 'fixed',
    inset: 0,
    background: SCREEN,
    zIndex: 70,
    display: 'flex',
    flexDirection: 'column',
  };

  const cardFace = (row, rowCat, counter, hint) => (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', ...mono(9, 500, '.16em'), color: cardMuted }}>
        <span style={{ whiteSpace: 'nowrap' }}>{label(rowCat)}</span>
        <span style={{ whiteSpace: 'nowrap' }}>{counter}</span>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 2px' }}>
        <div
          className="serif"
          style={{
            fontSize: 33,
            lineHeight: 1.16,
            color: cardInk,
            letterSpacing: '-.015em',
            textAlign: 'center',
            textWrap: 'pretty',
          }}
        >
          {text(row)}
        </div>
      </div>
      <div style={{ ...mono(9, 400, '.16em'), color: cardFaint, minHeight: 12 }}>{hint}</div>
    </>
  );

  return (
    <main
      style={{
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: SCREEN,
        overflow: 'hidden',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* ── header ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 0', flex: 'none' }}>
        <button onClick={() => setView('intro')} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ ...mono(15, 400, '0'), color: 'rgba(232,230,225,.5)' }}>←</span>
          <span className="serif" style={{ fontSize: 22, lineHeight: 1, letterSpacing: '-.01em' }}>Tralala.cards</span>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {[
            [ui.fav, () => setView('favs')],
            [ui.stats, () => setView('stats')],
            [ui.say, () => { setView('feedback'); setSent(false); }],
            [L === 'en' ? 'EN' : 'LT', () => chooseLang(L === 'en' ? 'lt' : 'en')],
          ].map(([t, fn]) => (
            <button key={t} onClick={fn} style={{ ...mono(10), color: 'rgba(232,230,225,.5)', padding: '10px 7px' }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ── categories ─────────────────────────────────────── */}
      <div style={{ flex: 'none', display: 'flex', flexWrap: 'wrap', gap: 6, padding: '14px 18px 2px' }}>
        <button
          onClick={() => reshuffle(CORE)}
          style={{
            padding: '7px 11px',
            borderRadius: 100,
            ...mono(9, 500, '.09em'),
            border: `1px solid ${allSelected ? INK : 'rgba(232,230,225,.18)'}`,
            background: allSelected ? INK : 'transparent',
            color: allSelected ? SCREEN : 'rgba(232,230,225,.55)',
          }}
        >
          {ui.all}
        </button>
        {CATEGORIES.map((c) => {
          const on = allSelected ? CORE.includes(c.id) : sel.includes(c.id);
          const excludedFromAll = allSelected && OPT_IN.includes(c.id);
          return (
            <button
              key={c.id}
              onClick={() => pickCategory(c.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '7px 11px',
                borderRadius: 100,
                whiteSpace: 'nowrap',
                ...mono(9, 500, '.09em'),
                border: `1px solid ${on ? INK : 'rgba(232,230,225,.18)'}`,
                background: on ? INK : 'transparent',
                color: on ? SCREEN : 'rgba(232,230,225,.55)',
                opacity: excludedFromAll ? 0.45 : 1,
              }}
            >
              <span>{label(c)}</span>
              {c.note && <span style={{ fontSize: 8, letterSpacing: '.06em', opacity: 0.62 }}>{c.note}</span>}
              {excludedFromAll && !c.note && <span style={{ fontSize: 8, letterSpacing: '.06em', opacity: 0.62 }}>{ui.optIn}</span>}
            </button>
          );
        })}
      </div>

      {/* ── reshuffle notice ───────────────────────────────── */}
      <div style={{ flex: 'none', height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px 22px 0' }}>
        {loop > 0 && pos < 3 && (
          <div style={{ ...mono(9, 500, '.16em'), color: 'rgba(232,230,225,.34)' }}>{ui.loop}</div>
        )}
      </div>

      {/* ── deck ───────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px 22px 0', minHeight: 0 }}>
        <div style={{ position: 'relative', width: '100%', height: '100%', maxHeight: 322 }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: cardBg,
              borderRadius: 6,
              padding: '30px 28px',
              display: 'flex',
              flexDirection: 'column',
              transform: 'translateY(15px) scale(.99)',
              boxShadow: '0 12px 30px rgba(0,0,0,.4)',
              filter: 'brightness(.9)',
            }}
          >
            {cardFace(pq, pcat, `${peekPos + 1} / ${order.length}`, '')}
          </div>
          <div
            ref={frontRef}
            onPointerDown={(e) => { e.preventDefault(); startX.current = e.clientX; }}
            onPointerUp={(e) => {
              const dx = e.clientX - startX.current;
              advance(Math.abs(dx) > 45 ? (dx < 0 ? 1 : -1) : 1);
            }}
            style={{
              position: 'absolute',
              inset: 0,
              background: cardBg,
              borderRadius: 6,
              padding: '30px 28px',
              display: 'flex',
              flexDirection: 'column',
              cursor: 'pointer',
              boxShadow: '0 24px 60px rgba(0,0,0,.5)',
              willChange: 'transform,opacity',
              touchAction: 'none',
            }}
          >
            {cardFace(q, cat, `${pos + 1} / ${order.length}`, ui.tapHint)}
          </div>
        </div>
      </div>

      {/* ── controls ───────────────────────────────────────── */}
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px 30px' }}>
        <button onClick={() => advance(-1)} style={navBtn}>←</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => rate('down')} style={rateBtn(rating === 'down')}>✕</button>
          <button onClick={() => rate('like')} style={rateBtn(rating === 'like')}>♥</button>
        </div>
        <button onClick={() => advance(1)} style={navBtn}>→</button>
      </div>

      {/* ── home ───────────────────────────────────────────── */}
      {view === 'intro' && (
        <div style={{ ...overlay, zIndex: 80, padding: '30px 30px 34px' }}>
          <div style={{ height: '46%', flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'relative', width: 194, height: 262, flex: 'none' }}>
              <div style={{ position: 'absolute', inset: 0, background: '#3a3835', borderRadius: 6, transform: 'rotate(-9deg) translateY(6px)' }} />
              <div style={{ position: 'absolute', inset: 0, background: '#8a8681', borderRadius: 6, transform: 'rotate(-4.5deg) translateY(3px)' }} />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: cardBg,
                  borderRadius: 6,
                  boxShadow: '0 26px 60px rgba(0,0,0,.55)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 14,
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span className="serif" style={{ fontSize: 58, lineHeight: 1, color: cardInk, letterSpacing: '-.02em' }}>Tra<span style={{ fontStyle: 'italic' }}>lala</span></span>
                  <span className="serif" style={{ fontSize: 32, lineHeight: 1, color: cardInk, letterSpacing: '-.02em' }}>cards</span>
                </div>
                <div style={{ ...mono(8, 500, '.18em'), color: cardFaint }}>{ui.deckMeta}</div>
              </div>
            </div>
            <div style={{ marginTop: 22, textAlign: 'center', ...mono(9, 500, '.16em'), color: 'rgba(232,230,225,.45)' }}>{ui.tagline}</div>
          </div>

          <div style={{ marginTop: 20, height: 1, background: 'rgba(232,230,225,.14)', flex: 'none' }} />

          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 13, flex: 1 }}>
            {[ui.introLine, ui.introHow].map((t) => (
              <p key={t} style={{ margin: 0, font: '400 12px/1.7 var(--font-mono), monospace', color: 'rgba(232,230,225,.62)' }}>{t}</p>
            ))}
            <p style={{ margin: 0, font: '400 12px/1.7 var(--font-mono), monospace', color: 'rgba(232,230,225,.4)' }}>{ui.introTop}</p>
          </div>

          <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 20 }}>
            <span style={{ ...mono(9, 500, '.14em'), color: 'rgba(232,230,225,.35)' }}>{ui.langLabelHome}</span>
            <div style={{ flex: 1, display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              {[['en', 'ENGLISH'], ['lt', 'LIETUVIŲ']].map(([code, name]) => (
                <button
                  key={code}
                  onClick={() => chooseLang(code)}
                  style={{
                    padding: '9px 18px',
                    borderRadius: 100,
                    ...mono(10, 500, '.14em'),
                    border: `1px solid ${L === code ? INK : 'rgba(232,230,225,.2)'}`,
                    background: L === code ? INK : 'transparent',
                    color: L === code ? SCREEN : 'rgba(232,230,225,.55)',
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => { setView('deck'); track('session_start'); }}
            style={{ flex: 'none', background: INK, color: SCREEN, textAlign: 'center', padding: 19, borderRadius: 100, ...mono(11, 600, '.2em') }}
          >
            {ui.start}
          </button>
          <div style={{ marginTop: 16, flex: 'none', textAlign: 'center', ...mono(10, 400, '.1em'), color: 'rgba(232,230,225,.28)' }}>{ui.introFoot}</div>
        </div>
      )}

      {/* ── favourites ─────────────────────────────────────── */}
      {view === 'favs' && (
        <div style={overlay}>
          <OverlayHead title={`${ui.favTitle}${favIds.length ? `  ${favIds.length}` : ''}`} onClose={() => setView('deck')} />
          <div style={{ flex: 1, overflow: 'auto', padding: '0 22px 60px' }}>
            {favIds.length === 0 && (
              <p style={{ font: '400 12px/1.7 var(--font-mono), monospace', color: 'rgba(232,230,225,.35)', paddingTop: 10 }}>
                {ui.favEmpty}
                <br />
                <br />
                {ui.favShareHint}
              </p>
            )}
            {favIds.map((i) => {
              const c = CATEGORIES.find((x) => x.id === QUESTIONS[i][0]);
              return (
                <div key={i} style={{ padding: '22px 0', borderTop: '1px solid rgba(232,230,225,.12)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
                    <span style={{ ...mono(9, 500, '.16em'), color: 'rgba(232,230,225,.35)' }}>{label(c)}  ♥</span>
                    <button
                      onClick={() => { setShareIdx(i); setShareDone(''); setCopyDone(''); setView('share'); }}
                      style={{ width: 34, height: 34, borderRadius: 100, ...mono(15, 400, '0'), color: 'rgba(232,230,225,.45)' }}
                    >
                      ↗
                    </button>
                  </div>
                  <div className="serif" style={{ marginTop: 10, fontSize: 22, lineHeight: 1.24 }}>{text(QUESTIONS[i])}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── most loved ─────────────────────────────────────── */}
      {view === 'stats' && (
        <div style={overlay}>
          <OverlayHead title={ui.statsTitle} onClose={() => setView('deck')} />
          <div style={{ flex: 1, overflow: 'auto', padding: '0 22px 60px' }}>
            <p style={{ font: '400 11px/1.6 var(--font-mono), monospace', color: 'rgba(232,230,225,.4)', paddingBottom: 22, margin: 0 }}>{ui.statsNote}</p>
            {stats.map(({ row, i, percent }) => (
              <div key={i} style={{ padding: '18px 0', borderTop: '1px solid rgba(232,230,225,.12)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16 }}>
                  <div className="serif" style={{ fontSize: 19, lineHeight: 1.26 }}>{text(row)}</div>
                  <div style={{ ...mono(11, 500, '0'), flex: 'none' }}>{percent}%</div>
                </div>
                <div style={{ marginTop: 12, height: 2, background: 'rgba(232,230,225,.12)' }}>
                  <div style={{ height: 2, background: INK, width: `${percent}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── share ──────────────────────────────────────────── */}
      {view === 'share' && shareRow && (
        <div style={{ ...overlay, zIndex: 75 }}>
          <OverlayHead title={ui.shareTitle} onClose={() => setView('favs')} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 26px' }}>
            <div style={{ width: '100%', aspectRatio: '4 / 5', background: cardBg, borderRadius: 6, padding: '26px 24px', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,.5)' }}>
              <div style={{ ...mono(9, 500, '.16em'), color: cardMuted }}>{label(shareCat)}</div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px 0' }}>
                <div className="serif" style={{ fontSize: 30, lineHeight: 1.14, color: cardInk, letterSpacing: '-.015em', textAlign: 'center', textWrap: 'pretty' }}>
                  {text(shareRow)}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="serif" style={{ fontSize: 19, lineHeight: 1, color: cardInk }}>Tralala</div>
                <div style={{ ...mono(8, 500, '.14em'), color: cardFaint }}>TRALALA.CARDS</div>
              </div>
            </div>
            <p style={{ marginTop: 16, textAlign: 'center', font: '400 10px/1.7 var(--font-mono), monospace', letterSpacing: '.06em', color: 'rgba(232,230,225,.32)' }}>{ui.shareNote}</p>
          </div>
          <div style={{ flex: 'none', display: 'flex', gap: 10, padding: '0 22px 46px' }}>
            <button onClick={doShare} style={{ flex: 1, background: INK, color: SCREEN, padding: 17, borderRadius: 100, ...mono(10, 600, '.16em') }}>
              {shareDone ? ui.shared : ui.share}
            </button>
            <button onClick={doCopy} style={{ flex: 'none', padding: '17px 22px', border: '1px solid rgba(232,230,225,.22)', borderRadius: 100, ...mono(10, 600, '.16em') }}>
              {copyDone ? ui.copied : ui.copy}
            </button>
          </div>
        </div>
      )}

      {/* ── feedback ───────────────────────────────────────── */}
      {view === 'feedback' && (
        <div style={overlay}>
          <OverlayHead title={ui.sayTitle} onClose={() => setView('deck')} />
          <div style={{ flex: 1, padding: '0 22px 46px', display: 'flex', flexDirection: 'column' }}>
            {sent ? (
              <div className="serif" style={{ fontSize: 30, lineHeight: 1.2, paddingTop: 8 }}>{ui.thanks}</div>
            ) : (
              <>
                <p style={{ font: '400 12px/1.7 var(--font-mono), monospace', color: 'rgba(232,230,225,.45)', margin: 0 }}>{ui.sayNote}</p>
                <textarea
                  placeholder="…"
                  style={{
                    marginTop: 18,
                    flex: 1,
                    background: 'transparent',
                    border: '1px solid rgba(232,230,225,.16)',
                    borderRadius: 4,
                    padding: 16,
                    color: INK,
                    font: '400 14px/1.6 var(--font-mono), monospace',
                    resize: 'none',
                  }}
                />
                <button onClick={() => setSent(true)} style={{ marginTop: 18, background: INK, color: SCREEN, padding: 18, borderRadius: 4, ...mono(11, 600, '.18em') }}>
                  {ui.send}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function OverlayHead({ title, onClose }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 22px 16px' }}>
      <div style={{ font: '500 10px var(--font-mono), monospace', letterSpacing: '.16em', color: 'rgba(232,230,225,.5)' }}>{title}</div>
      <button onClick={onClose} style={{ font: '400 18px var(--font-mono), monospace', padding: '0 4px' }}>✕</button>
    </div>
  );
}

const navBtn = {
  width: 52,
  height: 52,
  flex: 'none',
  borderRadius: 100,
  border: '1px solid rgba(232,230,225,.16)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  font: '400 26px var(--font-mono), monospace',
  color: 'rgba(232,230,225,.5)',
};

const rateBtn = (active) => ({
  width: 56,
  height: 56,
  flex: 'none',
  borderRadius: 100,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 26,
  lineHeight: 1,
  transition: 'transform .18s, color .18s, background .18s',
  color: active ? '#0c0c0d' : 'rgba(232,230,225,.4)',
  background: active ? '#e8e6e1' : 'rgba(232,230,225,.07)',
  transform: active ? 'scale(1.08)' : 'scale(1)',
});
