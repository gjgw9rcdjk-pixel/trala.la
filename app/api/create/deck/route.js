// Step 3 of /create: write the whole deck (15-50 cards) plus a short name.
// Streams newline-delimited JSON so the page can show each card as soon as
// the model finishes it:
//   {"type":"name","name":"..."}
//   {"type":"card","text":"...","level":2}      (one per card)
//   {"type":"done","meta":{...}}  or  {"type":"error","error":"...","message":"..."}

import { streamJson, gate, clip, errorInfo, CARD_RULES } from '../ai';

export const maxDuration = 300;

const schema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    cards: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          level: { type: 'integer', enum: [1, 2, 3] },
        },
        required: ['text', 'level'],
        additionalProperties: false,
      },
    },
  },
  required: ['name', 'cards'],
  additionalProperties: false,
};

// Finished pieces inside a partial JSON answer. The schema fixes the key
// order, so a card is complete once its closing brace has arrived.
const STR = '"((?:[^"\\\\]|\\\\.)*)"';
const NAME_RE = new RegExp(`"name"\\s*:\\s*${STR}`);
const CARD_RE = new RegExp(`\\{\\s*"text"\\s*:\\s*${STR}\\s*,\\s*"level"\\s*:\\s*([123])\\s*\\}`, 'g');
const unquote = (raw) => JSON.parse(`"${raw}"`);

export async function POST(request) {
  const { body, response } = await gate(request);
  if (response) return response;

  const brief = clip(body.brief, 800);
  const deckLang = clip(body.deckLang, 40) || 'English';
  const count = Math.min(50, Math.max(15, Number(body.count) || 15));
  const answers = (Array.isArray(body.answers) ? body.answers : [])
    .slice(0, 5)
    .map((a) => `- ${clip(a.question, 120)} → ${clip(a.answer, 40)}`)
    .join('\n');

  const prompt = `Write a deck of exactly ${count} cards in ${deckLang} for this occasion:
<brief>
${brief}
</brief>
${answers ? `\nThe organiser's answers:\n<answers>\n${answers}\n</answers>\n` : ''}
Before answering, quietly draft about twice as many candidates, drop any that break the rules (generic, too long, duplicate angle, fits any deck), and keep the best ${count} in warm-up order.

Also give the deck a short, warm name in ${deckLang} (2-4 words, no quotes, no emoji).`;

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj) => controller.enqueue(enc.encode(`${JSON.stringify(obj)}\n`));
      let nameSent = false;
      let sent = 0;
      try {
        const { meta } = await streamJson({
          name: 'deck', model: body.model, effort: 'high', maxTokens: 64000,
          system: CARD_RULES, prompt, schema, signal: request.signal,
          onText: (soFar) => {
            if (!nameSent) {
              const n = soFar.match(NAME_RE);
              if (n) { send({ type: 'name', name: clip(unquote(n[1]), 40) }); nameSent = true; }
            }
            const cards = [...soFar.matchAll(CARD_RE)];
            for (; sent < cards.length && sent < count; sent += 1) {
              send({ type: 'card', text: clip(unquote(cards[sent][1]), 200), level: Number(cards[sent][2]) });
            }
          },
        });
        send({ type: 'done', meta });
      } catch (err) {
        if (!request.signal.aborted) send({ type: 'error', ...errorInfo(err) });
      } finally {
        try { controller.close(); } catch { /* client already gone */ }
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
