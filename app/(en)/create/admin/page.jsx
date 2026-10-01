// Owner-only page for promo codes: make a code (note + number of decks),
// copy it or a ready link, see how much each code has been used, switch one
// off. Reached only via /create/admin?key=... (CREATE_PREVIEW_KEY).

import { notFound } from 'next/navigation';
import AdminCodes from './AdminCodes';

export const metadata = {
  title: 'Codes · Tralala.cards',
  robots: { index: false, follow: false },
};

export default async function AdminPage({ searchParams }) {
  const { key } = await searchParams;
  const expected = process.env.CREATE_PREVIEW_KEY;
  if (!expected || key !== expected) notFound();
  return <AdminCodes />;
}
