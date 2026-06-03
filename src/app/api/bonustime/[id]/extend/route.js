import { NextResponse } from 'next/server';
import { getSession } from '../../../../../lib/session.js';
import { ensureInit } from '../../../../../lib/setup.js';
import { User } from '../../../../../models/User.js';
import { BonustimeUser } from '../../../../../models/BonustimeUser.js';
import { BonustimeOrder } from '../../../../../models/BonustimeOrder.js';
import { recalcUserTotals } from '../../../../../services/spend.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const PLANS_NORMAL = [
  { days: 30, price: 1500, label: '1 เดือน', discount: '0%' },
  { days: 90, price: 4050, label: '3 เดือน', discount: '-10%' },
  { days: 180, price: 7200, label: '6 เดือน', discount: '-20%' },
  { days: 365, price: 12600, label: '12 เดือน', discount: '-30%' },
  { days: 730, price: 21600, label: '24 เดือน', discount: '-40%' },
];

const PLANS_LOTTO = [
  { days: 30, price: 2000, label: '1 เดือน', discount: '0%' },
  { days: 90, price: 5400, label: '3 เดือน', discount: '-10%' },
  { days: 180, price: 9600, label: '6 เดือน', discount: '-20%' },
  { days: 365, price: 16800, label: '12 เดือน', discount: '-30%' },
  { days: 730, price: 28800, label: '24 เดือน', discount: '-40%' },
];

function parseThaiDate(str) {
  if (!str) return null;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(str).trim());
  if (!m) return null;
  let year = Number(m[3]);
  if (year > 2400) year -= 543;
  return new Date(year, Number(m[2]) - 1, Number(m[1]));
}

function formatThaiDate(d) {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear() + 543}`;
}

function calcExpiry(doc) {
  const start = parseThaiDate(doc.LICENSE_START_DATE);
  const duration = Number(doc.LICENSE_DURATION_DAYS) || 0;
  if (!start || !duration) return null;
  return new Date(start.getTime() + duration * DAY_MS);
}

function sameSerial(a, b) {
  return String(a || '').trim() && String(a || '').trim() === String(b || '').trim();
}

export async function POST(request, { params }) {
  try {
    const session = await getSession();
    if (!session.user?._id) return NextResponse.json({ ok: false }, { status: 401 });

    await ensureInit();

    const { id } = await params;
    const body = await request.json();
    const { days, includeLotto } = body;
    const includeLottoBool = includeLotto === true || includeLotto === 'true' || includeLotto === '1';

    const daysNum = Number(days) || 0;
    const list = includeLottoBool ? PLANS_LOTTO : PLANS_NORMAL;
    const plan = list.find((p) => p.days === daysNum);
    if (!plan) return NextResponse.json({ ok: false, message: 'แพ็กเกจไม่ถูกต้อง' }, { status: 400 });

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

    const price = Number(plan.price) || 0;
    if ((user.balance || 0) < price)
      return NextResponse.json({ ok: false, message: 'ยอดเงินคงเหลือไม่เพียงพอ' }, { status: 400 });

    user.balance = (user.balance || 0) - price;
    await user.save();

    const now = new Date();
    if (!doc.LICENSE_START_DATE || !doc.LICENSE_DURATION_DAYS) {
      doc.LICENSE_START_DATE = formatThaiDate(now);
      doc.LICENSE_DURATION_DAYS = Number(plan.days);
      doc.LICENSE_DISABLED = false;
    } else {
      const start = parseThaiDate(doc.LICENSE_START_DATE) || now;
      const currentExpire = calcExpiry(doc) || now;
      const base = currentExpire.getTime() > now.getTime() ? currentExpire : now;
      const newExpire = new Date(base.getTime() + Number(plan.days) * DAY_MS);
      doc.LICENSE_DURATION_DAYS = Math.ceil((newExpire.getTime() - start.getTime()) / DAY_MS);
      doc.LICENSE_DISABLED = false;
    }

    await doc.save();
    await User.updateOne({ _id: user._id }, { $inc: { btSpent: price } });

    let affiliateReward = 0;
    if (user.referredBy) {
      affiliateReward = 200;
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
      type: 'renew',
      packageType: includeLottoBool ? 'lotto' : 'normal',
      days: plan.days,
      amountTHB: price,
      affiliateRewardTHB: affiliateReward,
    });

    await recalcUserTotals(user._id, { force: true, fullRescan: false });

    return NextResponse.json({
      ok: true,
      balance: user.balance,
      plan: { days: plan.days, price: plan.price, label: plan.label, discount: plan.discount },
    });
  } catch (e) {
    console.error('POST /api/bonustime/[id]/extend', e);
    return NextResponse.json({ ok: false, message: 'เกิดข้อผิดพลาดระหว่างต่ออายุ' }, { status: 500 });
  }
}
