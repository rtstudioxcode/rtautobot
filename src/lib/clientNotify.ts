'use client';

type NotifyPayload = {
  type?: string;
  variant?: string;
  ok?: boolean;
  title?: string;
  text?: string;
  message?: string;
  error?: string;
  timeout?: number;
};

function normalizeVariant(payload: NotifyPayload = {}) {
  const raw = String(payload.variant || payload.type || '').toLowerCase();
  if (payload.ok === true) return 'success';
  if (payload.ok === false) return 'error';
  if (['ok', 'success', 'done', 'saved'].includes(raw)) return 'success';
  if (['err', 'error', 'danger', 'fail', 'failed'].includes(raw)) return 'error';
  if (['warn', 'warning'].includes(raw)) return 'warn';
  return raw || 'info';
}

function defaultTitle(variant: string) {
  if (variant === 'success') return 'สำเร็จ';
  if (variant === 'error') return 'ไม่สำเร็จ';
  if (variant === 'warn') return 'แจ้งเตือน';
  return 'แจ้งเตือน';
}

export function notifyFromPayload(payload: NotifyPayload | null | undefined, fallbackTitle?: string) {
  if (typeof window === 'undefined' || !payload) return;
  const variant = normalizeVariant(payload);
  const detail = {
    variant,
    title: payload.title || fallbackTitle || defaultTitle(variant),
    text: payload.text || payload.message || payload.error || '',
    timeout: payload.timeout ?? 3500,
  };

  const notifyApi = (window as any).notify || (window as any).__rtNotify;
  if (notifyApi?.from) {
    notifyApi.from(detail);
    return;
  }
  if (notifyApi?.push) {
    notifyApi.push(detail);
    return;
  }
  window.dispatchEvent(new CustomEvent('rt:notify', { detail }));
}

export function notifyMsg<T extends NotifyPayload>(setter: (value: any) => void, payload: T, fallbackTitle?: string) {
  setter(payload);
  notifyFromPayload(payload, fallbackTitle);
}

export async function copyTextWithNotify(text: string, successText = 'คัดลอกเรียบร้อยแล้ว', errorText = 'คัดลอกไม่สำเร็จ กรุณาลองใหม่') {
  const value = String(text || '').trim();
  if (!value) {
    notifyFromPayload({ variant: 'error', title: 'คัดลอกไม่สำเร็จ', text: 'ไม่พบข้อมูลสำหรับคัดลอก' });
    return false;
  }

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
    } else {
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      ta.style.top = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    notifyFromPayload({ variant: 'success', title: 'คัดลอกแล้ว', text: successText });
    return true;
  } catch {
    notifyFromPayload({ variant: 'error', title: 'คัดลอกไม่สำเร็จ', text: errorText });
    return false;
  }
}

type ConfirmActionOptions = {
  title?: string;
  message?: string;
  detail?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'danger' | 'warning' | 'success' | string;
  tone?: 'default' | 'danger' | 'warning' | 'success' | string;
};

export async function confirmAction(options: ConfirmActionOptions | string) {
  if (typeof window === 'undefined') return false;
  const confirmApi = (window as any).rtConfirm || (window as any).UIConfirm || (window as any).uiConfirm;
  if (typeof confirmApi === 'function') {
    return Boolean(await confirmApi(options));
  }
  const message = typeof options === 'string' ? options : [options?.message, options?.detail].filter(Boolean).join('\n');
  return window.confirm(message || 'ต้องการดำเนินการต่อใช่ไหม?');
}
