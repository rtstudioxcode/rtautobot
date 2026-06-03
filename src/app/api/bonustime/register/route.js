import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSession } from '../../../../lib/session.js';
import { ensureInit } from '../../../../lib/setup.js';
import { User } from '../../../../models/User.js';

async function generateUniqueSerialKey() {
  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const makeCode = () => {
    let s = '';
    for (let i = 0; i < 8; i++) s += CHARS[Math.floor(Math.random() * CHARS.length)];
    return `BT-${s}`;
  };
  for (let i = 0; i < 10; i++) {
    const candidate = makeCode();
    const exists = await User.exists({ serial_key: candidate });
    if (!exists) return candidate;
  }
  throw new Error('Cannot generate unique serial key');
}

export async function POST() {
  try {
    const session = await getSession();
    if (!session.user?._id) return NextResponse.json({ ok: false }, { status: 401 });

    await ensureInit();

    const user = await User.findById(session.user._id);
    if (!user) return NextResponse.json({ ok: false }, { status: 404 });

    if (user.serial_key) return NextResponse.json({ ok: true, serial_key: user.serial_key });

    const key = await generateUniqueSerialKey();
    user.serial_key = key;
    await user.save();

    // Update session
    session.user.serial_key = key;
    await session.save();

    return NextResponse.json({ ok: true, serial_key: key });
  } catch (e) {
    console.error('POST /api/bonustime/register', e);
    return NextResponse.json({ ok: false, message: 'สร้าง Serial Key ไม่สำเร็จ' }, { status: 500 });
  }
}
