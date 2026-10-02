// Feedback moderation. Owner only (lib/adminAuth.js); everyone else gets a 404.

import { notFound } from 'next/navigation';
import { isAdmin } from '@/lib/adminAuth';
import ModerateView from './ModerateView';

export const metadata = {
  title: 'Moderate · Tralala.cards',
  robots: { index: false, follow: false },
};

export default async function ModeratePage() {
  if (!(await isAdmin())) notFound();
  return <ModerateView />;
}
