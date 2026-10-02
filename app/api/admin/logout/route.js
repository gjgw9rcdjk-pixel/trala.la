// Ends the owner session (form on /admin) and goes back to the game.

import { NextResponse } from 'next/server';
import { logOut } from '@/lib/adminAuth';

export async function POST(request) {
  await logOut();
  return NextResponse.redirect(new URL('/', request.url), 303);
}
