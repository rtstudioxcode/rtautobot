export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getSession } from '../../../../lib/session.js';
import { ensureInit } from '../../../../lib/setup.js';
import { User } from '../../../../models/User.js';
import { OtpToken } from '../../../../models/OtpToken.js';
import { sendEmail } from '../../../../lib/mailer.js';
import { config } from '../../../../config.js';

function genToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

const genAffKey = () => crypto.randomBytes(6).toString('hex');

async function genUniqueAffiliateKey() {
  for (let i = 0; i < 5; i++) {
    const key = genAffKey();
    const exist = await User.exists({ affiliateKey: key });
    if (!exist) return key;
  }
  return genAffKey();
}

async function generateUniqueSerialKey() {
  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const makeCode = () => {
    let s = '';
    for (let i = 0; i < 8; i++) s += CHARS[Math.floor(Math.random() * CHARS.length)];
    return `BT-${s}`;
  };
  for (let i = 0; i < 10; i++) {
    const candidate = makeCode();
    const exists = await User.exists({ serial_key: candidate });
    if (!exists) return candidate;
  }
  throw new Error('Cannot generate unique serial key');
}

function getPublicBaseUrl(request) {
  const configured = String(config?.brand?.rtautobotSite || config?.brand?.baseUrl || config?.publicBaseUrl || '').trim().replace(/\/+$/, '');
  if (configured) return configured;
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'https';
  const host = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || request.headers.get('host') || '';
  return `${proto}://${host}`;
}

function emailTemplateVerifyLink(verifyUrl) {
  return `<!doctype html><html lang="th"><head><meta charset="utf-8">
  <style>html,body{margin:0;padding:0;background:#f4f6f8}img{border:0;display:block}table,td{border-collapse:collapse}
  .head{background:#0b0f1a;padding:3px 16px;text-align:center}.logo{height:128px;width:auto;max-width:100%;margin:0 auto}
  .btn{background:#111827;border-radius:8px;color:#fff!important;display:inline-block;font-weight:700;text-decoration:none;padding:12px 22px}
  @media(max-width:600px){.logo{height:98px!important}}</style></head>
  <body><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:16px 0;font-family:system-ui,Arial">
  <tr><td align="center"><table role="presentation" style="width:560px;max-width:100%;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e6e8eb" cellpadding="0" cellspacing="0">
  <tr><td class="head"><a href="https://rtautobot.com" target="_blank"><img src="https://rtautobot.com/assets/logo/logo-rtautobot.png" alt="RTAUTOBOT" class="logo"></a></td></tr>
  <tr><td style="padding:20px 24px 8px;color:#111827"><h2 style="margin:0 0 6px">ยืนยันการสมัคร RTAUTOBOT</h2><p style="margin:0;color:#6b7280">คลิกปุ่มด้านล่างเพื่อยืนยันอีเมลและเปิดใช้งานบัญชีของคุณ</p></td></tr>
  <tr><td style="padding:16px 24px 20px" align="center"><a href="${verifyUrl}" target="_blank" class="btn">ยืนยันอีเมลของฉัน</a></td></tr>
  <tr><td style="padding:0 24px 20px;color:#6b7280;font-size:12px">หากปุ่มกดไม่ได้:<br><a href="${verifyUrl}" style="color:#2563eb;word-break:break-all">${verifyUrl}</a></td></tr>
  <tr><td style="background:#f9fafb;color:#9ca3af;padding:12px 20px;text-align:center;font-size:12px">© RTAUTOBOT</td></tr>
  </table></td></tr></table></body></html>`;
}

export async function POST(request) {
  try {
    await ensureInit();

    const body = await request.json();
    const username = String(body.username || '').trim();
    const name = String(body.name || '').trim();
    const emailRaw = String(body.email || '').trim();
    const email = emailRaw.toLowerCase();
    const password = body.password || '';
    const affKey = String(body.aff || body.affiliateKey || '').trim();

    if (!username || !name || !email || !password)
      return NextResponse.json({ ok: false, message: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 400 });

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return NextResponse.json({ ok: false, message: 'อีเมลไม่ถูกต้อง' }, { status: 400 });

    if (password.length < 6)
      return NextResponse.json({ ok: false, message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' }, { status: 400 });

    const dupUser = await User.findOne({ $or: [{ username }, { email }] }).lean();
    if (dupUser)
      return NextResponse.json({
        ok: false,
        message: dupUser.username === username ? 'ชื่อผู้ใช้ถูกใช้งานแล้ว' : 'อีเมลถูกใช้งานแล้ว'
      }, { status: 400 });

    const passwordHash = await bcrypt.hash(password, 10);
    const serialKey = await generateUniqueSerialKey();

    // Store pending registration data in a temp OTP record note field isn't ideal.
    // In Next.js (no server session), we create user directly after verifying email.
    // Use a separate pending registration approach: save to OtpToken with metadata.
    const token = genToken(32);
    const codeHash = await bcrypt.hash(token, 10);

    await OtpToken.create({
      email,
      purpose: 'email-verify-link',
      codeHash,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      attempts: 0,
      maxAttempts: 10,
      meta: { username, name, passwordHash, affKey, serialKey }
    });

    const base = getPublicBaseUrl(request);
    const verifyUrl = `${base}/api/auth/verify?e=${encodeURIComponent(email)}&t=${encodeURIComponent(token)}`;

    await sendEmail({
      to: email,
      subject: 'ยืนยันการสมัครสมาชิก RTAUTOBOT',
      html: emailTemplateVerifyLink(verifyUrl),
    });

    return NextResponse.json({ ok: true, message: 'ส่งอีเมลยืนยันแล้ว โปรดตรวจสอบกล่องจดหมายของคุณ' });
  } catch (e) {
    console.error('POST /api/auth/register', e);
    return NextResponse.json({ ok: false, message: 'สมัครไม่สำเร็จ' }, { status: 500 });
  }
}
