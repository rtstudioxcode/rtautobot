export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getSession } from '../../../../lib/session';
import { ensureInit } from '../../../../lib/setup';
import { User } from '../../../../models/User';
import { OtpToken } from '../../../../models/OtpToken';

const genAffKey = () => crypto.randomBytes(6).toString('hex');

async function genUniqueAffiliateKey() {
  for (let i = 0; i < 5; i++) {
    const key = genAffKey();
    const exist = await User.exists({ affiliateKey: key });
    if (!exist) return key;
  }
  return genAffKey();
}

export async function GET(request) {
  try {
    await ensureInit();

    const { searchParams } = new URL(request.url);
    const email = String(searchParams.get('e') || '').trim().toLowerCase();
    const token = String(searchParams.get('t') || '').trim();

    if (!email || !token) {
      return NextResponse.redirect(new URL('/register?error=invalid', request.url));
    }

    const doc = await OtpToken.findOne({
      email,
      purpose: 'email-verify-link',
      usedAt: null,
    }).sort({ createdAt: -1 });

    if (!doc || doc.expiresAt.getTime() < Date.now()) {
      return NextResponse.redirect(new URL('/register?error=expired', request.url));
    }

    const ok = await bcrypt.compare(token, doc.codeHash);
    if (!ok) {
      return NextResponse.redirect(new URL('/register?error=invalid', request.url));
    }

    const meta = doc.meta || {};
    if (!meta.username || !meta.passwordHash) {
      return NextResponse.redirect(new URL('/register?error=expired', request.url));
    }

    // Check for duplicates before creating
    const dupe = await User.findOne({ $or: [{ username: meta.username }, { email }] }).lean();
    if (dupe) {
      doc.usedAt = new Date();
      await doc.save();
      return NextResponse.redirect(new URL('/login?error=duplicate', request.url));
    }

    // Resolve referrer
    let referredById = null;
    if (meta.affKey) {
      const refUser = await User.findOne({ affiliateKey: meta.affKey }).select('_id');
      if (refUser?._id) referredById = refUser._id;
    }

    const affiliateKey = await genUniqueAffiliateKey();

    const user = await User.create({
      username: meta.username,
      name: meta.name || meta.username,
      email,
      emailVerified: true,
      passwordHash: meta.passwordHash,
      role: 'user',
      serial_key: meta.serialKey || '',
      affiliateKey,
      ...(referredById ? { referredBy: referredById } : {}),
    });

    if (referredById) {
      User.updateOne({ _id: referredById }, { $inc: { 'affiliate.referredCount': 1 } }).catch(() => {});
    }

    doc.usedAt = new Date();
    await doc.save();

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

    return NextResponse.redirect(new URL('/dashboard', request.url));
  } catch (e: any) {
    console.error('GET /api/auth/verify', e);
    return NextResponse.redirect(new URL('/register?error=server', request.url));
  }
}
