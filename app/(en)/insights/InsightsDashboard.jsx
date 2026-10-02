'use client';

// Private analytics dashboard, rendered by ./page.jsx for the logged-in
// owner only (lib/adminAuth.js; reached from /admin). /api/analytics checks
// the same session cookie. See README "Admin".

import { useEffect, useMemo, useState } from 'react';
import { QUESTION_BY_ID, CATEGORIES, LANGUAGES } from '@/lib/content';

const CAT_COLOR = {
  future: '#407aea', dnd: '#407aea', deep: '#8a63de', night: '#8a63de', couples: '#b950b2', duo: '#b950b2', spicy: '#d3456c',
  awkward: '#d05500', union: '#a77900', fun: '#a77900', know: '#748d00', food: '#009c3f', door: '#009c3f',
  team: '#00a084', reply: '#00a084', firsts: '#0093cc', fries: '#a77900',
};
const LANG_COLOR = { en: '#5983e9', lt: '#d95960', es: '#af8200', pl: '#b365c4', de: '#25a351', it: '#0095db' };
const GOLD = '#e8c468';
const UNLOVED = 'rgba(232,230,225,.16)';
const INK = '#e8e6e1';

const RANGES = [
  { key: '7', label: '7D', days: 7 },
  { key: '30', label: '30D', days: 30 },
  { key: '90', label: '90D', days: 90 },
  { key: 'max', label: 'MAX', days: null },
];

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${MONTH_SHORT[m - 1]} ${d}`;
}
function fmtNum(n) {
  return (n || 0).toLocaleString('en-US');
}

const MIN_VOTES = 3; // a question needs at least this many like+down votes before it shows up in Most/Rarely loved

export default function InsightsDashboard() {
  const [range, setRange] = useState('30');
  const [activeLang, setActiveLang] = useState('all');
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [hoverIdx, setHoverIdx] = useState(null);

  useEffect(() => {
    setError('');
    Promise.all([
      fetch(`/api/analytics?range=${range}`).then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      }),
      fetch('/api/stats').then((res) => (res.ok ? res.json() : {})),
    ])
      .then(([analytics, statsData]) => {
        setData(analytics);
        setStats(statsData);
      })
      .catch(() => setError('Logged out, or the analytics backend is unavailable.'));
  }, [range]);

  const sessionsTotal = data?.sessions?.total || 0;
  const returning = data?.sessions?.returning || 0;
  const newSessions = data?.sessions?.new || 0;
  const returningPct = sessionsTotal ? Math.round((returning / sessionsTotal) * 100) : 0;
  const newPct = 100 - returningPct;

  const languageRows = useMemo(() => {
    if (!data) return [];
    const entries = Object.entries(data.sessions.byLang || {}).sort(([, a], [, b]) => b - a);
    const total = entries.reduce((s, [, n]) => s + n, 0) || 1;
    // Round every row normally except the last, which gets whatever
    // percentage is left over — keeps the column always summing to exactly
    // 100% instead of drifting a point or two from independent rounding.
    let remaining = 100;
    return entries.map(([code, count], i) => {
      const pct = i === entries.length - 1 ? remaining : Math.round((count / total) * 100);
      remaining -= pct;
      return { code, count, pct, name: LANGUAGES.find((l) => l.code === code)?.name || code };
    });
  }, [data]);
  const topLang = languageRows[0];

  const categoryShare = useMemo(() => {
    if (!data) return {};
    return activeLang === 'all' ? data.views?.byCategory || {} : data.views?.byCategoryByLang?.[activeLang] || {};
  }, [data, activeLang]);

  const categoryRows = useMemo(() => {
    const entries = Object.entries(categoryShare).sort(([, a], [, b]) => b - a);
    const total = entries.reduce((s, [, n]) => s + n, 0) || 1;
    let remaining = 100;
    return entries.map(([id, count], i) => {
      const cat = CATEGORIES.find((c) => c.id === id);
      const pct = i === entries.length - 1 ? remaining : Math.round((count / total) * 100);
      remaining -= pct;
      return {
        id,
        count,
        pct,
        icon: cat?.icon || '•',
        name: cat?.names?.en || id,
        note: cat?.note,
        color: CAT_COLOR[id] || INK,
      };
    });
  }, [categoryShare]);
  const maxCategoryCount = categoryRows[0]?.count || 1;

  const sessionsForCps = activeLang === 'all' ? sessionsTotal : data?.sessions?.byLang?.[activeLang] || 0;
  const viewsForCps = Object.values(categoryShare).reduce((s, n) => s + n, 0);
  const cps = sessionsForCps ? (viewsForCps / sessionsForCps).toFixed(1) : '—';

  const filterAll = data?.views?.byFilterMode?.all || 0;
  const filterNarrowed = data?.views?.byFilterMode?.narrowed || 0;
  const filterTotal = filterAll + filterNarrowed;
  const filterAllPct = filterTotal ? Math.round((filterAll / filterTotal) * 100) : 0;

  const mostSeen = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.views?.byQuestion || {})
      .map(([qid, count]) => ({ qid, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [data]);

  const votedQuestions = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats)
      .map(([qid, s]) => ({ qid, ...s, total: (s.like || 0) + (s.down || 0) }))
      .filter((q) => q.total >= MIN_VOTES && q.percent != null);
  }, [stats]);
  const mostLoved = useMemo(() => [...votedQuestions].sort((a, b) => b.percent - a.percent).slice(0, 6), [votedQuestions]);
  const leastLoved = useMemo(() => [...votedQuestions].sort((a, b) => a.percent - b.percent).slice(0, 6), [votedQuestions]);

  const chartDays = useMemo(() => {
    if (!data) return [];
    const entries = Object.entries(data.sessions.byDay || {}).sort(([a], [b]) => (a < b ? -1 : 1));
    const rangeMeta = RANGES.find((r) => r.key === range);
    const sliced = rangeMeta?.days ? entries.slice(-rangeMeta.days) : entries;
    return sliced.map(([date, count]) => ({ date, count }));
  }, [data, range]);
  const chartMax = Math.max(1, ...chartDays.map((d) => d.count));

  const questionText = (qid) => QUESTION_BY_ID.get(qid)?.[2]?.en || '(deleted question)';
  const questionCat = (qid) => CATEGORIES.find((c) => c.id === QUESTION_BY_ID.get(qid)?.[0]);

  return (
    <main style={S.page}>
      <div style={S.head}>
        <div className="serif" style={S.wordmark}>
          Tra<i style={{ fontStyle: 'italic' }}>lala</i>.cards
        </div>
        <div style={S.eyebrow}>PRIVATE ANALYTICS</div>
      </div>

      {error && <p style={S.muted}>{error}</p>}

      {data && (
        <>
          <div style={S.chipRow}>
            {RANGES.map((r) => (
              <button key={r.key} onClick={() => setRange(r.key)} style={r.key === range ? S.chipActive : S.chip}>
                {r.label}
              </button>
            ))}
          </div>

          <div style={S.tiles}>
            <Tile label="SESSIONS" value={fmtNum(sessionsTotal)} sub={RANGES.find((r) => r.key === range)?.label} />
            <Tile label="RETURNING" value={`${returningPct}%`} sub={`${fmtNum(returning)} of ${fmtNum(sessionsTotal)} came back`} />
            <Tile label="CARDS / SESSION" value={cps} sub={activeLang === 'all' ? 'avg. deck depth reached' : `avg. deck depth — ${LANGUAGES.find((l) => l.code === activeLang)?.name}`} />
            <Tile label="TOP LANGUAGE" value={topLang ? topLang.code.toUpperCase() : '—'} sub={topLang ? `${topLang.pct}% of sessions` : 'no data yet'} />
          </div>

          <Section title="VISITS OVER TIME" sub="Sessions started, by day">
            {chartDays.length === 0 ? (
              <p style={S.muted}>No visits recorded yet for this window.</p>
            ) : (
              <div style={S.chartWrap}>
                <svg viewBox="0 0 872 200" preserveAspectRatio="none" style={S.svg}>
                  {[0, 1, 2, 3, 4].map((t) => (
                    <line key={t} x1="0" x2="872" y1={4 + (176 / 4) * t} y2={4 + (176 / 4) * t} stroke="rgba(232,230,225,.08)" strokeWidth="1" />
                  ))}
                  {(() => {
                    const stepX = chartDays.length > 1 ? 872 / (chartDays.length - 1) : 0;
                    const yAt = (v) => 4 + 176 - (v / (chartMax * 1.12)) * 176;
                    let line = '';
                    chartDays.forEach((d, i) => {
                      const x = i * stepX, y = yAt(d.count);
                      line += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)} `;
                    });
                    const area = `M0,180 L${line.slice(1)}L${((chartDays.length - 1) * stepX).toFixed(1)},180 Z`;
                    return (
                      <>
                        <path d={area} fill={INK} opacity="0.14" stroke="none" />
                        <path d={line.trim()} fill="none" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
                        {hoverIdx != null && chartDays[hoverIdx] && (
                          <>
                            <line x1={hoverIdx * stepX} x2={hoverIdx * stepX} y1="4" y2="180" stroke="rgba(232,230,225,.42)" strokeDasharray="2,3" />
                            <circle cx={hoverIdx * stepX} cy={yAt(chartDays[hoverIdx].count)} r="4" fill={INK} stroke="#0c0c0d" strokeWidth="2" />
                          </>
                        )}
                        <rect
                          x="0" y="0" width="872" height="180" fill="transparent"
                          onMouseMove={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const idx = Math.max(0, Math.min(chartDays.length - 1, Math.round(((e.clientX - rect.left) / rect.width) * (chartDays.length - 1))));
                            setHoverIdx(idx);
                          }}
                          onMouseLeave={() => setHoverIdx(null)}
                        />
                      </>
                    );
                  })()}
                </svg>
                <div style={S.axisRow}>
                  <span>{fmtDate(chartDays[0].date)}</span>
                  <span>{hoverIdx != null && chartDays[hoverIdx] ? `${fmtDate(chartDays[hoverIdx].date)} — ${fmtNum(chartDays[hoverIdx].count)} sessions` : ''}</span>
                  <span>{fmtDate(chartDays[chartDays.length - 1].date)}</span>
                </div>
              </div>
            )}
          </Section>

          <div style={S.grid2}>
            <div style={S.panel}>
              <div style={S.sectionTitle}>NEW VS RETURNING</div>
              <div style={S.splitBar}>
                <span style={{ width: `${newPct}%`, background: INK }} />
                <span style={{ width: `${returningPct}%`, background: UNLOVED }} />
              </div>
              <LegendRow color={INK} label="New" value={`${fmtNum(newSessions)} `} sub={`${newPct}%`} />
              <LegendRow color={UNLOVED} label="Returning" value={`${fmtNum(returning)} `} sub={`${returningPct}%`} />
            </div>
            <div style={S.panel}>
              <div style={S.sectionTitle}>LANGUAGES</div>
              {languageRows.length === 0 && <p style={S.muted}>No data yet.</p>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginTop: 18 }}>
                {languageRows.map((l) => (
                  <BarRow key={l.code} name={l.name} pct={l.pct} widthPct={l.pct} value={`${fmtNum(l.count)} ${l.pct}%`} color={LANG_COLOR[l.code] || INK} />
                ))}
              </div>
            </div>
          </div>

          <Section
            title="CATEGORIES"
            sub="Tap a language to see what's popular within it"
            right={
              <div style={S.chipRow}>
                <button onClick={() => setActiveLang('all')} style={activeLang === 'all' ? S.chipActive : S.chip}>ALL</button>
                {LANGUAGES.map((l) => (
                  <button key={l.code} onClick={() => setActiveLang(l.code)} style={activeLang === l.code ? S.chipActive : S.chip}>
                    {l.code.toUpperCase()}
                  </button>
                ))}
              </div>
            }
          >
            <div style={S.card}>
              <div style={S.miniLabel}>CATEGORY FILTER USE — SHARE OF CARD VIEWS</div>
              <div style={{ ...S.splitBar, marginTop: 12 }}>
                <span style={{ width: `${filterAllPct}%`, background: INK }} />
                <span style={{ width: `${100 - filterAllPct}%`, background: UNLOVED }} />
              </div>
              <LegendRow color={INK} label={'Browsing "All" — never narrowed the filter'} value="" sub={`${filterAllPct}%`} />
              <LegendRow color={UNLOVED} label="Narrowed to one or a few categories" value="" sub={`${100 - filterAllPct}%`} />
              <div style={S.hr} />
              <div style={S.miniLabel}>
                SHARE OF CARD VIEWS, BY CATEGORY — {activeLang === 'all' ? 'ALL LANGUAGES' : LANGUAGES.find((l) => l.code === activeLang)?.name.toUpperCase()}
              </div>
              {categoryRows.length === 0 && <p style={S.muted}>No data yet.</p>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
                {categoryRows.map((c) => (
                  <div key={c.id} style={S.catRow}>
                    <span style={S.catIcon}>{c.icon}</span>
                    <span style={S.catName}>
                      {c.name}
                      {c.note && <span style={S.catNote}> {c.note}</span>}
                    </span>
                    <span style={S.barTrack}>
                      <span style={{ ...S.barFill, width: `${Math.round((c.count / maxCategoryCount) * 100)}%`, background: c.color }} />
                    </span>
                    <span style={S.barVal}><b>{c.pct}%</b></span>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          <Section title="QUESTIONS" sub={`Like/dislike % is all-time (needs ${MIN_VOTES}+ votes) — views scope to the range above`}>
            <div style={S.qGrid}>
              <QCol title="MOST SEEN" dotColor={INK}>
                {mostSeen.length === 0 && <p style={S.muted}>No views yet.</p>}
                {mostSeen.map((q, i) => (
                  <QItem key={q.qid} rank={i + 1} text={questionText(q.qid)} catColor={CAT_COLOR[questionCat(q.qid)?.id]} catName={questionCat(q.qid)?.names?.en} meta={`${fmtNum(q.count)} views`} />
                ))}
              </QCol>
              <QCol title="MOST LOVED" dotColor={GOLD}>
                {mostLoved.length === 0 && <p style={S.muted}>Not enough votes yet.</p>}
                {mostLoved.map((q, i) => (
                  <QItem key={q.qid} rank={i + 1} text={questionText(q.qid)} catColor={CAT_COLOR[questionCat(q.qid)?.id]} catName={questionCat(q.qid)?.names?.en} meta={`${q.percent}% ♥`} />
                ))}
              </QCol>
              <QCol title="RARELY LOVED — CONSIDER CUTTING" dotColor={UNLOVED}>
                {leastLoved.length === 0 && <p style={S.muted}>Not enough votes yet.</p>}
                {leastLoved.map((q, i) => (
                  <QItem key={q.qid} rank={i + 1} text={questionText(q.qid)} catColor={CAT_COLOR[questionCat(q.qid)?.id]} catName={questionCat(q.qid)?.names?.en} meta={`${q.percent}% ♥`} />
                ))}
              </QCol>
            </div>
          </Section>

          <div style={S.footer}>
            Anonymous, aggregate-only — no personal data, nothing shared with a third party.
          </div>
        </>
      )}
    </main>
  );
}

