// Step 2 of /create: tidy up the user's idea and ask 3-5 multiple-choice
// questions that would most change the deck. Questions are in the UI
// language (the organiser answers them); the deck language is separate.
// Also returns `adult`: whether the page should offer the 18+ switch. The
// model only hints; the organiser decides.

import { callJson, handle, clip } from '../ai';
import { cardRules, ideaSoundsAdult } from '../rules';
import { allowAdult, allowClarify } from '../codes';

export const maxDuration = 60;

const UI_LANG_NAME = { en: 'English', lt: 'Lithuanian' };

const schema = {
  type: 'object',
  properties: {
    refined: { type: 'string' },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
        },
        required: ['question', 'options'],
        additionalProperties: false,
      },
    },
    adult: { type: 'boolean' },
  },
  required: ['refined', 'questions', 'adult'],
  additionalProperties: false,
};

export async function POST(request) {
  return handle(request, async (body, access) => {
    const idea = clip(body.idea, 400);
    const ui = UI_LANG_NAME[body.uiLang] || 'English';
    const deckLang = clip(body.deckLang, 40) || 'English';
    const count = Math.min(50, Math.max(15, Number(body.count) || 15));

    const prompt = `The organiser described their occasion:
<occasion>
${idea}
</occasion>

They want a deck of ${count} cards in ${deckLang}.

Do three things, the first two written in ${ui} (the organiser's language):
1. "refined": rewrite their idea as a clear 2-3 sentence brief for the deck: who is playing, how many, the setting, the mood, anything to avoid. Keep every fact they gave; add only reasonable, clearly implied assumptions. Plain words, no marketing tone.
2. "questions": 3-5 short multiple-choice questions whose answers would most change what cards you write (e.g. who is at the table, mood, how deep, whether someone is the focus, topics to avoid). Skip anything the idea already answers. Each question has 2-4 short options (1-4 words each).
   If the occasion is about work or a team, one question must be how much the cards should look back on the team's work together, with options like "None", "A little", "More".
   Never ask about adult or sexual content yourself; the page has its own switch for that.
3. "adult": true if the occasion suggests the group might want bold 18+ cards about sex (e.g. a bachelor or hen party, a couples' night, "spicy", "18+"); otherwise false. Family, work, kids or mixed-age occasions are always false.`;

    const { data, meta } = await callJson({
      name: 'clarify', model: body.model, effort: 'low', maxTokens: 8000,
      system: cardRules(deckLang), prompt, schema,
    });
    const questions = (data.questions || [])
      .slice(0, 5)
      .map((q) => ({ question: clip(q.question, 120), options: (q.options || []).slice(0, 4).map((o) => clip(o, 40)).filter(Boolean) }))
      .filter((q) => q.question && q.options.length >= 2);
    const adult = Boolean(data.adult) || ideaSoundsAdult(idea);
    if (adult && !access.admin) await allowAdult(access.code);
    return { refined: clip(data.refined, 600), questions, adult, meta };
  }, ({ code, ip }) => allowClarify(code, ip));
}
