// Shared KV helpers for the feedback board, used by app/api/feedback/route.js,
// app/api/feedback/export/route.js, and app/api/feedback/moderate/route.js so
// the "list every item" logic lives in one place instead of three copies.

import { kv } from '@vercel/kv';

// Reads every feedback item (or the first `limit`, newest first) and shapes
// each into { id, text, ts, up, down, type?, deck? }, dropping any that no longer exist
// (e.g. deleted between the id list read and the hash read).
export async function listFeedback(limit = null) {
  const end = limit == null ? -1 : limit - 1;
  const ids = await kv.lrange('tralala:feedback:ids', 0, end);
  const items = await Promise.all(
    (ids || []).map(async (id) => {
      const item = await kv.hgetall(`tralala:feedback:item:${id}`);
      if (!item || !item.text) return null;
      return {
        id: Number(id),
        text: item.text,
        ts: Number(item.ts) || 0,
        up: Number(item.up) || 0,
        down: Number(item.down) || 0,
        ...(item.type ? { type: item.type } : {}),
        ...(item.deck ? { deck: item.deck } : {}),
      };
    })
  );
  return items.filter(Boolean);
}

// Removes an item's id from the ordered list and its hash. A device's own
// vote record (tralala:feedback-voter:<device>) is left in place — it's
// harmless once the item it pointed at is gone.
export async function deleteFeedback(id) {
  await Promise.all([
    kv.lrem('tralala:feedback:ids', 0, String(id)),
    kv.del(`tralala:feedback:item:${id}`),
  ]);
}

