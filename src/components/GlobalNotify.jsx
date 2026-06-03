'use client';

import { useEffect } from 'react';

const CSS = `
.rt-notify-root{
  position:fixed;
  top:16px;
  right:16px;
  z-index:2147483647;
  display:flex;
  flex-direction:column;
  gap:12px;
  pointer-events:none;
  width:min(440px,calc(100vw - 32px));
}
.rt-notify{
  width:100%;
  pointer-events:auto;
  overflow:hidden;
  border-radius:16px;
  border:1px solid rgba(255,255,255,.10);
  background:
    radial-gradient(circle at 12% 0%, rgba(8,184,79,.18), transparent 34%),
    linear-gradient(145deg, rgba(26,28,34,.97), rgba(10,12,16,.97));
  color:#eef6ff;
  box-shadow:0 18px 46px rgba(0,0,0,.42), inset 0 1px 0 rgba(255,255,255,.06);
  transform:translateY(0) scale(1);
  opacity:1;
  transition:opacity .18s ease, transform .18s ease;
  font-family:inherit, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.rt-notify.hide{ opacity:0; transform:translateY(-8px) scale(.98); }
.rt-notify__head{ display:flex; align-items:center; gap:10px; padding:12px 14px 10px; }
.rt-notify__icon{
  width:28px; height:28px; flex:0 0 28px; border-radius:999px; display:grid; place-items:center;
  background:rgba(8,184,79,.16); color:#38e986; border:1px solid rgba(8,184,79,.28);
  box-shadow:0 0 24px rgba(8,184,79,.16);
}
.rt-notify__title{ min-width:0; flex:1; color:#eef6ff; font-size:14px; line-height:1.25; font-weight:900; letter-spacing:-.01em; }
.rt-notify__meta{ display:flex; align-items:center; gap:8px; color:rgba(238,246,255,.48); font-size:11px; font-weight:800; }
.rt-notify__close{
  appearance:none; border:0; width:26px; height:26px; border-radius:9px; cursor:pointer;
  background:rgba(255,255,255,.055); color:rgba(238,246,255,.74); font-size:16px; line-height:1;
  transition:background .18s ease, color .18s ease, transform .18s ease;
}
.rt-notify__close:hover{ background:rgba(255,255,255,.10); color:#fff; transform:translateY(-1px); }
.rt-notify__body{ padding:0 14px 13px 52px; margin-top:-2px; color:rgba(238,246,255,.72); font-size:13px; line-height:1.55; font-weight:650; }
.rt-notify::before{ content:''; display:block; height:3px; background:linear-gradient(90deg,#08b84f,#38e986); opacity:.88; }
.rt-notify--success .rt-notify__icon{ background:rgba(8,184,79,.16); color:#38e986; border-color:rgba(8,184,79,.32); }
.rt-notify--success::before{ background:linear-gradient(90deg,#05b84f,#38e986); }
.rt-notify--info .rt-notify__icon{ background:rgba(86,183,255,.14); color:#7fd3ff; border-color:rgba(86,183,255,.28); }
.rt-notify--info::before{ background:linear-gradient(90deg,#38a7ff,#7fd3ff); }
.rt-notify--warn .rt-notify__icon{ background:rgba(251,191,36,.14); color:#fbbf24; border-color:rgba(251,191,36,.30); }
.rt-notify--warn::before{ background:linear-gradient(90deg,#f59e0b,#fbbf24); }
.rt-notify--error .rt-notify__icon{ background:rgba(255,95,115,.14); color:#ff8a99; border-color:rgba(255,95,115,.30); }
.rt-notify--error::before{ background:linear-gradient(90deg,#ef4444,#ff8a99); }
@media (max-width:640px){
  .rt-notify-root{ top:10px; right:10px; left:10px; width:auto; }
  .rt-notify{ border-radius:14px; }
  .rt-notify__body{ padding-left:14px; }
}
`;

