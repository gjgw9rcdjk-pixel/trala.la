// Renders a question card to a PNG on a <canvas>, client-side (design 13d).
// Exported cards match the in-game card: tilted −1.4° with the pink offset
// shadow, with enough margin that nothing is clipped. One brand line
// ("Tralala.cards") and no deck label, so the question stands on its own.
// The neon flamingo from the home screen stands behind the card, only its
// head and neck peeking over the top edge.

export const SURFACES = {
  cream: { bg: '#FFFDF8', ink: '#131318', label: '#C22050', muted: '#8A8578' },
  sand: { bg: '#EFEBE2', ink: '#131318', label: '#C22050', muted: '#8A8578' },
  ink: { bg: '#131318', ink: '#FFFDF8', label: '#FF4E7D', muted: 'rgba(255,255,255,.5)', border: 'rgba(255,255,255,.25)' },
};

export const FORMATS = {
  square: { w: 1080, h: 1080 },
  story: { w: 1080, h: 1920 },
};

// next/font gives each font a generated family name; read it from the CSS
// variables set on <html> in app/layout.jsx.
function family(varName, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return v || fallback;
}

// Questions may mark a word as *word*; the marks are never drawn.
const plain = (t) => t.replace(/\*/g, '');

function wrap(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(plain(test)).width <= maxWidth || !line) line = test;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Largest font size (stepping down) whose wrapped lines fit the box.
function fitText(ctx, text, font, maxWidth, maxHeight, start, min, lineHeight) {
  for (let size = start; size >= min; size -= 2) {
    ctx.font = font(size);
    const lines = wrap(ctx, text, maxWidth);
    if (lines.length * size * lineHeight <= maxHeight) return { size, lines };
  }
  ctx.font = font(min);
  return { size: min, lines: wrap(ctx, text, maxWidth) };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function dotGround(ctx, w, h) {
  ctx.fillStyle = '#101014';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,.075)';
  for (let y = 22.5; y < h; y += 45) {
    for (let x = 22.5; x < w; x += 45) {
      ctx.beginPath();
      ctx.arc(x, y, 3.9, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// The home screen's neon flamingo (NeonFlamingo in app/game/parts.jsx), in
// its 76×116 viewBox units starting at (20, 8).
const FLAMINGO = [
  'M45 18 A5 5 0 1 1 35 18 A5 5 0 1 1 45 18 Z',
  'M35.5 19.5 Q28 19 26 25 Q25.5 29.5 28.5 30.5',
  'M44.5 20 C51 25.5 51 34 45 40 C38.5 46.5 38.5 54 46 58.5',
  'M44.5 60 C44.5 50 64 50 74 56 C80 59.5 83 62 89 60 C85 66.5 80.5 70 72 72 C60 76 44.5 72 44.5 60 Z',
  'M52 60.5 Q62 57.5 72 64 Q63 69.5 54 66',
];
const FLAMINGO_LEG = 'M60 74 L60 118 L53 120';

// Pink glow tube with a light core, like the CSS version. (x, y) is the top
// left of the viewBox, s the pixels per unit.
function neonFlamingo(ctx, x, y, s) {
  const paths = FLAMINGO.map((d) => new Path2D(d));
  const leg = new Path2D(FLAMINGO_LEG);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.translate(-20, -8);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const tube = (width, legWidth, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    paths.forEach((p) => ctx.stroke(p));
    ctx.lineWidth = legWidth;
    ctx.stroke(leg);
  };
  ctx.shadowColor = 'rgba(255,78,125,.9)';
  ctx.shadowBlur = 8 * s;
  tube(4.5, 2.8, '#FF4E7D');
  ctx.shadowColor = 'rgba(255,78,125,.55)';
  ctx.shadowBlur = 22 * s;
  tube(4.5, 2.8, '#FF4E7D');
  ctx.shadowBlur = 0;
  tube(1.5, 0.9, '#FFE3EC');
  ctx.fillStyle = '#FFE3EC';
  ctx.beginPath();
  ctx.arc(41.5, 16.8, 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// How far above the card's top edge the flamingo's box starts, and where
// it stands across, for a given scale: the card hides everything below the
// neck.
const FLAMINGO_SCALE = 3.3;
const FLAMINGO_RISE = 138;
const FLAMINGO_X = 650;

function spaced(ctx, px) {
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`;
}

export async function renderCard({ text, format = 'square', surface = 'cream' }) {
  const display = family('--font-archivo', 'Archivo');
  const body = family('--font-jakarta', 'Plus Jakarta Sans');
  // Passing the text makes the browser fetch every font file it needs:
  // next/font splits Latin and Latin Extended (ą, ł, ß, ñ…) into separate
  // files, and a canvas silently falls back to a system font for any
  // glyph whose file hasn't loaded yet.
  await Promise.all([
    document.fonts.load(`800 60px ${display}`, plain(text)),
    document.fonts.load(`italic 800 60px ${display}`, 'Tralala.cards'),
    document.fonts.load(`800 30px ${body}`, plain(text)),
  ]).catch(() => {});

  const { w, h } = FORMATS[format];
  const sf = SURFACES[surface];
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  dotGround(ctx, w, h);

  const qFont = (size) => `800 ${size}px ${display}`;
  const OFFSET = 42;
  // Card with the in-game pink offset shadow (never rotated, so it crops cleanly).
  const drawCard = (x, y, cw, ch) => {
    roundRect(ctx, x + OFFSET, y + OFFSET, cw, ch, 54);
    ctx.fillStyle = 'rgba(255,78,125,.92)';
    ctx.fill();
    roundRect(ctx, x, y, cw, ch, 54);
    ctx.fillStyle = sf.bg;
    ctx.fill();
    if (sf.border) {
      ctx.strokeStyle = sf.border;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  };
  const drawLines = (lines, size, x, y) => {
    ctx.font = qFont(size);
    spaced(ctx, -size * 0.03);
    ctx.fillStyle = sf.ink;
    ctx.textBaseline = 'top';
    // Draw piece by piece so a *marked* word comes out in the label pink.
    let marked = false;
    lines.forEach((ln, i) => {
      let px = x;
      ln.split(/(\*)/).forEach((piece) => {
        if (piece === '*') { marked = !marked; return; }
        ctx.fillStyle = marked ? sf.label : sf.ink;
        ctx.fillText(piece, px, y + i * size * 1.14);
        px += ctx.measureText(piece).width;
      });
    });
    spaced(ctx, 0);
  };
  // One brand mention: the wordmark doubles as the address.
  const WORDMARK = 48;
  const drawWordmark = (x, baseline) => {
    ctx.textBaseline = 'alphabetic';
    ctx.font = `italic 800 ${WORDMARK}px ${display}`;
    spaced(ctx, -1);
    ctx.fillStyle = sf.label;
    ctx.fillText('Tralala.cards', x, baseline);
    spaced(ctx, 0);
  };

  // Same −1.4° tilt as the question card in the app, around the card's centre.
  const tilt = (x, y, cw, ch) => {
    const cx = x + cw / 2;
    const cy = y + ch / 2;
    ctx.translate(cx, cy);
    ctx.rotate((-1.4 * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  };

  const INNER = 78;
  ctx.save();
  if (format === 'square') {
    // Shorter than wide, set low, so the flamingo has room above it.
    const cw = w - 90 * 2 - OFFSET;
    const ch = 740;
    const cx = (w - cw - OFFSET) / 2;
    const cy = 250;
    neonFlamingo(ctx, FLAMINGO_X, cy - FLAMINGO_RISE, FLAMINGO_SCALE);
    tilt(cx, cy, cw, ch);
    drawCard(cx, cy, cw, ch);
    const ix = cx + INNER;
    const iw = cw - INNER * 2;
    const top = cy + INNER;
    const footTop = cy + ch - INNER - WORDMARK;
    const room = footTop - top - 40;
    const { size, lines } = fitText(ctx, text, qFont, iw, room, 88, 52, 1.14);
    const qh = lines.length * size * 1.14;
    drawLines(lines, size, ix, top + Math.max(0, (room - qh) / 2));
    drawWordmark(ix, cy + ch - INNER);
  } else {
    const cw = w - 90 * 2 - OFFSET;
    const ix = 90 + INNER;
    const iw = cw - INNER * 2;
    const { size, lines } = fitText(ctx, text, qFont, iw, 1000, 92, 56, 1.14);
    const qh = lines.length * size * 1.14;
    const ch = INNER + qh + 84 + WORDMARK + INNER;
    // Centred with the peeking flamingo counted in, so the pair sits mid-frame.
    const cy = (h - ch - OFFSET + FLAMINGO_RISE) / 2;
    neonFlamingo(ctx, FLAMINGO_X, cy - FLAMINGO_RISE, FLAMINGO_SCALE);
    tilt(90, cy, cw, ch);
    drawCard(90, cy, cw, ch);
    drawLines(lines, size, ix, cy + INNER);
    drawWordmark(ix, cy + ch - INNER);
  }
  ctx.restore();

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
