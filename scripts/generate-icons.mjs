// Generates the app icons and the Open Graph image in the "game night" style
// (design handoff 13d / 14d·14). Run: node scripts/generate-icons.mjs
import { ImageResponse } from 'next/og.js';
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QUESTIONS, QUESTION_BY_ID } from '../lib/content.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const archivo = await readFile(join(__dirname, 'assets/Archivo-ExtraBold.ttf'));
const archivoItalic = await readFile(join(__dirname, 'assets/Archivo-ExtraBoldItalic.ttf'));
const jakarta = await readFile(join(__dirname, 'assets/PlusJakartaSans-ExtraBold.ttf'));

const GROUND = '#101014';
const CARD = '#FFFDF8';
const INK = '#131318';
const PINK = '#FF4E7D';
const PINK_ON_CARD = '#C22050';
const YELLOW = '#FFC93C';
const BLUE = '#3FA9FF';
const ACTION = '#E01B52';

const fonts = [
  { name: 'Archivo', data: archivo, weight: 800, style: 'normal' },
  { name: 'Archivo', data: archivoItalic, weight: 800, style: 'italic' },
  { name: 'Jakarta', data: jakarta, weight: 800, style: 'normal' },
];

async function renderPng(node, width, height, outPath) {
  const res = new ImageResponse(node, { width, height, fonts });
  const buf = Buffer.from(await res.arrayBuffer());
  if (outPath) {
    await writeFile(outPath, buf);
    console.log('wrote', outPath, `${width}x${height}`);
  }
  return buf;
}

// favicon.ico for crawlers and browsers that ask for /favicon.ico directly
// (Google search results among them). ICO files can hold PNGs as-is.
async function writeIco(pngs, outPath) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = 6 + 16 * pngs.length;
  const entries = pngs.map(({ size, buf }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(buf.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += buf.length;
    return e;
  });
  await writeFile(outPath, Buffer.concat([header, ...entries, ...pngs.map((p) => p.buf)]));
  console.log('wrote', outPath, pngs.map((p) => p.size).join('+'));
}

const el = (type, style, children) => ({ type, props: { style: { display: 'flex', ...style }, children } });

const dots = (size, gap) => ({
  backgroundColor: GROUND,
  backgroundImage: `radial-gradient(circle, rgba(255,255,255,.08) ${size}px, transparent ${size}px)`,
  backgroundSize: `${gap}px ${gap}px`,
});

