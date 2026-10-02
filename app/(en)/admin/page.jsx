// Owner hub. /admin?key=ADMIN_KEY asks for ADMIN_CODE; once logged in, /admin
// lists the private pages. Everyone else gets a plain 404. See lib/adminAuth.js.

import { notFound } from 'next/navigation';
import { isAdmin, isAdminKey } from '@/lib/adminAuth';
import AdminLogin from './AdminLogin';

export const metadata = {
  title: 'Admin · Tralala.cards',
  robots: { index: false, follow: false },
};

const INK = '#e8e6e1';
const MUTED = 'rgba(232,230,225,.5)';
const mono = (size, weight = 500, tracking = '.08em') => ({
  font: `${weight} ${size}px var(--font-mono), monospace`,
  letterSpacing: tracking,
});

const PAGES = [
  { href: '/insights', title: 'Statistika', note: 'Kiek žaidžia, kurios kortelės patinka' },
  { href: '/moderate', title: 'Atsiliepimai', note: 'Peržiūrėti ir ištrinti' },
  { href: '/create/admin', title: 'Promo kodai', note: 'Kurti, sekti, išjungti' },
  { href: '/create', title: 'Kaladžių generatorius', note: 'Savininko režimas' },
];

export default async function AdminPage({ searchParams }) {
  const admin = await isAdmin();
  if (!admin) {
    const { key } = await searchParams;
    if (!isAdminKey(key)) notFound();
  }
  return (
    <main style={{ minHeight: '100dvh', background: '#0c0c0d', color: INK, padding: '30px 22px 60px', font: '400 14px/1.6 var(--font-mono), monospace' }}>
      <div style={{ maxWidth: 420, margin: '0 auto' }}>
        <div style={{ ...mono(11, 600, '.14em'), color: MUTED, marginBottom: 24 }}>TRALALA ADMIN</div>
        {admin ? (
          <>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {PAGES.map((p) => (
                <a key={p.href} href={p.href} style={{ display: 'block', padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(232,230,225,.14)', color: INK, textDecoration: 'none' }}>
                  <div style={mono(14, 700, '.02em')}>{p.title}</div>
                  <div style={{ color: MUTED, fontSize: 12 }}>{p.note}</div>
                </a>
              ))}
            </nav>
            <form method="post" action="/api/admin/logout" style={{ marginTop: 28 }}>
              <button type="submit" style={{ ...mono(12, 600), background: 'none', border: 0, color: MUTED, padding: 0, cursor: 'pointer', textDecoration: 'underline' }}>
                Atsijungti
              </button>
            </form>
          </>
        ) : (
          <AdminLogin />
        )}
      </div>
    </main>
  );
}
