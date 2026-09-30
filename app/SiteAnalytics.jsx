'use client';

// Vercel Analytics with private keys stripped from the recorded URL.
// /create, /insights and /moderate are opened with ?key=..., and that
// secret shouldn't end up in the analytics dashboard. beforeSend is a
// function, so this has to be a client component (RootShell is a server one).

import { Analytics } from '@vercel/analytics/react';

function stripKey(event) {
  try {
    const url = new URL(event.url);
    if (!url.searchParams.has('key')) return event;
    url.searchParams.delete('key');
    return { ...event, url: url.toString() };
  } catch {
    return event;
  }
}

export default function SiteAnalytics() {
  return <Analytics beforeSend={stripKey} />;
}
