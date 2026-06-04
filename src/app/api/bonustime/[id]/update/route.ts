export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getSession } from '../../../../../lib/session';
import { ensureInit } from '../../../../../lib/setup';
import { User } from '../../../../../models/User';
import { BonustimeUser } from '../../../../../models/BonustimeUser';

function sameSerial(a, b) {
  return String(a || '').trim() && String(a || '').trim() === String(b || '').trim();
}

export async function POST(request, { params }) {
  try {
    const session = await getSession();
    if (!session.user?._id) return NextResponse.json({ ok: false }, { status: 401 });

    await ensureInit();

    const { id } = await params;
    const doc = await BonustimeUser.findById(id);
    if (!doc) return NextResponse.json({ ok: false, message: 'ไม่พบข้อมูล Bonustime' }, { status: 404 });

    if (session.user.role !== 'admin') {
      const user = await User.findById(session.user._id).select('serial_key');
      if (!user?.serial_key) return NextResponse.json({ ok: false, message: 'กรุณาลงทะเบียน Serial Key ก่อนใช้งาน' }, { status: 403 });
      if (!sameSerial(doc.serial_key, user.serial_key)) return NextResponse.json({ ok: false, message: 'คุณไม่มีสิทธิ์จัดการ Service นี้' }, { status: 403 });
    }

    const body = await request.json();
    const fields = ['NAME', 'CHANNEL_ACCESS_TOKEN', 'CHANNEL_SECRET', 'LOGO', 'LOGIN_URL', 'SIGNUP_URL', 'LINE_ADMIN'];
    for (const f of fields) {
      if (body[f] !== undefined) doc[f] = body[f];
    }

    await doc.save();
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('POST /api/bonustime/[id]/update', e);
    return NextResponse.json({ ok: false, message: 'เกิดข้อผิดพลาดระหว่างอัปเดตข้อมูล' }, { status: 500 });
  }
}