// Neon flamingo (same drawing as NeonFlamingo in app/game/parts.jsx; keep
// the paths in sync). `w` is the tube width in viewBox units: thicker for
// small icons so the lines stay visible. Returned as an SVG data URI so the
// blur filter (the neon glow) is rendered by resvg.
function flamingoSrc(w) {
  const tube = `
    <circle cx="40" cy="18" r="5"/>
    <path d="M35.5 19.5 Q28 19 26 25 Q25.5 29.5 28.5 30.5"/>
    <path d="M44.5 20 C51 25.5 51 34 45 40 C38.5 46.5 38.5 54 46 58.5"/>
    <path d="M44.5 60 C44.5 50 64 50 74 56 C80 59.5 83 62 89 60 C85 66.5 80.5 70 72 72 C60 76 44.5 72 44.5 60 Z"/>
    <path d="M52 60.5 Q62 57.5 72 64 Q63 69.5 54 66"/>`;
  const leg = 'M60 74 L60 118 L53 120';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="14 2 88 128">
    <defs><filter id="g" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${w * 0.9}"/></filter></defs>
    <g fill="none" stroke-linecap="round" stroke-linejoin="round">
      <g stroke="${PINK}" stroke-width="${w * 2.2}" opacity=".75" filter="url(#g)">${tube}<path d="${leg}" stroke-width="${w * 1.4}"/></g>
      <g stroke="${PINK}" stroke-width="${w}">${tube}<path d="${leg}" stroke-width="${w * 0.62}"/></g>
      <g stroke="#FFE3EC" stroke-width="${w / 3}">${tube}<path d="${leg}" stroke-width="${w / 5}"/></g>
    </g>
    <circle cx="41.5" cy="16.8" r="${Math.max(1.2, w / 3.5)}" fill="#FFE3EC"/>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

// Card stack icon. Detail drops with size (design 14d·14): three cards at
// large sizes, two around 180, one at favicon size. Geometry is taken from
// the 256px mock and scaled.
// `zoom` enlarges the whole stack so the flamingo reads bigger on home
// screens and browser tabs; `cx`/`cy` is the stack's visual centre in the
// 256px mock (back cards + pink offset included), moved to the icon centre.
function stackIcon(size, cards) {
  const [zoom, cx, cy] = cards === 1 ? [1.45, 138, 134] : [1.35, 127, 128];
  const k = (size / 256) * zoom;
  const at = (v, c) => (128 + (v - c) * zoom) * (size / 256);
  const cw = 124 * k;
  const ch = 150 * k;
  const r = 24 * k;
  const card = (left, top, bg, rot, extra = {}, children) =>
    el('div', { position: 'absolute', left: at(left, cx), top: at(top, cy), width: cw, height: ch, borderRadius: r, background: bg, ...(rot ? { transform: `rotate(${rot}deg)` } : {}), ...extra }, children);
  const layers = [];
  if (cards >= 3) layers.push(card(64, 48, BLUE, -14));
  if (cards >= 2) layers.push(card(66, 50, YELLOW, -6));
  // Front card: dark, with the neon flamingo; tube gets thicker as the icon shrinks.
  const tubeW = size >= 400 ? 4.5 : size >= 150 ? 6 : 8.5;
  layers.push(
    card(70, 52, INK, 0, {
      boxShadow: `${12 * k}px ${14 * k}px 0 0 ${PINK}`,
      border: `${Math.max(1, 2 * k)}px solid rgba(255,255,255,.16)`,
      alignItems: 'center',
      justifyContent: 'center',
    }, { type: 'img', props: { src: flamingoSrc(tubeW), width: cw * 0.86, height: ch * 0.86 } })
  );
  return el('div', { width: '100%', height: '100%', position: 'relative', ...(size >= 128 ? dots(2 * size / 256, 22 * size / 256) : { background: GROUND }) }, layers);
}

// Maskable (Android adaptive) icon: the neon flamingo on the dark ground,
// kept well inside the 80% safe zone so any mask shape leaves it whole.
function maskableIcon(size) {
  return el('div', { width: '100%', height: '100%', background: INK, alignItems: 'center', justifyContent: 'center' },
    { type: 'img', props: { src: flamingoSrc(5), width: size * 0.56, height: size * 0.56 * (128 / 88) * 0.8 } });
}

// Open Graph 1200×630 (design 13d): a real question card on the dot ground,
// with the wordmark, a one-line pitch and a "play free" button beside it.
function ogImage() {
  const q = QUESTION_BY_ID.get('union-02');
  return el('div', { width: '100%', height: '100%', padding: 68, gap: 52, alignItems: 'center', ...dots(2.6, 30) }, [
    el('div', { flex: 1, height: '100%', flexDirection: 'column', background: CARD, borderRadius: 36, padding: '52px 48px' }, [
      el('div', { fontFamily: 'Jakarta', fontSize: 20, letterSpacing: 3.2, color: PINK_ON_CARD }, 'THE APPLIANCE UNION'),
      el('div', { marginTop: 28, fontFamily: 'Archivo', fontSize: 54, lineHeight: 1.14, letterSpacing: -1.6, color: INK }, q[2].en),
    ]),
    el('div', { width: 372, flexDirection: 'column', gap: 28 }, [
      el('div', { fontFamily: 'Archivo', fontStyle: 'italic', fontSize: 60, letterSpacing: -1.2, color: PINK }, 'Tralala.cards'),
      el('div', { fontFamily: 'Jakarta', fontSize: 26, lineHeight: 1.45, color: 'rgba(255,255,255,.7)' },
        `One phone. Everyone talks. ${QUESTIONS.length} conversation questions.`),
      el('div', { alignSelf: 'flex-start', padding: '20px 32px', borderRadius: 24, background: ACTION, fontFamily: 'Jakarta', fontSize: 22, letterSpacing: 1.8, color: '#fff' }, 'PLAY FREE'),
    ]),
  ]);
}

await renderPng(stackIcon(512, 3), 512, 512, join(root, 'public/icon-512.png'));
await renderPng(stackIcon(192, 2), 192, 192, join(root, 'public/icon-192.png'));
await renderPng(maskableIcon(512), 512, 512, join(root, 'public/icon-maskable-512.png'));
const icon96 = await renderPng(stackIcon(96, 1), 96, 96, join(root, 'app/icon.png'));
const icon48 = await renderPng(stackIcon(48, 1), 48, 48);
await writeIco([{ size: 48, buf: icon48 }, { size: 96, buf: icon96 }], join(root, 'app/favicon.ico'));
await renderPng(stackIcon(180, 2), 180, 180, join(root, 'app/apple-icon.png'));
await renderPng(ogImage(), 1200, 630, join(root, 'app/opengraph-image.png'));

console.log('done');
