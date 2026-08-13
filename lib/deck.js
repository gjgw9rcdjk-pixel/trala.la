export function shuffle(arr) {
  const r = arr.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

export function buildOrder(questions, selectedIds) {
  return shuffle(
    questions.map((_, i) => i).filter((i) => selectedIds.includes(questions[i][0]))
  );
}
