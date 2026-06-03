import { NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { ensureInit } from '../../../../lib/setup.js';
import { User } from '../../../../models/User.js';
import { OtpToken } from '../../../../models/OtpToken.js';
import { sendEmail } from '../../../../lib/mailer.js';
import { config } from '../../../../config.js';

function makeTokenDigest(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function getBrandBase() {
  return String(config?.brand?.rtautobotSite || 'https://rtautobot.com').trim().replace(/\/+$/, '');
}

function getPublicBase(request) {
  const configured = String(config?.brand?.rtautobotSite || config?.publicBaseUrl || '').trim().replace(/\/+$/, '');
  if (configured) return configured;
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'https';
  const host = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || request.headers.get('host') || '';
  return `${proto}://${host}`;
}

function emailResetHtml(resetUrl) {
  const base = getBrandBase();
  const logo = `${base}/assets/logo/logo-rtautobot.png`;
  return `<!doctype html><html lang="th"><head><meta charset="utf-8">
  <style>html,body{margin:0;padding:0;background:#f4f6f8}img{border:0;display:block}table,td{border-collapse:collapse}
  .head{background:#0b0f1a;padding:3px 16px;text-align:center}.logo{height:128px;width:auto;max-width:100%;margin:0 auto}
  .btn{background:#111827;border-radius:8px;color:#fff!important;display:inline-block;font-weight:700;text-decoration:none;padding:12px 22px}
  @media(max-width:600px){.logo{height:98px!important}}</style></head>
  <body><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:16px 0;font-family:system-ui,Arial">
  <tr><td align="center"><table role="presentation" style="width:560px;max-width:100%;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e6e8eb" cellpadding="0" cellspacing="0">
  <tr><td class="head"><a href="${base}" target="_blank"><img src="${logo}" alt="RTAUTOBOT" class="logo"></a></td></tr>
  <tr><td style="padding:20px 24px 8px;color:#111827"><h2 style="margin:0 0 6px">รีเซ็ตรหัสผ่าน RTAUTOBOT</h2><p style="margin:0;color:#6b7280">กดปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่</p></td></tr>
  <tr><td style="padding:16px 24px 20px" align="center"><a href="${resetUrl}" target="_blank" class="btn">รีเซ็ตรหัสผ่าน</a></td></tr>
  <tr><td style="padding:0 24px 20px;color:#6b7280;font-size:12px">หากปุ่มกดไม่ได้:<br><a href="${resetUrl}" style="color:#2563eb;word-break:break-all">${resetUrl}</a></td></tr>
  <tr><td style="background:#f9fafb;color:#9ca3af;padding:12px 20px;text-align:center;font-size:12px">© RTAUTOBOT</td></tr>
  </table></td></tr></table></body></html>`;
}

export async function POST(request) {
  try {
    await ensureInit();

    const { email: rawEmail } = await request.json();
    const email = String(rawEmail || '').trim().toLowerCase();
    if (!email) return NextResponse.json({ ok: false, message: 'กรอกอีเมล' }, { status: 400 });

    const user = await User.findOne({ email }).select('_id email username emailVerified').lean();
    if (!user)
      return NextResponse.json({ ok: false, message: 'ยังไม่มีอีเมลนี้ในระบบ โปรดลองสมัครใหม่ดูก่อน' }, { status: 404 });

    if (!user.emailVerified) {
      const token = crypto.randomBytes(32).toString('base64url');
      const hash = await bcrypt.hash(token, 10);
      await OtpToken.create({ email, purpose: 'email-verify-link', codeHash: hash, expiresAt: new Date(Date.now() + 30 * 60 * 1000), attempts: 0, maxAttempts: 10 });
      const base = getPublicBase(request);
      const verifyUrl = `${base}/api/auth/verify?e=${encodeURIComponent(email)}&t=${encodeURIComponent(token)}`;
      sendEmail({ to: email, subject: 'ยืนยันอีเมล RTAUTOBOT', html: `<p>ยืนยัน: <a href="${verifyUrl}">${verifyUrl}</a></p>` }).catch(() => {});
      return NextResponse.json({ ok: false, message: 'บัญชีนี้ยังไม่ได้ยืนยันอีเมล — ได้ส่งลิงก์ยืนยันให้แล้ว' }, { status: 409 });
    }

    const token = crypto.randomBytes(32).toString('base64url');
    const hash = await bcrypt.hash(token, 10);

    await OtpToken.create({
      email,
      purpose: 'password-reset-link',
      codeHash: hash,
      tokenDigest: makeTokenDigest(token),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      attempts: 0,
      maxAttempts: 10,
    });

    const base = getPublicBase(request);
    const resetUrl = `${base}/password/reset/${encodeURIComponent(token)}`;

    sendEmail({ to: email, subject: 'รีเซ็ตรหัสผ่าน RTAUTOBOT', html: emailResetHtml(resetUrl) }).catch(() => {});

    return NextResponse.json({ ok: true, message: 'ส่งลิงก์รีเซ็ตไปยังอีเมลของคุณแล้ว' });
  } catch (e) {
    console.error('POST /api/password/forgot', e);
    return NextResponse.json({ ok: false, message: 'ส่งอีเมลไม่สำเร็จ' }, { status: 500 });
  }
}
