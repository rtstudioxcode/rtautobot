export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/session';
import { ensureInit } from '../../../../lib/setup';
import { verifyTurnstileToken } from '../../../../lib/turnstile';
import { User } from '../../../../models/User';

const RATE = new Map();


function checkRate(ip) {
  const now = Date.now();
  const e = RATE.get(ip);
  if (!e || now > e.reset) { RATE.set(ip, { count: 1, reset: now + 5 * 60 * 1000 }); return true; }
  e.count++;
  return e.count <= 10;
}

function requestHost(request) {
  return request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
}

function safeNextPath(value) {
  const raw = String(value || '/dashboard').trim();
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/dashboard';
  return raw || '/dashboard';
}

async function readLoginRequest(request) {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const body = await request.json().catch(() => ({}));
    return { body, isForm: false };
  }

  if (
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data')
  ) {
    const form = await request.formData().catch(() => null);
    const body = {};
    if (form) {
      for (const [key, value] of form.entries()) {
        body[key] = typeof value === 'string' ? value : '';
      }
    }
    return { body, isForm: true };
  }

  return { body: {}, isForm: false };
}

function formRedirect(request, nextPath, error) {
  const url = new URL('/login', request.url);
  url.searchParams.set('next', safeNextPath(nextPath));
  if (error) url.searchParams.set('error', error);
  return NextResponse.redirect(url, 303);
}

function loginError(request, isForm, nextPath, message, status) {
  if (isForm) return formRedirect(request, nextPath, message);
  return NextResponse.json({ ok: false, message }, { status });
}

export async function POST(request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    const { body, isForm } = await readLoginRequest(request);
    const nextPath = safeNextPath(body.next);

    if (!checkRate(ip)) {
      return loginError(request, isForm, nextPath, 'ลองอีกครั้งภายหลัง (rate limit)', 429);
    }

    const login = body.login || body.username || body.email;
    const { password, turnstileToken } = body;
    if (!login || !password) {
      return loginError(request, isForm, nextPath, 'กรุณากรอกข้อมูลให้ครบ', 400);
    }

    await ensureInit();

    const turnstile = await verifyTurnstileToken(turnstileToken, ip, requestHost(request));
    if (!turnstile.ok) {
      return loginError(request, isForm, nextPath, turnstile.message || 'ยืนยันความปลอดภัยไม่สำเร็จ', 403);
    }

    const loginStr = String(login).trim();
    const query = loginStr.includes('@')
      ? { email: loginStr.toLowerCase() }
      : { username: { $regex: `^${loginStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } };

    const user = await User.findOne(query)
      .select('passwordHash role username email balance currency level levelName avatarUrl affiliateKey serial_key')
      .lean(false);

    if (!user) {
      return loginError(request, isForm, nextPath, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 401);
    }

    const valid = await user.validatePassword(password);
    if (!valid) {
      return loginError(request, isForm, nextPath, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 401);
    }

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

    if (isForm) return NextResponse.redirect(new URL(nextPath, request.url), 303);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('POST /api/auth/login', e);
    return NextResponse.json({ ok: false, message: 'เกิดข้อผิดพลาด กรุณาลองใหม่' }, { status: 500 });
  }
}
