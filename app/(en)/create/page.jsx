// AI deck generator. Opened from the "Make your own cards" tile in the game.
// Players unlock it with a promo code (made on /create/admin). The owner's
// link, /create?key=... with CREATE_PREVIEW_KEY, also shows the prototype
// switches (mock data, model choice, cost per call) and needs no code.

import CreateFlow from './CreateFlow';

export const metadata = {
  title: 'Create a deck · Tralala.cards',
  robots: { index: false, follow: false },
};

export default async function CreatePage({ searchParams }) {
  const { key, ui } = await searchParams;
  const expected = process.env.CREATE_PREVIEW_KEY;
  const admin = Boolean(expected) && key === expected;
  return <CreateFlow admin={admin} initialUi={ui === 'lt' ? 'lt' : 'en'} />;
}
