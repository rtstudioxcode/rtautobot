export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getSession } from '../../../../../lib/session.js';
import { ensureInit } from '../../../../../lib/setup.js';
import { User } from '../../../../../models/User.js';
import { BonustimeUser } from '../../../../../models/BonustimeUser.js';
import { BonustimeOrder } from '../../../../../models/BonustimeOrder.js';
import { recalcUserTotals } from '../../../../../services/spend.js';

const UPGRADE_LOTTO_PRICE = 1000;

function sameSerial(a, b) {
  return String(a || '').trim() && String(a || '').trim() === String(b || '').trim();
}

export async function POST(request, { params }) {
  try {
    const session = await getSession();
    if (!session.user?._id) return NextResponse.json({ ok: false }, { status: 401 });

    await ensureInit();

    const { id } = await params;
    const [doc, user] = await Promise.all([
      BonustimeUser.findById(id),
      User.findById(session.user._id),
    ]);

    if (!doc) return NextResponse.json({ ok: false, message: 'ไม่พบข้อมูล Bonustime' }, { status: 404 });
    if (!user) return NextResponse.json({ ok: false, message: 'ไม่พบผู้ใช้' }, { status: 404 });

    if (session.user.role !== 'admin') {
      if (!user.serial_key) return NextResponse.json({ ok: false, message: 'กรุณาลงทะเบียน Serial Key ก่อนใช้งาน' }, { status: 403 });
      if (!sameSerial(doc.serial_key, user.serial_key)) return NextResponse.json({ ok: false, message: 'คุณไม่มีสิทธิ์จัดการ Service นี้' }, { status: 403 });
    }

    if (doc.LOTTO_ENABLED) return NextResponse.json({ ok: false, message: 'แพ็กเกจนี้เปิดใช้งานหวยอยู่แล้ว' });

    const balance = Number(user.balance || 0);
    if (balance < UPGRADE_LOTTO_PRICE)
      return NextResponse.json({ ok: false, message: 'ยอดเงินคงเหลือไม่เพียงพอสำหรับอัปเกรด' });

    user.balance = balance - UPGRADE_LOTTO_PRICE;
    doc.LOTTO_ENABLED = true;
    await Promise.all([user.save(), doc.save()]);

    await User.updateOne({ _id: user._id }, { $inc: { btSpent: UPGRADE_LOTTO_PRICE } });

    let affiliateReward = 0;
    if (user.referredBy) {
      affiliateReward = 250;
      await User.updateOne({ _id: user.referredBy }, {
        $inc: { 'affiliate.earningsTHB': affiliateReward, 'affiliate.withdrawableTHB': affiliateReward }
      });
    }

    await BonustimeOrder.create({
      user: user._id,
      referrer: user.referredBy || null,
      serialKey: user.serial_key,
      legacyTenantId: doc.legacyTenantId || doc.tenantId || null,
      serviceMode: doc.serviceMode || 'multiTenant',
      serviceKey: doc.serviceKey || null,
      webhookUrl: doc.webhookUrl || doc.LINK || null,
      type: 'upgrade',
      packageType: 'lotto',
      days: 0,
      amountTHB: UPGRADE_LOTTO_PRICE,
      affiliateRewardTHB: affiliateReward,
    });

    await recalcUserTotals(user._id, { force: true, fullRescan: false });

    return NextResponse.json({ ok: true, balance: user.balance });
  } catch (e) {
    console.error('POST /api/bonustime/[id]/upgrade-lotto', e);
    return NextResponse.json({ ok: false, message: 'ไม่สามารถอัปเกรดแพ็กเกจได้' }, { status: 500 });
  }
}
