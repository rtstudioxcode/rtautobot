import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/session.js';
import { ensureInit } from '../../../../lib/setup.js';
import { BonustimeUser } from '../../../../models/BonustimeUser.js';
import { BonustimeOrder } from '../../../../models/BonustimeOrder.js';

const DAY_MS = 24 * 60 * 60 * 1000;

async function requireAdmin() {
  const session = await getSession();
  if (!session.user?._id) return { allowed: false, status: 401 };
  if (session.user.role !== 'admin') return { allowed: false, status: 403 };
  return { allowed: true };
}

function calcExpiry(doc) {
  const m = String(doc.LICENSE_START_DATE || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const year = Number(m[3]) > 2400 ? Number(m[3]) - 543 : Number(m[3]);
  const start = new Date(Date.UTC(year, Number(m[2]) - 1, Number(m[1]), 0, 0, 0));
  if (!Number.isFinite(start.getTime())) return null;
  return new Date(start.getTime() + Number(doc.LICENSE_DURATION_DAYS || 0) * DAY_MS);
}

export async function GET(request) {
  try {
    const { allowed, status } = await requireAdmin();
    if (!allowed) return NextResponse.json({ ok: false }, { status });

    await ensureInit();

    const { searchParams } = new URL(request.url);

    // ─── Stats endpoint ───────────────────────────────────────────────
    if (searchParams.get('type') === 'stats') {
      const now = new Date();
      const year = parseInt(searchParams.get('year') || String(now.getFullYear()), 10);
      const month = parseInt(searchParams.get('month') || String(now.getMonth() + 1), 10);

      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 1);

      const orders = await BonustimeOrder.find({
        createdAt: { $gte: startDate, $lt: endDate },
      }).lean();

      const totalRevenue = orders.reduce((s, o) => s + (o.amountTHB || 0), 0);
      const pkg1Orders = orders.filter(o => o.packageType === 'normal');
      const pkg2Orders = orders.filter(o => o.packageType === 'lotto');
      const pkg1Revenue = pkg1Orders.reduce((s, o) => s + (o.amountTHB || 0), 0);
      const pkg2Revenue = pkg2Orders.reduce((s, o) => s + (o.amountTHB || 0), 0);

      const dailyMap = {};
      for (const o of orders) {
        const day = new Date(o.createdAt).getDate();
        if (!dailyMap[day]) dailyMap[day] = { day, total: 0, pkg1: 0, pkg2: 0, count: 0 };
        dailyMap[day].total += o.amountTHB || 0;
        dailyMap[day][o.packageType === 'lotto' ? 'pkg2' : 'pkg1'] += o.amountTHB || 0;
        dailyMap[day].count++;
      }
      const daily = Object.values(dailyMap).sort((a, b) => a.day - b.day);
      const top5 = [...daily].sort((a, b) => b.total - a.total).slice(0, 5);

      const yearStart = new Date(year, 0, 1);
      const yearEnd = new Date(year + 1, 0, 1);
      const yearlyOrders = await BonustimeOrder.find({
        createdAt: { $gte: yearStart, $lt: yearEnd },
      }).lean();

      const yearly = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, total: 0, pkg1: 0, pkg2: 0, count: 0 }));
      for (const o of yearlyOrders) {
        const m = new Date(o.createdAt).getMonth();
        yearly[m].total += o.amountTHB || 0;
        yearly[m][o.packageType === 'lotto' ? 'pkg2' : 'pkg1'] += o.amountTHB || 0;
        yearly[m].count++;
      }
      const yearlyTotal = yearlyOrders.reduce((s, o) => s + (o.amountTHB || 0), 0);
      const yearlyOrderCount = yearlyOrders.length;

      return NextResponse.json({
        ok: true,
        totalRevenue, pkg1Revenue, pkg2Revenue,
        orderCount: orders.length, pkg1Count: pkg1Orders.length, pkg2Count: pkg2Orders.length,
        daily, top5,
        yearly, yearlyTotal, yearlyOrderCount,
      });
    }

    // ─── List endpoint ─────────────────────────────────────────────────
    const filter = searchParams.get('filter') || 'all';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const perPage = Math.min(500, Math.max(1, parseInt(searchParams.get('perPage') || '20', 10)));

    let query = {};
    const now = new Date();

    if (filter === 'active') {
      query = { serial_key: { $exists: true, $ne: '' } };
    } else if (filter === 'free') {
      query = { $or: [{ serial_key: null }, { serial_key: '' }] };
    } else if (filter === 'expired') {
      query = { serial_key: { $exists: true, $ne: '' }, LICENSE_DISABLED: { $ne: true } };
    }

    const allRecords = await BonustimeUser.find(query).sort({ LOTTO_ENABLED: 1, serviceNo: 1, tenantId: 1 }).lean();

    let filtered = allRecords;
    if (filter === 'expired') {
      filtered = allRecords.filter((r) => {
        const exp = calcExpiry(r);
        return exp && exp.getTime() < now.getTime();
      });
    }

    const total = filtered.length;
    const records = filtered.slice((page - 1) * perPage, page * perPage).map((r) => {
      const expiry = calcExpiry(r);
      return {
        ...r,
        expiresAt: expiry || null,
        expiryLabel: expiry ? expiry.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: '2-digit' }) : null,
      };
    });

    return NextResponse.json({ ok: true, total, page, perPage, records });
  } catch (e) {
    console.error('GET /api/admin/bonustime', e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// ─── PATCH: update fields (auto-save) ──────────────────────────────────────
export async function PATCH(request) {
  try {
    const { allowed, status } = await requireAdmin();
    if (!allowed) return NextResponse.json({ ok: false }, { status });

    await ensureInit();

    const body = await request.json();
    const { id, fields } = body;
    if (!id || !fields) return NextResponse.json({ ok: false, error: 'missing id or fields' }, { status: 400 });

    const ALLOWED_FIELDS = [
      'NAME', 'CHANNEL_ACCESS_TOKEN', 'CHANNEL_SECRET', 'LOGO', 'LOGIN_URL', 'SIGNUP_URL',
      'LINE_ADMIN', 'LICENSE_START_DATE', 'LOTTO_ENABLED', 'LICENSE_DISABLED',
      'serial_key', 'note', 'LINK',
    ];

    const doc = await BonustimeUser.findById(id);
    if (!doc) return NextResponse.json({ ok: false, error: 'ไม่พบข้อมูล' }, { status: 404 });

    for (const key of ALLOWED_FIELDS) {
      if (key in fields) doc[key] = fields[key];
    }

    if ('LICENSE_DURATION_DAYS' in fields) {
      const days = parseInt(fields.LICENSE_DURATION_DAYS, 10);
      doc.LICENSE_DURATION_DAYS = isNaN(days) ? 0 : Math.max(0, days);
    }

    await doc.save();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('PATCH /api/admin/bonustime', e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// ─── POST: actions ──────────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const { allowed, status } = await requireAdmin();
    if (!allowed) return NextResponse.json({ ok: false }, { status });

    await ensureInit();

    const body = await request.json();
    const action = body.action;

    // Toggle service disabled/enabled (legacy)
    if (action === 'toggle-disable') {
      const { id } = body;
      const doc = await BonustimeUser.findById(id);
      if (!doc) return NextResponse.json({ ok: false, error: 'ไม่พบข้อมูล' }, { status: 404 });
      doc.LICENSE_DISABLED = !doc.LICENSE_DISABLED;
      await doc.save();
      return NextResponse.json({ ok: true, disabled: doc.LICENSE_DISABLED });
    }

    // Add new service
    if (action === 'add-service') {
      const { lotto } = body;
      const isLotto = Boolean(lotto);
      const prefix = isLotto ? 'pk2server' : 'pk1server';
      const allSame = await BonustimeUser.find({}).select('serviceKey serviceNo').lean();
      const maxNo = allSame.reduce((max, r) => {
        if (!(r.serviceKey || '').startsWith(prefix)) return max;
        const no = parseInt((r.serviceKey || '').replace(prefix, ''), 10);
        return isNaN(no) ? max : Math.max(max, no);
      }, 0);
      const nextNo = maxNo + 1;
      const serviceKey = `${prefix}${nextNo}`;
      const doc = new BonustimeUser({
        tenantId: serviceKey,
        serviceKey,
        serviceNo: nextNo,
        LOTTO_ENABLED: isLotto,
        LICENSE_DISABLED: false,
        LICENSE_DURATION_DAYS: 0,
      });
      await doc.save();
      const saved = doc.toObject();
      return NextResponse.json({ ok: true, record: saved });
    }

    // Delete service
    if (action === 'delete-service') {
      const { id } = body;
      await BonustimeUser.findByIdAndDelete(id);
      return NextResponse.json({ ok: true });
    }

    // Reset service (clear customer data so it can be re-sold)
    if (action === 'reset-service') {
      const { id, force } = body;
      const doc = await BonustimeUser.findById(id);
      if (!doc) return NextResponse.json({ ok: false, error: 'ไม่พบข้อมูล' }, { status: 404 });

      if (!force) {
        const expiry = calcExpiry(doc);
        const thirtyDaysAgo = new Date(Date.now() - 30 * DAY_MS);
        if (!expiry || expiry.getTime() > thirtyDaysAgo.getTime()) {
          return NextResponse.json({ ok: false, error: 'Service ยังไม่หมดอายุเกิน 30 วัน ใช้ force=true เพื่อบังคับ' }, { status: 400 });
        }
      }

      doc.serial_key = undefined;
      doc.NAME = undefined;
      doc.CHANNEL_ACCESS_TOKEN = undefined;
      doc.CHANNEL_SECRET = undefined;
      doc.LOGO = undefined;
      doc.LOGIN_URL = undefined;
      doc.SIGNUP_URL = undefined;
      doc.LINE_ADMIN = undefined;
      doc.LICENSE_START_DATE = undefined;
      doc.LICENSE_DURATION_DAYS = 0;
      doc.LICENSE_DISABLED = false;
      doc.note = undefined;
      await doc.save();
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: 'unknown action' }, { status: 400 });
  } catch (e) {
    console.error('POST /api/admin/bonustime', e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
