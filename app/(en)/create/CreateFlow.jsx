'use client';

// AI deck generator. Four screens (Idea → Refine → Deck → Play).
// Players unlock it with a promo code (app/api/create/codes.js); one deck
// uses one generation from the code. The owner (admin, logged in) skips the
// code and gets the prototype bar: "Mock" uses ./mockData.js and a timer
// (free), "AI" calls app/api/create/* (Claude, costs money).
// Reuses the game's look (app/game/game.css, scoped to .tl-shell) plus a few
// page-only rules in ./create.css (scoped to .tc-app).

import { useEffect, useRef, useState } from 'react';
import { NeonFlamingo, QText, qSizeClass } from '@/app/game/parts';
import { ShareSheet } from '@/app/game/share';
import { TvButton, TvSheet, useTvRemote } from '@/app/game/tv';
import { GAME_STRINGS } from '@/lib/gameStrings';
import { CREATE_STRINGS, DECK_LANGS, STEPS } from './strings';
import { DECK_SIZE, MOCK_SETS, setForIdea } from './mockData';
import '@/app/game/game.css';
import './create.css';

const DECKS_KEY = 'tralala.customDecks';
const TIP_KEY = 'tralala.create.dragTipSeen';
const MODE_KEY = 'tralala.create.mode';
const CODE_KEY = 'tralala.create.code';
const THINK_MS = 1600;
const SWAP_MS = 700;
// Mock "live writing": name first, then one card at a time.
const LIVE_FIRST_MS = 1400;
const LIVE_EACH_MS = 650;

function readJson(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v ?? fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
}

let uid = 0;
const nextId = () => `c${Date.now().toString(36)}${(uid++).toString(36)}`;
const toCard = ([en, lt]) => ({ id: nextId(), en, lt });
// AI text is already in the deck language, so it fills both slots.
const aiCard = (text) => ({ id: nextId(), en: text, lt: text });
const wait = (ms) => new Promise((res) => { setTimeout(res, ms); });

// An error the server sent back; `code` (e.g. "code_used_up") picks the
// message from strings.js when there is one.
function apiError(data, fallback) {
  const err = new Error(data.message || fallback);
  err.code = data.error;
  return err;
}
const errText = (s, e) => s.codeErrors[e.code] || e.message || s.errorGeneric;

// The phone dropped the connection (screen locked, app switched, signal
// lost). Safari says "Load failed", Chrome "Failed to fetch"; both are a
// TypeError from fetch or from reading the stream.
function connectionLost() {
  const err = new Error('The connection dropped.');
  err.code = 'connection_lost';
  return err;
}

// Keeps the screen from going dark while Tralala writes, so the phone
// doesn't cut the connection. Returns a function that lets it sleep again.
async function keepAwake() {
  try {
    const lock = await navigator.wakeLock?.request('screen');
    return () => { lock?.release().catch(() => {}); };
  } catch {
    return () => {};
  }
}

