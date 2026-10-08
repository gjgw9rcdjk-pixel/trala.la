export function shuffle(arr) {
  const r = arr.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

// Shuffles, then spreads groups apart: the same group never comes twice in a
// row, and where there are enough other groups left, not within 2 cards
// either. `groupOf` maps an item to its group (e.g. its category).
export function spreadShuffle(arr, groupOf) {
  const groups = new Map();
  for (const item of shuffle(arr)) {
    const g = groupOf(item);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(item);
  }
  const out = [];
  const recent = [];
  let left = arr.length;
  while (left > 0) {
    const live = [...groups].filter(([, items]) => items.length);
    // If one group holds more than half of what's left, it must go now or it
    // will end up bunched together at the end.
    const [bigG, bigItems] = live.reduce((a, b) => (b[1].length > a[1].length ? b : a));
    let pool;
    if (bigItems.length * 2 > left && bigG !== recent[recent.length - 1]) {
      pool = [[bigG, bigItems]];
    } else {
      pool = live.filter(([g]) => !recent.includes(g));
      if (!pool.length) pool = live.filter(([g]) => g !== recent[recent.length - 1]);
      if (!pool.length) pool = live;
    }
    // Weighted by how many cards each group still has, so big groups
    // don't pile up at the end.
    let r = Math.random() * pool.reduce((n, [, items]) => n + items.length, 0);
    let pick = pool[pool.length - 1];
    for (const p of pool) {
      r -= p[1].length;
      if (r < 0) { pick = p; break; }
    }
    out.push(pick[1].pop());
    recent.push(pick[0]);
    if (recent.length > 2) recent.shift();
    left -= 1;
  }
  return out;
}
