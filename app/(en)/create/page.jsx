// Private prototype of the AI deck generator (mock data, no AI calls yet).
// Not linked from anywhere — reached only via /create?key=..., where the key
// must match CREATE_PREVIEW_KEY. Anything else gets a plain 404.

import { notFound } from 'next/navigation';
import CreateFlow from './CreateFlow';

export const metadata = {
  title: 'Create a deck · Tralala.cards',
  robots: { index: false, follow: false },
};

export default async function CreatePage({ searchParams }) {
  const { key } = await searchParams;
  const expected = process.env.CREATE_PREVIEW_KEY;
  if (!expected || key !== expected) notFound();
  return <CreateFlow />;
}