// POST to one of the /api/create routes with the saved promo code (the
// owner's session cookie goes along by itself); throws with a readable message.
async function post(path, body, signal) {
  const code = readJson(CODE_KEY, '');
  let res;
  try {
    res = await fetch(`/api/create/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, code }),
      signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw connectionLost();
  }
  if (!res.ok) throw apiError(await res.json().catch(() => ({})), `Request failed (${res.status}).`);
  return res;
}

async function callApi(path, body) {
  return (await post(path, body)).json();
}

// Reads a newline-delimited JSON stream, calling onMessage for each line.
async function readLines(res, onMessage) {
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    let chunk;
    try {
      chunk = await reader.read();
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      throw connectionLost();
    }
    const { value, done } = chunk;
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) onMessage(JSON.parse(line));
    }
  }
}

export default function CreateFlow({ admin, initialUi = 'en' }) {
  const [ui, setUi] = useState(initialUi);
  const s = CREATE_STRINGS[ui];
  // Card text being shared from the Play step (the game's share sheet).
  const [shareText, setShareText] = useState(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // Prototype switches: mock data vs real AI, and which model.
  // Players always get real AI on Sonnet (the server enforces the model too).
  const [mode, setModeState] = useState(admin ? { source: 'mock', model: 'sonnet' } : { source: 'ai', model: 'sonnet' });
  const ai = mode.source === 'ai';
  const setMode = (patch) => setModeState((m) => {
    const next = { ...m, ...patch };
    writeJson(MODE_KEY, next);
    return next;
  });
  const [meta, setMeta] = useState(null); // cost/time of the last AI call

  // Promo code: { code, left, limit, expiresAt } once checked. `null` with
  // passReady = no code yet (code screen). Admin doesn't need one.
  const [pass, setPass] = useState(null);
  const [passReady, setPassReady] = useState(admin);
  const outOfDecks = !admin && pass?.left < 1;
  // Server-issued id of the deck being written, needed for ↻ on a code.
  const deckId = useRef(null);
  const [swapsLeft, setSwapsLeft] = useState(null);

  // 1 · idea
  const [idea, setIdea] = useState('');
  const [lang, setLang] = useState('en');
  const [otherLang, setOtherLang] = useState('');
  const [count, setCount] = useState(15);

  // 2 · clarify
  const [set, setSet] = useState(null);
  const [refined, setRefined] = useState('');
  const [answers, setAnswers] = useState({});
  // 18+: the clarify step offers the switch only when the idea hints at it
  // (model hint or keywords); it stays off until the organiser turns it on.
  const [adultHint, setAdultHint] = useState(false);
  const [adult, setAdult] = useState(false);
  const adultOn = adultHint && adult;

  // 3 · deck
  const [deck, setDeck] = useState(null); // { id, name, cards: [{id,en,lt}] }
  const [spares, setSpares] = useState([]);
  const [swapping, setSwapping] = useState(null);
  // AI mode: cards thrown out of this deck (↻, ✕, code-check fixes), sent
  // with every ↻ so the model doesn't bring them back.
  const rejected = useRef([]);
  const reject = (text) => { if (text) rejected.current = [...rejected.current, text].slice(-40); };
  // A saved deck being edited: reorder, rename and delete only, no new cards.
  const [editing, setEditing] = useState(false);
  const [tipSeen, setTipSeen] = useState(true);
  // Cards appearing one by one: { total } while writing, else null.
  const [writing, setWriting] = useState(null);
  const liveTimers = useRef([]);
  const liveAbort = useRef(null);
  const stopLive = () => {
    liveTimers.current.forEach(clearTimeout);
    liveTimers.current = [];
    liveAbort.current?.abort();
    liveAbort.current = null;
    setWriting(null);
  };
  useEffect(() => () => {
    liveTimers.current.forEach(clearTimeout);
    liveAbort.current?.abort();
  }, []);

  // 4 · play
  const [saved, setSaved] = useState([]);
  const [playing, setPlaying] = useState(null);
  const [cardIdx, setCardIdx] = useState(0);

  useEffect(() => {
    setTipSeen(readJson(TIP_KEY, false));
    setSaved(readJson(DECKS_KEY, []));
    if (admin) { setModeState((m) => ({ ...m, ...readJson(MODE_KEY, {}) })); return; }
    // A shared link carries ?code=...; take it out of the address bar at once.
    const url = new URL(window.location.href);
    const fromLink = url.searchParams.get('code');
    if (fromLink) {
      url.searchParams.delete('code');
      window.history.replaceState(null, '', url.pathname + url.search);
    }
    const code = fromLink || readJson(CODE_KEY, '');
    if (code) checkCode(code).finally(() => setPassReady(true));
    else setPassReady(true);
  }, [admin]);

  const [codeError, setCodeError] = useState(null);
  const checkCode = async (code) => {
    setCodeError(null);
    try {
      const res = await fetch('/api/create/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw apiError(data, `Request failed (${res.status}).`);
      writeJson(CODE_KEY, data.code);
      setPass(data);
    } catch (e) {
      // fetch itself failing (no answer at all) means a bad connection.
      setCodeError(e.code ? e : connectionLost());
      setPass(null);
    }
  };
  // Asks the server how many decks are really left (after a dropped
  // connection the page can't know whether the deck was counted).
  const refreshPass = async () => {
    try {
      const res = await fetch('/api/create/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: readJson(CODE_KEY, '') }),
      });
      if (res.ok) setPass(await res.json());
    } catch { /* still offline; keep what we have */ }
  };
  const forgetCode = () => {
    try { localStorage.removeItem(CODE_KEY); } catch { /* private mode */ }
    setPass(null);
    setCodeError(null);
  };
  // A code problem in the middle of the flow updates what the page knows.
  const onCodeProblem = (e) => {
    if (e.code === 'code_used_up') setPass((p) => p && { ...p, left: 0 });
    if (['code_bad', 'code_expired', 'code_off'].includes(e.code)) forgetCode();
  };

  const scrollRef = useRef(null);
  useEffect(() => { scrollRef.current?.scrollTo(0, 0); }, [step, busy]);

  // Runs one "thinking" step. On failure, goes back to `failStep` and shows
  // the error there, so the user can simply press the button again.
  const think = async (work, failStep) => {
    setBusy(true);
    setError(null);
    const release = ai ? await keepAwake() : () => {};
    try {
      if (!ai) await wait(THINK_MS);
      await work();
    } catch (e) {
      onCodeProblem(e);
      setError(errText(s, e));
      setStep(failStep);
    } finally {
      release();
      setBusy(false);
    }
  };

  const langName = lang === 'other'
    ? (otherLang.trim() || s.otherLang)
    : DECK_LANGS.find((l) => l.code === lang).name[ui];
  const textLang = lang === 'lt' ? 'lt' : 'en';
  // The language name the AI writes in (English names read best in prompts).
  const deckLangForAi = lang === 'other' ? otherLang.trim() || 'English' : DECK_LANGS.find((l) => l.code === lang).name.en;

  const goClarify = () => {
    setStep(1);
    think(async () => {
      if (ai) {
        const r = await callApi('clarify', { idea, deckLang: deckLangForAi, count, uiLang: ui, model: mode.model });
        setSet({
          id: 'ai',
          name: { en: '', lt: '' },
          questions: r.questions.map((q) => ({
            q: { en: q.question, lt: q.question },
            options: q.options.map((o) => ({ en: o, lt: o })),
          })),
        });
        setRefined(r.refined);
        setAdultHint(Boolean(r.adult));
        setMeta(r.meta);
      } else {
        const hit = setForIdea(idea);
        setSet(hit);
        setRefined(hit.custom ? hit.custom : hit.refined[ui]);
        setAdultHint(false);
        setMeta(null);
      }
      setAnswers({});
      setAdult(false);
    }, 0);
  };

  // Mock mode shows the deck screen at once and "writes" the cards into it,
  // to preview how streaming from the real AI would feel.
  const writeMockLive = () => {
    stopLive();
    setError(null);
    const all = set.cards.map(toCard);
    const first = all.slice(0, DECK_SIZE);
    setDeck({ id: nextId(), name: '', cards: [] });
    setSpares(all.slice(DECK_SIZE));
    setMeta(null);
    setWriting({ total: first.length });
    const later = (ms, fn) => liveTimers.current.push(setTimeout(fn, ms));
    later(LIVE_FIRST_MS / 2, () => setDeck((d) => ({ ...d, name: set.name[textLang] })));
    first.forEach((c, i) => later(LIVE_FIRST_MS + i * LIVE_EACH_MS, () => {
      setDeck((d) => ({ ...d, cards: [...d.cards, c] }));
      if (i === first.length - 1) { liveTimers.current = []; setWriting(null); }
    }));
  };

  // Real AI: the deck route streams the name and then each card as soon as
  // the model finishes it. Cards written before an error are kept.
  const writeAiLive = async () => {
    stopLive();
    setError(null);
    setMeta(null);
    const ctrl = new AbortController();
    liveAbort.current = ctrl;
    setSpares([]);
    rejected.current = [];
    deckId.current = null;
    setSwapsLeft(null);
    setWriting({ total: count });
    const release = await keepAwake();
    // Mirror of what's on screen, so the deck can be saved the moment
    // writing ends, without waiting for "Save & play".
    const local = { id: nextId(), name: '', cards: [] };
    setDeck({ ...local });
    let got = 0;
    try {
      const picked = set.questions
        .map((q, i) => answers[i] != null && { question: q.q[ui], answer: q.options[answers[i]][ui] })
        .filter(Boolean);
      const res = await post('deck', { brief: refined, answers: picked, deckLang: deckLangForAi, count, adult: adultOn, model: mode.model }, ctrl.signal);
      await readLines(res, (m) => {
        if (m.type === 'deck') {
          deckId.current = m.id;
          setPass((p) => p && { ...p, left: m.left });
        } else if (m.type === 'name') {
          local.name = m.name;
          setDeck((d) => ({ ...d, name: m.name }));
        } else if (m.type === 'card') {
          got += 1;
          const c = aiCard(m.text);
          local.cards = [...local.cards, c];
          setDeck((d) => ({ ...d, cards: [...d.cards, c] }));
        } else if (m.type === 'fix') {
          reject(m.from);
          const c = aiCard(m.text);
          local.cards = local.cards.map((x) => (x.en === m.from ? c : x));
          setDeck((d) => ({ ...d, cards: d.cards.map((x) => (x.en === m.from ? c : x)) }));
        } else if (m.type === 'done') setMeta(m.meta);
        else if (m.type === 'error') throw apiError(m, s.errorGeneric);
      });
    } catch (e) {
      if (e.name === 'AbortError') return;
      onCodeProblem(e);
      setError(errText(s, e));
      if (!got) setStep(1);
      // The server may or may not have counted the deck; ask it.
      if (!admin && deckId.current) refreshPass();
    } finally {
      release();
      // Every written deck lands in "My decks" at once, so a reload, a closed
      // tab or a second deck can't lose it. "Save & play" later just updates it.
      if (got) storeDeck(local);
      if (liveAbort.current === ctrl) {
        liveAbort.current = null;
        setWriting(null);
      }
    }
  };

  const goDeck = () => {
    setEditing(false);
    setStep(2);
    if (ai) writeAiLive();
    else writeMockLive();
  };

  const swapCardAi = async (id) => {
    if (swapping) return;
    setSwapping(id);
    setError(null);
    try {
      const old = deck.cards.find((c) => c.id === id);
      const r = await callApi('swap', {
        deckId: deckId.current, brief: refined, deckLang: deckLangForAi, adult: adultOn, model: mode.model,
        replace: old[textLang], cards: deck.cards.map((c) => c[textLang]), rejected: rejected.current,
      });
      reject(old[textLang]);
      setDeck((d) => ({ ...d, cards: d.cards.map((c) => (c.id === id ? aiCard(r.text) : c)) }));
      setMeta(r.meta);
      if (r.swapsLeft != null) setSwapsLeft(r.swapsLeft);
    } catch (e) {
      onCodeProblem(e);
      if (e.code === 'swaps_used_up') setSwapsLeft(0);
      setError(errText(s, e));
    } finally {
      setSwapping(null);
    }
  };

  const swapCard = (id) => {
    if (ai) { swapCardAi(id); return; }
    if (swapping || !spares.length) return;
    setSwapping(id);
    // Swapped-out card goes to the back of the spares, so ↻ never runs dry.
    const old = deck.cards.find((c) => c.id === id);
    const [fresh, ...rest] = spares;
    setTimeout(() => {
      setSpares([...rest, { ...old, id: nextId() }]);
      setDeck((d) => ({ ...d, cards: d.cards.map((c) => (c.id === id ? fresh : c)) }));
      setSwapping(null);
    }, SWAP_MS);
  };

  const removeCard = (id) => {
    if (ai) reject(deck.cards.find((c) => c.id === id)?.[textLang]);
    setDeck((d) => ({ ...d, cards: d.cards.filter((c) => c.id !== id) }));
  };
  const moveCard = (from, to) => setDeck((d) => {
    const cards = [...d.cards];
    const [c] = cards.splice(from, 1);
    cards.splice(to, 0, c);
    return { ...d, cards };
  });

  const dismissTip = () => { setTipSeen(true); writeJson(TIP_KEY, true); };

  // Puts a deck into "My decks" (new or updated) and returns the entry.
  // A deck already saved keeps its language, source and 18+ mark.
  const storeDeck = (d) => {
    const prev = readJson(DECKS_KEY, []).find((x) => x.id === d.id);
    const entry = {
      id: d.id,
      name: d.name.trim() || set.name[textLang] || s.deckTitle,
      // AI decks are written in the chosen language; mock decks are EN or LT.
      lang: prev?.lang ?? (set.id === 'ai' && lang !== 'other' ? lang : textLang),
      setId: prev?.setId ?? set.id,
      adult: prev?.adult ?? (set.id === 'ai' && adultOn),
      cards: d.cards.map((c) => c[textLang]),
      savedAt: Date.now(),
    };
    setSaved((list) => {
      const next = [entry, ...list.filter((x) => x.id !== entry.id)];
      writeJson(DECKS_KEY, next);
      return next;
    });
    return entry;
  };

  const saveAndPlay = () => {
    const entry = storeDeck(deck);
    setPlaying(entry);
    setCardIdx(0);
    setStep(3);
  };

  // Edit whichever deck is on screen: a deck opened from "My decks" is
  // loaded back into the editor, with its mock set's cards as ↻ spares.
  const editPlaying = () => {
    if (deck?.id !== playing.id) {
      const src = MOCK_SETS.find((m) => m.id === playing.setId) || MOCK_SETS[3];
      const inDeck = new Set(playing.cards);
      setSet(src);
      setLang(playing.lang);
      setDeck({
        id: playing.id,
        name: playing.name,
        cards: playing.cards.map((t) => ({ id: nextId(), en: t, lt: t })),
      });
      setSpares(src.cards.map(toCard).filter((c) => !inDeck.has(c[playing.lang])));
    }
    setEditing(true);
    setStep(2);
  };

  const startOver = () => {
    stopLive();
    setStep(0); setIdea(''); setSet(null); setDeck(null); setPlaying(null); setEditing(false); setError(null); setMeta(null);
  };

  // An 18+ deck opens with a card that explains the *flamingo* word.
  const playDeck = playing?.adult ? { ...playing, cards: [s.flamingoIntro, ...playing.cards] } : playing;

  // TV mode: this deck lives only on the phone, so the TV gets the text itself.
  const [tvOpen, setTvOpen] = useState(false);
  const tv = useTvRemote(step === 3 && playDeck
    ? { kind: 'text', text: playDeck.cards[cardIdx], lang: ui, label: playDeck.name, i: cardIdx + 1, n: playDeck.cards.length }
    : { kind: 'idle' });

  // Leaving while Tralala writes stops the deck, and it still counts.
  const aiWriting = ai && Boolean(writing);
  const goBack = () => {
    if (aiWriting && !window.confirm(s.stopWriting)) return;
    stopLive();
    setStep(editing && step === 2 ? 3 : step - 1);
  };
  useEffect(() => {
    if (!aiWriting) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [aiWriting]);

  const canGoTo = (i) => i < step && !busy && !writing && i !== 3 && !editing;

  // Waiting for the saved code to be checked: show nothing rather than flash
  // the code screen.
  if (!passReady) return <div className="tl-shell"><div className="tl-app tc-app" /></div>;
  if (!admin && !pass) {
    return <CodeScreen s={s} ui={ui} setUi={setUi} error={codeError && errText(s, codeError)} onSubmit={checkCode} />;
  }

  return (
    <div className="tl-shell">
      <div className="tl-app tc-app">
        <header className="tc-top">
          <span className="tl-wordmark tl-wordmark--still tc-wordmark">
            Tralala<span className="tl-wordmark__tld">.cards</span>
          </span>
          {admin && <span className="tc-proto">{s.prototype}</span>}
          <UiLang ui={ui} setUi={setUi} />
        </header>

        {!admin && (
          <div className="tc-pass">
            <span><b>{s.decksLeft(pass.left)}</b> · {s.until(new Date(pass.expiresAt).toLocaleDateString(ui === 'lt' ? 'lt-LT' : 'en-GB'))}</span>
            {!busy && !writing && <button className="tl-link" onClick={forgetCode}>{s.otherCode}</button>}
          </div>
        )}

        {admin && <div className="tc-mode" role="group" aria-label="Prototype mode">
          <div className="tc-seg">
            {['mock', 'ai'].map((m) => (
              <button key={m} aria-pressed={mode.source === m} disabled={busy} onClick={() => setMode({ source: m })}>
                {m === 'mock' ? 'Mock' : 'AI'}
              </button>
            ))}
          </div>
          {ai && (
            <div className="tc-seg">
              {['sonnet', 'opus'].map((m) => (
                <button key={m} aria-pressed={mode.model === m} disabled={busy} onClick={() => setMode({ model: m })}>
                  {m === 'sonnet' ? 'Sonnet 5.5' : 'Opus 5.5'}
                </button>
              ))}
            </div>
          )}
          <span className="tc-mode__note">{ai ? s.modeAi : s.modeMock}</span>
        </div>}

        <nav className="tc-steps" aria-label="Progress">
          {STEPS.map((id, i) => (
            <button
              key={id}
              className="tc-step"
              data-state={i < step ? 'done' : i === step ? 'current' : 'todo'}
              disabled={!canGoTo(i)}
              onClick={() => setStep(i)}
              aria-current={i === step ? 'step' : undefined}
            >
              <span className="tc-step__bar" />
              <span className="tc-step__label">{s.steps[id]}</span>
            </button>
          ))}
        </nav>

        <div className="tl-scroll tc-scroll" ref={scrollRef}>
          {error && !busy && (
            <div className="tl-error tc-err" role="alert">
              <span>!</span>
              <div><b>{s.errorTitle}</b><small>{error}</small></div>
              <button onClick={() => setError(null)} aria-label={s.dismiss}>✕</button>
            </div>
          )}
          {outOfDecks && step < 2 && <div className="tl-banner tc-note tc-out"><span />{s.usedUpNote}</div>}
          {admin && meta && !busy && (step === 1 || step === 2) && !editing && (
            <p className="tc-meta-cost">
              {meta.model} · {(meta.ms / 1000).toFixed(0)} s · ~${meta.cost.toFixed(3)}{meta.fixed ? ` · ${meta.fixed} fixed` : ''}
            </p>
          )}
          {busy ? (
            <Thinking
              lines={step === 1 ? s.thinkingLines : s.writingLines}
              wait={ai && step === 2 ? s.writingWait : null}
            />
          ) : step === 0 ? (
            <IdeaStep s={s} ui={ui} idea={idea} setIdea={setIdea} lang={lang} setLang={setLang}
              otherLang={otherLang} setOtherLang={setOtherLang} count={count} setCount={setCount} />
          ) : step === 1 && set ? (
            <ClarifyStep s={s} ui={ui} set={set} refined={refined} setRefined={setRefined}
              answers={answers} setAnswers={setAnswers} adultHint={adultHint} adult={adult} setAdult={setAdult} />
          ) : step === 2 && deck ? (
            <DeckStep s={s} deck={deck} textLang={textLang} setName={(name) => setDeck((d) => ({ ...d, name }))}
              swapping={swapping} onSwap={editing || swapsLeft === 0 ? null : swapCard} onRemove={removeCard} onMove={moveCard}
              tipSeen={tipSeen} onTip={dismissTip} writing={writing}
              notes={writing ? [] : [
                !admin && !editing && swapsLeft != null && s.swapsLeft(swapsLeft),
                !editing && set?.id !== 'ai' && count > deck.cards.length && s.sampleNote(deck.cards.length, count),
                set?.id !== 'ai' && textLang === 'en' && lang !== 'en' && s.langNote(langName),
              ].filter(Boolean)} />
          ) : step === 3 && playing ? (
            <PlayStep s={s} deck={playDeck} idx={cardIdx} onGo={(d) => setCardIdx((i) => (i + d + playDeck.cards.length) % playDeck.cards.length)}
              saved={saved} onOpen={(d) => { setPlaying(d); setCardIdx(0); }} onShare={setShareText} shareLabel={GAME_STRINGS[ui].ariaShare}
              tvButton={<TvButton tv={tv} label={GAME_STRINGS[ui].ariaTv} onClick={() => setTvOpen(true)} />} />
          ) : null}
        </div>

        {!busy && (
          <footer className="tl-pad tc-foot">
            {step > 0 && step < 3 && (
              <button className="tl-icon-btn" onClick={goBack} aria-label={s.back}>←</button>
            )}
            {step === 0 && (
              <button className="tl-btn tl-btn--primary" disabled={idea.trim().length < 8 || outOfDecks} onClick={goClarify}>{s.makeIt}</button>
            )}
            {step === 1 && (
              <button className="tl-btn tl-btn--primary" disabled={!refined.trim() || outOfDecks} onClick={goDeck}>{s.buildDeck}</button>
            )}
            {step === 2 && (
              <button className="tl-btn tl-btn--primary" disabled={!!writing || !deck?.cards.length} onClick={saveAndPlay}>
                {writing ? s.writingBtn(deck?.cards.length || 0, writing.total) : s.save}
              </button>
            )}
            {step === 3 && (
              <>
                <button className="tl-btn tl-btn--secondary" onClick={editPlaying}>{s.edit}</button>
                <button className="tl-btn tl-btn--secondary" disabled={outOfDecks} onClick={startOver}>{s.newDeck}</button>
              </>
            )}
          </footer>
        )}
        {tvOpen && <TvSheet s={GAME_STRINGS[ui]} tv={tv} onClose={() => setTvOpen(false)} />}
        {shareText && (
          <ShareSheet s={GAME_STRINGS[ui]} lang={ui} text={shareText} onClose={() => setShareText(null)} />
        )}
      </div>
    </div>
  );
}

function UiLang({ ui, setUi }) {
  return (
    <div className="tc-ui-lang" role="group" aria-label="UI language">
      {['en', 'lt'].map((l) => (
        <button key={l} aria-pressed={ui === l} onClick={() => setUi(l)}>{l.toUpperCase()}</button>
      ))}
    </div>
  );
}

// ── 0 · promo code ──────────────────────────────────────────────────────
function CodeScreen({ s, ui, setUi, error, onSubmit }) {
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const ready = code.replace(/[^a-z0-9]/gi, '').length === 8;
  const submit = async (e) => {
    e.preventDefault();
    if (!ready || checking) return;
    setChecking(true);
    await onSubmit(code);
    setChecking(false);
  };
  return (
    <div className="tl-shell">
      <form className="tl-app tc-app" onSubmit={submit}>
        <header className="tc-top">
          <a href="/" className="tl-wordmark tl-wordmark--still tc-wordmark">
            Tralala<span className="tl-wordmark__tld">.cards</span>
          </a>
          <UiLang ui={ui} setUi={setUi} />
        </header>
        <div className="tl-scroll tc-scroll">
          {error && !checking && (
            <div className="tl-error tc-err" role="alert">
              <span>!</span>
              <div><b>{s.errorTitle}</b><small>{error}</small></div>
            </div>
          )}
          <div className="tc-body">
            <Head title={s.codeTitle} hint={s.codeHint} />
            <label className="tc-label" htmlFor="tc-code">{s.codeLabel}</label>
            <input
              id="tc-code"
              className="tl-field tc-code-input"
              value={code}
              maxLength={12}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="XXXX-XXXX"
              onChange={(e) => setCode(e.target.value)}
              autoFocus
            />
            <p className="tl-note tc-code-note">{s.codeNote}</p>
          </div>
        </div>
        <footer className="tl-pad tc-foot">
          <button type="submit" className="tl-btn tl-btn--primary" disabled={!ready || checking}>
            {checking ? s.codeChecking : s.codeGo}
          </button>
        </footer>
      </form>
    </div>
  );
}

function Head({ title, hint }) {
  return (
    <div className="tc-head">
      <h1 className="tl-title">{title}</h1>
      <p className="tl-sub">{hint}</p>
    </div>
  );
}

// Loading: the app-icon card stack shuffles; when the dark card reaches the
// top, the neon flamingo draws itself and flickers on. The title types out
// each of `lines` in turn; only the first one is announced to screen readers.
const TYPE_MS = 45;
const HOLD_MS = 2200;
function Thinking({ lines, wait: waitNote }) {
  const [at, setAt] = useState({ i: 0, n: 0 }); // line index, letters shown
  useEffect(() => {
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let i = 0;
    let n = still ? lines[0].length : 0;
    let t;
    const tick = () => {
      if (n < lines[i].length) { n += 1; t = setTimeout(tick, TYPE_MS); }
      else {
        // The finished line stays up for HOLD_MS; with reduced motion, whole lines just swap.
        i = (i + 1) % lines.length; n = still ? lines[i].length : 0;
        t = setTimeout(tick, HOLD_MS);
        if (still) setAt({ i, n });
        return;
      }
      setAt({ i, n });
    };
    setAt({ i, n });
    t = setTimeout(tick, still ? HOLD_MS : TYPE_MS);
    return () => clearTimeout(t);
  }, [lines]);
  return (
    <div className="tc-thinking">
      <div className="tc-shuffle" aria-hidden="true">
        <div className="tc-shuffle__stack">
          <span className="tc-shuffle__card tc-shuffle__card--blue">?</span>
          <span className="tc-shuffle__card tc-shuffle__card--yellow">?</span>
          <span className="tc-shuffle__card tc-shuffle__card--ink"><NeonFlamingo className="tl-flamingo" /></span>
        </div>
      </div>
      <p className="tc-sr" role="status">{lines[0]}</p>
      {/* the untyped rest stays in place, invisible, so lines never jump */}
      <h2 className="tl-sheet-title tc-line" aria-hidden="true">
        <span>
          {lines[at.i].slice(0, at.n)}
          <span className="tc-caret" />
          <span className="tc-line__rest">{lines[at.i].slice(at.n)}</span>
        </span>
      </h2>
      {waitNote && <p className="tl-note tc-wait">{waitNote}</p>}
    </div>
  );
}

// ── 1 · idea ────────────────────────────────────────────────────────────
function IdeaStep({ s, ui, idea, setIdea, lang, setLang, otherLang, setOtherLang, count, setCount }) {
  return (
    <div className="tc-body">
      <Head title={s.ideaTitle} hint={s.ideaHint} />
      <div className="tl-textarea-wrap">
        <textarea
          className="tl-field"
          value={idea}
          maxLength={400}
          onChange={(e) => setIdea(e.target.value)}
          placeholder={s.ideaPlaceholder}
          aria-label={s.ideaTitle}
        />
        <span className="tl-counter">{idea.length}/400</span>
      </div>

      <div className="tc-label">{s.examples}</div>
      <div className="tc-chips">
        {MOCK_SETS.map((m) => (
          <button key={m.id} className="tl-chip tc-chip" aria-pressed={idea === m.prompt[ui]} onClick={() => setIdea(m.prompt[ui])}>
            {m.chip[ui]}
          </button>
        ))}
      </div>

      <label className="tl-select-row tc-lang">
        <span>{s.deckLang}</span>
        <b>{lang === 'other' ? s.otherLang : DECK_LANGS.find((l) => l.code === lang).name[ui]} ▾</b>
        <select value={lang} onChange={(e) => setLang(e.target.value)} aria-label={s.deckLang}>
          {DECK_LANGS.map((l) => <option key={l.code} value={l.code}>{l.name[ui]}</option>)}
          <option value="other">{s.otherLang}</option>
        </select>
      </label>
      {lang === 'other' && (
        <input
          className="tl-field tc-other"
          value={otherLang}
          onChange={(e) => setOtherLang(e.target.value)}
          placeholder={s.otherLangPlaceholder}
          aria-label={s.otherLangPlaceholder}
          autoFocus
        />
      )}

      <div className="tc-count">
        <label className="tc-label" htmlFor="tc-count">{s.cardCount}</label>
        <output className="tc-count__value" htmlFor="tc-count">{count}</output>
      </div>
      <input
        id="tc-count"
        className="tc-range"
        type="range"
        min={15}
        max={50}
        step={5}
        value={count}
        onChange={(e) => setCount(Number(e.target.value))}
        style={{ '--fill': `${((count - 15) / 35) * 100}%` }}
      />
      <div className="tc-range__ends"><span>15</span><span>50</span></div>
    </div>
  );
}

// ── 2 · clarify ─────────────────────────────────────────────────────────
// Refined idea grows with its text so the whole idea is visible at once.
const grow = (el) => {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight + 2}px`;
};

function ClarifyStep({ s, ui, set, refined, setRefined, answers, setAnswers, adultHint, adult, setAdult }) {
  return (
    <div className="tc-body">
      <Head title={s.clarifyTitle} hint={s.clarifyHint} />
      <div className="tc-label tc-label--ai">✦ {s.refined}</div>
      <textarea
        ref={grow}
        className="tl-field tc-refined"
        value={refined}
        onChange={(e) => { setRefined(e.target.value); grow(e.target); }}
        aria-label={s.refined}
      />
      {set.questions.map((q, qi) => (
        <fieldset key={qi} className="tc-q">
          <legend className="tc-q__title">{q.q[ui]}</legend>
          <div className="tc-q__opts">
            {q.options.map((o, oi) => (
              <button
                key={oi}
                className="tl-chip tc-chip"
                aria-pressed={answers[qi] === oi}
                onClick={() => setAnswers((a) => ({ ...a, [qi]: oi }))}
              >
                {o[ui]}
              </button>
            ))}
          </div>
        </fieldset>
      ))}
      {adultHint && (
        <fieldset className="tc-q">
          <legend className="tc-q__title">{s.adultTitle}</legend>
          <p className="tc-q__note"><QText text={s.adultNote} /></p>
          <div className="tc-q__opts">
            <button className="tl-chip tc-chip" aria-pressed={!adult} onClick={() => setAdult(false)}>{s.adultNo}</button>
            <button className="tl-chip tc-chip" aria-pressed={adult} onClick={() => setAdult(true)}>{s.adultYes}</button>
          </div>
        </fieldset>
      )}
    </div>
  );
}

// ── 3 · deck ────────────────────────────────────────────────────────────
function DeckStep({ s, deck, textLang, setName, swapping, onSwap, onRemove, onMove, tipSeen, onTip, notes, writing }) {
  const listRef = useRef(null);
  const drag = useRef(null);
  const [dragState, setDragState] = useState(null); // { id, dy }

  const rows = () => [...listRef.current.children];

  // While writing, keep the newest card (and the typing row under it) in view.
  const liveCount = writing ? deck.cards.length : -1;
  useEffect(() => {
    if (liveCount < 1) return;
    listRef.current?.children[liveCount]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [liveCount]);

  const onDown = (e, id) => {
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    drag.current = { id, startY: e.clientY };
    setDragState({ id, dy: 0 });
    if (!tipSeen) onTip();
  };

  const onMoveP = (e) => {
    const d = drag.current;
    if (!d) return;
    let dy = e.clientY - d.startY;
    const els = rows();
    const i = deck.cards.findIndex((c) => c.id === d.id);
    const me = els[i].getBoundingClientRect();
    const mid = me.top + me.height / 2 + dy - (parseFloat(els[i].style.getPropertyValue('--dy')) || 0);
    // Crossed the neighbour's midpoint → swap in the list and rebase the offset.
    const below = els[i + 1]?.getBoundingClientRect();
    const above = els[i - 1]?.getBoundingClientRect();
    if (below && mid > below.top + below.height / 2) {
      onMove(i, i + 1);
      d.startY += below.height + 8;
      dy = e.clientY - d.startY;
    } else if (above && mid < above.top + above.height / 2) {
      onMove(i, i - 1);
      d.startY -= above.height + 8;
      dy = e.clientY - d.startY;
    }
    setDragState({ id: d.id, dy });
  };

  const onUp = () => { drag.current = null; setDragState(null); };

  return (
    <div className="tc-body">
      <Head
        title={!writing ? s.deckTitle : deck.cards.length ? s.writing : s.thinking}
        hint={!writing ? (onSwap ? s.deckHint : s.deckEditHint) : deck.cards.length ? s.writingLive : s.writingPrep}
      />
      <label className="tc-label" htmlFor="tc-name">{s.deckName}</label>
      {writing && !deck.name ? (
        <div className="tl-field tc-name tc-ghost-line" aria-hidden="true"><span /></div>
      ) : (
        <input id="tc-name" className="tl-field tc-name" value={deck.name} maxLength={40} disabled={!!writing} onChange={(e) => setName(e.target.value)} />
      )}

      {notes.map((n) => <div key={n} className="tl-banner tc-note"><span />{n}</div>)}

      {!tipSeen && !writing && (
        <div className="tc-tip" role="note">
          <span className="tc-tip__icon">⋮⋮</span>
          <span>{s.dragTip}</span>
          <button onClick={onTip}>{s.gotIt}</button>
        </div>
      )}

      {writing ? (
        <div className="tc-live" role="status" aria-live="polite">
          <span className="tc-live__label">{s.writingCount(deck.cards.length, writing.total)}</span>
          <span className="tc-live__bar"><span style={{ width: `${(deck.cards.length / writing.total) * 100}%` }} /></span>
        </div>
      ) : (
        <div className="tc-meta">{s.cardsCount(deck.cards.length)}</div>
      )}
      <ol className="tc-list" ref={listRef} data-live={writing ? 'true' : undefined}>
        {deck.cards.map((c, i) => {
          const dragging = dragState?.id === c.id;
          return (
            <li
              key={c.id}
              className={writing ? 'tc-row tc-row--live' : 'tc-row'}
              data-dragging={dragging || undefined}
              data-swapping={swapping === c.id || undefined}
              style={dragging ? { transform: `translateY(${dragState.dy}px)`, '--dy': dragState.dy } : undefined}
            >
              <button
                className="tc-row__handle"
                aria-label={s.move}
                disabled={!!writing}
                onPointerDown={(e) => onDown(e, c.id)}
                onPointerMove={onMoveP}
                onPointerUp={onUp}
                onPointerCancel={onUp}
              >
                ⋮⋮
              </button>
              <span className="tc-row__n">{i + 1}</span>
              <p className="tc-row__q" lang={textLang}>{swapping === c.id ? '…' : <QText text={c[textLang]} />}</p>
              <div className="tc-row__acts" hidden={!!writing}>
                {onSwap && <button className="tc-row__swap" onClick={() => onSwap(c.id)} aria-label={s.swap} disabled={!!swapping}>↻</button>}
                <button onClick={() => onRemove(c.id)} aria-label={s.remove}>✕</button>
              </div>
            </li>
          );
        })}
        {writing && Array.from({ length: writing.total - deck.cards.length }, (_, i) => (
          <li key={`ghost-${i}`} className="tc-row tc-row--ghost" aria-hidden="true">
            <span className="tc-row__n">{deck.cards.length + i + 1}</span>
            {i === 0 ? (
              <>
                <span className="tc-typing"><span /><span /><span /></span>
                {deck.cards.length === 0 && <PrepLine lines={s.prepLines} />}
              </>
            ) : (
              <span className="tc-ghost-text" />
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

// While the model is still thinking (no cards yet), cycle through short
// lines about what it's doing, so a ~30 s wait doesn't feel stuck.
const PREP_MS = 3500;
function PrepLine({ lines }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % lines.length), PREP_MS);
    return () => clearInterval(t);
  }, [lines.length]);
  return <span key={i} className="tc-prep">{lines[i]}</span>;
}

// ── 4 · play ────────────────────────────────────────────────────────────
// Card behaves like the game's: tap turns it over to the next card, swipe
// left = next, swipe right = previous, ‹ › buttons and ←/→ keys do the same.
const SWIPE_COMMIT = 90;
const tilt = (x) => `translateX(${x}px) rotate(${-1.4 + x / 30}deg)`;

function PlayStep({ s, deck, idx, onGo, saved, onOpen, onShare, shareLabel, tvButton }) {
  const text = deck.cards[idx];
  const cardRef = useRef(null);
  const busy = useRef(false);
  const drag = useRef(null);
  const [dragX, setDragX] = useState(0);
  const [open, setOpen] = useState(false);
  const listRef = useRef(null);
  useEffect(() => {
    if (open) listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [open]);

  const still = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // Fly the card out (dir -1 = left → next, +1 = right → previous), swap the
  // text, then settle the new card in.
  const leave = (dir) => {
    const el = cardRef.current;
    const delta = dir < 0 ? 1 : -1;
    if (busy.current) return;
    if (!el?.animate || still()) { setDragX(0); onGo(delta); return; }
    busy.current = true;
    const out = el.animate(
      [
        { transform: dragX ? tilt(dragX) : 'rotate(-1.4deg)', opacity: 1 },
        { transform: `translateX(${dir * 130}%) rotate(${dir * 9}deg)`, opacity: 0 },
      ],
      { duration: 320, easing: 'cubic-bezier(.4,.05,.3,1)', fill: 'forwards' }
    );
    out.onfinish = () => {
      setDragX(0);
      onGo(delta);
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
  const next = () => leave(-1);
  const prev = () => leave(1);

  // Tap: turn the card over like a real one; the next question is on the back.
  const flip = () => {
    const el = cardRef.current;
    if (busy.current) return;
    if (!el?.animate || still()) { onGo(1); return; }
    busy.current = true;
    const turn = (deg) => `perspective(900px) rotateY(${deg}deg) rotate(-1.4deg)`;
    const half = el.animate([{ transform: turn(0) }, { transform: turn(-90) }],
      { duration: 170, easing: 'cubic-bezier(.5,0,.9,.6)', fill: 'forwards' });
    half.onfinish = () => {
      onGo(1);
      requestAnimationFrame(() => {
        half.cancel();
        const back = el.animate([{ transform: turn(90) }, { transform: turn(0) }],
          { duration: 230, easing: 'cubic-bezier(.1,.4,.5,1)' });
        back.onfinish = () => { busy.current = false; };
        back.oncancel = back.onfinish;
      });
    };
  };

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
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    }
    if (d.moved) setDragX(dx);
  };
  const onPointerUp = (e) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) {
      const tap = Math.abs(e.clientX - d.x) < 8 && Math.abs(e.clientY - d.y) < 8;
      if (e.type === 'pointerup' && tap) flip();
      return;
    }
    if (dragX <= -SWIPE_COMMIT) next();
    else if (dragX >= SWIPE_COMMIT) prev();
    else setDragX(0);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target.closest?.('input, textarea, select')) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="tc-body">
      <Head title={deck.name} hint={s.playHint} />
      <div className="tl-card-area tc-card-area">
        <div
          ref={cardRef}
          className="tl-card tc-card"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={dragX ? { transform: tilt(dragX), transition: 'none' } : undefined}
        >
          <div className="tl-card__label">{deck.name}</div>
          <button
            className="tl-share-mark"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onShare(text)}
            aria-label={shareLabel}
          >
            ↗
          </button>
          <p className={qSizeClass(text)} lang={deck.lang}><QText text={text} /></p>
        </div>
      </div>

      <div className="tc-nav">
        <button className="tl-icon-btn" onClick={prev} aria-label={s.prevCard}>←</button>
        <span className="tc-nav__mid">
          <span className="tc-nav__count">{idx + 1} / {deck.cards.length}</span>
          {tvButton}
        </span>
        <button className="tl-icon-btn" onClick={next} aria-label={s.nextCard}>→</button>
      </div>

      <button
        className="tl-row tc-decks-toggle"
        aria-expanded={open}
        aria-controls="tc-saved"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="tc-decks-toggle__label">{s.myDecks}</span>
        <span className="tc-decks-toggle__count">{saved.length}</span>
        <span className="tc-decks-toggle__chev" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="tc-saved" id="tc-saved" ref={listRef}>
          {saved.map((d) => {
            const current = d.id === deck.id;
            return (
              <button
                key={d.id}
                className="tl-row tc-saved__row"
                aria-current={current || undefined}
                disabled={current}
                onClick={() => { onOpen(d); setOpen(false); }}
              >
                <span className="tc-saved__name">{d.name}</span>
                <span className="tc-saved__count">{s.cardsCount(d.cards.length)}</span>
                <span className="tc-saved__go">{current ? s.nowPlaying : s.open}</span>
              </button>
            );
          })}
        </div>
      )}
      <p className="tl-note tc-local">{s.savedLocal}</p>
    </div>
  );
}
