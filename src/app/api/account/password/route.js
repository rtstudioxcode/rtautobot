export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSession } from '../../../../lib/session.js';
import { ensureInit } from '../../../../lib/setup.js';
import { User } from '../../../../models/User.js';

export async function POST(request) {
  try {
    const session = await getSession();
    if (!session.user?._id) return NextResponse.json({ ok: false, error: 'คุณไม่ได้รับอนุญาต' }, { status: 401 });

    await ensureInit();

    const { currentPassword, newPassword } = await request.json();

    if (!newPassword || String(newPassword).length < 8)
      return NextResponse.json({ ok: false, error: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัว' }, { status: 400 });

    const u = await User.findById(session.user._id);
    if (!u) return NextResponse.json({ ok: false, error: 'ไม่พบข้อมูลผู้ใช้' }, { status: 404 });

    const ok = await bcrypt.compare(String(currentPassword || ''), u.passwordHash);
    if (!ok) return NextResponse.json({ ok: false, error: 'รหัสผ่านเดิมไม่ถูกต้อง' }, { status: 400 });

    const same = await bcrypt.compare(String(newPassword), u.passwordHash);
    if (same) return NextResponse.json({ ok: false, error: 'รหัสผ่านใหม่ซ้ำกับรหัสเดิม' }, { status: 400 });

    await u.setPassword(String(newPassword));
    await u.save();

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('POST /api/account/password', e);
    return NextResponse.json({ ok: false, error: 'เปลี่ยนรหัสผ่านไม่สำเร็จ' }, { status: 500 });
  }
}
