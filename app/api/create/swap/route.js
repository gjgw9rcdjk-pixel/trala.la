// ↻ on the /create deck screen: one new card to replace one the user dropped,
// different in angle from everything already in the deck and from every card
// the user has already thrown out. The new card goes through the same code
// checks as the deck; if it fails, the model gets one more try.

import { callJson, handle, clip } from '../ai';
import { cardRules, checkCards } from '../rules';
import { takeSwap } from '../codes';

export const maxDuration = 60;

const schema = {
  type: 'object',
  properties: {
    text: { type: 'string' },
    level: { type: 'integer', enum: [1, 2, 3] },
  },
  required: ['text', 'level'],
  additionalProperties: false,
};

const list = (arr, max) => (Array.isArray(arr) ? arr : []).slice(-max).map((t) => `- ${clip(t, 200)}`).join('\n');

export async function POST(request) {
  return handle(request, async (body, access) => {
    const brief = clip(body.brief, 800);
    const deckLang = clip(body.deckLang, 40) || 'English';
    const replace = clip(body.replace, 200);
    const cards = (Array.isArray(body.cards) ? body.cards : []).slice(0, 60).map((t) => clip(t, 200));
    const rest = cards.filter((t) => t !== replace);
    const rejected = list(body.rejected, 40);

    const prompt = `A deck in ${deckLang} for this occasion:
<brief>
${brief}
</brief>

Cards already in the deck:
<deck>
${list(cards, 60)}
</deck>
${rejected ? `\nCards the organiser already threw out (don't bring these back or write close variants):\n<rejected>\n${rejected}\n</rejected>\n` : ''}
The organiser wants to replace this card:
<replace>${replace}</replace>

Write ONE new card in ${deckLang} at a similar intensity level. It must take a different angle from the replaced card and from every card in the deck.`;

    const system = cardRules(deckLang, { adult: access.admin ? body.adult === true : access.adult });
    const ask = (p) => callJson({ name: 'swap', model: body.model, effort: 'low', maxTokens: 8000, system, prompt: p, schema });

    let { data, meta } = await ask(prompt);
    let text = clip(data.text, 200);
    const problems = checkCards([text], deckLang, rest)[0]?.problems;
    if (problems) {
      const retry = await ask(`${prompt}\n\nYour first try was "${text}", but it broke a rule: ${problems.join('; ')}. Write a different card that follows every rule.`);
      text = clip(retry.data.text, 200);
      data = retry.data;
      meta = { ...retry.meta, cost: Math.round((meta.cost + retry.meta.cost) * 10000) / 10000, ms: meta.ms + retry.meta.ms, fixed: 1 };
    }
    return { text, level: data.level, meta, swapsLeft: access.swapsLeft };
  }, ({ code, ip }, body) => takeSwap(code, ip, body.deckId));
}
