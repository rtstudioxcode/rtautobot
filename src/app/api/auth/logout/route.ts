export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/session';

export async function POST() {
  try {
    const session = await getSession();
    await session.destroy();
    return NextResponse.json({ ok: true, redirect: '/login' });
  } catch (e: any) {
    console.error('POST /api/auth/logout', e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
