// ↻ on the /create deck screen: one new card to replace one the user dropped,
// different in angle from everything already in the deck.

import { callJson, handle, clip, CARD_RULES } from '../ai';

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

export async function POST(request) {
  return handle(request, async (body) => {
    const brief = clip(body.brief, 800);
    const deckLang = clip(body.deckLang, 40) || 'English';
    const replace = clip(body.replace, 200);
    const deck = (Array.isArray(body.cards) ? body.cards : []).slice(0, 60).map((t) => `- ${clip(t, 200)}`).join('\n');

    const prompt = `A deck in ${deckLang} for this occasion:
<brief>
${brief}
</brief>

Cards already in the deck:
<deck>
${deck}
</deck>

The organiser wants to replace this card:
<replace>${replace}</replace>

Write ONE new card in ${deckLang} at a similar intensity level. It must take a different angle from the replaced card and from every card in the deck.`;

    const { data, meta } = await callJson({
      name: 'swap', model: body.model, effort: 'low', maxTokens: 8000,
      system: CARD_RULES, prompt, schema,
    });
    return { text: clip(data.text, 200), level: data.level, meta };
  });
}
