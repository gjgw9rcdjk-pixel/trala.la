'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CATEGORIES, QUESTION_BY_ID, CORE } from '@/lib/content';
import { DECK_STYLE, deckIds } from '@/lib/gameMeta';
import { GAME_STRINGS, fmt } from '@/lib/gameStrings';
import { spreadShuffle } from '@/lib/deck';
import { track, rateQuestion } from '@/lib/analytics';
import { PATH_BY_LANG } from '@/lib/seo';
import {
  BottomNav, DecksScreen, EndScreen, HomeScreen, LangPill, LanguageSheet,
  CardTimer, QuestionCard, Wordmark,
} from './parts';
import { SavedScreen } from './lists';
import { SayScreen } from './say';
import { ShareSheet } from './share';
import { InstallSheet, Onboarding, Splash, useInstallPrompt } from './onboarding';
import './game.css';

const SAVED_KEY = 'tralala.saved';
const SAVED_AT_KEY = 'tralala.savedAt';
const SETTINGS_KEY = 'tralala.settings';
const ONBOARDED_KEY = 'tralala.onboarded';
// Onboarding is switched off for now: START goes straight to the deck
// picker. Set to true to bring the two onboarding steps back.
const ONBOARDING_ON = false;
const INSTALL_KEY = 'tralala.installDismissed';
// Long enough for the wordmark's neon warm-up (2.2s) to finish on the splash.
const SPLASH_MS = 2200;
const UNDO_MS = 4000;
const SWIPE_COMMIT = 90;

// Random order with categories mixed, so the same kind of card doesn't come
// up back to back.
const deal = (ids) => spreadShuffle(ids, (id) => QUESTION_BY_ID.get(id)[0]);

