export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getSession } from '../../../../lib/session';
import { ensureInit } from '../../../../lib/setup';
import { User } from '../../../../models/User';
import { OtpToken } from '../../../../models/OtpToken';

function makeTokenDigest(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

export async function POST(request) {
  try {
    await ensureInit();

    const { token, password } = await request.json();
    if (!token || !password)
      return NextResponse.json({ ok: false, message: 'ข้อมูลไม่ครบ' }, { status: 400 });

    if (String(password).length < 6)
      return NextResponse.json({ ok: false, message: 'รหัสสั้นเกินไป โปรดใส่มากกว่า 6 ตัว' }, { status: 400 });

    const tokenDigest = makeTokenDigest(token);

    // Try fast path: tokenDigest lookup
    let doc = await OtpToken.findOne({ purpose: 'password-reset-link', tokenDigest, usedAt: null }).sort({ createdAt: -1 });

    // Fallback: bcrypt compare for older tokens
    if (!doc) {
      const candidates = await OtpToken.find({ purpose: 'password-reset-link', usedAt: null, expiresAt: { $gt: new Date() } })
        .sort({ createdAt: -1 }).limit(25);
      for (const item of candidates) {
        if (await bcrypt.compare(token, item.codeHash)) { doc = item; break; }
      }
    }

    if (!doc) return NextResponse.json({ ok: false, message: 'ลิงก์หมดอายุหรือถูกใช้ไปแล้ว' }, { status: 400 });
    if (doc.expiresAt.getTime() < Date.now()) return NextResponse.json({ ok: false, message: 'ลิงก์หมดอายุแล้ว' }, { status: 400 });

    // Mark used
    doc.usedAt = new Date();
    await doc.save();

    const u = await User.findOne({ email: doc.email });
    if (!u) return NextResponse.json({ ok: false, message: 'ไม่พบบัญชี' }, { status: 404 });

    await u.setPassword(password);
    await u.save();

    // Auto-login
    const session = await getSession();
    session.user = {
      _id: String(u._id),
      username: u.username,
      email: u.email || '',
      role: u.role || 'user',
      balance: u.balance || 0,
      currency: u.currency || 'THB',
      level: u.level || '1',
      levelName: u.levelName || 'เลเวล 1',
      avatarUrl: u.avatarUrl || '',
      affiliateKey: u.affiliateKey || '',
      serial_key: u.serial_key || '',
    };
    await session.save();

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('POST /api/password/reset', e);
    return NextResponse.json({ ok: false, message: 'รีเซ็ตรหัสผ่านไม่สำเร็จ' }, { status: 500 });
  }
}
