export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSession } from '../../../../lib/session';
import { ensureInit } from '../../../../lib/setup';
import { User } from '../../../../models/User';
import { Transaction } from '../../../../models/Transaction';
import { AffWithdraw } from '../../../../models/AffWithdraw';
import { computeAffiliateTotals } from '../../../../lib/affiliate';

const genAffKey = () => [...crypto.randomUUID().replace(/-/g, '')].sort(() => 0.5 - Math.random()).slice(0, 12).join('');
const PRODUCTION_KEY = 'rtautobot';
const round2 = (n: any) => Math.round((Number(n) || 0) * 100) / 100;
const positive = (n: any) => Math.max(0, round2(n));

export async function GET() {
  try {
    const session = await getSession();
    if (!session.user?._id) return NextResponse.json({ ok: false }, { status: 401 });

    await ensureInit();

    const uid = session.user._id;
    const totals: any = await computeAffiliateTotals(uid);

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
  } catch (e: any) {
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

      const link = `https://rtautobot.com/aff?aff=${u.affiliateKey}`;
      return NextResponse.json({
        ok: true,
        key: u.affiliateKey,
        link,
        rate: u.affiliate?.rateLockedPct ?? u.affiliate?.ratePct ?? 5,
      });
    }


    if (action === 'withdraw-balance') {
      const totals: any = await computeAffiliateTotals(session.user._id);
      const amount = positive(totals.withdrawableTHB);
      const paidBefore = positive(totals.paidTHB);

      if (amount <= 0) {
        return NextResponse.json({ ok: false, error: 'ยังไม่มียอดรายได้ที่ถอนได้' }, { status: 400 });
      }

      const paidFilter: any[] = [{ 'affiliate.paidTHB': paidBefore }];
      if (paidBefore === 0) paidFilter.push({ 'affiliate.paidTHB': { $exists: false } });

      const updated = await User.findOneAndUpdate(
        { _id: session.user._id, $or: paidFilter },
        {
          $inc: {
            balance: amount,
            'affiliate.paidTHB': amount,
          },
          $set: {
            'affiliate.lastCalcAt': new Date(),
            'affiliate.withdrawableTHB': 0,
          },
        },
        { new: true }
      );

      if (!updated) {
        return NextResponse.json({ ok: false, error: 'ยอดรายได้มีการเปลี่ยนแปลง กรุณารีเฟรชหน้าแล้วลองใหม่' }, { status: 409 });
      }

      await AffWithdraw.create({
        userId: updated._id,
        username: updated.username,
        amount,
        kind: 'balance',
        status: 'success',
      });

      await Transaction.create({
        production: PRODUCTION_KEY,
        userId: updated._id,
        username: updated.username,
        method: 'admin',
        amount,
        amountCents: Math.round(amount * 100),
        status: 'completed',
        paidAt: new Date(),
        note: 'affiliate withdraw to balance',
      });

      const nextTotals: any = await computeAffiliateTotals(updated._id);

      session.user.balance = Number(updated.balance || 0);
      await session.save();

      return NextResponse.json({
        ok: true,
        message: `ถอนรายได้แนะนำเพื่อนเข้าเครดิต ฿${amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} สำเร็จ`,
        amount,
        balance: Number(updated.balance || 0),
        summary: {
          ratePct: nextTotals.ratePct,
          referredCount: nextTotals.referredCount,
          orders: Number(nextTotals.orders || 0),
          spentTHB: Number((nextTotals.spentTHB || 0).toFixed(2)),
          earningsTHB: nextTotals.earningsTHB,
          paidTHB: nextTotals.paidTHB,
          withdrawableTHB: nextTotals.withdrawableTHB,
        },
      });
    }

    return NextResponse.json({ ok: false, message: 'unknown action' }, { status: 400 });
  } catch (e: any) {
    console.error('POST /api/account/affiliate', e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
