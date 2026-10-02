// AI deck generator. Opened from the "Make your own cards" tile in the game.
// Players unlock it with a promo code (made on /create/admin). The logged-in
// owner (lib/adminAuth.js) also gets the prototype switches (mock data, model
// choice, cost per call) and needs no code.

import { isAdmin } from '@/lib/adminAuth';
import CreateFlow from './CreateFlow';

export const metadata = {
  title: 'Create a deck · Tralala.cards',
  robots: { index: false, follow: false },
};

export default async function CreatePage({ searchParams }) {
  const { ui } = await searchParams;
  const admin = await isAdmin();
  return <CreateFlow admin={admin} initialUi={ui === 'lt' ? 'lt' : 'en'} />;
}