function readJson(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export default function Game({ initialLang = 'en' }) {
  const [lang, setLang] = useState(initialLang);
  const [screen, setScreen] = useState('home'); // onboarding | home | deck | decks | end | saved | say
  const [splash, setSplash] = useState(false);
  const [sheet, setSheet] = useState(null); // lang | install | share
  const [shareOf, setShareOf] = useState(null); // { id, fromSaved }
  const [selected, setSelected] = useState([]); // empty = full deck
  const [draft, setDraft] = useState([]); // decks picker, applied on PLAY
  const [spice, setSpice] = useState('spicy');
  const [timerOn, setTimerOn] = useState(false);
  // Deterministic (unshuffled) on first render so server and client markup
  // match; shuffled once client-side right after mount.
  const [order, setOrder] = useState(() => deckIds([], 'spicy'));
  const [pos, setPos] = useState(0);
  const [loop, setLoop] = useState(0);
  const [round, setRound] = useState({ played: 0, skipped: 0, starred: 0 });
  const [lastSkip, setLastSkip] = useState(null); // { pos, id, at }
  const [roundOver, setRoundOver] = useState(false);
  const [undoLeft, setUndoLeft] = useState(0);
  const [saved, setSaved] = useState([]);
  const [savedAt, setSavedAt] = useState({}); // id → timestamp
  const [toast, setToast] = useState(null); // { id }
  const [dragX, setDragX] = useState(0);

  const cardRef = useRef(null);
  const busy = useRef(false);
  const drag = useRef(null);

  const s = GAME_STRINGS[lang] || GAME_STRINGS.en;
  const currentId = order[pos] ?? order[0];
  const row = QUESTION_BY_ID.get(currentId);
  const filtered = selected.length > 0;

  // ── restore per-device state ──────────────────────────────────────────
  useEffect(() => {
    // The URL decides the language (/ = English, /lt = Lithuanian, …).
    document.documentElement.lang = initialLang;
    setSaved(readJson(SAVED_KEY, []).filter((id) => QUESTION_BY_ID.has(id)));
    setSavedAt(readJson(SAVED_AT_KEY, {}));
    const st = readJson(SETTINGS_KEY, {});
    const sp = st.spice || 'spicy';
    if (st.spice) setSpice(sp);

    // Deep links: a shared card (?q=<questionId>) opens the full deck with
    // that card first; the landing page's vibe cards (?vibe=<categoryId>)
    // open a deck filtered to that category.
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    const vibe = params.get('vibe');
    if (q && QUESTION_BY_ID.has(q)) {
      const cat = QUESTION_BY_ID.get(q)[0];
      const sel = CORE.includes(cat) ? [] : [cat];
      setSelected(sel);
      setOrder([q, ...deal(deckIds(sel, sp).filter((id) => id !== q))]);
      setScreen('deck');
    } else if (vibe && CATEGORIES.some((c) => c.id === vibe)) {
      setSelected([vibe]);
      setOrder(deal(deckIds([vibe], sp)));
      setScreen('deck');
    } else {
      setOrder(deal(deckIds([], sp)));
      // Launched from the home-screen icon: show the splash, like a native
      // app. In the browser the page opens straight away (onboarding waits
      // for START, so visitors and search engines see the home page first).
      if (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true) {
        setSplash(true);
        setTimeout(() => setSplash(false), SPLASH_MS);
      }
    }
  }, [initialLang]);

  // Spice is remembered between visits; the timer always starts off.
  useEffect(() => { writeJson(SETTINGS_KEY, { spice }); }, [spice]);

  // Hides the landing sections below the game while playing (see globals.css).
  useEffect(() => {
    if (screen === 'home') delete document.body.dataset.playing;
    else document.body.dataset.playing = 'true';
  }, [screen]);

  // Undo countdown: the primary slot reads "UNDO SKIP 4s" for 4 seconds.
  useEffect(() => {
    if (!lastSkip) { setUndoLeft(0); return undefined; }
    const tick = () => setUndoLeft(Math.max(0, Math.ceil((lastSkip.at + UNDO_MS - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [lastSkip]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // ── deck building ─────────────────────────────────────────────────────
  const startDeck = useCallback((sel, sp = spice) => {
    setSelected(sel);
    setOrder(deal(deckIds(sel, sp)));
    setPos(0);
    setLoop(0);
    setRound({ played: 0, skipped: 0, starred: 0 });
    setLastSkip(null);
    setRoundOver(false);
    setScreen('deck');
  }, [spice]);

  const chooseLang = (l) => {
    setLang(l);
    document.documentElement.lang = l;
    // Move to that language's URL without reloading, so a shared or
    // bookmarked link opens in the same language.
    window.history.replaceState(window.history.state, '', PATH_BY_LANG[l]);
    window.dispatchEvent(new CustomEvent('tralala:lang', { detail: l }));
    setSheet(null);
  };

  // ── card flow ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (screen === 'deck' && currentId) track('cards_viewed', { question: currentId, lang, allMode: !filtered });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, currentId]);

  // Animates the card off-screen, then moves to `nextPos` (or the end screen).
  const leave = (dir, nextPos, after) => {
    const finish = () => {
      after?.();
      if (nextPos >= order.length) {
        setRoundOver(true);
        setScreen('end');
        return;
      }
      setPos(nextPos);
    };
    const el = cardRef.current;
    if (!el || !el.animate || busy.current) { setDragX(0); finish(); return; }
    busy.current = true;
    const from = dragX ? `translateX(${dragX}px) rotate(${-1.4 + dragX / 30}deg)` : 'rotate(-1.4deg)';
    const out = el.animate(
      [
        { transform: from, opacity: 1 },
        { transform: `translateX(${dir < 0 ? -130 : 130}%) rotate(${dir < 0 ? -9 : 9}deg)`, opacity: 0 },
      ],
      { duration: 320, easing: 'cubic-bezier(.4,.05,.3,1)', fill: 'forwards' }
    );
    out.onfinish = () => {
      setDragX(0);
      finish();
      requestAnimationFrame(() => {
        out.cancel();
        cardRef.current?.animate(
          [{ transform: 'translateY(18px) rotate(-1.4deg) scale(.98)', opacity: 0.4 }, { transform: 'rotate(-1.4deg)', opacity: 1 }],
          { duration: 220, easing: 'ease-out' }
        );
        busy.current = false;
      });
    };
  };

  const next = () => {
    if (busy.current) return;
    setLastSkip(null);
    leave(1, pos + 1, () => setRound((r) => ({ ...r, played: r.played + 1 })));
  };

  // Tapping the card turns it over like a real card; the next question is on
  // the back. Counts as played, same as Next.
  const flip = () => {
    if (busy.current) return;
    const el = cardRef.current;
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    // Last card goes through `next` so the round ends the usual way.
    if (pos + 1 >= order.length || !el?.animate || still) { next(); return; }
    busy.current = true;
    setLastSkip(null);
    const turn = (deg) => `perspective(900px) rotateY(${deg}deg) rotate(-1.4deg)`;
    const half = el.animate(
      [{ transform: turn(0) }, { transform: turn(-90) }],
      { duration: 170, easing: 'cubic-bezier(.5,0,.9,.6)', fill: 'forwards' }
    );
    half.onfinish = () => {
      setRound((r) => ({ ...r, played: r.played + 1 }));
      setPos(pos + 1);
      requestAnimationFrame(() => {
        half.cancel();
        const back = el.animate(
          [{ transform: turn(90) }, { transform: turn(0) }],
          { duration: 230, easing: 'cubic-bezier(.1,.4,.5,1)' }
        );
        back.onfinish = () => { busy.current = false; };
        back.oncancel = back.onfinish;
      });
    };
  };

  const skip = () => {
    if (busy.current) return;
    const id = currentId;
    const wasSaved = saved.includes(id);
    if (!wasSaved) {
      track('rate', { question: id, kind: 'down' });
      rateQuestion(id, 'down');
    }
    leave(-1, pos + 1, () => {
      setRound((r) => ({ ...r, skipped: r.skipped + 1 }));
      setLastSkip({ pos, id, at: Date.now(), voted: !wasSaved });
    });
  };

  const undoSkip = () => {
    if (!lastSkip) return;
    if (lastSkip.voted) rateQuestion(lastSkip.id, null);
    setRound((r) => ({ ...r, skipped: Math.max(0, r.skipped - 1) }));
    setPos(lastSkip.pos);
    setLastSkip(null);
    setRoundOver(false);
    if (screen === 'end') setScreen('deck');
  };

  const setStar = (id, on) => {
    setSaved((list) => {
      const nextList = on ? [id, ...list.filter((x) => x !== id)] : list.filter((x) => x !== id);
      writeJson(SAVED_KEY, nextList);
      return nextList;
    });
    setSavedAt((m) => {
      const n = { ...m };
      if (on) n[id] = Date.now();
      else delete n[id];
      writeJson(SAVED_AT_KEY, n);
      return n;
    });
    if (on) track('rate', { question: id, kind: 'like' });
    rateQuestion(id, on ? 'like' : null);
  };

  const toggleStar = () => {
    const on = !saved.includes(currentId);
    setStar(currentId, on);
    setRound((r) => ({ ...r, starred: Math.max(0, r.starred + (on ? 1 : -1)) }));
    setToast(on ? { id: currentId } : null);
  };

  const undoStar = () => {
    if (!toast) return;
    setStar(toast.id, false);
    setRound((r) => ({ ...r, starred: Math.max(0, r.starred - 1) }));
    setToast(null);
  };

  const again = () => {
    startDeck(selected);
    setLoop((n) => n + 1);
  };

  // ── swipe ─────────────────────────────────────────────────────────────
  const onPointerDown = (e) => {
    if (busy.current) return;
    drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: false };
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(e.clientY - d.y)) {
      d.moved = true;
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    if (d.moved) setDragX(dx);
  };
  const onPointerUp = (e) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) {
      // A tap (not a scroll or a cancelled touch) turns the card over.
      const still = Math.abs(e.clientX - d.x) < 8 && Math.abs(e.clientY - d.y) < 8;
      if (e.type === 'pointerup' && still) flip();
      return;
    }
    if (dragX <= -SWIPE_COMMIT) skip();
    else if (dragX >= SWIPE_COMMIT) next();
    else setDragX(0);
  };

  // Desktop keyboard: → next, ← undo the last skip.
  useEffect(() => {
    if (screen !== 'deck' || sheet) return undefined;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target.closest?.('input, textarea')) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft' && lastSkip) { e.preventDefault(); undoSkip(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const finishOnboarding = ({ start: go, decks, audience }) => {
    writeJson(ONBOARDED_KEY, { at: Date.now(), audience });
    track('onboarding_done', { lang, audience: audience.join(','), started: go });
    // Onboarding only runs after START, so both finishing and skipping
    // carry on to the deck picker.
    setSelected(decks);
    setDraft(decks);
    setScreen('decks');
  };

  // Install prompt: only after the first finished round, and only once.
  const installer = useInstallPrompt();
  useEffect(() => {
    if (screen !== 'end' || !installer.available || readJson(INSTALL_KEY, false)) return undefined;
    const t = setTimeout(() => setSheet('install'), 900);
    return () => clearTimeout(t);
  }, [screen, installer.available]);
  const closeInstall = () => {
    writeJson(INSTALL_KEY, true);
    setSheet(null);
  };

  const openShare = (id, fromSaved = false) => {
    setShareOf({ id, fromSaved });
    setSheet('share');
  };

  // ── navigation ────────────────────────────────────────────────────────
  const goHome = () => {
    setSheet(null);
    setScreen('home');
    window.scrollTo({ top: 0 });
  };
  const openDecks = () => { setDraft(selected); setScreen('decks'); };
  const goTab = (tab) => {
    if (tab === 'install') {
      track('install_open', { lang });
      setSheet('install');
      return;
    }
    setSheet(null);
    if (tab === 'play') setScreen(screen === 'end' ? 'end' : pos > 0 || round.played ? 'deck' : 'home');
    else setScreen(tab);
  };
  // START on the home screen opens the deck picker; PLAY there deals.
  // The very first START shows the two onboarding steps first.
  const start = () => {
    track('session_start', { lang });
    if (ONBOARDING_ON && !readJson(ONBOARDED_KEY, false)) setScreen('onboarding');
    else openDecks();
  };

  const fullCount = deckIds([], spice).length;
  // A started, unfinished round can be resumed from the home screen.
  const inProgress = !roundOver && (pos > 0 || round.played > 0 || round.skipped > 0);
  const tab = sheet === 'install' ? 'install' : ['saved', 'say'].includes(screen) ? screen : 'play';
  const undoActive = lastSkip && undoLeft > 0;

  return (
    <div className="tl-shell">
      <div className="tl-app">
        {screen === 'onboarding' && <Onboarding lang={lang} onDone={finishOnboarding} />}
        {splash && <Splash />}

        {screen === 'home' && (
          <HomeScreen
            s={s}
            lang={lang}
            onHome={goHome}
            onLang={() => setSheet('lang')}
            onStart={start}
            resume={inProgress ? { i: pos + 1, n: order.length } : null}
            onResume={() => setScreen('deck')}
          />
        )}

        {screen === 'deck' && row && (
          <div className="tl-screen">
            <div className="tl-topbar tl-topbar--deck">
              <Wordmark onHome={goHome} label={s.ariaHome} />
              <span className="tl-topbar__center">{fmt(s.cardOf, { i: pos + 1, n: order.length })}</span>
              <LangPill lang={lang} open={sheet === 'lang'} onClick={() => setSheet('lang')} label={s.ariaLang} />
            </div>
            <div className="tl-progress"><div style={{ width: `${((pos + 1) / order.length) * 100}%` }} /></div>
            {/* What's in play; tapping it opens the deck picker to change it. */}
            <button
              className="tl-deck-meta"
              onClick={openDecks}
              style={{ color: selected.length === 1 ? DECK_STYLE[selected[0]].color || 'var(--pink)' : 'var(--t2)' }}
            >
              {!filtered
                ? s.fullDeck
                : selected.length === 1
                  ? CATEGORIES.find((c) => c.id === selected[0]).names[lang].toUpperCase()
                  : fmt(s.catsPicked, { k: selected.length })}
            </button>
            {loop > 0 && pos < 2 && <div className="tl-deck-meta" style={{ paddingTop: 4 }}>● {s.startingOver}</div>}
            <div className="tl-card-area">
              <QuestionCard
                s={s}
                lang={lang}
                row={row}
                filtered={filtered}
                cardRef={cardRef}
                dragX={dragX}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onShare={() => openShare(currentId)}
              />
            </div>
            {timerOn && <CardTimer s={s} resetKey={currentId} />}
            <div className="tl-band">
              <button className="tl-icon-btn" style={{ fontSize: 18 }} onClick={undoSkip} disabled={!lastSkip} aria-label={s.ariaUndo}>↺</button>
              <button className="tl-icon-btn" onClick={skip} aria-label={s.ariaSkip}>✕</button>
              {undoActive ? (
                <button className="tl-btn tl-btn--primary" style={{ background: 'var(--card)', color: 'var(--ink)' }} onClick={undoSkip}>
                  {s.undoSkip} <span style={{ color: 'var(--pink-on-card)' }}>{undoLeft}s</span>
                </button>
              ) : (
                <button className="tl-btn tl-btn--primary" onClick={next}>{s.next}</button>
              )}
              <button
                className="tl-icon-btn tl-icon-btn--star"
                onClick={toggleStar}
                aria-pressed={saved.includes(currentId)}
                aria-label={saved.includes(currentId) ? s.ariaUnsave : s.ariaSave}
              >
                ★
              </button>
            </div>
            {toast && (
              <div className="tl-toast" role="status">
                <span className="tl-toast__disc" aria-hidden="true">★</span>
                <span className="tl-toast__text">{s.savedToast}</span>
                <button onClick={undoStar}>{s.undo}</button>
              </div>
            )}
          </div>
        )}

        {screen === 'decks' && (
          <DecksScreen
            s={s}
            lang={lang}
            draft={draft}
            spice={spice}
            timerOn={timerOn}
            fullCount={fullCount}
            playCount={deckIds(draft, spice).length}
            onToggle={(id) => setDraft((d) => (d.includes(id) ? d.filter((x) => x !== id) : d.concat(id)))}
            onClear={() => setDraft([])}
            onBack={() => setScreen(pos > 0 || round.played ? 'deck' : 'home')}
            onPlay={() => startDeck(draft)}
            onSpice={setSpice}
            onTimer={setTimerOn}
          />
        )}

        {screen === 'end' && (
          <EndScreen
            s={s}
            total={order.length}
            played={round.played}
            skipped={round.skipped}
            starred={round.starred}
            onClose={goHome}
            onAgain={again}
            onDecks={openDecks}
            onStarred={() => setScreen('saved')}
          />
        )}

        {['saved', 'say'].includes(screen) && (
          <div className="tl-topbar" style={{ height: 'auto', paddingTop: 22 }}>
            <Wordmark onHome={goHome} label={s.ariaHome} />
            <LangPill lang={lang} open={sheet === 'lang'} onClick={() => setSheet('lang')} label={s.ariaLang} />
          </div>
        )}
        {screen === 'saved' && (
          <SavedScreen
            s={s}
            lang={lang}
            saved={saved}
            savedAt={savedAt}
            onUnsave={(id) => setStar(id, false)}
            onShare={(id) => openShare(id, true)}
            onStart={start}
          />
        )}

        {screen === 'say' && <SayScreen s={s} lang={lang} onPlay={() => goTab('play')} />}

        {screen !== 'decks' && screen !== 'onboarding' && <BottomNav current={tab} onGo={goTab} s={s} showInstall={!installer.installed} />}

        {sheet === 'lang' && <LanguageSheet s={s} lang={lang} onPick={chooseLang} onClose={() => setSheet(null)} />}
        {sheet === 'install' && (
          <InstallSheet s={s} ios={installer.ios} evt={installer.evt} onClose={closeInstall} onPromptUsed={installer.clear} />
        )}
        {sheet === 'share' && shareOf && (
          <ShareSheet
            s={s}
            lang={lang}
            id={shareOf.id}
            fromSaved={shareOf.fromSaved}
            onClose={() => setSheet(null)}
          />
        )}
      </div>
    </div>
  );
}
