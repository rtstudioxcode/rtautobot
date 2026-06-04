export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/session';
import { ensureInit } from '../../../../lib/setup';
import { User } from '../../../../models/User';

const RATE = new Map();

function checkRate(ip) {
  const now = Date.now();
  const e = RATE.get(ip);
  if (!e || now > e.reset) { RATE.set(ip, { count: 1, reset: now + 5 * 60 * 1000 }); return true; }
  e.count++;
  return e.count <= 10;
}

export async function POST(request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    if (!checkRate(ip)) return NextResponse.json({ ok: false, message: 'ลองอีกครั้งภายหลัง (rate limit)' }, { status: 429 });

    const body = await request.json().catch(() => ({}));
    const { login, password } = body;
    if (!login || !password) return NextResponse.json({ ok: false, message: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 400 });

    await ensureInit();

    const loginStr = String(login).trim();
    const query = loginStr.includes('@')
      ? { email: loginStr.toLowerCase() }
      : { username: { $regex: `^${loginStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } };

    const user = await User.findOne(query)
      .select('passwordHash role username email balance currency level levelName avatarUrl affiliateKey serial_key')
      .lean(false);

    if (!user) return NextResponse.json({ ok: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 });

    const valid = await user.validatePassword(password);
    if (!valid) return NextResponse.json({ ok: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 });

    const session = await getSession();
    session.user = {
      _id: String(user._id),
      username: user.username,
      email: user.email || '',
      role: user.role || 'user',
      balance: user.balance || 0,
      currency: user.currency || 'THB',
      level: user.level || '1',
      levelName: user.levelName || 'เลเวล 1',
      avatarUrl: user.avatarUrl || '',
      affiliateKey: user.affiliateKey || '',
      serial_key: user.serial_key || '',
    };
    await session.save();

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('POST /api/auth/login', e);
    return NextResponse.json({ ok: false, message: 'เกิดข้อผิดพลาด กรุณาลองใหม่' }, { status: 500 });
  }
}
