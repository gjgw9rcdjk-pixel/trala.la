// Visual identity + play rules for the "game night" redesign.
// Kept separate from lib/content.js so question data stays untouched.

import { CATEGORIES, QUESTIONS, CORE, LANGUAGES } from '@/lib/content';

// Deck tile colour + glyph per category. Colours come from the design kit
// (hot pink, deep-end blue, highlight yellow, dating purple, go green);
// `null` colour = the dark "raised" tile used for the 18+ deck.
export const DECK_STYLE = {
  union:   { color: '#FFC93C', glyph: '♣' },
  know:    { color: '#FF4E7D', glyph: '♠' },
  night:   { color: '#3FA9FF', glyph: '◆' },
  team:    { color: '#3AD07A', glyph: '♦' },
  spicy:   { color: null,      glyph: '✦' },
  future:  { color: '#B579FF', glyph: '★' },
  firsts:  { color: '#FF4E7D', glyph: '▲' },
  awkward: { color: '#FFC93C', glyph: '●' },
  couples: { color: '#B579FF', glyph: '♥' },
  food:    { color: '#3AD07A', glyph: '■' },
};

// Language pickers: English first, then the rest alphabetically by name.
export const UI_LANGUAGES = [
  ...LANGUAGES.filter((l) => l.code === 'en'),
  ...LANGUAGES.filter((l) => l.code !== 'en').sort((a, b) => a.name.localeCompare(b.name)),
];

// Card offset colour for a filtered deck follows the card's own deck tile.
// `label` is a darker shade of the same hue, readable on the cream card.
// The 18+ deck has a dark tile, so its cards keep the default pink.
const OFFSET_BY_COLOR = {
  '#FFC93C': { rgb: '255, 201, 60', label: '#8A6200' },
  '#FF4E7D': { rgb: '255, 78, 125', label: '#C22050' },
  '#3FA9FF': { rgb: '63, 169, 255', label: '#1B67A8' },
  '#3AD07A': { rgb: '58, 208, 122', label: '#1E7A45' },
  '#B579FF': { rgb: '181, 121, 255', label: '#6B35B8' },
};
export function deckOffset(catId) {
  return OFFSET_BY_COLOR[DECK_STYLE[catId]?.color] || OFFSET_BY_COLOR['#FF4E7D'];
}

// How many deck tiles show between the "All cards" / "Make your own" tiles
// and the "+N more" tile (keeps the grid at 4 full rows of 2).
export const VISIBLE_DECKS = 5;

// Spice applies to the Spicy deck only. Levels are cumulative:
// mild → only mild cards, spicy → mild + spicy, nomercy → all.
export const SPICE_LEVELS = ['mild', 'spicy', 'nomercy'];
const SPICE_RANK = { mild: 0, spicy: 1, nomercy: 2 };

export const SPICE_OF = {
  'spicy-01': 'spicy',
  'spicy-02': 'spicy',
  'spicy-03': 'mild',
  'spicy-04': 'mild',
  'spicy-05': 'spicy',
  'spicy-06': 'mild',
  'spicy-07': 'spicy',
  'spicy-08': 'spicy',
  'spicy-09': 'spicy',
  'spicy-10': 'spicy',
  'spicy-11': 'mild',
  'spicy-12': 'spicy',
  'spicy-13': 'mild',
  'spicy-14': 'nomercy',
  'spicy-15': 'mild',
  'spicy-16': 'nomercy',
  'spicy-17': 'nomercy',
  'spicy-18': 'nomercy',
  'spicy-19': 'nomercy',
  'spicy-20': 'nomercy',
  'spicy-21': 'mild',
  'spicy-22': 'mild',
  'spicy-23': 'mild',
  'spicy-24': 'mild',
  'spicy-25': 'mild',
  'spicy-26': 'mild',
  'spicy-27': 'mild',
  'spicy-28': 'mild',
  'spicy-29': 'mild',
  'spicy-30': 'mild',
  'spicy-31': 'spicy',
  'spicy-32': 'spicy',
  'spicy-33': 'spicy',
  'spicy-34': 'spicy',
  'spicy-35': 'spicy',
  'spicy-36': 'spicy',
  'spicy-37': 'spicy',
  'spicy-38': 'spicy',
  'spicy-39': 'spicy',
  'spicy-40': 'spicy',
  'spicy-41': 'spicy',
  'spicy-42': 'spicy',
  'spicy-43': 'nomercy',
  'spicy-44': 'nomercy',
  'spicy-45': 'nomercy',
  'spicy-46': 'nomercy',
  'spicy-47': 'nomercy',
  'spicy-48': 'nomercy',
  'spicy-49': 'nomercy',
  'spicy-50': 'nomercy',
  'spicy-51': 'nomercy',
  'spicy-52': 'nomercy',
  'spicy-53': 'spicy',
  'spicy-54': 'spicy',
  'spicy-55': 'nomercy',
  'spicy-56': 'nomercy',
  'spicy-57': 'nomercy',
  'spicy-58': 'spicy',
  'spicy-59': 'nomercy',
  'spicy-60': 'nomercy',
  'spicy-61': 'nomercy',
  'spicy-62': 'spicy',
};

// One real question per level, quoted in the spice sheet.
export const SPICE_EXAMPLE = { mild: 'spicy-04', spicy: 'spicy-09', nomercy: 'spicy-16' };

export const TIMER_SECONDS = 60;

export const categoryById = (id) => CATEGORIES.find((c) => c.id === id);

function passesSpice(row, spice) {
  const level = SPICE_OF[row[1]];
  return !level || SPICE_RANK[level] <= SPICE_RANK[spice];
}

// Question ids (row[1]) in play for a selection. Empty selection = the
// default full deck (CORE, i.e. everything except the opt-in decks).
export function deckIds(selected, spice) {
  const cats = selected.length ? selected : CORE;
  return QUESTIONS.filter((row) => cats.includes(row[0]) && passesSpice(row, spice)).map((row) => row[1]);
}

export function countFor(catId, spice) {
  return QUESTIONS.filter((row) => row[0] === catId && passesSpice(row, spice)).length;
}