function normalizeVariant(v) {
  const s = String(v || '').toLowerCase();
  if (['ok', 'success', 'done'].includes(s)) return 'success';
  if (['err', 'error', 'danger', 'fail', 'failed'].includes(s)) return 'error';
  if (['warn', 'warning'].includes(s)) return 'warn';
  return 'info';
}

function defaultTitle(variant) {
  if (variant === 'success') return 'สำเร็จ';
  if (variant === 'error') return 'ไม่สำเร็จ';
  if (variant === 'warn') return 'แจ้งเตือน';
  return 'แจ้งเตือน';
}

function iconFor(variant) {
  if (variant === 'success') return '✓';
  if (variant === 'error') return '!';
  if (variant === 'warn') return '⚠';
  return 'i';
}

function toText(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return value.text || value.message || value.error || '';
  return String(value);
}

export default function GlobalNotify() {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    if (!document.getElementById('rt-notify-style')) {
      const style = document.createElement('style');
      style.id = 'rt-notify-style';
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    let root = document.getElementById('rt-notify-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'rt-notify-root';
      root.className = 'rt-notify-root';
      root.setAttribute('aria-live', 'polite');
      root.setAttribute('aria-atomic', 'false');
      document.body.appendChild(root);
    }

    const makeNotify = ({ variant = 'info', title, text, timeout = 3600 } = {}) => {
      const v = normalizeVariant(variant);
      const bodyText = toText(text);
      const heading = title || defaultTitle(v);
      const el = document.createElement('div');
      el.className = `rt-notify rt-notify--${v}`;
      el.setAttribute('role', 'status');
      el.innerHTML = `
        <div class="rt-notify__head">
          <span class="rt-notify__icon" aria-hidden="true">${iconFor(v)}</span>
          <span class="rt-notify__title"></span>
          <div class="rt-notify__meta">
            <span>just now</span>
            <button class="rt-notify__close" type="button" aria-label="ปิด">×</button>
          </div>
        </div>
        ${bodyText ? '<div class="rt-notify__body"></div>' : ''}
      `;
      el.querySelector('.rt-notify__title').textContent = heading;
      const body = el.querySelector('.rt-notify__body');
      if (body) body.textContent = bodyText;
      const close = () => {
        el.classList.add('hide');
        window.setTimeout(() => el.remove(), 180);
      };
      el.querySelector('.rt-notify__close')?.addEventListener('click', close);
      root.prepend(el);
      if (timeout > 0) window.setTimeout(close, timeout);
      return close;
    };

    const notifyApi = {
      push: makeNotify,
      success: (title, text, options = {}) => makeNotify({ ...options, variant: 'success', title, text }),
      info: (title, text, options = {}) => makeNotify({ ...options, variant: 'info', title, text }),
      warn: (title, text, options = {}) => makeNotify({ ...options, variant: 'warn', title, text }),
      error: (title, text, options = {}) => makeNotify({ ...options, variant: 'error', title, text }),
      from: (payload, fallbackTitle) => {
        if (!payload) return null;
        const variant = normalizeVariant(payload.type || payload.variant || (payload.ok === false ? 'error' : payload.ok === true ? 'success' : 'info'));
        return makeNotify({ variant, title: payload.title || fallbackTitle || defaultTitle(variant), text: toText(payload), timeout: payload.timeout ?? 3600 });
      },
    };

    window.notify = notifyApi;
    window.showMsg = (opts = {}) => notifyApi.from(opts);
    window.dispatchNotify = (payload = {}) => notifyApi.from(payload);
    window.__rtNotifyReady = true;

    const onNotify = (event) => notifyApi.from(event.detail || {});
    window.addEventListener('rt:notify', onNotify);

    if (!window.__rtOriginalAlert) window.__rtOriginalAlert = window.alert;
    window.alert = (message) => notifyApi.info('แจ้งเตือน', String(message ?? ''));

    return () => window.removeEventListener('rt:notify', onNotify);
  }, []);

  return <div id="rt-notify-root" className="rt-notify-root" aria-live="polite" aria-atomic="false" />;
}