function Tile({ label, value, sub }) {
  return (
    <div style={S.tile}>
      <div style={S.tileLabel}>{label}</div>
      <div className="serif" style={S.tileValue}>{value}</div>
      <div style={S.tileSub}>{sub}</div>
    </div>
  );
}

function Section({ title, sub, right, children }) {
  return (
    <section style={S.section}>
      <div style={S.sectionHead}>
        <div>
          <div style={S.sectionTitle}>{title}</div>
          {sub && <div style={S.muted}>{sub}</div>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function LegendRow({ color, label, value, sub }) {
  return (
    <div style={S.legendRow}>
      <span style={S.legendKey}>
        <span style={{ ...S.swatch, background: color }} />
        {label}
      </span>
      <span style={S.legendVal}>
        {value}
        <span style={S.legendSub}>{sub}</span>
      </span>
    </div>
  );
}

function BarRow({ name, widthPct, value, color }) {
  return (
    <div style={S.barRow}>
      <span style={S.barRowName}>{name}</span>
      <span style={S.barTrack}>
        <span style={{ ...S.barFill, width: `${widthPct}%`, background: color }} />
      </span>
      <span style={S.barVal}>{value}</span>
    </div>
  );
}

function QCol({ title, dotColor, children }) {
  return (
    <div style={S.qCol}>
      <div style={S.qColHead}>
        <span style={{ ...S.qColDot, background: dotColor }} />
        <span style={S.qColTitle}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function QItem({ rank, text, catColor, catName, meta }) {
  return (
    <div style={S.qItem}>
      <span style={S.qRank}>{String(rank).padStart(2, '0')}</span>
      <div style={{ minWidth: 0 }}>
        <div className="serif" style={S.qText}>{text}</div>
        <div style={S.qMeta}>
          <span style={{ ...S.qCatDot, background: catColor || INK }} />
          {catName} · <b style={{ color: 'rgba(232,230,225,.62)' }}>{meta}</b>
        </div>
      </div>
    </div>
  );
}

const mono = (size, weight = 500, tracking = '.08em') => ({
  font: `${weight} ${size}px var(--font-mono), monospace`,
  letterSpacing: tracking,
});

const S = {
  page: { minHeight: '100dvh', background: '#0c0c0d', color: INK, padding: '30px 20px 80px', maxWidth: 920, margin: '0 auto' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, paddingBottom: 20, borderBottom: '1px solid rgba(232,230,225,.12)', flexWrap: 'wrap' },
  wordmark: { fontSize: 30, lineHeight: 1 },
  eyebrow: { ...mono(9, 600, '.18em'), color: 'rgba(232,230,225,.42)' },
  muted: { ...mono(11, 400, '.02em'), color: 'rgba(232,230,225,.4)', margin: '8px 0 0' },
  chipRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  chip: { padding: '6px 12px', borderRadius: 100, border: '1px solid rgba(232,230,225,.22)', background: 'transparent', color: 'rgba(232,230,225,.42)', cursor: 'pointer', ...mono(9, 500, '.1em') },
  chipActive: { padding: '6px 12px', borderRadius: 100, border: '1px solid #e8e6e1', background: '#e8e6e1', color: '#0c0c0d', cursor: 'pointer', ...mono(9, 500, '.1em') },
  tiles: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 1, background: 'rgba(232,230,225,.12)', border: '1px solid rgba(232,230,225,.12)', borderRadius: 6, overflow: 'hidden', marginTop: 20 },
  tile: { background: '#17151a', padding: '18px 16px' },
  tileLabel: { ...mono(9, 600, '.12em'), color: 'rgba(232,230,225,.42)' },
  tileValue: { marginTop: 8, fontSize: 30, lineHeight: 1 },
  tileSub: { marginTop: 6, ...mono(10, 400, '.02em'), color: 'rgba(232,230,225,.42)' },
  section: { marginTop: 36 },
  sectionHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 14, marginBottom: 14, flexWrap: 'wrap' },
  sectionTitle: { ...mono(10, 600, '.16em'), color: 'rgba(232,230,225,.62)' },
  card: { background: '#17151a', border: '1px solid rgba(232,230,225,.12)', borderRadius: 6, padding: '20px 20px 12px', overflowX: 'auto' },
  chartWrap: { background: '#17151a', border: '1px solid rgba(232,230,225,.12)', borderRadius: 6, padding: '18px 18px 12px' },
  svg: { display: 'block', width: '100%', height: 180 },
  axisRow: { display: 'flex', justifyContent: 'space-between', marginTop: 8, ...mono(9, 400, '.04em'), color: 'rgba(232,230,225,.42)' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 1, background: 'rgba(232,230,225,.12)', border: '1px solid rgba(232,230,225,.12)', borderRadius: 6, overflow: 'hidden', marginTop: 36 },
  panel: { background: '#17151a', padding: 20, overflowX: 'auto' },
  splitBar: { display: 'flex', height: 10, borderRadius: 100, overflow: 'hidden', marginTop: 14 },
  legendRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, ...mono(11, 400, '.01em') },
  legendKey: { display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(232,230,225,.62)' },
  swatch: { width: 8, height: 8, borderRadius: 2, flex: 'none' },
  legendVal: { fontVariantNumeric: 'tabular-nums', color: INK, fontWeight: 600 },
  legendSub: { color: 'rgba(232,230,225,.42)', fontSize: 10, marginLeft: 4 },
  miniLabel: { ...mono(9, 600, '.1em'), color: 'rgba(232,230,225,.42)' },
  hr: { height: 1, background: 'rgba(232,230,225,.12)', margin: '18px 0' },
  catRow: { display: 'grid', gridTemplateColumns: '24px minmax(90px, 130px) 1fr 56px', alignItems: 'center', gap: 10 },
  catIcon: { fontSize: 14, textAlign: 'center' },
  catName: { fontSize: 11, color: 'rgba(232,230,225,.62)', whiteSpace: 'nowrap' },
  catNote: { color: 'rgba(232,230,225,.42)', fontSize: 9 },
  barRow: { display: 'grid', gridTemplateColumns: '78px 1fr 76px', alignItems: 'center', gap: 10 },
  barRowName: { fontSize: 11, color: 'rgba(232,230,225,.62)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  barTrack: { position: 'relative', height: 14, background: '#1d1a20', borderRadius: 3, overflow: 'hidden' },
  barFill: { position: 'absolute', inset: '0 auto 0 0', borderRadius: 3 },
  barVal: { fontSize: 11, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'rgba(232,230,225,.62)', whiteSpace: 'nowrap' },
  qGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1, background: 'rgba(232,230,225,.12)', border: '1px solid rgba(232,230,225,.12)', borderRadius: 6, overflow: 'hidden' },
  qCol: { background: '#17151a', padding: 16 },
  qColHead: { display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 },
  qColDot: { width: 6, height: 6, borderRadius: 100, flex: 'none' },
  qColTitle: { ...mono(9, 600, '.1em'), color: 'rgba(232,230,225,.62)' },
  qItem: { display: 'flex', gap: 10, padding: '10px 0', borderTop: '1px solid rgba(232,230,225,.12)' },
  qRank: { flex: 'none', width: 16, fontSize: 9, color: 'rgba(232,230,225,.3)', fontWeight: 600, paddingTop: 2, fontVariantNumeric: 'tabular-nums' },
  qText: { fontSize: 14, lineHeight: 1.3 },
  qMeta: { display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, fontSize: 9, color: 'rgba(232,230,225,.42)' },
  qCatDot: { width: 5, height: 5, borderRadius: 100, flex: 'none' },
  footer: { marginTop: 40, paddingTop: 16, borderTop: '1px solid rgba(232,230,225,.12)', ...mono(10, 400, '.02em'), color: 'rgba(232,230,225,.3)' },
};
