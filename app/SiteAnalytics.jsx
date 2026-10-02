'use client';

// Vercel Analytics with private keys stripped from the recorded URL.
// /admin is opened with ?key=..., and shared /create links carry a promo
// ?code=...; neither should end up in the
// analytics dashboard. beforeSend is a
// function, so this has to be a client component (RootShell is a server one).

import { Analytics } from '@vercel/analytics/react';

function stripSecrets(event) {
  try {
    const url = new URL(event.url);
    if (!url.searchParams.has('key') && !url.searchParams.has('code')) return event;
    url.searchParams.delete('key');
    url.searchParams.delete('code');
    return { ...event, url: url.toString() };
  } catch {
    return event;
  }
}

export default function SiteAnalytics() {
  return <Analytics beforeSend={stripSecrets} />;
}
