import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/session.js';
import { ensureInit } from '../../../../lib/setup.js';
import { Topup } from '../../../../models/Topup.js';
import { Transaction } from '../../../../models/Transaction.js';

const PRODUCTION_KEY = 'rtautobot';
const TOPUP_ALLOWED_METHODS = ['tw', 'qr', 'kbank', 'scb'];

function normalizeTopupMethod(value) {
  const method = String(value || '').toLowerCase().trim();
  return TOPUP_ALLOWED_METHODS.includes(method) ? method : '';
}

function getTopupExpireSeconds(method) {
  const m = normalizeTopupMethod(method);
  if (m === 'tw' || m === 'qr') return 5 * 60;
  if (m === 'kbank' || m === 'scb') return 15 * 60;
  return 5 * 60;
}

function secondsUntil(date, fallback = 15 * 60) {
  const ms = date ? new Date(date).getTime() - Date.now() : fallback * 1000;
  if (!Number.isFinite(ms)) return fallback;
  return Math.max(1, Math.ceil(ms / 1000));
}

function makeExpectedTopupAmount(base) {
  const baseCents = Math.round(Number(base || 0) * 100);
  const extraCents = Math.floor(Math.random() * 20) + 1;
  const amountCents = baseCents + extraCents;
  return { expectedAmount: amountCents / 100, amountCents, extraCents };
}

async function resolveMethod(body) {
  const raw = body.method || body.accountCode || body.walletCode || body.channel || '';
  let method = normalizeTopupMethod(raw);

  if (method) {
    const active = await Topup.exists({
      production: PRODUCTION_KEY,
      accountCode: method,
      isActive: true,
      ...(method === 'tw' ? { isSMS: false } : {}),
    });
    if (!active) {
      const err = new Error(`ช่องทางเติมเงิน ${method.toUpperCase()} ยังไม่เปิดใช้งาน`);
      err.statusCode = 400;
      throw err;
    }
    return method;
  }

  const activeWallets = await Topup.find({
    production: PRODUCTION_KEY,
    isActive: true,
    accountCode: { $in: TOPUP_ALLOWED_METHODS },
  }).select('accountCode isSMS').lean();

  const methods = [...new Set(
    activeWallets
      .filter((w) => w.accountCode !== 'tw' || w.isSMS === false)
      .map((w) => normalizeTopupMethod(w.accountCode))
      .filter(Boolean)
  )];

  if (methods.length === 1) return methods[0];
  return 'qr';
}

export async function POST(request) {
  try {
    const session = await getSession();
    if (!session.user?._id) return NextResponse.json({ ok: false, message: 'กรุณาเข้าสู่ระบบก่อนเติมเงิน' }, { status: 401 });

    await ensureInit();

    const body = await request.json();
    const base = Math.floor(Number(body.amount || 0));
    if (!Number.isFinite(base) || base < 1)
      return NextResponse.json({ ok: false, message: 'ยอดเติมขั้นต่ำ 1 บาท' }, { status: 400 });

    const method = await resolveMethod(body);
    const expireSeconds = getTopupExpireSeconds(method);
    const expireMinutes = Math.ceil(expireSeconds / 60);
    const uid = session.user._id;

    // Reuse existing pending
    const existing = await Transaction.findOne({
      production: PRODUCTION_KEY,
      userId: uid,
      method,
      status: 'pending',
    }).sort({ createdAt: -1 }).lean();

    if (existing) {
      const expiredPending = existing.expiresAt ? new Date(existing.expiresAt).getTime() <= Date.now() : false;
      return NextResponse.json({
        ok: true,
        txId: String(existing._id),
        method: existing.method,
        amount: Number(existing.amount || 0),
        displayAmount: Number(existing.expectedAmount || existing.amount || 0),
        amountCents: Number(existing.amountCents || 0),
        expiresAt: existing.expiresAt || null,
        expiresIn: expiredPending ? 0 : secondsUntil(existing.expiresAt, expireSeconds),
        expireMinutes,
        reused: true,
        expiredPending,
        mustCancelOld: expiredPending,
        message: expiredPending ? 'กรุณายกเลิกรายการเก่าก่อนทำรายการใหม่' : undefined,
      });
    }

    let tx = null;
    let lastErr = null;
    const now = Date.now();

    for (let i = 0; i < 40; i++) {
      try {
        const { expectedAmount, amountCents, extraCents } = makeExpectedTopupAmount(base);
        tx = await Transaction.create({
          production: PRODUCTION_KEY,
          userId: uid,
          method,
          amount: base,
          expectedAmount,
          amountCents,
          topupExtraCents: extraCents,
          status: 'pending',
          expiresAt: new Date(now + expireSeconds * 1000),
          note: `${method}_topup_pending`,
          ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || '',
        });
        break;
      } catch (err) {
        lastErr = err;
        if (err?.code === 11000) continue;
        throw err;
      }
    }

    if (!tx) {
      console.error('CREATE TOPUP DUPLICATE EXHAUSTED', lastErr);
      return NextResponse.json({ ok: false, message: 'ยอดนี้มีคนใช้งานอยู่ กรุณากดสร้างรายการใหม่อีกครั้ง' }, { status: 409 });
    }

    return NextResponse.json({
      ok: true,
      txId: String(tx._id),
      method: tx.method,
      amount: Number(tx.amount),
      displayAmount: Number(tx.expectedAmount),
      amountCents: Number(tx.amountCents),
      expiresAt: tx.expiresAt || null,
      expiresIn: secondsUntil(tx.expiresAt, expireSeconds),
      expireMinutes,
      reused: false,
    });
  } catch (e) {
    console.error('CREATE TOPUP ERROR', e);
    return NextResponse.json({ ok: false, message: e.message || 'สร้างคำสั่งเติมเงินไม่สำเร็จ' }, { status: e?.statusCode || 500 });
  }
}
