'use client';

// Code form for /admin. Sends the ?key= from the URL with the typed code;
// on success reloads /admin without the key, which then shows the menu.

import { useState } from 'react';

const INK = '#e8e6e1';

export default function AdminLogin() {
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      const key = new URLSearchParams(window.location.search).get('key') || '';
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        window.location.replace('/admin');
        return;
      }
      setCode('');
      if (data.error === 'wrong_code') setMsg(`Neteisingas kodas. Liko bandymų: ${data.left}.`);
      else if (data.error === 'locked') setMsg('Per daug bandymų. Bandykite po 24 valandų.');
      else setMsg('Nepavyko prisijungti.');
    } catch {
      setMsg('Nepavyko prisijungti.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <label htmlFor="admin-code" style={{ color: 'rgba(232,230,225,.6)', fontSize: 13 }}>Kodas</label>
      <input
        id="admin-code"
        type="password"
        autoComplete="current-password"
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value)}
        style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(232,230,225,.2)', background: '#16161a', color: INK, font: 'inherit', fontSize: 16 }}
      />
      <button
        type="submit"
        disabled={busy || !code}
        style={{ padding: '12px 14px', borderRadius: 10, border: 0, background: '#E01B52', color: '#fff', font: '700 14px var(--font-mono), monospace', letterSpacing: '.06em', opacity: busy || !code ? 0.5 : 1, cursor: 'pointer' }}
      >
        PRISIJUNGTI
      </button>
      {msg && <p style={{ margin: 0, color: 'rgba(232,230,225,.7)' }} role="alert">{msg}</p>}
    </form>
  );
}
