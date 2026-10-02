// Private analytics. Owner only (lib/adminAuth.js); everyone else gets a 404.

import { notFound } from 'next/navigation';
import { isAdmin } from '@/lib/adminAuth';
import InsightsDashboard from './InsightsDashboard';

export const metadata = {
  title: 'Insights · Tralala.cards',
  robots: { index: false, follow: false },
};

export default async function InsightsPage() {
  if (!(await isAdmin())) notFound();
  return <InsightsDashboard />;
}
