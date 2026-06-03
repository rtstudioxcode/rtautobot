export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSession } from '../../../../lib/session.js';
import { ensureInit } from '../../../../lib/setup.js';
import { User } from '../../../../models/User.js';
import { computeAffiliateTotals } from '../../../../lib/affiliate.js';

const genAffKey = () => [...crypto.randomUUID().replace(/-/g, '')].sort(() => 0.5 - Math.random()).slice(0, 12).join('');

export async function GET() {
  try {
    const session = await getSession();
    if (!session.user?._id) return NextResponse.json({ ok: false }, { status: 401 });

    await ensureInit();

    const uid = session.user._id;
    const totals = await computeAffiliateTotals(uid);

    return NextResponse.json({
      ok: true,
      summary: {
        ratePct: totals.ratePct,
        referredCount: totals.referredCount,
        orders: Number(totals.orders || 0),
        spentTHB: Number((totals.spentTHB || 0).toFixed(2)),
        earningsTHB: totals.earningsTHB,
        paidTHB: totals.paidTHB,
        withdrawableTHB: totals.withdrawableTHB,
      },
      tier: totals.tier,
    });
  } catch (e) {
    console.error('GET /api/account/affiliate', e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getSession();
    if (!session.user?._id) return NextResponse.json({ ok: false }, { status: 401 });

    await ensureInit();

    const body = await request.json();
    const action = body.action;

    if (action === 'create-link') {
      const u = await User.findById(session.user._id);
      if (!u) return NextResponse.json({ ok: false }, { status: 404 });

      if (!u.affiliateKey) {
        let key = null;
        for (let i = 0; i < 5; i++) {
          const candidate = genAffKey();
          const exist = await User.exists({ affiliateKey: candidate });
          if (!exist) { key = candidate; break; }
        }
        if (!key) return NextResponse.json({ ok: false, error: 'สร้างคีย์ไม่สำเร็จ' }, { status: 500 });

        const now = new Date();
        u.affiliateKey = key;
        if (!u.affiliate) u.affiliate = {};
        if (!u.affiliate.linkCreatedAt) u.affiliate.linkCreatedAt = now;
        if (typeof u.affiliate.rateLockedPct !== 'number')
          u.affiliate.rateLockedPct = u.affiliate?.ratePct ?? 5;

        await u.save();
        session.user.affiliateKey = key;
        await session.save();
      }

      const link = `https://rtautobot.com/aff?=${u.affiliateKey}`;
      return NextResponse.json({
        ok: true,
        key: u.affiliateKey,
        link,
        rate: u.affiliate?.rateLockedPct ?? u.affiliate?.ratePct ?? 5,
      });
    }

    return NextResponse.json({ ok: false, message: 'unknown action' }, { status: 400 });
  } catch (e) {
    console.error('POST /api/account/affiliate', e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
