export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { ensureInit } from '../../../../lib/setup.js';
import { Topup } from '../../../../models/Topup.js';
import { Transaction } from '../../../../models/Transaction.js';
import { User } from '../../../../models/User.js';

export const runtime = 'nodejs';

const PRODUCTION_KEY = 'rtautobot';

function payloadToObject(input) {
  if (!input) return {};
  if (typeof input === 'string') {
    const raw = input.trim();
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return { ...parsed, __rawText: raw };
    } catch {}
    return { message: raw, text: raw, __rawText: raw };
  }
  if (typeof input === 'object') return input;
  return {};
}

function cleanBearer(value) {
  return String(value || '').trim().replace(/^Bearer\s+/i, '').trim();
}

function normalizeJwtSatangToCents(value) {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n);
}

function normalizeDirectAmountToCents(value) {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

function buildPendingTopupMatchFilter(method, amountCents) {
  return {
    production: PRODUCTION_KEY,
    method,
    amountCents,
    status: 'pending',
    $or: [
      { userId: { $exists: true, $ne: null } },
      {
        $and: [
          { $or: [{ userId: { $exists: false } }, { userId: null }] },
          { $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }] },
        ],
      },
    ],
  };
}

async function cleanupExpiredOrphans() {
  await Transaction.updateMany(
    {
      production: PRODUCTION_KEY,
      status: 'processing',
      expiresAt: { $lte: new Date() },
      $or: [{ userId: { $exists: false } }, { userId: null }],
    },
    { $set: { status: 'failed', note: 'expired processing orphan topup' } }
  );
}

async function parseTrueWalletBody(body, topup, authHeader) {
  const message = body.message || body.token || body.jwt || body.data || body.payload || cleanBearer(authHeader) || body.__rawText || '';

  if (message) {
    const secret = new TextEncoder().encode(String(topup.secret || '').trim());
    const { payload } = await jwtVerify(String(message), secret);
    const amountCents = normalizeJwtSatangToCents(payload.amount ?? payload.transfer_amount ?? payload.received_amount);
    return { ok: amountCents > 0, mode: 'jwt', amountCents, rawAmount: amountCents / 100, payload, rawMessage: String(message) };
  }

  const givenSecret = String(body.secret || body.webhookSecret || body.key || body.tokenSecret || '').trim();
  if (!givenSecret || givenSecret !== String(topup.secret || '').trim())
    return { ok: false, mode: 'missing_or_invalid_secret' };

  const amountCents = normalizeDirectAmountToCents(body.amount ?? body.payAmount ?? body.total ?? body.value);
  return { ok: amountCents > 0, mode: 'direct', amountCents, rawAmount: amountCents / 100, payload: body, rawMessage: JSON.stringify(body) };
}

export async function POST(request) {
  try {
    await ensureInit();

    const topup = await Topup.findOne({
      production: PRODUCTION_KEY,
      accountCode: 'tw',
      isActive: true,
      isSMS: false,
    }).lean();

    if (!topup?.secret)
      return NextResponse.json({ success: false, message: 'TW secret not configured' }, { status: 401 });

    await cleanupExpiredOrphans();

    const text = await request.text();
    let body = {};
    try { body = JSON.parse(text); } catch { body = { message: text, __rawText: text }; }

    let parsed;
    try {
      parsed = await parseTrueWalletBody(payloadToObject(body), topup, request.headers.get('authorization') || '');
    } catch (err) {
      console.warn('TW WEBHOOK VERIFY FAILED', err?.message);
      return NextResponse.json({ success: false, message: 'invalid webhook signature' }, { status: 401 });
    }

    if (!parsed?.ok || !parsed.amountCents)
      return NextResponse.json({ success: false, message: 'amount not found' }, { status: 400 });

    const addedCents = parsed.amountCents;
    const rawAmount = addedCents / 100;

    const dup = await Transaction.findOne({
      production: PRODUCTION_KEY,
      method: 'tw',
      amountCents: addedCents,
      status: 'completed',
      occurredAt: { $gte: new Date(Date.now() - 2 * 60 * 1000), $lte: new Date(Date.now() + 2 * 60 * 1000) },
    }).lean();

    if (dup) return NextResponse.json({ success: true, deduped: true });

    const lockedTx = await Transaction.findOneAndUpdate(
      buildPendingTopupMatchFilter({ $in: ['tw', 'qr'] }, addedCents),
      { $set: { status: 'processing' } },
      { sort: { createdAt: -1 }, new: true }
    );

    if (lockedTx) {
      const user = await User.findById(lockedTx.userId);
      if (!user) {
        await Transaction.updateOne({ _id: lockedTx._id }, { $set: { status: 'failed', note: 'matched tw but user not found' } });
        return NextResponse.json({ success: true, userNotFound: true });
      }

      const newBalance = await user.addBalance(Number(lockedTx.amount || 0));
      await Transaction.updateOne({ _id: lockedTx._id }, {
        $set: {
          status: 'completed',
          matchedBy: lockedTx.method === 'tw' ? `tw_${parsed.mode}_amountCents` : `legacy_qr_${parsed.mode}_amountCents`,
          paidAt: new Date(),
          occurredAt: new Date(),
          rawMessage: parsed.rawMessage,
          ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || '',
          note: 'matched truewallet',
        },
      });

      return NextResponse.json({ success: true, matched: true, amount: lockedTx.amount, paidAmount: rawAmount, balance: newBalance });
    }

    await Transaction.create({
      production: PRODUCTION_KEY,
      method: 'tw',
      amount: Math.floor(rawAmount),
      amountCents: addedCents,
      status: 'pending',
      occurredAt: new Date(),
      rawMessage: parsed.rawMessage,
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || '',
      note: 'unmatched truewallet',
    });

    return NextResponse.json({ success: true, unmatched: true });
  } catch (e) {
    console.error('TW WEBHOOK ERROR', e);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
