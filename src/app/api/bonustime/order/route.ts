export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/session';
import { ensureInit } from '../../../../lib/setup';
import { User } from '../../../../models/User';
import { BonustimeUser } from '../../../../models/BonustimeUser';
import { BonustimeOrder } from '../../../../models/BonustimeOrder';
import { recalcUserTotals } from '../../../../services/spend';
import { buildAdditiveFields } from '../../../../services/bonustimeMultiTenant';

const BT_PACKAGES = {
  normal: { days: 30, price: 2000, label: 'แพ็กเกจ 1 : สล็อต + บาคาร่า' },
  lotto: { days: 30, price: 2500, label: 'แพ็กเกจ 2 : สล็อต + บาคาร่า + หวย' },
};

function thaiDateString(d = new Date()) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear() + 543;
  return `${dd}/${mm}/${yyyy}`;
}

export async function POST(request) {
  try {
    const session = await getSession();
    if (!session.user?._id) return NextResponse.json({ ok: false, message: 'ไม่พบข้อมูลผู้ใช้' }, { status: 401 });

    await ensureInit();

    const body = await request.json();
    const { bonustimeId, packageType, NAME, CHANNEL_ACCESS_TOKEN, CHANNEL_SECRET, LOGO, LOGIN_URL, SIGNUP_URL, LINE_ADMIN } = body;

    const user = await User.findById(session.user._id);
    if (!user) return NextResponse.json({ ok: false, message: 'ไม่พบข้อมูลผู้ใช้' }, { status: 404 });
    if (!user.serial_key) return NextResponse.json({ ok: false, message: 'กรุณาลงทะเบียน Serial Key ก่อนสั่งซื้อ' });

    const type = packageType === 'lotto' ? 'lotto' : 'normal';
    const pack = BT_PACKAGES[type];
    if (!pack || !bonustimeId) return NextResponse.json({ ok: false, message: 'ข้อมูลคำสั่งซื้อไม่ถูกต้อง' });

    if ((user.balance || 0) < pack.price)
      return NextResponse.json({ ok: false, message: 'ยอดเงินในกระเป๋าไม่เพียงพอสำหรับสั่งซื้อแพ็กเกจนี้' });

    const record = await BonustimeUser.findOne({
      _id: bonustimeId,
      $or: [{ serial_key: null }, { serial_key: '' }],
      LOTTO_ENABLED: type === 'lotto' ? true : { $ne: true },
    });

    if (!record) return NextResponse.json({ ok: false, message: 'รายการนี้ถูกซื้อไปแล้ว หรือไม่พร้อมใช้งาน' });

    user.balance = (user.balance || 0) - pack.price;
    await user.save();

    record.serial_key = user.serial_key;
    record.NAME = NAME || '';
    record.CHANNEL_ACCESS_TOKEN = CHANNEL_ACCESS_TOKEN || '';
    record.CHANNEL_SECRET = CHANNEL_SECRET || '';
    record.LOGO = LOGO || '';
    record.LOGIN_URL = LOGIN_URL || '';
    record.SIGNUP_URL = SIGNUP_URL || '';
    record.LINE_ADMIN = LINE_ADMIN || '';
    record.LICENSE_START_DATE = thaiDateString(new Date());
    record.LICENSE_DURATION_DAYS = pack.days;
    record.LICENSE_DISABLED = false;
    record.note = type === 'lotto' ? 'แพ็กเกจ 2 (สล็อต+บาคาร่า+หวย)' : 'แพ็กเกจ 1 (สล็อต+บาคาร่า)';

    const mt = buildAdditiveFields(record.toObject ? record.toObject() : record);
    for (const [k, v] of Object.entries(mt)) record[k] = v;
    if (!record.LINK && mt.webhookUrl) record.LINK = mt.webhookUrl;

    await record.save();

    await User.updateOne({ _id: user._id }, { $inc: { btSpent: pack.price } });

    let affiliateReward = 0;
    if (user.referredBy) {
      affiliateReward = 500;
      await User.updateOne({ _id: user.referredBy }, {
        $inc: { 'affiliate.earningsTHB': affiliateReward, 'affiliate.withdrawableTHB': affiliateReward }
      });
    }

    await BonustimeOrder.create({
      user: user._id,
      referrer: user.referredBy || null,
      serialKey: user.serial_key,
      legacyTenantId: record.legacyTenantId || record.tenantId || null,
      serviceMode: record.serviceMode || 'multiTenant',
      serviceKey: record.serviceKey || null,
      webhookUrl: record.webhookUrl || record.LINK || null,
      type: 'buy',
      packageType: type,
      days: pack.days,
      amountTHB: pack.price,
      affiliateRewardTHB: affiliateReward,
    });

    await recalcUserTotals(user._id, { force: true, fullRescan: false });

    return NextResponse.json({
      ok: true,
      plan: { type, label: pack.label, days: pack.days, price: pack.price },
      balance: user.balance,
      tenantId: record.tenantId || null,
    });
  } catch (e: any) {
    console.error('POST /api/bonustime/order', e);
    return NextResponse.json({ ok: false, message: 'ไม่สามารถสั่งซื้อแพ็กเกจ Bonustime ได้' }, { status: 500 });
  }
}
