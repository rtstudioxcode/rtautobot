'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { notifyMsg, copyTextWithNotify } from '../../lib/clientNotify';
import SvgIcon from '@/components/SvgIcon';

const DAY_MS = 86400000;

function calcExpiry(rec) {
  const m = String(rec?.LICENSE_START_DATE || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  let year = Number(m[3]);
  if (year > 2400) year -= 543;
  const start = new Date(Date.UTC(year, Number(m[2]) - 1, Number(m[1])));
  if (!Number.isFinite(start.getTime())) return null;
  return new Date(start.getTime() + Number(rec.LICENSE_DURATION_DAYS || 0) * DAY_MS);
}


function getWebhookLink(rec) {
  const raw = String(rec?.LINK || rec?.webhookUrl || rec?.webhookPath || '').trim();
  if (raw) return raw;
  const key = String(rec?.serviceKey || rec?.tenantId || '').trim();
  return key ? `/webhook/${encodeURIComponent(key)}` : '';
}

const BT_NOTICE_KEY = 'bt_notice_suppress_v1';

const PLANS_NORMAL = [
  { days: 30, price: 1500, label: '1 เดือน', discount: '0%' },
  { days: 90, price: 4050, label: '3 เดือน', discount: '-10%' },
  { days: 180, price: 7200, label: '6 เดือน', discount: '-20%' },
  { days: 365, price: 12600, label: '12 เดือน', discount: '-30%' },
  { days: 730, price: 21600, label: '24 เดือน', discount: '-40%' },
];
const PLANS_LOTTO = [
  { days: 30, price: 2000, label: '1 เดือน', discount: '0%' },
  { days: 90, price: 5400, label: '3 เดือน', discount: '-10%' },
  { days: 180, price: 9600, label: '6 เดือน', discount: '-20%' },
  { days: 365, price: 16800, label: '12 เดือน', discount: '-30%' },
  { days: 730, price: 28800, label: '24 เดือน', discount: '-40%' },
];

const PKG1_FEATURES = [
  'BOT LINE ช่วยส่งโบนัสไทม์-ตอบลูกค้าแทนคุณ ใช้ง่าย ประหยัดเวลา คุ้มสุด ๆ',
  'อัปเดตรูปเกมให้ฟรีตลอดระยะเวลาการใช้งาน',
  'รองรับเกมสล็อตจากค่ายดังมากมาย',
  'ระบบตอบคำถามลูกค้าอัตโนมัติ',
  'ระบบอัปเดตเกมให้ทุก 5 นาทีสำหรับสล็อต',
  'ระบบอัปเดตห้องให้ทุก 20 วินาทีสำหรับบาคาร่า',
  'ระบบอัปเดตอัตราการชนะให้ทุกครั้งที่เปลี่ยนเกม & ห้อง',
];

const PKG2_FEATURES = [
  'รวมสล็อต บาคาร่า และหวยในระบบเดียว จัดเต็มฟีเจอร์สายเกม & สายหวย',
  'อัปเดตรูปเกมให้ฟรีตลอดระยะเวลาการใช้งาน',
  'อัปเดตรูปเกมให้ฟรีตลอดระยะเวลาการใช้งาน',
  'รองรับเกมสล็อตจากค่ายดังมากมาย',
  'ระบบตอบคำถามลูกค้าอัตโนมัติ',
  'ระบบอัปเดตเกมให้ทุก 5 นาทีสำหรับสล็อต',
  'ระบบอัปเดตห้องให้ทุก 20 วินาทีสำหรับบาคาร่า',
  'ระบบอัปเดตอัตราการชนะให้ทุกครั้งที่เปลี่ยนเกม & ห้อง',
  'ฟีเจอร์ครบครันสำหรับสายหวย',
  'หวยจะอัปเดตก่อนเวลาหวยออก 20 ชั่วโมง',
];

const CSS = `
.page.bonustime {
  --bt-page: #07080b;
  --bt-card: #17181e;
  --bt-card-2: #111215;
  --bt-text: #eef6ff;
  --bt-muted: #08b84f;
  --bt-border: rgba(255,255,255,.12);
  --bt-accent: #08b84f;
  --bt-accent-2: #08b84f;
  --bt-green-dark: #05b84f;
  --bt-shadow: rgba(0,0,0,.42);
  color: var(--bt-text);
  position: relative;
  isolation: isolate;
  padding-bottom: 48px;
}
.page.bonustime::before {
  content: none;
  display: none;
}
.page.bonustime * { box-sizing: border-box; }
.page.bonustime .muted { color: var(--bt-muted); }

/* Empty state */
.page.bonustime .bt-empty-state {
  max-width: 760px;
  margin: 40px auto;
  border-radius: 30px;
  border: 1px solid var(--bt-border);
  background:
    radial-gradient(circle at 50% 0%, color-mix(in srgb,var(--bt-accent) 18%,transparent), transparent 46%),
    linear-gradient(145deg, color-mix(in srgb,var(--bt-card) 94%,transparent), color-mix(in srgb,var(--bt-card-2) 96%,transparent));
  box-shadow: 0 26px 80px var(--bt-shadow), inset 0 1px 0 rgba(255,255,255,.08);
  padding: 24px;
  text-align: center;
  animation: btRise .55s cubic-bezier(.2,.9,.2,1) both;
}
.page.bonustime .bt-empty-state h2 { font-size: clamp(28px,4vw,46px); margin: 0 0 10px; letter-spacing: -.05em; color: var(--bt-text); }
.page.bonustime .bt-empty-state .bt-register-btn {
  display: inline-flex; align-items: center; justify-content: center;
  min-height: 52px; padding: 0 28px; border-radius: 18px; border: 0; cursor: pointer;
  color: #17130a; font-weight: 650; font-size: 16px; font-family: inherit;
  background: linear-gradient(135deg, #08b84f, #08b84f 55%, #05b84f);
  box-shadow: 0 18px 38px color-mix(in srgb,var(--bt-accent) 24%,transparent), inset 0 1px 0 rgba(255,255,255,.55);
  transition: transform .2s ease, filter .2s ease;
  margin-top: 16px;
}
.page.bonustime .bt-empty-state .bt-register-btn:hover { transform: translateY(-2px); filter: saturate(1.05); }

/* Hero */
.page.bonustime .bt-hero-enterprise {
  position: relative; overflow: hidden;
  display: grid; grid-template-columns: minmax(0,1.2fr) minmax(320px,.8fr);
  gap: 24px; align-items: end;
  padding: 34px 38px; margin: 0 0 18px; min-height: 250px;
  border: 1px solid var(--bt-border); border-radius: 34px;
  background:
    linear-gradient(135deg, color-mix(in srgb,var(--bt-card) 88%,transparent), color-mix(in srgb,var(--bt-card-2) 96%,transparent)),
    radial-gradient(circle at 80% 12%, color-mix(in srgb,var(--bt-accent) 18%,transparent), transparent 34%);
  box-shadow: 0 30px 90px var(--bt-shadow), inset 0 1px 0 rgba(255,255,255,.08);
  animation: btRise .55s cubic-bezier(.2,.9,.2,1) both;
}
.page.bonustime .bt-hero-enterprise::after {
  content: ""; position: absolute; inset: -35% -18% auto auto; width: 420px; height: 420px; transform: rotate(18deg);
  background: linear-gradient(90deg,transparent,rgba(255,255,255,.08),transparent);
  filter: blur(.4px); opacity: .8; animation: btSheen 7s ease-in-out infinite;
}
.page.bonustime .bt-hero-glow { position: absolute; border-radius: 999px; filter: blur(36px); opacity: .55; pointer-events: none; }
.page.bonustime .bt-hero-glow.one { width: 230px; height: 230px; left: 8%; top: 18%; background: color-mix(in srgb,var(--bt-accent) 24%,transparent); }
.page.bonustime .bt-hero-glow.two { width: 280px; height: 280px; right: 8%; bottom: -34%; background: rgba(116,88,255,.24); }
.page.bonustime .bt-hero-copy { position: relative; z-index: 1; }
.page.bonustime .bt-kicker {
  display: inline-flex; align-items: center; gap: 8px; margin-bottom: 18px; padding: 9px 15px; border-radius: 999px;
  color: var(--bt-accent-2); font-size: 12px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase;
  border: 1px solid color-mix(in srgb,var(--bt-accent) 50%,transparent);
  background: color-mix(in srgb,var(--bt-accent) 10%,transparent);
}
.page.bonustime .bt-hero-copy h1 { margin: 0 0 12px; font-size: clamp(42px,6vw,78px); line-height: .92; letter-spacing: -.075em; color: var(--bt-text); }
.page.bonustime .bt-hero-copy p { max-width: 780px; margin: 0; color: var(--bt-muted); font-size: clamp(15px,1.3vw,18px); line-height: 1.8; font-weight: 450; }
.page.bonustime .bt-hero-metrics { position: relative; z-index: 1; display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 12px; }
.page.bonustime .bt-metric-card {
  min-height: 94px; padding: 18px; border-radius: 22px; border: 1px solid var(--bt-border);
  background: linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.012));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.06); transition: .22s ease;
}
.page.bonustime .bt-metric-card:hover { transform: translateY(-3px); border-color: color-mix(in srgb,var(--bt-accent) 55%,transparent); }
.page.bonustime .bt-metric-card strong { display: block; font-size: clamp(22px,2.2vw,30px); line-height: 1; color: var(--bt-accent-2); letter-spacing: -.04em; }
.page.bonustime .bt-metric-card span { display: block; margin-top: 9px; color: var(--bt-muted); font-size: 12px; font-weight: 500; }

/* Tabs */
.page.bonustime .bt-tabbar {
  position: relative; display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 10px; width: 100%;
  padding: 8px; margin: 0 0 18px; border-radius: 26px; border: 1px solid var(--bt-border);
  background: linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.012)), var(--bt-card);
  box-shadow: 0 18px 52px var(--bt-shadow), inset 0 1px 0 rgba(255,255,255,.06);
  backdrop-filter: blur(14px);
  animation: btRise .65s .06s cubic-bezier(.2,.9,.2,1) both;
}
.page.bonustime .bt-tab {
  min-height: 56px; border: 0; border-radius: 18px; background: transparent; color: var(--bt-muted);
  cursor: pointer; font-size: 15px; font-weight: 600; font-family: inherit;
  display: flex; align-items: center; justify-content: center; gap: 10px;
  transition: transform .2s ease, background .2s ease, color .2s ease, box-shadow .2s ease;
}
.page.bonustime .bt-tab:hover { transform: translateY(-1px); background: color-mix(in srgb,var(--bt-card-2) 86%,transparent); color: var(--bt-text); }
.page.bonustime .bt-tab.active {
  color: #17130a; background: linear-gradient(135deg,#08b84f,#08b84f 55%,#05b84f);
  box-shadow: 0 12px 28px color-mix(in srgb,var(--bt-accent) 25%,transparent), inset 0 1px 0 rgba(255,255,255,.55);
}
.page.bonustime .tabpane { animation: btFade .28s ease both; }

/* Order/History/Help panels */
.page.bonustime .bonustime-order,
.page.bonustime .tab-history,
.page.bonustime .tab-helpers {
  border: 1px solid var(--bt-border); border-radius: 32px; padding: 26px;
  background:
    radial-gradient(circle at 8% 0%, color-mix(in srgb,var(--bt-accent) 10%,transparent), transparent 34%),
    linear-gradient(180deg,color-mix(in srgb,var(--bt-card) 92%,transparent),color-mix(in srgb,var(--bt-card-2) 96%,transparent));
  box-shadow: 0 24px 70px var(--bt-shadow), inset 0 1px 0 rgba(255,255,255,.06);
}

/* Package grid */
.page.bonustime .bt-package-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 18px; }
.page.bonustime .bt-package {
  position: relative; overflow: hidden; border-radius: 28px; border: 1px solid var(--bt-border);
  background: linear-gradient(145deg,color-mix(in srgb,var(--bt-card) 94%,transparent),color-mix(in srgb,var(--bt-card-2) 98%,transparent));
  box-shadow: 0 20px 58px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.06);
  transform: translateZ(0); transition: transform .24s ease, border-color .24s ease, box-shadow .24s ease;
  animation: btRise .6s cubic-bezier(.2,.9,.2,1) both; display: flex; flex-direction: column;
}
.page.bonustime .bt-package:nth-child(2) { animation-delay: .08s; }
.page.bonustime .bt-package::before {
  content: ""; position: absolute; inset: 0;
  background: radial-gradient(circle at 50% -10%,color-mix(in srgb,var(--bt-accent) 14%,transparent),transparent 38%);
  pointer-events: none;
}
.page.bonustime .bt-package:hover { transform: translateY(-5px); border-color: color-mix(in srgb,var(--bt-accent) 52%,transparent); box-shadow: 0 30px 80px var(--bt-shadow), 0 0 0 1px color-mix(in srgb,var(--bt-accent) 12%,transparent) inset; }
.page.bonustime .pkg-head { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 18px 18px 12px; }
.page.bonustime .pkg-title { font-size: 18px; font-weight: 650; color: var(--bt-text); letter-spacing: -.02em; }
.page.bonustime .pkg-remaining {
  display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; padding: 8px 12px;
  font-size: 12px; font-weight: 650; color: var(--bt-accent-2);
  border: 1px solid color-mix(in srgb,var(--bt-accent) 38%,transparent);
  background: color-mix(in srgb,var(--bt-accent) 10%,transparent);
}
.page.bonustime .pkg-remaining.sold { color: #ff5f75; border-color: rgba(255,95,115,.38); background: rgba(255,95,115,.10); }
.page.bonustime .pkg-remaining.near { color: #ffc85a; border-color: rgba(255,200,90,.38); background: rgba(255,200,90,.10); }
.page.bonustime .pkg-body { position: relative; padding: 0 18px 18px; flex: 1; }
.page.bonustime .pkg-thumb { overflow: hidden; border-radius: 24px; border: 1px solid var(--bt-border); background: color-mix(in srgb,var(--bt-page) 60%,transparent); box-shadow: inset 0 1px 0 rgba(255,255,255,.06); }
.page.bonustime .pkg-thumb img { display: block; width: 100%; height: auto; transition: transform .45s ease, filter .45s ease; }
.page.bonustime .bt-package:hover .pkg-thumb img { transform: scale(1.035); filter: saturate(1.08) contrast(1.04); }
.page.bonustime .pkg-meta { margin: 14px 0 8px; }
.page.bonustime .pkg-badge {
  display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; padding: 6px 10px;
  font-size: 11px; font-weight: 650; color: var(--bt-accent-2);
  border: 1px solid color-mix(in srgb,var(--bt-accent) 38%,transparent);
  background: color-mix(in srgb,var(--bt-accent) 10%,transparent);
}
.page.bonustime .pkg-hint { font-weight: 500; margin-bottom: 10px; cursor: pointer; color: var(--bt-muted); font-size: 13px; display: flex; align-items: center; gap: 6px; }
.page.bonustime .pkg-details { border-radius: 22px; padding: 16px; border: 1px solid var(--bt-border); background: color-mix(in srgb,var(--bt-page) 34%,transparent); margin-top: 8px; }
.page.bonustime .pkg-desc { margin: 0 0 14px; color: var(--bt-muted); line-height: 1.75; font-weight: 450; font-size: 13px; }
.page.bonustime .pkg-price { color: var(--bt-accent-2); font-size: 20px; font-weight: 650; letter-spacing: -.03em; }
.page.bonustime .pkg-price.sub { font-size: 13px; font-weight: 500; color: var(--bt-muted); margin-top: 4px; }
.page.bonustime .pkg-actions { padding: 0 18px 18px; margin-top: auto; }
.page.bonustime .bt-btn-primary {
  display: flex; align-items: center; justify-content: center; width: 100%;
  min-height: 52px; border: 0; border-radius: 18px; cursor: pointer;
  color: #17130a; font-weight: 650; font-size: 15px; font-family: inherit;
  background: linear-gradient(135deg,#08b84f,#08b84f 55%,#05b84f);
  box-shadow: 0 18px 38px color-mix(in srgb,var(--bt-accent) 22%,transparent), inset 0 1px 0 rgba(255,255,255,.55);
  transition: transform .2s ease, filter .2s ease, box-shadow .2s ease;
}
.page.bonustime .bt-btn-primary:hover { transform: translateY(-2px); filter: saturate(1.05); box-shadow: 0 24px 48px color-mix(in srgb,var(--bt-accent) 28%,transparent), inset 0 1px 0 rgba(255,255,255,.6); }
.page.bonustime .bt-btn-primary:disabled { opacity: .5; cursor: not-allowed; transform: none; filter: none; }

/* Flash message */
.page.bonustime .bt-flash {
  padding: 14px 18px; border-radius: 18px; font-size: 14px; margin-bottom: 14px; font-weight: 600;
  border: 1px solid; animation: btFade .25s ease both;
}
.page.bonustime .bt-flash.success { background: rgba(8,184,79,.12); border-color: rgba(8,184,79,.30); color: #38e986; }
.page.bonustime .bt-flash.error { background: rgba(255,95,115,.12); border-color: rgba(255,95,115,.30); color: #ffb6bf; }

/* History */
.page.bonustime .history-list { display: grid; gap: 12px; }
.page.bonustime .bt-history-card {
  border-radius: 20px; border: 1px solid var(--bt-border);
  background: color-mix(in srgb,var(--bt-card-2) 92%,transparent);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.045); padding: 16px;
}
.page.bonustime .bt-history-card .rec-name { font-weight: 600; font-size: 15px; color: var(--bt-text); }
.page.bonustime .bt-history-card .rec-key { font-size: 12px; color: var(--bt-muted); font-family: monospace; }
.page.bonustime .rec-badge {
  display: inline-flex; align-items: center; border-radius: 999px; padding: 5px 10px;
  font-size: 11px; font-weight: 650;
}
.page.bonustime .rec-badge.active { background: rgba(8,184,79,.14); color: #38e986; border: 1px solid rgba(8,184,79,.30); }
.page.bonustime .rec-badge.expired { background: rgba(255,95,115,.14); color: #ff8a99; border: 1px solid rgba(255,95,115,.28); }
.page.bonustime .rec-badge.permanent { background: rgba(78,183,255,.14); color: #7fd3ff; border: 1px solid rgba(78,183,255,.28); }
.page.bonustime .rec-webhook-linkbox {
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
  margin-top: 2px; color: rgba(238,246,255,.58);
}
.page.bonustime .rec-webhook-label { color: #7fd3ff; font-weight: 800; }
.page.bonustime .rec-webhook-link {
  display: inline-flex; align-items: center; min-width: 0; max-width: min(620px,100%);
  color: #38e986; font-family: monospace; font-size: 12px; font-weight: 800;
  text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  border: 0; border-bottom: 1px dashed rgba(56,233,134,.48);
  background: transparent; padding: 0; cursor: copy; font: inherit; font-family: monospace;
}
.page.bonustime .rec-webhook-link:hover,
.page.bonustime .rec-webhook-link:focus-visible {
  color: #7cffb2; border-bottom-color: rgba(124,255,178,.85); outline: none;
}
.page.bonustime .rec-webhook-copy {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  min-height: 28px; padding: 0 10px; border-radius: 999px;
  border: 1px solid rgba(124,255,178,.28);
  background: rgba(8,184,79,.12); color: #7cffb2;
  font-size: 11px; font-weight: 900; font-family: inherit;
  cursor: copy; transition: transform .18s ease, background .18s ease, border-color .18s ease;
}
.page.bonustime .rec-webhook-copy:hover,
.page.bonustime .rec-webhook-copy:focus-visible {
  transform: translateY(-1px); background: rgba(8,184,79,.18); border-color: rgba(124,255,178,.48); outline: none;
}
.page.bonustime .rec-webhook-empty { color: rgba(238,246,255,.42); }
.page.bonustime .rec-actions { display: flex; gap: 10px; margin-top: 14px; }
.page.bonustime .rec-btn {
  flex: 1; display: flex; align-items: center; justify-content: center; height: 40px;
  border-radius: 14px; font-size: 13px; font-weight: 650; font-family: inherit; cursor: pointer;
  border: 1px solid var(--bt-border); transition: .2s ease; text-decoration: none; color: inherit;
}
.page.bonustime .rec-btn.primary { color: #17130a; border-color: transparent; background: linear-gradient(135deg,#08b84f,#05b84f); }
.page.bonustime .rec-btn.ghost { background: color-mix(in srgb,var(--bt-card) 60%,transparent); color: var(--bt-text); }
.page.bonustime .rec-btn:hover { transform: translateY(-1px); filter: saturate(1.05); }

/* Help accordion */
.page.bonustime .bt-help-title { font-size: clamp(28px,3.2vw,44px); letter-spacing: -.055em; margin: 0 0 8px; color: var(--bt-text); }
.page.bonustime .faq-card,
.page.bonustime .accordion-clean { border-radius: 28px; border: 1px solid var(--bt-border); background: transparent; box-shadow: none; }
.page.bonustime .accordion-clean ul { display: grid; gap: 12px; list-style: none; margin: 0; padding: 0; }
.page.bonustime .accordion-item {
  overflow: hidden; border-radius: 22px; border: 1px solid var(--bt-border);
  background: color-mix(in srgb,var(--bt-card-2) 91%,transparent);
  transition: transform .2s ease, border-color .2s ease, background .2s ease;
}
.page.bonustime .accordion-item:hover { transform: translateY(-2px); border-color: color-mix(in srgb,var(--bt-accent) 45%,transparent); }
.page.bonustime .accordion-title {
  padding: 18px 20px; color: var(--bt-text); font-weight: 650; display: flex; align-items: center;
  justify-content: space-between; gap: 10px; cursor: pointer; font-family: inherit; font-size: 15px;
  background: transparent; border: 0; width: 100%; text-align: left;
}
.page.bonustime .accordion-title:hover { background: rgba(8,184,79,.06); }
.page.bonustime .accordion-item.active .accordion-title { background: rgba(8,184,79,.12); }
.page.bonustime .accordion-content { padding: 0 20px 18px; color: var(--bt-muted); line-height: 1.75; font-size: 14px; }
.page.bonustime .accordion-arrow { font-size: 12px; transition: transform .2s ease; flex-shrink: 0; }
.page.bonustime .accordion-item.active .accordion-arrow { transform: rotate(180deg); }
.page.bonustime .help-steps { display: grid; gap: 10px; margin: 12px 0 0; padding-left: 18px; color: var(--bt-muted); }
.page.bonustime code { border-radius: 10px; padding: 2px 6px; background: color-mix(in srgb,var(--bt-page) 60%,transparent); border: 1px solid var(--bt-border); color: var(--bt-accent-2); font-size: 13px; }
.page.bonustime .bt-help-video-frame { position: relative; overflow: hidden; border-radius: 24px; border: 1px solid var(--bt-border); box-shadow: 0 18px 44px var(--bt-shadow); }
.page.bonustime .bt-help-video-frame iframe { width: 100%; aspect-ratio: 16/9; display: block; border: 0; }
.page.bonustime .bt-help-img img { width: 100%; border-radius: 18px; border: 1px solid var(--bt-border); box-shadow: 0 16px 40px var(--bt-shadow); }
.page.bonustime .bt-help-pdf .pdf-frame { position: relative; overflow: hidden; border-radius: 18px; border: 1px solid var(--bt-border); margin-bottom: 8px; }
.page.bonustime .bt-help-pdf .pdf-frame iframe { width: 100%; height: 400px; display: block; border: 0; }
.page.bonustime .bt-help-pdf a { color: #4ca8ff; text-decoration: underline; font-size: 13px; }
.page.bonustime .accordion-content strong { color: #05b84f; }
.page.bonustime .accordion-content a { color: #4ca8ff; text-decoration: underline; }
.page.bonustime .accordion-content p { margin: 0 0 10px; }
.page.bonustime .accordion-content h4 { font-size: 14px; font-weight: 400; margin: 16px 0 8px; color: var(--bt-text); }
.page.bonustime .accordion-content .mt-sm { margin-top: 14px; }
.page.bonustime .accordion-content .mt-xs { margin-top: 8px; }
.page.bonustime .accordion-content .mb-sm { margin-bottom: 10px; }
.page.bonustime .accordion-content .small { font-size: 12px; }

/* Keyframes */
@keyframes btRise { from{ opacity:0; transform:translateY(18px) scale(.985); } to{ opacity:1; transform:translateY(0) scale(1); } }
@keyframes btFade { from{ opacity:0; transform:translateY(8px); } to{ opacity:1; transform:translateY(0); } }
@keyframes btSheen { 0%,100%{ transform:translateX(-16px) rotate(18deg); opacity:.45; } 50%{ transform:translateX(28px) rotate(18deg); opacity:.85; } }

/* Responsive */
@media (max-width:1100px) {
  .page.bonustime .bt-hero-enterprise { grid-template-columns: 1fr; }
  .page.bonustime .bt-hero-metrics { max-width: 720px; }
}
@media (max-width:780px) {
  .page.bonustime .bt-hero-enterprise { padding: 26px 20px; border-radius: 28px; }
  .page.bonustime .bt-hero-copy h1 { font-size: clamp(38px,12vw,58px); }
  .page.bonustime .bt-hero-metrics { grid-template-columns: 1fr; }
  .page.bonustime .bt-tabbar { grid-template-columns: 1fr; border-radius: 22px; }
  .page.bonustime .bt-tab { min-height: 48px; }
  .page.bonustime .bt-package-grid { grid-template-columns: 1fr; }
  .page.bonustime .bonustime-order, .page.bonustime .tab-history, .page.bonustime .tab-helpers { padding: 16px; border-radius: 24px; }
}

/* ── BtModal (order / extend) ── */
.bt-modal-overlay {
  position: fixed; inset: 0; z-index: 9900;
  display: grid; place-items: center; padding: 18px;
  background:
    radial-gradient(circle at 22% 18%, rgba(124,255,178,.22), transparent 32%),
    radial-gradient(circle at 78% 16%, rgba(125,92,255,.14), transparent 30%),
    rgba(0,0,0,.74);
  backdrop-filter: blur(14px) saturate(1.12);
  -webkit-backdrop-filter: blur(14px) saturate(1.12);
}
.bt-modal-bg { position: absolute; inset: 0; cursor: pointer; }
.bt-modal-dialog {
  position: relative; width: min(560px,100%); max-height: min(680px,calc(100dvh - 36px));
  overflow: hidden; display: grid; grid-template-rows: auto minmax(0,1fr);
  border-radius: 30px;
  border: 1px solid rgba(124,255,178,.28);
  background:
    radial-gradient(circle at 18% 14%, rgba(124,255,178,.12), transparent 30%),
    radial-gradient(circle at 88% 18%, rgba(125,92,255,.12), transparent 32%),
    linear-gradient(135deg, rgba(28,28,32,.98), rgba(14,14,18,.98));
  box-shadow: 0 34px 90px rgba(0,0,0,.56), inset 0 0 0 1px rgba(255,255,255,.035), 0 0 60px rgba(124,255,178,.06);
  animation: btModalIn .24s cubic-bezier(.2,.8,.2,1) both;
}
.bt-modal-head {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
  padding: 22px 24px 18px;
  border-bottom: 1px solid rgba(255,255,255,.09);
  background: linear-gradient(135deg, rgba(124,255,178,.09), rgba(255,255,255,.015));
}
.bt-modal-kicker {
  display: inline-flex; align-items: center; gap: 8px; margin-bottom: 9px;
  padding: 7px 12px; border-radius: 999px;
  border: 1px solid rgba(124,255,178,.34); background: rgba(124,255,178,.075);
  color: #08b84f; font-size: 11px; font-weight: 950; letter-spacing: .08em; text-transform: uppercase;
}
.bt-modal-head h2 {
  margin: 0; font-size: clamp(22px,4vw,34px); font-weight: 1000; letter-spacing: -.05em;
  color: #eef6ff; line-height: 1.05;
}
.bt-modal-close {
  flex: 0 0 48px; width: 48px; height: 48px;
  border-radius: 16px; border: 1px solid rgba(255,255,255,.11);
  background: rgba(255,255,255,.045); color: #eef6ff;
  font-size: 26px; line-height: 1; cursor: pointer;
  transition: transform .18s ease, background .18s ease, border-color .18s ease;
}
.bt-modal-close:hover { transform: translateY(-1px) rotate(4deg); background: rgba(124,255,178,.12); border-color: rgba(124,255,178,.34); }
.bt-modal-body { overflow-y: auto; padding: 20px 24px 24px; -webkit-overflow-scrolling: touch; }
.bt-modal-body .label { display: block; margin-bottom: 6px; font-size: 13px; font-weight: 800; color: #08b84f; }
.bt-modal-body .input {
  width: 100%; min-height: 48px; border-radius: 14px;
  border: 1px solid rgba(124,255,178,.24); background: rgba(0,0,0,.28);
  color: #eef6ff; padding: 0 14px; font-weight: 600; font-size: 14px; font-family: inherit;
  outline: none; transition: border-color .18s ease; display: block;
}
.bt-modal-body .input:focus { border-color: rgba(124,255,178,.52); }
.bt-modal-body .card-sm {
  padding: 14px; border-radius: 16px;
  border: 1px solid rgba(255,255,255,.09); background: rgba(255,255,255,.04);
}
.bt-modal-body .btn-primary {
  display: flex; align-items: center; justify-content: center; width: 100%;
  min-height: 50px; border: 0; border-radius: 16px; cursor: pointer;
  color: #17130a; font-weight: 800; font-size: 15px; font-family: inherit;
  background: linear-gradient(135deg,#08b84f,#05b84f);
  box-shadow: 0 16px 36px rgba(8,184,79,.22), inset 0 1px 0 rgba(255,255,255,.5);
  transition: transform .2s ease, filter .2s ease;
}
.bt-modal-body .btn-primary:hover { transform: translateY(-2px); filter: saturate(1.05); }
.bt-modal-body .btn-primary:disabled { opacity: .5; cursor: not-allowed; transform: none; filter: none; }

/* ── BtNoticeModal ── */
.bt-notice-overlay {
  position: fixed !important; inset: 0 !important; z-index: 2147483000 !important;
  display: grid; place-items: center; padding: 18px; overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain; isolation: isolate;
  background:
    radial-gradient(circle at 50% 15%, rgba(24,201,100,.13), transparent 30%),
    radial-gradient(circle at 12% 85%, rgba(139,92,246,.16), transparent 26%),
    rgba(0,0,0,.76);
  backdrop-filter: blur(18px) saturate(1.15);
  -webkit-backdrop-filter: blur(18px) saturate(1.15);
  animation: btNoticeBackdropIn .32s ease both;
}
.bt-notice-bg { position: absolute; inset: 0; z-index: 0; cursor: pointer; }
.bt-notice-card {
  position: relative; z-index: 1; isolation: isolate; overflow: hidden; width: min(620px,100%); max-height:min(840px,calc(100dvh - 28px)); display:grid; grid-template-rows:auto minmax(0,1fr) auto;
  border-radius: 28px; border: 1px solid rgba(124,255,178,.32);
  background:
    linear-gradient(145deg,rgba(255,255,255,.085),rgba(255,255,255,.025) 38%,rgba(0,0,0,.32)),
    radial-gradient(circle at 16% 12%,rgba(24,201,100,.14),transparent 34%),
    radial-gradient(circle at 88% 82%,rgba(139,92,246,.18),transparent 32%),
    #111216;
  box-shadow: 0 32px 90px rgba(0,0,0,.72), inset 0 0 0 1px rgba(255,255,255,.035), 0 0 54px rgba(124,255,178,.12);
  animation: btNoticeCardIn .46s cubic-bezier(.16,1,.3,1) both;
}
.bt-notice-card::before {
  content: ""; position: absolute; inset: 0 0 auto 0; height: 4px;
  background: linear-gradient(90deg,#08b84f,#05b84f 42%,#8b5cf6 72%,#08b84f);
  opacity: .92; z-index: 3; box-shadow: 0 0 24px rgba(124,255,178,.38);
}
.bt-notice-aurora {
  position: absolute; inset: -35% -20% auto auto; width: 330px; height: 330px; border-radius: 999px;
  background: radial-gradient(circle,rgba(124,255,178,.34),rgba(6,199,85,.14) 38%,transparent 66%);
  filter: blur(8px); opacity: .9; animation: btNoticeFloat 7s ease-in-out infinite; z-index: -1;
}
.bt-notice-grid {
  position: absolute; inset: 0; z-index: -1; opacity: .23; pointer-events: none;
  background-image: linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px), linear-gradient(90deg,rgba(255,255,255,.032) 1px,transparent 1px);
  background-size: 34px 34px; mask-image: linear-gradient(to bottom,rgba(0,0,0,.6),transparent 76%);
}
.bt-notice-head { display: grid; grid-template-columns: auto minmax(0,1fr) auto; gap: 16px; align-items: center; padding: 28px 28px 22px; min-height:0; }
.bt-notice-icon {
  position: relative; width: 76px; height: 76px; border-radius: 24px; display: grid; place-items: center;
  background: linear-gradient(145deg,#21b95c,#05b84f 65%,#008c38);
  box-shadow: 0 18px 38px rgba(6,199,85,.28), inset 0 0 0 1px rgba(255,255,255,.32);
  animation: btNoticeIconPulse 2.8s ease-in-out infinite;
}
.bt-notice-icon::after {
  content: ""; position: absolute; inset: -10px; border-radius: 30px;
  border: 1px solid rgba(24,201,100,.16); opacity: .75; animation: btNoticeRing 2.7s ease-in-out infinite;
}
.bt-notice-icon-core { font-size: 30px; filter: drop-shadow(0 6px 10px rgba(0,0,0,.28)); }
.bt-notice-titlebox { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.bt-notice-kicker { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 6px; color: #08b84f; font-size: 12px; font-weight: 950; letter-spacing: .12em; text-transform: uppercase; }
.bt-notice-title { margin: 0; color: #eef6ff; font-size: clamp(25px,4.2vw,42px); line-height: 1.05; font-weight: 1000; letter-spacing: -.04em; }
.bt-notice-copy { margin: 10px 0 0; color: rgba(238,246,255,.72); font-size: 14px; line-height: 1.65; font-weight: 650; }
.bt-notice-x {
  align-self: start; width: 44px; height: 44px; border: 1px solid rgba(255,255,255,.09); border-radius: 16px;
  color: #21b95c; background: rgba(255,255,255,.055); box-shadow: 0 12px 30px rgba(0,0,0,.22);
  cursor: pointer; font-size: 25px; line-height: 1; transition: transform .22s ease, background .22s ease, border-color .22s ease;
}
.bt-notice-x:hover { transform: translateY(-2px) rotate(8deg); background: rgba(124,255,178,.12); border-color: rgba(124,255,178,.32); }
.bt-notice-body { min-height:0; padding: 0 28px 22px; overflow-y:auto; overflow-x:hidden; -webkit-overflow-scrolling:touch; scrollbar-gutter:stable; }
.bt-notice-warning {
  display: flex; gap: 10px; align-items: flex-start; padding: 13px 14px; border-radius: 18px;
  color: #21b95c; background: linear-gradient(135deg,rgba(124,255,178,.13),rgba(255,255,255,.035));
  border: 1px solid rgba(24,201,100,.16); font-weight: 800; font-size: 13px; line-height: 1.55;
  box-shadow: 0 16px 32px rgba(0,0,0,.18);
}
.bt-notice-warning-dot { width: 9px; height: 9px; margin-top: 6px; flex: 0 0 9px; border-radius: 999px; background: #08b84f; box-shadow: 0 0 18px rgba(124,255,178,.8); }
.bt-notice-steps { display: grid; gap: 12px; margin-top: 16px; }
.bt-notice-step {
  display: grid; grid-template-columns: 48px 1fr; gap: 13px; align-items: center;
  padding: 14px; border-radius: 20px; border: 1px solid rgba(255,255,255,.08);
  background: linear-gradient(135deg,rgba(255,255,255,.065),rgba(255,255,255,.022)),rgba(0,0,0,.18);
  box-shadow: 0 14px 30px rgba(0,0,0,.18); transition: transform .25s ease, border-color .25s ease;
}
.bt-notice-step:hover { transform: translateY(-2px); border-color: rgba(124,255,178,.28); }
.bt-step-no { width: 48px; height: 48px; border-radius: 16px; display: grid; place-items: center; color: #16120a; background: linear-gradient(145deg,#08b84f,#05b84f); box-shadow: 0 14px 26px rgba(6,199,85,.22); font-weight: 1000; font-size: 13px; }
.bt-notice-step.danger .bt-step-no { color: #fff; background: linear-gradient(145deg,#fb7185,#b91c1c); box-shadow: 0 14px 26px rgba(248,113,113,.22); }
.bt-step-copy strong { display: block; color: #eef6ff; font-size: 14px; font-weight: 950; line-height: 1.35; }
.bt-step-copy span { display: block; margin-top: 4px; color: rgba(238,246,255,.67); font-size: 13px; line-height: 1.55; font-weight: 650; }
.bt-notice-check { display: inline-flex; align-items: center; gap: 10px; margin-top: 18px; color: rgba(238,246,255,.78); font-size: 13px; font-weight: 800; cursor: pointer; user-select: none; }
.bt-notice-check input { position: absolute; opacity: 0; pointer-events: none; }
.bt-check-ui { width: 22px; height: 22px; border-radius: 7px; border: 1px solid rgba(124,255,178,.32); background: rgba(255,255,255,.055); box-shadow: 0 0 0 3px rgba(124,255,178,.05); display: grid; place-items: center; transition: .22s ease; flex-shrink: 0; }
.bt-check-ui::after { content: ""; width: 14px; height: 14px; border-right: 2px solid #16120a; border-bottom: 2px solid #16120a; transform: rotate(45deg) scale(.3); opacity: 0; transition: .22s ease; }
.bt-notice-check input:checked + .bt-check-ui { background: linear-gradient(145deg,#08b84f,#05b84f); border-color: rgba(255,255,255,.35); box-shadow: 0 0 26px rgba(124,255,178,.24); }
.bt-notice-check input:checked + .bt-check-ui::after { transform: scale(1); opacity: 1; }
.bt-notice-actions { position:relative; z-index:2; display: flex; justify-content: flex-end; gap: 12px; padding: 14px 28px 24px; background:linear-gradient(180deg,rgba(17,18,22,.78),rgba(17,18,22,.98)); border-top:1px solid rgba(255,255,255,.07); box-shadow:0 -18px 38px rgba(0,0,0,.28); }
.bt-notice-btn { min-height: 48px; padding: 0 20px; border-radius: 999px; border: 1px solid rgba(255,255,255,.10); cursor: pointer; font-weight: 950; color: #eef6ff; font-family: inherit; font-size: 14px; background: rgba(255,255,255,.055); box-shadow: 0 16px 34px rgba(0,0,0,.22); transition: transform .22s ease, box-shadow .22s ease, filter .22s ease; }
.bt-notice-btn:hover { transform: translateY(-2px); filter: brightness(1.05); }
.bt-notice-btn.primary { color: #03150f; border-color: rgba(255,255,255,.32); background: linear-gradient(135deg,#08b84f,#05b84f); box-shadow: 0 18px 38px rgba(6,199,85,.30), inset 0 0 0 1px rgba(255,255,255,.24); }

@keyframes btModalIn { from{opacity:0;transform:translateY(18px) scale(.965);filter:blur(8px);}to{opacity:1;transform:translateY(0) scale(1);filter:blur(0);} }
@keyframes btNoticeCardIn { from{opacity:0;transform:translateY(18px) scale(.965);filter:blur(8px);}to{opacity:1;transform:translateY(0) scale(1);filter:blur(0);} }
@keyframes btNoticeBackdropIn { from{opacity:0;}to{opacity:1;} }
@keyframes btNoticeFloat { 0%,100%{transform:translate3d(0,0,0) rotate(0deg);}50%{transform:translate3d(-24px,24px,0) rotate(10deg);} }
@keyframes btNoticeIconPulse { 0%,100%{transform:translateY(0);}50%{transform:translateY(-4px);} }
@keyframes btNoticeRing { 0%,100%{transform:scale(.94);opacity:.35;}50%{transform:scale(1.05);opacity:.82;} }
@media (max-width:640px) {
  .bt-notice-overlay { padding: 10px; align-items:center; }
  .bt-notice-card { width: min(420px,calc(100vw - 20px)); max-height: calc(100dvh - 20px); border-radius: 24px; }
  .bt-notice-head { grid-template-columns: 64px minmax(0,1fr) 42px; gap: 12px; padding: 18px 16px 12px; align-items:start; }
  .bt-notice-icon { grid-column: 1; width: 58px; height: 58px; border-radius: 20px; }
  .bt-notice-icon::after { inset:-7px; border-radius:24px; }
  .bt-notice-x { grid-column: 3; grid-row: 1; justify-self: end; width: 40px; height: 40px; border-radius:14px; }
  .bt-notice-titlebox { grid-column: 1 / -1; }
  .bt-notice-title { font-size:clamp(23px,7vw,30px); line-height:1.08; }
  .bt-notice-copy { font-size:13px; line-height:1.5; }
  .bt-notice-body { padding: 0 16px 12px; }
  .bt-notice-step { grid-template-columns: 42px 1fr; padding: 12px; border-radius: 18px; }
  .bt-step-no { width: 42px; height: 42px; border-radius: 14px; }
  .bt-notice-actions { padding: 12px 16px 16px; flex-direction: column-reverse; }
  .bt-notice-btn { width: 100%; }
}
`;

export default function BonustimePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('order');
  const [products, setProducts] = useState(null);
  const [history, setHistory] = useState([]);
  const [orderModal, setOrderModal] = useState(null);
  const [extendModal, setExtendModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [showNotice, setShowNotice] = useState(false);

  useEffect(() => {
    loadUser();
    try {
      const v = localStorage.getItem(BT_NOTICE_KEY);
      const ts = v ? Number(v) : 0;
      if (!ts || Date.now() > ts) setShowNotice(true);
    } catch {}
  }, []);

  async function loadUser() {
    const res = await fetch('/api/auth/me');
    if (!res.ok) { router.push('/login'); return; }
    const data = await res.json();
    setUser(data.user);
    setLoading(false);
    if (data.user?.serial_key) {
      loadProducts();
      loadHistory();
    }
  }

  async function loadProducts() {
    const res = await fetch('/api/bonustime/products');
    const data = await res.json();
    if (data.ok) setProducts(data.packages);
  }

  async function loadHistory() {
    const res = await fetch('/api/bonustime/history');
    const data = await res.json();
    if (data.ok) setHistory(data.records || []);
  }

  async function handleRegister() {
    setBusy(true);
    await fetch('/api/bonustime/register', { method: 'POST' });
    await loadUser();
    setBusy(false);
  }

  async function handleOrder(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const form = new FormData(e.target);
    const body = Object.fromEntries(form);
    const res = await fetch('/api/bonustime/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setBusy(false);
    if (!data.ok) { notifyMsg(setMsg, { type: 'error', text: data.message }); return; }
    notifyMsg(setMsg, { type: 'success', text: `สั่งซื้อสำเร็จ! เหลือเงิน ฿${Number(data.balance).toLocaleString()}` });
    setOrderModal(null);
    setUser((u) => ({ ...u, balance: data.balance }));
    setTab('history');
    loadHistory();
  }

  async function handleExtend(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const form = new FormData(e.target);
    const body = Object.fromEntries(form);
    const res = await fetch(`/api/bonustime/${extendModal._id}/extend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setBusy(false);
    if (!data.ok) { notifyMsg(setMsg, { type: 'error', text: data.message }); return; }
    notifyMsg(setMsg, { type: 'success', text: 'ต่ออายุสำเร็จ!' });
    setExtendModal(null);
    setUser((u) => ({ ...u, balance: data.balance }));
    loadHistory();
  }

  async function copyWebhookLink(e, link) {
    e?.preventDefault?.();
    e?.stopPropagation?.();

    const text = String(link || '').trim();
    if (!text) {
      notifyMsg(setMsg, { type: 'error', text: 'ยังไม่มีลิงก์ Webhook ให้คัดลอก' });
      return;
    }

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        ta.style.top = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      notifyMsg(setMsg, { type: 'success', text: 'คัดลอกลิงก์ Webhook แล้ว' });
    } catch (err: any) {
      notifyMsg(setMsg, { type: 'error', text: 'คัดลอกลิงก์ไม่สำเร็จ กรุณาลองอีกครั้ง' });
    }
  }

  if (loading) return <div style={{ padding: '80px 0', textAlign: 'center', color: 'rgba(238,246,255,.45)', fontSize: 15 }}>กำลังโหลด...</div>;

  if (!user?.serial_key) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="page-container">
          <section className="page bonustime">
            <section className="bt-empty-state">
              <h2>เช่าบอทไลน์ช่วยส่งโบนัสไทม์</h2>
              <p className="muted" style={{ marginTop: 8 }}>คุณยังไม่มี Serial Key สำหรับใช้งานระบบนี้</p>
              <button onClick={handleRegister} disabled={busy} className="bt-register-btn">
                {busy ? 'กำลังลงทะเบียน...' : 'ลงทะเบียนใช้งาน'}
              </button>
            </section>
          </section>
        </div>
      </>
    );
  }

  const buyPriceNormal = products?.normal?.price ?? 2000;
  const buyPriceLotto = products?.lotto?.price ?? 2500;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="page-container">
        <section className="page bonustime">

          {/* Hero */}
          <section className="bt-hero-enterprise" aria-label="Bonustime Automation">
            <div className="bt-hero-glow one" />
            <div className="bt-hero-glow two" />
            <div className="bt-hero-copy">
              <div className="bt-kicker"><span><SvgIcon name="spark" size={18} /></span> BONUSTIME AUTOMATION</div>
              <h1>Bonustime — เช่าบอท</h1>
              <p>เปิดใช้งานระบบบอท LINE โบนัสไทม์ระดับมืออาชีพ จัดการโปรโมชันอัตโนมัติ เลือกแพ็กเกจที่เหมาะกับธุรกิจ พร้อมติดตามออเดอร์และตั้งค่าได้ครบในหน้าเดียว</p>
            </div>
            <div className="bt-hero-metrics" aria-label="จุดเด่นระบบ">
              <div className="bt-metric-card"><strong>LINE</strong><span>Bot พร้อมใช้งาน</span></div>
              <div className="bt-metric-card"><strong>30 วัน</strong><span>เริ่มต้น</span></div>
              <div className="bt-metric-card"><strong>Live</strong><span>อัปเดตระบบตลอดการใช้งาน</span></div>
            </div>
          </section>

          {/* Tabs */}
          <div className="bt-tabbar">
            {[
              { key: 'order', label: 'สั่งซื้อเช่า' },
              { key: 'history', label: `ประวัติการสั่งซื้อ` },
              { key: 'help', label: 'ช่วยเหลือ' },
            ].map(({ key, label }) => (
              <button key={key} className={`bt-tab${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* TAB 1: สั่งซื้อ */}
          {tab === 'order' && (
            <div className="bonustime-order tabpane">
              <p className="muted" style={{ textAlign: 'center', marginBottom: 18 }}>เลือกแพ็กเกจที่ต้องการ</p>
              <div className="bt-package-grid">
                <PackageCard
                  pkgNum={1}
                  title="แพ็กเกจ 1 : สล็อต + บาคาร่า"
                  image="/bonustime/packgage1.jpg"
                  price={buyPriceNormal}
                  count={products?.normal?.count}
                  features={PKG1_FEATURES}
                  onBuy={async () => {
                    setMsg(null);
                    const res = await fetch('/api/bonustime/next?type=normal');
                    const d = await res.json();
                    if (!d.ok) { notifyMsg(setMsg, { type: 'error', text: d.message }); return; }
                    setOrderModal({ type: 'normal', item: d.item });
                  }}
                  busy={busy}
                />
                <PackageCard
                  pkgNum={2}
                  title="แพ็กเกจ 2 : สล็อต + บาคาร่า + หวย"
                  image="/bonustime/packgage2.jpg"
                  price={buyPriceLotto}
                  count={products?.lotto?.count}
                  features={PKG2_FEATURES}
                  onBuy={async () => {
                    setMsg(null);
                    const res = await fetch('/api/bonustime/next?type=lotto');
                    const d = await res.json();
                    if (!d.ok) { notifyMsg(setMsg, { type: 'error', text: d.message }); return; }
                    setOrderModal({ type: 'lotto', item: d.item });
                  }}
                  busy={busy}
                />
              </div>
            </div>
          )}

          {/* TAB 2: ประวัติ */}
          {tab === 'history' && (
            <div className="tab-history tabpane">
              <p className="muted" style={{ textAlign: 'center', marginBottom: 18 }}>ประวัติการสั่งซื้อ</p>
              <div className="history-list">
                {history.length === 0 ? (
                  <p className="muted" style={{ textAlign: 'center' }}>
                    ยังไม่มี Service Bonustime —{' '}
                    <button onClick={() => setTab('order')} style={{ color: '#08b84f', background: 'none', border: 0, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}>
                      ไปสั่งซื้อ →
                    </button>
                  </p>
                ) : history.map((rec) => {
                  const isPermanent = Boolean(rec.LICENSE_DISABLED);
                  const expiry = isPermanent ? null : calcExpiry(rec);
                  const isExpired = expiry ? expiry.getTime() < Date.now() : false;
                  const statusLabel = isPermanent ? 'ถาวร' : isExpired ? 'หมดอายุ' : 'ใช้งานอยู่';
                  const statusCls = isPermanent ? 'permanent' : isExpired ? 'expired' : 'active';
                  return (
                    <div key={String(rec._id)} className="bt-history-card">
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                        <div>
                          <div className="rec-name">{rec.NAME || '(ไม่มีชื่อ)'}</div>
                          <div className="rec-key">{rec.serviceKey || rec.tenantId}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                          <span className={`rec-badge ${statusCls}`}>{statusLabel}</span>
                          <span style={{ fontSize: 11, color: 'rgba(238,246,255,.5)' }}>{rec.LOTTO_ENABLED ? 'รวมหวย' : 'สล็อต+บาคาร่า'}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(238,246,255,.5)', marginBottom: 12 }}>
                        {!isPermanent && <div>เริ่ม: {rec.LICENSE_START_DATE || '—'} | {rec.LICENSE_DURATION_DAYS || 0} วัน</div>}
                        {isPermanent
                          ? (() => {
                              const webhookLink = getWebhookLink(rec);
                              return (
                                <div className="rec-webhook-linkbox">
                                  <span className="rec-webhook-label">ลิงก์เชื่อมต่อ Webhook:</span>
                                  {webhookLink ? (
                                    <>
                                      <button
                                        type="button"
                                        className="rec-webhook-link"
                                        title="กดเพื่อคัดลอกลิงก์ Webhook"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={(e) => copyWebhookLink(e, webhookLink)}
                                      >
                                        {webhookLink}
                                      </button>
                                      <button
                                        type="button"
                                        className="rec-webhook-copy"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={(e) => copyWebhookLink(e, webhookLink)}
                                      >
                                        คัดลอกลิงก์
                                      </button>
                                    </>
                                  ) : (
                                    <span className="rec-webhook-empty">ยังไม่มีลิงก์</span>
                                  )}
                                </div>
                              );
                            })()
                          : expiry
                            ? <div style={{ color: isExpired ? '#ff8a99' : '#38e986' }}>
                                หมดอายุ: {expiry.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
                              </div>
                            : null
                        }
                      </div>
                      <div className="rec-actions">
                        <Link href={`/bonustime/${rec._id}`} className="rec-btn primary">ดูรายละเอียด / แก้ไข</Link>
                        {!isPermanent && (
                          <button onClick={() => { setExtendModal(rec); setMsg(null); }} className="rec-btn ghost">ต่ออายุ</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: ช่วยเหลือ */}
          {tab === 'help' && (
            <div className="tab-helpers tabpane">
              <section className="bt-help">
                <h2 className="bt-help-title" style={{ textAlign: 'center' }}>ศูนย์ช่วยเหลือ</h2>
                <p className="muted" style={{ textAlign: 'center', marginBottom: 16 }}>
                  รวมวิธีใช้งานและคำถามที่พบบ่อยเกี่ยวกับการตั้งค่า BOT LINE RTAUTOBOT
                </p>
                <div className="faq-card">
                  <div className="accordion-clean">
                    <ul>
                      <HelpAccordionItem title={<><SvgIcon name="video" size={18} /> วิธีขอ Channel Access Token และ Channel Secret</>} defaultOpen>
                        <p className="small muted mb-sm">
                          วิดีโอตัวอย่างตั้งแต่สร้าง LINE OA, เปิด Messaging API, จนถึงคัดลอก Channel Access Token และ Channel Secret เพื่อนำมาใส่ในฟอร์มสั่งซื้อ Bonustime
                        </p>
                        <div className="bt-help-video-frame" style={{ marginBottom: 16 }}>
                          <iframe
                            src="https://www.youtube.com/embed/sBr56tsh4DY?si=ppNxCGAqq-vP6P8w"
                            title="วิธีขอ Channel Access Token และ Channel Secret"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            referrerPolicy="strict-origin-when-cross-origin"
                            allowFullScreen
                            loading="lazy"
                          />
                        </div>
                        <ul className="help-steps">
                          <li>เข้าสู่ระบบที่ <a href="https://developers.line.biz" target="_blank" rel="noopener">https://developers.line.biz</a></li>
                          <li>สร้างหรือเลือก LINE Official Account ที่ต้องการใช้กับ BOT</li>
                          <li>ไปที่เมนู <strong>Messaging API</strong> แล้วกดสร้าง Channel</li>
                          <li>เมื่อสร้างเสร็จ ให้คัดลอกค่า <strong>Channel secret</strong></li>
                          <li>เลื่อนลงมาด้านล่าง คัดลอกค่า <strong>Channel access token (long-lived)</strong></li>
                          <li>นำ 2 ค่านี้มาใส่ในฟอร์มสั่งซื้อ/แก้ไข Bonustime ในช่อง <strong>CHANNEL_ACCESS_TOKEN</strong> และ <strong>CHANNEL_SECRET</strong></li>
                        </ul>
                      </HelpAccordionItem>

                      <HelpAccordionItem title={<><SvgIcon name="edit" size={18} /> ต้องกรอกอะไรบ้างในฟอร์มสั่งซื้อแพ็กเกจ?</>}>
                        <p className="mb-sm">ฟอร์มสั่งซื้อจะแสดงเมื่อกดปุ่ม <strong>สั่งซื้อแพ็กเกจนี้</strong> โดยแต่ละช่องมีความหมายดังนี้</p>
                        <ul className="help-steps">
                          <li><strong>ชื่อเว็บ</strong> — ชื่อหน้าร้าน/เว็บหรือเพจของคุณ ใช้แสดงในประวัติ Bonustime</li>
                          <li><strong>CHANNEL_ACCESS_TOKEN</strong> — ค่า token จาก LINE Developers</li>
                          <li><strong>CHANNEL_SECRET</strong> — ค่า secret จาก LINE Developers</li>
                          <li><strong>โลโก้ (ลิงก์รูป)</strong> — URL รูปโลโก้ที่จะแสดงในหน้า Flex ของลูกค้า แนะนำใช้ <a href="https://pic.in.th/?lang=th" target="_blank" rel="noopener">pic.in.th</a></li>
                          <li><strong>ลิงก์เข้าสู่ระบบ</strong> — ลิงก์หน้า Login ของระบบหลักคุณ</li>
                          <li><strong>ลิงก์สมัครสมาชิก</strong> — ลิงก์หน้า Register สำหรับลูกค้าใหม่</li>
                          <li><strong>ลิงก์ไลน์ติดต่อ</strong> — ลิงก์เพิ่มเพื่อน LINE แอดมิน เช่น <code>https://line.me/R/ti/p/@xxxxxxx</code></li>
                        </ul>
                      </HelpAccordionItem>

                      <HelpAccordionItem title={<><SvgIcon name="link" size={18} /> ลิงก์เชื่อมต่อ (LINK) คืออะไร ใช้ยังไง?</>}>
                        <p>ลิงก์เชื่อมต่อคือ URL ที่ใช้เชื่อมระหว่าง <strong>เซิร์ฟเวอร์ Bonustime</strong> กับ <strong>Webhook ของคุณ</strong> ซึ่งระบบจะสร้างให้อัตโนมัติหลังสั่งซื้อ</p>
                        <ul className="help-steps">
                          <li>สามารถดูได้ในแท็บ <strong>ประวัติการสั่งซื้อ</strong> แถวของเซิร์ฟเวอร์ที่ต้องการ</li>
                          <li>กดปุ่ม <strong>คัดลอก</strong> เพื่อนำลิงก์ไปวางในหน้า Webhook ของ LINE Developers</li>
                          <li>ในหน้า Messaging API ให้ตั้งค่า <strong>Webhook URL</strong> เป็นลิงก์เชื่อมต่อนี้ แล้วกด <strong>Verify</strong></li>
                          <li>เมื่อขึ้นสถานะ Success แสดงว่า BOT สามารถรับข้อความจากลูกค้าได้แล้ว</li>
                        </ul>
                        <div className="bt-help-pdf mt-sm">
                          <p className="muted small mb-xs"><SvgIcon name="play" size={14} /> ตัวอย่างหน้าจอจากคู่มือการใส่ลิงก์ Webhook</p>
                          <div className="pdf-frame">
                            <iframe src="/bonustime/webhook.pdf#page=1&view=FitH&zoom=130&toolbar=0&navpanes=0" title="Webhook PDF preview" />
                          </div>
                          <a href="/bonustime/webhook.pdf" target="_blank" rel="noopener">เปิดคู่มือแบบเต็มหน้าจอ</a>
                        </div>
                        <h4 className="mt-sm"><SvgIcon name="puzzle" size={18} /> ขั้นตอนตั้งค่า Rich Menu ให้เรียกคำสั่ง Bonustime</h4>
                        <ul className="help-steps">
                          <li>เข้าสู่ระบบ <strong>LINE Official Admin</strong> ของบัญชีที่ใช้กับ BOT</li>
                          <li>ไปที่เมนู <strong>ริชเมนู</strong> แล้วสร้างริชเมนูใหม่</li>
                          <li>กำหนดตำแหน่งปุ่มในริชเมนู (เช่น ปุ่ม BONUSTIME / FOOTBALL / LOTTO)</li>
                          <li>ที่การตั้งค่าการทำงานของปุ่ม ให้เลือกแบบ <strong>ส่งข้อความแชท</strong></li>
                          <li>ในช่องข้อความ ให้ใส่ KEYWORD เช่น <code>โบนัสไทม์</code>, <code>แนวทางหวย</code></li>
                          <li>หากซื้อ Packgage1 ใส่แค่ <strong>โบนัสไทม์</strong></li>
                          <li>หากซื้อ Packgage2 ใส่ทั้ง <strong>โบนัสไทม์</strong> และ <strong>แนวทางหวย</strong></li>
                        </ul>
                        <div className="bt-help-pdf mt-sm">
                          <p className="muted small mb-xs"><SvgIcon name="play" size={14} /> ตัวอย่างหน้าจอจากคู่มือการตั้งค่า Rich Menu</p>
                          <div className="pdf-frame">
                            <iframe src="/bonustime/rich.pdf#page=1&view=FitH&zoom=130&toolbar=0&navpanes=0" title="Rich Menu PDF preview" />
                          </div>
                          <a href="/bonustime/rich.pdf" target="_blank" rel="noopener">เปิดคู่มือแบบเต็มหน้าจอ</a>
                        </div>
                      </HelpAccordionItem>

                      <HelpAccordionItem title={<><SvgIcon name="rotate" size={18} /> วิธีต่ออายุ / อัปเกรดแพ็กเกจ</>}>
                        <ul className="help-steps">
                          <li>ไปที่แท็บ <strong>ประวัติการสั่งซื้อ</strong> และเลือกเซิร์ฟเวอร์ที่ต้องการต่ออายุ</li>
                          <li>กดปุ่ม <strong>ต่ออายุการใช้งาน</strong> ระบบจะแสดงตัวเลือกแพ็กเกจตามเวลาที่ต้องการ</li>
                          <li>เลือกจำนวนวันและยืนยัน ระบบจะต่ออายุให้อัตโนมัติ</li>
                          <li>ถ้าต้องการเพิ่มฟีเจอร์หวย กดปุ่ม <strong>อัปเกรดเพิ่มหวย +฿1,000</strong> (ถ้ายังไม่เปิดใช้)</li>
                        </ul>
                        <p className="muted small">หลังต่ออายุสำเร็จ หาก BOT ไม่ตอบ ให้ลองปิด–เปิด Webhook ใน LINE อีกครั้ง หรือส่งข้อความใหม่เพื่อเริ่มใช้งาน</p>
                      </HelpAccordionItem>

                      <HelpAccordionItem title={<><SvgIcon name="users" size={18} /> วิธีการแนะนำเพื่อน</>}>
                        <p>ระบบแนะนำเพื่อนของ <strong>Bonustime</strong> จะให้คุณสร้างลิงก์ส่วนตัว เพื่อส่งให้เพื่อนหรือคนรู้จักสมัครใช้งาน และรับค่าตอบแทนเมื่อมีการซื้อแพ็กเกจหรือต่ออายุ</p>
                        <ul className="help-steps">
                          <li>ไปที่เมนู <strong>ข้อมูลผู้ใช้งาน</strong> จากนั้นเลือก <strong>ข้อมูลส่วนตัว</strong></li>
                          <li>กดไปที่แท็บ <strong>แนะนำเพื่อน</strong></li>
                          <li>กดปุ่ม <strong>สร้างลิงก์</strong> แล้วนำลิงก์ที่ได้ส่งให้เพื่อน</li>
                          <li>เมื่อเพื่อนของคุณ <strong>ซื้อแพ็กเกจครั้งแรก</strong> คุณจะได้รับเงิน <strong>500 บาท</strong></li>
                          <li>เมื่อเพื่อนของคุณ <strong>ต่ออายุแพ็กเกจ</strong> คุณจะได้รับเงิน <strong>200 บาท</strong> ต่อการต่ออายุ 1 ครั้ง</li>
                        </ul>
                        <div className="bt-help-img mt-sm">
                          <img src="/bonustime/affbt.png" alt="กิจกรรมแนะนำเพื่อน Bonustime" loading="lazy" onError={(e) => { e.target.style.display = 'none'; }} />
                        </div>
                      </HelpAccordionItem>
                    </ul>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* Order Modal */}
          {orderModal && (
            <BtModal title={`สั่งซื้อแพ็กเกจ${orderModal.type === 'lotto' ? ' (รวมหวย)' : ''}`} onClose={() => setOrderModal(null)}>
              <form onSubmit={handleOrder} style={{ display: 'grid', gap: 14 }}>
                <input type="hidden" name="bonustimeId" value={orderModal.item._id} />
                <input type="hidden" name="packageType" value={orderModal.type} />
                <div><label className="label">ชื่อร้าน / LINE Bot <span style={{ color: '#ff5f75' }}>*</span></label><input className="input" name="NAME" placeholder="ชื่อร้านหรือบอทของคุณ" required /></div>
                <div><label className="label">Channel Access Token <span style={{ color: '#ff5f75' }}>*</span></label><input className="input" style={{ fontFamily: 'monospace' }} name="CHANNEL_ACCESS_TOKEN" placeholder="LINE Channel Access Token" required /></div>
                <div><label className="label">Channel Secret <span style={{ color: '#ff5f75' }}>*</span></label><input className="input" style={{ fontFamily: 'monospace' }} name="CHANNEL_SECRET" placeholder="LINE Channel Secret" required /></div>
                <div><label className="label">URL เข้าสู่ระบบ</label><input className="input" name="LOGIN_URL" placeholder="https://..." /></div>
                <div><label className="label">URL ลงทะเบียน</label><input className="input" name="SIGNUP_URL" placeholder="https://..." /></div>
                <div><label className="label">URL โลโก้</label><input className="input" name="LOGO" placeholder="https://example.com/logo.png" /></div>
                <div><label className="label">LINE Admin</label><input className="input" name="LINE_ADMIN" placeholder="@lineadmin หรือ userId" /></div>
                <div className="card-sm" style={{ fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: 'rgba(238,246,255,.6)' }}>ราคาแพ็กเกจนี้</span>
                    <span style={{ color: '#08b84f', fontWeight: 700 }}>฿{(orderModal.type === 'lotto' ? buyPriceLotto : buyPriceNormal).toLocaleString()} / 30 วัน</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'rgba(238,246,255,.6)' }}>ยอดเงินของคุณ</span>
                    <span style={{ color: 'rgba(238,246,255,.8)' }}>฿{Number(user.balance || 0).toLocaleString()}</span>
                  </div>
                </div>
                <button type="submit" disabled={busy} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 52, border: 0, borderRadius: 16, fontSize: 15, fontWeight: 900, fontFamily: 'inherit', cursor: 'pointer', background: 'linear-gradient(135deg,#08b84f,#05b84f)', color: '#17130a', boxShadow: '0 18px 40px rgba(8,184,79,.24)', transition: 'transform .2s ease' }}>
                  {busy ? 'กำลังสั่งซื้อ...' : 'ยืนยันสั่งซื้อ'}
                </button>
              </form>
            </BtModal>
          )}

          {/* Notice Modal */}
          {showNotice && (
            <NoticeLayer>
              <BtNoticeModal
                onClose={(dontShow) => {
                  if (dontShow) {
                    try { localStorage.setItem(BT_NOTICE_KEY, String(Date.now() + 86400000)); } catch {}
                  }
                  setShowNotice(false);
                }}
                onHelp={() => { setShowNotice(false); setTab('help'); }}
              />
            </NoticeLayer>
          )}

          {/* Extend Modal */}
          {extendModal && (
            <BtModal title={`ต่ออายุ — ${extendModal.NAME || extendModal.tenantId}`} onClose={() => setExtendModal(null)}>
              <form onSubmit={handleExtend} style={{ display: 'grid', gap: 12 }}>
                <input type="hidden" name="includeLotto" value={extendModal.LOTTO_ENABLED ? 'true' : 'false'} />
                <p style={{ color: 'rgba(238,246,255,.6)', fontSize: 13, margin: 0 }}>เลือกระยะเวลาต่ออายุ</p>
                {(extendModal.LOTTO_ENABLED ? PLANS_LOTTO : PLANS_NORMAL).map((plan) => (
                  <label key={plan.days} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 16, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.09)', cursor: 'pointer' }}>
                    <input type="radio" name="days" value={plan.days} style={{ accentColor: '#08b84f' }} required />
                    <span style={{ flex: 1, fontSize: 14, color: 'rgba(238,246,255,.9)' }}>{plan.label}</span>
                    {plan.discount !== '0%' && <span style={{ fontSize: 11, color: '#08b84f' }}>{plan.discount}</span>}
                    <span style={{ color: '#08b84f', fontWeight: 700 }}>฿{plan.price.toLocaleString()}</span>
                  </label>
                ))}
                <button type="submit" disabled={busy} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 52, border: 0, borderRadius: 16, fontSize: 15, fontWeight: 900, fontFamily: 'inherit', cursor: 'pointer', background: 'linear-gradient(135deg,#08b84f,#05b84f)', color: '#17130a', boxShadow: '0 18px 40px rgba(8,184,79,.24)', transition: 'transform .2s ease' }}>
                  {busy ? 'กำลังต่ออายุ...' : 'ยืนยันต่ออายุ'}
                </button>
              </form>
            </BtModal>
          )}

        </section>
      </div>
    </>
  );
}

function PackageCard({ pkgNum, title, image, price, count, features, onBuy, busy }) {
  const [showDetails, setShowDetails] = useState(false);
  const soldOut = count !== undefined && count === 0;
  const nearEnd = count !== undefined && count > 0 && count <= 3;

  const stockLabel = count === undefined
    ? 'กำลังโหลด…'
    : soldOut ? 'หมดแล้ว'
    : nearEnd ? `เหลือ ${count} ชุด`
    : `เหลือ ${count} ชุด`;

  const stockCls = soldOut ? 'sold' : nearEnd ? 'near' : '';

  return (
    <section className="bt-package">
      <header className="pkg-head">
        <div className="pkg-title">{title}</div>
        <div className={`pkg-remaining ${stockCls}`}>{stockLabel}</div>
      </header>
      <div className="pkg-body">
        <div className="pkg-thumb">
          <img src={image} alt={title} loading="lazy" onError={(e) => { e.target.style.display = 'none'; }} />
        </div>
        <div className="pkg-meta">
          <span className="pkg-badge">30 วัน</span>
        </div>
        <div className="pkg-hint" onClick={() => setShowDetails(v => !v)}>
          <span style={{ transition: 'transform .2s', transform: showDetails ? 'rotate(180deg)' : 'none', display: 'inline-block' }}>▼</span>
          {showDetails ? 'ซ่อนรายละเอียด' : 'กดดูรายละเอียดเพิ่มเติม'}
        </div>
        {showDetails && (
          <div className="pkg-details">
            <p className="pkg-desc">{features.join('\n').split('\n').map((f, i) => <span key={i}>{f}<br /></span>)}</p>
            <div className="pkg-price">฿{price.toLocaleString()} / 30 วัน</div>
            <div className="pkg-price sub">(รวมค่าเปิดระบบครั้งแรก 500)</div>
          </div>
        )}
      </div>
      <footer className="pkg-actions">
        <button
          type="button"
          className="bt-btn-primary"
          disabled={soldOut || busy}
          onClick={onBuy}
        >
          {soldOut ? 'สินค้าหมดแล้ว' : 'สั่งซื้อแพ็กเกจนี้'}
        </button>
      </footer>
    </section>
  );
}

function HelpAccordionItem({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <li className={`accordion-item${open ? ' active' : ''}`}>
      <button type="button" className="accordion-title" onClick={() => setOpen(v => !v)}>
        <span>{title}</span>
        <span className="accordion-arrow">▼</span>
      </button>
      {open && <div className="accordion-content">{children}</div>}
    </li>
  );
}

function BtModal({ title, children, onClose }) {
  return (
    <div className="bt-modal-overlay">
      <div className="bt-modal-bg" onClick={onClose} />
      <div className="bt-modal-dialog">
        <div className="bt-modal-head">
          <div>
            <div className="bt-modal-kicker"><span><SvgIcon name="spark" size={18} /></span> BONUSTIME</div>
            <h2>{title}</h2>
          </div>
          <button className="bt-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="bt-modal-body">{children}</div>
      </div>
    </div>
  );
}

function NoticeLayer({ children }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

function BtNoticeModal({ onClose, onHelp }) {
  const [dontShow, setDontShow] = useState(false);
  return (
    <div className="bt-notice-overlay">
      <div className="bt-notice-bg" onClick={() => onClose(false)} />
      <div className="bt-notice-card">
        <div className="bt-notice-aurora" aria-hidden="true" />
        <div className="bt-notice-grid" aria-hidden="true" />
        <div className="bt-notice-head">
          <span className="bt-notice-icon" aria-hidden="true"><span className="bt-notice-icon-core"><SvgIcon name="alert" size={18} /></span></span>
          <span className="bt-notice-titlebox">
            <span className="bt-notice-kicker"><span><SvgIcon name="spark" size={18} /></span> BONUSTIME NOTICE</span>
            <span className="bt-notice-title">แจ้งเตือนก่อนใช้บริการ</span>
            <span className="bt-notice-copy">โปรดอ่านข้อมูลสำคัญก่อนเริ่มสั่งซื้อ Bonustime เพื่อให้ระบบเชื่อมต่อ LINE Bot ได้ถูกต้อง</span>
          </span>
          <button type="button" className="bt-notice-x" onClick={() => onClose(false)} aria-label="ปิดแจ้งเตือน">×</button>
        </div>
        <div className="bt-notice-body">
          <div className="bt-notice-warning">
            <div className="bt-notice-warning-dot" />
            <span>แนะนำให้อ่านแท็บช่วยเหลือก่อนสั่งซื้อ เพื่อป้องกันกรอก Token / Secret / Webhook ผิด</span>
          </div>
          <div className="bt-notice-steps">
            {[
              { n: '01', title: 'ตรวจสอบข้อมูล LINE Developers ให้พร้อม', desc: 'เตรียม Channel Access Token และ Channel Secret ให้ถูกต้องก่อนเริ่มสั่งซื้อ' },
              { n: '02', title: 'อ่านคู่มือในแท็บช่วยเหลือ', desc: 'ดูวิธีตั้งค่า Webhook, Rich Menu และรายละเอียดต่าง ๆ ได้ที่แท็บช่วยเหลือ' },
              { n: '03', title: 'แก้ไขข้อมูล Service ได้ตลอด', desc: 'หากกรอกข้อมูลผิด สามารถกดแก้ไขข้อมูลของ Service ได้ทุกเมื่อ ไม่มีค่าบริการเพิ่มเติม' },
              { n: '!', danger: true, title: 'พบปัญหาให้ติดต่อแอดมินทันที', desc: 'หาก BOT ไม่ตอบกลับหรือ Webhook เชื่อมต่อไม่สำเร็จ ให้ติดต่อทีมงานเพื่อช่วยตรวจสอบ' },
            ].map(({ n, title: stepTitle, desc, danger }) => (
              <div key={n} className={`bt-notice-step${danger ? ' danger' : ''}`}>
                <div className="bt-step-no">{n}</div>
                <div className="bt-step-copy">
                  <strong>{stepTitle}</strong>
                  <span>{desc}</span>
                </div>
              </div>
            ))}
          </div>
          <label className="bt-notice-check">
            <input type="checkbox" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)} />
            <span className="bt-check-ui" aria-hidden="true" />
            <span>ไม่แสดงอีกในวันนี้</span>
          </label>
        </div>
        <footer className="bt-notice-actions">
          <button type="button" className="bt-notice-btn" onClick={onHelp}>เปิดแท็บช่วยเหลือ</button>
          <button type="button" className="bt-notice-btn primary" onClick={() => onClose(dontShow)}>ปิดและยอมรับ</button>
        </footer>
      </div>
    </div>
  );
}
