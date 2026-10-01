// Shared server-side helpers for the /create AI deck generator prototype.
// Used by app/api/create/{clarify,deck,swap}/route.js. The API key lives only
// in ANTHROPIC_API_KEY on the server; the browser never sees it.

import Anthropic from '@anthropic-ai/sdk';
import { kv } from '@vercel/kv';
import { CodeError, clientIp } from './codes';

const client = new Anthropic();

export const MODELS = {
  sonnet: { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5', inPerM: 2, outPerM: 10 },
  opus: { id: 'claude-opus-5-5', label: 'Opus 5.5', inPerM: 4, outPerM: 20 },
};

const DAILY_LIMIT = Number(process.env.CREATE_DAILY_LIMIT) || 40;

// The owner's key (CREATE_PREVIEW_KEY): prototype switches, admin page.
// Everyone else comes in with a promo code (./codes.js).
export function badKey(key) {
  const expected = process.env.CREATE_PREVIEW_KEY;
  return !expected || key !== expected;
}

// Daily cap on AI calls. KV in production; an in-memory counter locally
// (no KV env vars), which resets when the dev server restarts.
const memCount = new Map();
export async function overDailyLimit() {
  const day = new Date().toISOString().slice(0, 10);
  const key = `tralala:create:calls:${day}`;
  if (process.env.KV_REST_API_URL) {
    const n = await kv.incr(key);
    if (n === 1) await kv.expire(key, 60 * 60 * 48);
    return n > DAILY_LIMIT;
  }
  const n = (memCount.get(key) || 0) + 1;
  memCount.set(key, n);
  return n > DAILY_LIMIT;
}

function openStream({ model, effort, system, prompt, schema, maxTokens, signal }) {
  const m = MODELS[model] || MODELS.sonnet;
  const stream = client.beta.messages.stream({
    model: m.id,
    max_tokens: maxTokens,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    thinking: { type: 'adaptive' },
    output_config: { effort, format: { type: 'json_schema', schema } },
    system,
    messages: [{ role: 'user', content: prompt }],
  }, { signal });
  return { m, stream };
}

// Checks the finished message and works out what it cost.
function finish(name, m, msg, started) {
  if (msg.stop_reason === 'refusal') throw new AiError('refused', 'The model declined this request.');
  if (msg.stop_reason === 'max_tokens') throw new AiError('too_long', 'The answer was cut off.');
  const text = msg.content.find((b) => b.type === 'text')?.text;
  if (!text) throw new AiError('empty', 'No answer came back.');
  const { input_tokens: inTok = 0, output_tokens: outTok = 0 } = msg.usage || {};
  const cost = (inTok * m.inPerM + outTok * m.outPerM) / 1e6;
  const meta = { model: m.label, servedBy: msg.model, ms: Date.now() - started, inTok, outTok, cost: Math.round(cost * 10000) / 10000 };
  console.log('[create]', name, JSON.stringify(meta));
  return { text, meta };
}

// One structured-output call, answered all at once: returns { data, meta }.
export async function callJson({ name, ...params }) {
  const started = Date.now();
  const { m, stream } = openStream(params);
  const msg = await stream.finalMessage();
  const { text, meta } = finish(name, m, msg, started);
  return { data: JSON.parse(text), meta };
}

// Same call, but hands every piece of the JSON answer to onText(fullSoFar)
// as it arrives, so the caller can pick out finished parts early.
export async function streamJson({ name, onText, ...params }) {
  const started = Date.now();
  const { m, stream } = openStream(params);
  let soFar = '';
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      soFar += event.delta.text;
      onText(soFar);
    }
  }
  const msg = await stream.finalMessage();
  return finish(name, m, msg, started);
}

export class AiError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// Maps any failure to a small JSON error the page can show.
export function errorInfo(err) {
  if (err instanceof CodeError) return { error: err.code };
  if (err instanceof AiError) return { error: err.code, message: err.message };
  if (err instanceof Anthropic.AuthenticationError) return { error: 'auth', message: 'API key is missing or invalid.' };
  if (err instanceof Anthropic.RateLimitError) return { error: 'rate_limit', message: 'Too many requests right now. Try again in a minute.' };
  if (err instanceof Anthropic.APIError) return { error: 'api', message: `AI service error (${err.status}).` };
  console.error('[create]', err);
  return { error: 'server', message: 'Something went wrong on the server.' };
}

const STATUS = { auth: 500, rate_limit: 429, server: 500 };
export function errorResponse(err) {
  const info = errorInfo(err);
  return Response.json(info, { status: err instanceof CodeError ? err.status : STATUS[info.error] || 502 });
}

// Reads the body, checks the owner's key or runs `check` on the promo code,
// then applies the daily cap. Code users always get Sonnet.
// Returns { body, access } or { response } (an error to send back as is).
// check(access, body) may return extra fields (e.g. a deck id) or throw CodeError.
export async function gate(request, check) {
  let body;
  try {
    body = await request.json();
  } catch {
    return { response: Response.json({ error: 'bad_json' }, { status: 400 }) };
  }
  const admin = !badKey(body.key);
  if (!admin && !body.code) return { response: Response.json({ error: 'not_found' }, { status: 404 }) };
  if (!admin) body.model = 'sonnet';
  let access = { admin, code: body.code, ip: clientIp(request) };
  if (!admin && check) {
    try {
      access = { ...access, ...(await check(access, body)) };
    } catch (err) {
      return { response: errorResponse(err) };
    }
  }
  if (await overDailyLimit()) {
    await access.refund?.();
    return { response: Response.json({ error: 'daily_limit', message: 'Daily limit reached. Try again tomorrow.' }, { status: 429 }) };
  }
  return { body, access };
}

// Plumbing for the JSON (non-streaming) routes.
export async function handle(request, run, check) {
  const { body, access, response } = await gate(request, check);
  if (response) return response;
  try {
    return Response.json(await run(body, access));
  } catch (err) {
    await access.refund?.();
    return errorResponse(err);
  }
}

export const clip = (s, n) => String(s ?? '').slice(0, n).trim();
