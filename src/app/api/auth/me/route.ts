export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/session';
import { ensureInit } from '../../../../lib/setup';
import { User } from '../../../../models/User';

export async function GET() {
  try {
    const session = await getSession();
    if (!session.user?._id) return NextResponse.json({ ok: false }, { status: 401 });

    await ensureInit();
    const user = await User.findById(session.user._id)
      .select('username email role balance currency level levelName avatarUrl affiliateKey serial_key')
      .lean();

    if (!user) return NextResponse.json({ ok: false }, { status: 401 });

    return NextResponse.json({ ok: true, user });
  } catch (e: any) {
    console.error('GET /api/auth/me', e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
