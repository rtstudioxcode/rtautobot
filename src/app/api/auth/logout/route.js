import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/session.js';

export async function POST() {
  try {
    const session = await getSession();
    await session.destroy();
    return NextResponse.json({ ok: true, redirect: '/login' });
  } catch (e) {
    console.error('POST /api/auth/logout', e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
