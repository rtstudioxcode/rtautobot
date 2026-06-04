export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/session';
import { ensureInit } from '../../../../lib/setup';
import { User } from '../../../../models/User';
import { BonustimeUser } from '../../../../models/BonustimeUser';

export async function GET(request, { params }) {
  try {
    const session = await getSession();
    if (!session.user?._id) return NextResponse.json({ ok: false }, { status: 401 });

    await ensureInit();

    const { id } = await params;
    const doc = await BonustimeUser.findById(id).lean();
    if (!doc) return NextResponse.json({ ok: false, message: 'ไม่พบข้อมูล' }, { status: 404 });

    if (session.user.role !== 'admin') {
      const user = await User.findById(session.user._id).select('serial_key');
      const serial = String(user?.serial_key || '').trim();
      if (!serial || serial !== String(doc.serial_key || '').trim())
        return NextResponse.json({ ok: false }, { status: 403 });
    }

    return NextResponse.json({ ok: true, record: doc });
  } catch (e: any) {
    console.error('GET /api/bonustime/[id]', e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
