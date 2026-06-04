import { config } from '../config';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export function getTurnstilePublicConfig() {
  const siteKey = String(config?.turnstile?.siteKey || '').trim();
  const secretKey = String(config?.turnstile?.secretKey || '').trim();
  return {
    enabled: Boolean(siteKey),
    siteKey,
    serverVerifyEnabled: Boolean(siteKey && secretKey),
  };
}

export async function verifyTurnstileToken(token: unknown, remoteIp?: string) {
  const siteKey = String(config?.turnstile?.siteKey || '').trim();
  const secretKey = String(config?.turnstile?.secretKey || '').trim();

  // If Turnstile is not configured, keep the old login/register behavior.
  if (!siteKey && !secretKey) return { ok: true, skipped: true };

  if (!secretKey) {
    console.warn('[turnstile] siteKey is configured but secretKey is missing; server verification skipped.');
    return { ok: true, skipped: true, missingSecret: true };
  }

  const response = String(token || '').trim();
  if (!response) {
    return { ok: false, message: 'กรุณายืนยัน Cloudflare Turnstile ก่อนดำเนินการ' };
  }

  try {
    const form = new URLSearchParams();
    form.set('secret', secretKey);
    form.set('response', response);
    if (remoteIp) form.set('remoteip', remoteIp);

    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    });

    const data: any = await res.json().catch(() => ({}));
    if (data?.success) return { ok: true, data };

    console.warn('[turnstile] verification failed', data?.['error-codes'] || data);
    return { ok: false, message: 'ยืนยันความปลอดภัยไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', data };
  } catch (err) {
    console.error('[turnstile] verification error', err);
    return { ok: false, message: 'ไม่สามารถตรวจสอบ Cloudflare Turnstile ได้ กรุณาลองใหม่' };
  }
}
