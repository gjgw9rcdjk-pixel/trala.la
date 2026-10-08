// Returning visitors land in the language they used last. Game writes the
// tl_lang cookie whenever a language page opens or the language is switched;
// a bare visit to / (English) with another language saved goes there instead.
// First-time visitors and crawlers have no cookie and stay on English.

import { NextResponse } from 'next/server';

// Mirrors PATH_BY_LANG in lib/seo.js (not imported: it pulls in all the
// landing copy, which middleware doesn't need).
const PATH = { lt: '/lt', de: '/de', es: '/es', it: '/it', pl: '/pl' };

export function middleware(req) {
  const path = PATH[req.cookies.get('tl_lang')?.value];
  if (!path) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = path;
  return NextResponse.redirect(url);
}

export const config = { matcher: '/' };
