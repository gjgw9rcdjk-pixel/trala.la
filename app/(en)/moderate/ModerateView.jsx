'use client';

// Private feedback moderation view, rendered by ./page.jsx for the
// logged-in owner only (lib/adminAuth.js; reached from /admin).
// /api/feedback/moderate checks the same session cookie. See README "Admin".

import { useEffect, useState } from 'react';

const INK = '#e8e6e1';
const SCREEN = '#0c0c0d';
const mono = (size, weight = 500, tracking = '.08em') => ({
  font: `${weight} ${size}px var(--font-mono), monospace`,
  letterSpacing: tracking,
});

export default function ModerateView() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    fetch('/api/feedback/moderate')
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then(setItems)
      .catch(() => setError('Logged out, or the feedback backend is unavailable.'));
  }, []);

  const remove = async (id) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/feedback/moderate?id=${id}`, { method: 'DELETE' });
      if (res.ok) setItems((it) => it.filter((x) => x.id !== id));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main
      style={{
        minHeight: '100dvh',
        background: SCREEN,
        color: INK,
        padding: '30px 22px 60px',
        font: '400 14px/1.6 var(--font-mono), monospace',
      }}
    >
      <div style={{ ...mono(11, 600, '.14em'), color: 'rgba(232,230,225,.5)', marginBottom: 24 }}>
        FEEDBACK MODERATION
      </div>

      {error && <p style={{ color: 'rgba(232,230,225,.55)' }}>{error}</p>}
      {items && items.length === 0 && <p style={{ color: 'rgba(232,230,225,.4)' }}>No feedback yet.</p>}

      {items &&
        items.map((item) => (
          <div
            key={item.id}
            style={{
              padding: '16px 0',
              borderTop: '1px solid rgba(232,230,225,.14)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 16,
            }}
          >
            <div>
              <div style={{ whiteSpace: 'pre-wrap', color: 'rgba(232,230,225,.85)' }}>{item.text}</div>
              <div style={{ marginTop: 6, ...mono(10, 500, '.06em'), color: 'rgba(232,230,225,.35)' }}>
                #{item.id} · {new Date(item.ts).toLocaleString()} · ▲{item.up} ▼{item.down}
              </div>
            </div>
            <button
              onClick={() => remove(item.id)}
              disabled={busyId === item.id}
              style={{
                flex: 'none',
                padding: '8px 14px',
                borderRadius: 4,
                border: '1px solid rgba(232,230,225,.3)',
                color: 'rgba(232,230,225,.7)',
                opacity: busyId === item.id ? 0.5 : 1,
                ...mono(10, 600, '.08em'),
              }}
            >
              {busyId === item.id ? '…' : 'DELETE'}
            </button>
          </div>
        ))}
    </main>
  );
}
