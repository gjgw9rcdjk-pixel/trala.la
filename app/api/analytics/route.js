// Read-only export of the anonymous, aggregate counters written by
// /api/track — sessions (total/new/returning/by day/by language), card views
// (by question, by category, by category-within-language, by filter mode),
// and shares (by question, by category). Owner session only
// (lib/adminAuth.js); backs the /insights page.
//
// Pass ?range=7 / 30 / 90 / max (default: max) to scope everything except the
// sessions-per-day chart — that one always comes back in full so a caller can
// slice it however it wants — to that many trailing days.

import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import { adminOnly } from '@/lib/adminAuth';

// Every source hash stores fields as "<date>|<rest>". This splits on the
// first "|", keeps only fields whose date falls in `dateSet` (null = keep
// everything), and sums values into buckets keyed by whatever `keyFn` turns
// the remainder into.
function sumByField(hash, dateSet, keyFn) {
  const out = {};
  for (const [field, val] of Object.entries(hash || {})) {
    const sep = field.indexOf('|');
    if (sep === -1) continue;
    const date = field.slice(0, sep);
    if (dateSet && !dateSet.has(date)) continue;
    const bucketKey = keyFn(field.slice(sep + 1));
    out[bucketKey] = (out[bucketKey] || 0) + (Number(val) || 0);
  }
  return out;
}

// null = no date filtering (the "max" / since-launch case).
function dateSetForRange(rangeParam) {
  if (rangeParam === 'max') return null;
  const n = Number(rangeParam);
  if (!Number.isInteger(n) || n <= 0) return null;
  const set = new Set();
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    set.add(d.toISOString().slice(0, 10));
  }
  return set;
}

export async function GET(request) {
  const denied = await adminOnly();
  if (denied) return denied;
  const { searchParams } = new URL(request.url);

  const rangeParam = searchParams.get('range') || 'max';
  const dateSet = dateSetForRange(rangeParam);

  const [
    sessionsByDay,
    sessionsByKindDay,
    sessionsByLangDay,
    viewsByQuestionDay,
    viewsByCategoryDay,
    viewsByCatLangDay,
    viewsByFilterModeDay,
    sharesByQuestionDay,
    sharesByCategoryDay,
  ] = await Promise.all([
    kv.hgetall('tralala:analytics:sessions:byday'),
    kv.hgetall('tralala:analytics:sessions:bykindday'),
    kv.hgetall('tralala:analytics:sessions:bylangday'),
    kv.hgetall('tralala:analytics:views:byquestionday'),
    kv.hgetall('tralala:analytics:views:bycategoryday'),
    kv.hgetall('tralala:analytics:views:bycatlangday'),
    kv.hgetall('tralala:analytics:views:byfiltermodeday'),
    kv.hgetall('tralala:analytics:shares:byquestionday'),
    kv.hgetall('tralala:analytics:shares:bycategoryday'),
  ]);

  const kind = sumByField(sessionsByKindDay, dateSet, (rest) => rest); // { new, returning }

  // "<date>|<category>|<lang>" has two "|"s, so it needs its own pass rather
  // than the single-split sumByField helper.
  const byCategoryByLang = {};
  for (const [field, val] of Object.entries(viewsByCatLangDay || {})) {
    const [date, category, lang] = field.split('|');
    if (!date || !category || !lang) continue;
    if (dateSet && !dateSet.has(date)) continue;
    byCategoryByLang[lang] = byCategoryByLang[lang] || {};
    byCategoryByLang[lang][category] = (byCategoryByLang[lang][category] || 0) + (Number(val) || 0);
  }

  return NextResponse.json({
    range: rangeParam,
    sessions: {
      total: (kind.new || 0) + (kind.returning || 0),
      new: kind.new || 0,
      returning: kind.returning || 0,
      byDay: sessionsByDay || {}, // full history, unfiltered — for the chart
      byLang: sumByField(sessionsByLangDay, dateSet, (rest) => rest),
    },
    views: {
      byQuestion: sumByField(viewsByQuestionDay, dateSet, (rest) => rest),
      byCategory: sumByField(viewsByCategoryDay, dateSet, (rest) => rest),
      byCategoryByLang,
      byFilterMode: sumByField(viewsByFilterModeDay, dateSet, (rest) => rest), // { all, narrowed }
    },
    shares: {
      byQuestion: sumByField(sharesByQuestionDay, dateSet, (rest) => rest),
      byCategory: sumByField(sharesByCategoryDay, dateSet, (rest) => rest),
    },
  });
}
