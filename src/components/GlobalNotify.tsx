'use client';

import { useEffect } from 'react';

const CSS = `
.notify-root{
  position:fixed;
  inset:16px 16px auto auto;
  z-index:2147483647;
  display:flex;
  flex-direction:column;
  gap:12px;
  pointer-events:none;
  width:min(440px,calc(100vw - 32px));
}
.notify{
  width:100%;
  background:#ffffff;
  color:#111827;
  border:1px solid #e5e7eb;
  border-radius:12px;
  box-shadow:0 10px 30px rgba(2,6,23,.12),0 2px 8px rgba(2,6,23,.08);
  pointer-events:auto;
  overflow:hidden;
  opacity:1;
  transform:translateY(0);
  transition:opacity .18s ease,transform .18s ease;
  font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans Thai","Prompt",Arial,sans-serif;
}
.notify.hide{opacity:0;transform:translateY(-6px);}
.notify__head{display:flex;align-items:center;gap:10px;padding:10px 12px 8px 12px;}
.notify__icon{
  width:22px;height:22px;display:grid;place-items:center;
  background:#d1fae5;color:#059669;border-radius:999px;flex:0 0 22px;
}
.notify__title{font-weight:650;color:#111827;font-size:14px;line-height:1.15;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.notify__meta{margin-left:auto;color:#6b7280;font-size:12px;display:flex;align-items:center;gap:10px;white-space:nowrap;}
.notify__close{
  appearance:none;background:transparent;border:0;color:#9ca3af;
  cursor:pointer;font-size:16px;line-height:1;padding:2px;border-radius:6px;
}
.notify__close:hover{color:#6b7280;background:#f3f4f6;}
.notify__body{padding:10px 12px 12px 12px;color:#374151;font-size:13px;border-top:1px solid #f3f4f6;font-weight:400;line-height:1.55;}
.notify--success .notify__icon{background:#d1fae5;color:#059669;}
.notify--info .notify__icon{background:#e0e7ff;color:#4f46e5;}
.notify--warn .notify__icon{background:#ecfdf5;color:#009f3f;}
.notify--error .notify__icon{background:#fee2e2;color:#dc2626;}
@media (max-width:640px){
  .notify-root{inset:10px 10px auto 10px;width:auto;}
  .notify{border-radius:12px;}
}
`;

function normalizeVariant(value?: unknown) {
  const v = String(value || '').toLowerCase();
  if (['success', 'ok', 'done', 'saved'].includes(v)) return 'success';
  if (['error', 'err', 'danger', 'fail', 'failed'].includes(v)) return 'error';
  if (['warn', 'warning'].includes(v)) return 'warn';
  return 'info';
}

function defaultTitle(variant: string) {
  if (variant === 'success') return 'สำเร็จ';
  if (variant === 'error') return 'ไม่สำเร็จ';
  if (variant === 'warn') return 'แจ้งเตือน';
  return 'แจ้งเตือน';
}

function textFrom(value: unknown) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return String(obj.text || obj.message || obj.error || '');
  }
  return String(value);
}

function iconSvg() {
  return `
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
      <path d="M9.55 16.2 5.8 12.45a1 1 0 1 1 1.4-1.4l2.35 2.34 5.24-5.24a1 1 0 1 1 1.42 1.42l-5.95 5.95a1 1 0 0 1-1.41 0Z"/>
    </svg>`;
}

export default function GlobalNotify() {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    if (!document.getElementById('notify-style')) {
      const style = document.createElement('style');
      style.id = 'notify-style';
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    let root = document.getElementById('notify-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'notify-root';
      root.className = 'notify-root';
      root.setAttribute('aria-live', 'polite');
      root.setAttribute('aria-atomic', 'false');
      document.body.appendChild(root);
    }

    const push = ({ variant = 'info', title = '', text = '', timeout = 3500 }: any = {}) => {
      const v = normalizeVariant(variant);
      const notify = document.createElement('div');
      notify.className = `notify notify--${v}`;
      notify.setAttribute('role', 'status');
      notify.setAttribute('aria-live', 'polite');
      notify.innerHTML = `
        <div class="notify__head">
          <span class="notify__icon">${iconSvg()}</span>
          <span class="notify__title"></span>
          <div class="notify__meta">
            <span class="notify__time">just now</span>
            <button class="notify__close" type="button" aria-label="close">×</button>
          </div>
        </div>
        ${textFrom(text) ? '<div class="notify__body"></div>' : ''}
      `;
      const safeTitle = String(title || defaultTitle(v));
      const safeText = textFrom(text);
      const titleEl = notify.querySelector('.notify__title');
      const bodyEl = notify.querySelector('.notify__body');
      if (titleEl) titleEl.textContent = safeTitle;
      if (bodyEl) bodyEl.textContent = safeText;

      const close = () => {
        notify.classList.add('hide');
        window.setTimeout(() => notify.remove(), 180);
      };
      notify.querySelector('.notify__close')?.addEventListener('click', close);
      root.prepend(notify);
      if (Number(timeout) > 0) window.setTimeout(close, Number(timeout));
      return close;
    };

    const api: any = {
      push,
      success: (title: unknown, text?: unknown, options: any = {}) => push({ ...options, variant: 'success', title, text }),
      info: (title: unknown, text?: unknown, options: any = {}) => push({ ...options, variant: 'info', title, text }),
      warn: (title: unknown, text?: unknown, options: any = {}) => push({ ...options, variant: 'warn', title, text }),
      error: (title: unknown, text?: unknown, options: any = {}) => push({ ...options, variant: 'error', title, text }),
      from: (payload: any = {}, fallbackTitle?: string) => {
        const variant = normalizeVariant(payload.type || payload.variant || (payload.ok === false ? 'error' : payload.ok === true ? 'success' : 'info'));
        return push({
          variant,
          title: payload.title || fallbackTitle || defaultTitle(variant),
          text: payload.text || payload.message || payload.error || '',
          timeout: payload.timeout ?? 3500,
        });
      },
    };

    window.notify = api;
    window.__rtNotify = api;
    window.showMsg = (opts: any = {}) => api.from(opts);
    window.dispatchNotify = (payload: any = {}) => api.from(payload);
    window.__rtNotifyReady = true;

    const onNotify = (event: Event) => api.from((event as CustomEvent).detail || {});
    window.addEventListener('rt:notify', onNotify as EventListener);

    if (!window.__rtOriginalAlert) window.__rtOriginalAlert = window.alert;
    window.alert = (message?: any) => push({ variant: 'info', title: 'แจ้งเตือน', text: String(message ?? '') });

    return () => {
      window.removeEventListener('rt:notify', onNotify as EventListener);
    };
  }, []);

  return <div id="notify-root" className="notify-root" aria-live="polite" aria-atomic="false" />;
}
