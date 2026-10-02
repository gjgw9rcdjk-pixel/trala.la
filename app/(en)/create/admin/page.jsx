// Owner-only page for promo codes: make a code (note + number of decks),
// copy it or a ready link, see how much each code has been used, switch one
// off. Owner only (lib/adminAuth.js; reached from /admin).

import { notFound } from 'next/navigation';
import { isAdmin } from '@/lib/adminAuth';
import AdminCodes from './AdminCodes';

export const metadata = {
  title: 'Codes · Tralala.cards',
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  if (!(await isAdmin())) notFound();
  return <AdminCodes />;
}
