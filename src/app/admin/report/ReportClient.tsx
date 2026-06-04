'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ManualTopupModal from '../ManualTopupModal';
import { notifyFromPayload, confirmAction } from '../../../lib/clientNotify';

const AVATAR_FALLBACK = '/assets/img/user-blue.png';

function appendAvatarVersion(src, ver) {
  const value = String(src || '').trim();
  if (!value) return AVATAR_FALLBACK;
  if (!ver) return value;
  return `${value}${value.includes('?') ? '&' : '?'}v=${encodeURIComponent(ver)}`;
}

function avatarSrc(user) {
  const raw = String(user?.avatarUrl || '').trim();
  const normalized = raw.startsWith('/static/assets/') ? raw.replace('/static', '') : raw;
  return appendAvatarVersion(normalized || AVATAR_FALLBACK, user?.avatarVer || 0);
}

function handleAvatarError(event) {
  const img = event.currentTarget;
  if (img.dataset.fallback === '1') return;
  img.dataset.fallback = '1';
  img.src = AVATAR_FALLBACK;
}

const CSS = `
.topup-report-page,
body:has(.topup-report-page){
  --tr-page: var(--page, var(--bg, #08090c));
  --tr-card: var(--card, #17181d);
  --tr-card-2: color-mix(in srgb, var(--tr-card) 82%, #ffffff 4%);
  --tr-soft: color-mix(in srgb, var(--tr-card) 74%, #ffffff 5%);
  --tr-text: var(--text, #eef6ff);
  --tr-muted: var(--muted, #08b84f);
  --tr-border: var(--border, rgba(255,255,255,.11));
  --tr-accent: var(--accent, #05b84f);
  --tr-accent-2: #21b95c;
  --tr-green-1: #08b84f;
  --tr-green-2: #05b84f;
  --tr-green: #35df7b;
  --tr-red: #ff5d63;
  --tr-blue: #46a6ff;
  --tr-shadow: rgba(0,0,0,.36);
  color: var(--tr-text);
}
.topup-report-page{
  position: relative;
  isolation: isolate;
  padding: clamp(14px,2vw,28px);
  min-height: calc(100vh - 80px);
}
.topup-report-page::before{
  content:"";
  position:fixed;
  inset:0;
  z-index:-2;
  pointer-events:none;
  background:
    radial-gradient(900px 440px at 12% -10%, color-mix(in srgb,var(--tr-accent) 16%, transparent), transparent 62%),
    radial-gradient(760px 420px at 92% 4%, rgba(96,120,255,.14), transparent 62%),
    linear-gradient(180deg, color-mix(in srgb,var(--tr-page) 100%, #000 0%), color-mix(in srgb,var(--tr-page) 90%, #000 10%));
}
.topup-report-page *{ box-sizing:border-box; }
.topup-report-page a{ color:inherit; }

/* ===== Header ===== */
.topup-report-page .page-head{
  position:relative;
  overflow:hidden;
  border:1px solid var(--tr-border);
  border-radius:30px;
  padding:clamp(24px,4vw,48px);
  margin:0 0 24px;
  background:
    linear-gradient(118deg, rgba(255,255,255,.055), rgba(255,255,255,.018) 52%, rgba(91,108,255,.09)),
    color-mix(in srgb,var(--tr-card) 90%, transparent);
  box-shadow:0 26px 70px var(--tr-shadow), inset 0 1px 0 rgba(255,255,255,.07);
  animation: trFadeUp .55s ease both;
}
.topup-report-page .page-head::after{
  content:"";
  position:absolute;
  inset:-40% -12% auto auto;
  width:34%;
  height:180%;
  transform:rotate(14deg);
  background:linear-gradient(90deg, transparent, rgba(255,255,255,.08), transparent);
  opacity:.7;
  pointer-events:none;
}
.topup-report-page .page-title::before{
  content:"✦ TOPUP REPORT";
  display:inline-flex;
  align-items:center;
  width:max-content;
  max-width:100%;
  margin-bottom:16px;
  padding:7px 14px;
  border-radius:999px;
  border:1px solid color-mix(in srgb,var(--tr-accent) 56%, transparent);
  color:var(--tr-accent-2);
  background:color-mix(in srgb,var(--tr-accent) 11%, transparent);
  font-size:12px;
  font-weight:7000;
  letter-spacing:.08em;
}
.topup-report-page .page-title h1{
  margin:0;
  font-size:clamp(34px,5vw,70px);
  line-height:.98;
  letter-spacing:-.05em;
  color:var(--tr-text);
  text-wrap:balance;
}
.topup-report-page .page-title .muted,
.topup-report-page .page-title small{
  display:block;
  margin-top:16px;
  color:var(--tr-muted);
  font-size:clamp(14px,1.2vw,17px);
  font-weight:600;
}

/* ===== Cards ===== */
.topup-report-page .grid.cards{
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:14px;
  margin:0 0 16px;
}
.topup-report-page .grid.cards.single{ grid-template-columns:1fr; }
.topup-report-page .card,
.topup-report-page .card2,
.topup-report-page .history-wrapper,
.topup-report-page .month-toolbar,
.topup-report-page .mp-card,
.topup-report-page .dialog{
  border:1px solid var(--tr-border);
  background:
    linear-gradient(145deg, rgba(255,255,255,.055), rgba(255,255,255,.018)),
    color-mix(in srgb,var(--tr-card) 92%, transparent);
  border-radius:26px;
  box-shadow:0 20px 54px var(--tr-shadow), inset 0 1px 0 rgba(255,255,255,.06);
}
.topup-report-page .card,
.topup-report-page .card2{
  position:relative;
  overflow:hidden;
  min-height:150px;
  padding:24px;
  animation: trFadeUp .55s ease both;
}
.topup-report-page .card::before,
.topup-report-page .card2::before{
  content:"";
  position:absolute;
  inset:auto -8% -48% 18%;
  height:80px;
  transform:rotate(-8deg);
  background:linear-gradient(90deg, transparent, color-mix(in srgb,var(--tr-accent) 24%, transparent), transparent);
  filter:blur(10px);
  opacity:.75;
}
.topup-report-page .card-head.row-head{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12px;
  margin:0 0 16px;
}
.topup-report-page .card-head h3{
  margin:0;
  color:var(--tr-muted);
  font-size:14px;
  font-weight:600;
}
.topup-report-page .metric-badge{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-height:30px;
  border-radius:999px;
  border:1px solid var(--tr-border);
  background:rgba(255,255,255,.035);
  color:var(--tr-accent-2)!important;
  font-weight:600;
  white-space:nowrap;
}
.topup-report-page .big{
  position:relative;
  z-index:1;
  color:var(--tr-green)!important;
  font-size:clamp(34px,3.6vw,52px);
  line-height:1;
  font-weight:600;
  letter-spacing:-.04em;
  text-shadow:0 14px 34px color-mix(in srgb,var(--tr-green) 22%, transparent);
}

/* ===== Report mode tabs ===== */
.topup-report-page .report-mode-tabs{
  display:flex;
  justify-content:flex-end;
  gap:10px;
  margin:0 0 10px;
}
.topup-report-page .report-mode-tabs .btn.active{
  color:#17130a;
  background:linear-gradient(135deg,var(--tr-green-1),var(--tr-green-2));
  box-shadow:0 14px 30px color-mix(in srgb,var(--tr-accent) 18%, transparent);
}

/* ===== Month toolbar ===== */
.topup-report-page .month-toolbar{
  position:relative;
  display:flex;
  justify-content:flex-end;
  align-items:center;
  gap:10px;
  margin:16px 0 18px;
  padding:12px;
  border-radius:24px;
}

/* ===== Period Control Card ===== */
.topup-report-page .period-control-card{
  position:relative;
  overflow:hidden;
  isolation:isolate;
  display:grid;
  gap:18px;
  margin:18px 0 20px;
  padding:20px;
  border:1px solid color-mix(in srgb,var(--tr-border) 88%, rgba(255,255,255,.06));
  border-radius:30px;
  background:
    radial-gradient(760px 260px at 8% 0%, color-mix(in srgb,var(--tr-accent) 14%, transparent), transparent 62%),
    radial-gradient(520px 240px at 94% 100%, rgba(84,116,255,.11), transparent 60%),
    linear-gradient(145deg, rgba(255,255,255,.06), rgba(255,255,255,.018) 52%, rgba(0,0,0,.10)),
    color-mix(in srgb,var(--tr-card) 94%, transparent);
  box-shadow:0 24px 64px var(--tr-shadow), inset 0 1px 0 rgba(255,255,255,.07);
  animation:trFadeUp .58s ease both;
}
.topup-report-page .period-control-card::before{
  content:"";
  position:absolute;
  inset:0;
  background:linear-gradient(90deg, transparent, rgba(255,255,255,.045), transparent);
  opacity:.28;
  pointer-events:none;
}
.topup-report-page .period-control-glow{
  position:absolute;
  z-index:-1;
  left:-100px;
  top:-170px;
  width:340px;
  height:340px;
  border-radius:999px;
  background:radial-gradient(circle, color-mix(in srgb,var(--tr-accent) 22%, transparent), transparent 68%);
  filter:blur(18px);
  opacity:.82;
  pointer-events:none;
}
.topup-report-page .period-control-glow--right{
  left:auto;
  right:-110px;
  top:auto;
  bottom:-190px;
  background:radial-gradient(circle, rgba(96,120,255,.18), transparent 70%);
}
.topup-report-page .period-control-head{
  position:relative;
  z-index:1;
  display:grid;
  grid-template-columns:minmax(260px,1fr) minmax(260px,.72fr) auto;
  align-items:center;
  gap:16px;
}
.topup-report-page .period-title-wrap{
  display:flex;
  align-items:flex-start;
  gap:15px;
  min-width:0;
}
.topup-report-page .period-icon{
  flex:0 0 58px;
  width:58px;
  height:58px;
  display:grid;
  place-items:center;
  border-radius:19px;
  border:1px solid color-mix(in srgb,var(--tr-accent) 30%, var(--tr-border));
  background:linear-gradient(145deg, color-mix(in srgb,var(--tr-accent) 18%, transparent), rgba(255,255,255,.035));
  box-shadow:0 18px 38px color-mix(in srgb,var(--tr-accent) 15%, transparent), inset 0 1px 0 rgba(255,255,255,.10);
  font-size:24px;
}
.topup-report-page .period-copy{ min-width:0; }
.topup-report-page .period-kicker{
  display:inline-flex;
  align-items:center;
  width:max-content;
  max-width:100%;
  margin-bottom:8px;
  padding:6px 12px;
  border-radius:999px;
  border:1px solid color-mix(in srgb,var(--tr-accent) 34%, var(--tr-border));
  background:color-mix(in srgb,var(--tr-accent) 10%, transparent);
  color:var(--tr-accent-2);
  font-size:11px;
  font-weight:900;
  letter-spacing:.08em;
  text-transform:uppercase;
}
.topup-report-page .period-copy h2{
  margin:0;
  color:var(--tr-text);
  font-size:clamp(24px,2.35vw,38px);
  line-height:1.05;
  font-weight:1000;
  letter-spacing:-.04em;
}
.topup-report-page .period-copy p{
  margin:7px 0 0;
  max-width:520px;
  color:var(--tr-muted);
  font-size:13.5px;
  line-height:1.55;
  font-weight:700;
}
.topup-report-page .period-current{
  min-height:66px;
  padding:12px 18px;
  border-radius:22px;
  border:1px solid color-mix(in srgb,var(--tr-border) 84%, rgba(255,255,255,.05));
  background:linear-gradient(180deg, rgba(255,255,255,.035), rgba(255,255,255,.012)), color-mix(in srgb,var(--tr-card) 82%, var(--tr-page));
  display:flex;
  flex-direction:column;
  justify-content:center;
  align-items:center;
  text-align:center;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.06), 0 14px 30px rgba(0,0,0,.16);
}
.topup-report-page .period-current span{
  color:var(--tr-muted);
  font-size:11px;
  font-weight:900;
  letter-spacing:.08em;
  text-transform:uppercase;
}
.topup-report-page .period-current strong{
  margin-top:4px;
  color:var(--tr-accent-2);
  font-size:clamp(18px,1.8vw,26px);
  font-weight:1000;
  letter-spacing:-.025em;
}
.topup-report-page .period-control-card .report-mode-tabs{
  margin:0;
  justify-content:flex-end;
  padding:6px;
  border-radius:22px;
  border:1px solid color-mix(in srgb,var(--tr-border) 84%, rgba(255,255,255,.05));
  background:linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.01)), color-mix(in srgb,var(--tr-page) 78%, var(--tr-card));
  box-shadow:inset 0 1px 0 rgba(255,255,255,.04), 0 16px 34px rgba(0,0,0,.15);
}
.topup-report-page .period-control-card .report-mode-tabs .btn{
  min-width:96px;
  min-height:46px;
  border-radius:16px;
  padding:0 18px;
  font-weight:900;
}
.topup-report-page .period-control-card .report-mode-tabs .btn.active{
  color:#17130a;
  background:linear-gradient(135deg,var(--tr-green-1),var(--tr-green-2));
  box-shadow:0 14px 28px color-mix(in srgb,var(--tr-accent) 22%, transparent), inset 0 1px 0 rgba(255,255,255,.25);
}
.topup-report-page .period-control-body{
  position:relative;
  z-index:1;
  display:flex;
  justify-content:center;
  padding-top:2px;
}
.topup-report-page .period-control-card .month-toolbar{
  margin:0;
  justify-content:center;
  width:max-content;
  max-width:100%;
  border-radius:24px;
  background:linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.01)), color-mix(in srgb,var(--tr-page) 75%, var(--tr-card));
  box-shadow:inset 0 1px 0 rgba(255,255,255,.05), 0 16px 34px rgba(0,0,0,.18);
}
.topup-report-page .period-control-card .month-ctrl{
  min-height:52px;
  border-radius:20px;
  background:linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.01)), color-mix(in srgb,var(--tr-card) 82%, var(--tr-page));
}
.topup-report-page .period-control-card #monthInput{ width:160px; }

.topup-report-page .btn,
.topup-report-page button.btn,
.topup-report-page .icon-btn{
  border:1px solid var(--tr-border);
  border-radius:16px;
  min-height:44px;
  padding:0 18px;
  color:#17130a;
  background:linear-gradient(135deg,var(--tr-green-1),var(--tr-green-2));
  font-weight:600;
  cursor:pointer;
  transition:transform .18s ease, box-shadow .18s ease, filter .18s ease;
  box-shadow:0 14px 30px color-mix(in srgb,var(--tr-accent) 18%, transparent);
}
.topup-report-page .btn:hover,
.topup-report-page .icon-btn:hover{ transform:translateY(-1px); filter:saturate(1.05); }
.topup-report-page .btn.ghost,
.topup-report-page button.btn.ghost{
  color:var(--tr-text);
  background:color-mix(in srgb,var(--tr-card) 88%, transparent);
  box-shadow:none;
}
.topup-report-page .btn.small{ min-height:36px; padding:0 13px; border-radius:13px; font-size:12px; }
.topup-report-page .btn.success{ background:linear-gradient(135deg,#49ec8d,#109653); color:#062214; border:0; }
.topup-report-page .btn.danger{ background:linear-gradient(135deg,#ff7a7f,#b71f28); color:#fff; border:0; }
.topup-report-page .month-ctrl{
  display:flex;
  align-items:center;
  gap:8px;
  min-height:54px;
  padding:7px;
  border:1px solid color-mix(in srgb,var(--tr-accent) 42%, var(--tr-border));
  border-radius:18px;
  background:rgba(0,0,0,.18);
}
.topup-report-page #monthInput{
  width:150px;
  border:0;
  outline:0;
  background:transparent;
  color:var(--tr-text);
  text-align:center;
  font-weight:1000;
  font-size:16px;
  cursor:pointer;
}
.topup-report-page .icon-btn{ width:42px; min-height:42px; padding:0; border-radius:14px; }

/* ===== Month / Year picker ===== */
.topup-report-page .mp-popup{
  position:fixed;
  inset:0;
  z-index:2147483000;
  display:block;
  pointer-events:none;
  background:transparent;
}
.topup-report-page .mp-backdrop{
  position:absolute;
  inset:0;
  background:rgba(0,0,0,.18);
  backdrop-filter:blur(2px);
  opacity:0;
  pointer-events:auto;
}
.topup-report-page .mp-card{
  position:fixed;
  width:min(342px,calc(100vw - 24px));
  max-width:none;
  border-radius:24px;
  border:1px solid var(--tr-border);
  background:
    linear-gradient(180deg,color-mix(in srgb,var(--tr-card) 96%,transparent),color-mix(in srgb,var(--tr-page) 30%,var(--tr-card)));
  color:var(--tr-text);
  box-shadow:0 30px 90px rgba(0,0,0,.46), inset 0 1px 0 rgba(255,255,255,.08);
  padding:14px;
  pointer-events:auto;
  animation:trPicker .2s ease both;
  overflow:hidden;
  z-index:1;
}
.topup-report-page .mp-card::before{
  content:"";
  position:absolute;
  inset:-60px -80px auto auto;
  width:180px;
  height:180px;
  border-radius:999px;
  background:color-mix(in srgb,var(--tr-accent) 22%,transparent);
  filter:blur(20px);
  pointer-events:none;
}
.topup-report-page .mp-head{
  position:relative;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  padding:4px 2px 12px;
  border-bottom:1px solid var(--tr-border);
}
.topup-report-page .mp-actions{
  position:relative;
  display:flex;
  align-items:center;
  gap:8px;
  padding-top:12px;
  border-top:1px solid var(--tr-border);
}
.topup-report-page .mp-year{
  flex:1;
  text-align:center;
  font-size:20px;
  font-weight:950;
  color:var(--tr-accent-2);
  letter-spacing:-.02em;
}
.topup-report-page .mp-nav{
  width:40px;
  height:40px;
  border-radius:14px;
  border:1px solid var(--tr-border);
  background:var(--tr-soft);
  color:var(--tr-text);
  cursor:pointer;
  font-size:24px;
  line-height:1;
  transition:transform .18s ease, background .18s ease;
}
.topup-report-page .mp-nav:hover{
  transform:translateY(-1px);
  background:color-mix(in srgb,var(--tr-accent) 14%,transparent);
}
.topup-report-page .mp-grid{
  position:relative;
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:8px;
  padding:14px 0;
  margin:0;
}
.topup-report-page .mp-m,
.topup-report-page .mp-grid button{
  min-height:44px;
  border:1px solid var(--tr-border);
  background:color-mix(in srgb,var(--tr-page) 55%,transparent);
  color:var(--tr-text);
  border-radius:15px;
  cursor:pointer;
  font-weight:950;
  transition:transform .18s ease, background .18s ease, border-color .18s ease, box-shadow .18s ease;
}
.topup-report-page .mp-m:hover,
.topup-report-page .mp-grid button:hover{
  transform:translateY(-1px);
  border-color:color-mix(in srgb,var(--tr-accent) 45%,var(--tr-border));
  background:color-mix(in srgb,var(--tr-accent) 12%,transparent);
}
.topup-report-page .mp-m.active,
.topup-report-page .mp-grid button.active{
  color:#17130a;
  background:linear-gradient(135deg,var(--tr-green-1),var(--tr-green-2));
  border-color:transparent;
  box-shadow:0 10px 22px color-mix(in srgb,var(--tr-accent) 25%,transparent);
}
.topup-report-page .mp-m.current:not(.active),
.topup-report-page .mp-grid button.current:not(.active){
  border-color:color-mix(in srgb,var(--tr-accent) 48%,var(--tr-border));
  color:var(--tr-accent-2);
}
.topup-report-page .spacer{flex:1;}

/* ===== Table / History ===== */
.topup-report-page .history-wrapper{
  overflow:hidden;
  padding:18px;
  border-radius:28px;
  animation: trFadeUp .62s ease both;
}
.topup-report-page .history-wrapper .title{
  display:flex;
  justify-content:space-between;
  align-items:center;
  margin:0 0 14px;
}
.topup-report-page .history-wrapper h3{ color:var(--tr-text); font-weight:1000; }
.topup-report-page .table-wrap{
  width:100%;
  overflow-x:auto;
  border:1px solid var(--tr-border);
  border-radius:22px;
  background:rgba(0,0,0,.12);
}
.topup-report-page .history-table{
  width:100%;
  border-collapse:separate;
  border-spacing:0;
  min-width:1120px;
}
.topup-report-page .history-table th{
  position:sticky;
  top:0;
  z-index:2;
  padding:16px 18px;
  color:var(--tr-accent-2);
  font-size:13px;
  text-align:left;
  background:linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.026));
  border-bottom:1px solid var(--tr-border);
  white-space:nowrap;
}
.topup-report-page .history-table td{
  padding:16px 18px;
  border-bottom:1px solid color-mix(in srgb,var(--tr-border) 70%, transparent);
  vertical-align:middle;
  color:var(--tr-text);
}
.topup-report-page .history-table tbody tr{
  transition:background .18s ease, transform .18s ease;
}
.topup-report-page .history-table tbody tr:hover{
  background:color-mix(in srgb,var(--tr-accent) 7%, transparent);
}
.topup-report-page .amount{ text-align:right; color:var(--tr-accent-2)!important; font-weight:1000; }
.topup-report-page .status{ text-align:center; font-weight:1000; }
.topup-report-page .status.completed,
.topup-report-page .status.success{ color:var(--tr-green)!important; }
.topup-report-page .status.pending{ color:var(--tr-accent-2)!important; }
.topup-report-page .status.reject,
.topup-report-page .status.rejected,
.topup-report-page .status.failed,
.topup-report-page .status.cancelled,
.topup-report-page .status.canceled{ color:var(--tr-red)!important; }
.topup-report-page .user-cell{ display:flex; align-items:center; gap:10px; min-width:180px; }
.topup-report-page .avatar-sm,
.topup-report-page .bank-logo{
  width:34px; height:34px; border-radius:12px; object-fit:cover;
  border:1px solid var(--tr-border); background:var(--tr-soft);
  vertical-align:middle;
}
.topup-report-page .bank-logo{ margin-right:8px; }
.topup-report-page .user-meta{ display:grid; gap:2px; }
.topup-report-page .user-name{ color:var(--tr-text); }
.topup-report-page .user-email,
.topup-report-page .muted{ color:var(--tr-muted)!important; }

/* PC: desktop only, mobile only */
.topup-report-page .mobile-only{ display:none!important; }
.topup-report-page .desktop-only{ display:block!important; }

/* ===== Mobile accordion ===== */
.topup-report-page .tx-accordion-list{ display:grid; gap:10px; }
.topup-report-page .tx-accordion{
  border:1px solid var(--tr-border);
  border-radius:20px;
  background:var(--tr-soft);
  overflow:hidden;
}
.topup-report-page .tx-accordion__head{
  width:100%;
  min-height:62px;
  padding:14px 16px;
  border:0;
  background:transparent;
  color:var(--tr-text);
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  cursor:pointer;
}
.topup-report-page .tx-id{ color:var(--tr-accent-2); font-weight:1000; word-break:break-all; }
.topup-report-page .tx-accordion__meta{ display:flex; align-items:center; gap:10px; color:var(--tr-muted); font-size:12px; }
.topup-report-page .tx-toggle::before{ content:"⌄"; display:grid; place-items:center; width:30px; height:30px; border-radius:999px; border:1px solid var(--tr-border); }
.topup-report-page .tx-accordion[data-open="1"] .tx-toggle::before{ transform:rotate(180deg); }
.topup-report-page .tx-accordion__body{ display:none; padding:0 16px 16px; }
.topup-report-page .tx-accordion[data-open="1"] .tx-accordion__body{ display:block; }
.topup-report-page .tx-row{ display:grid; grid-template-columns:110px minmax(0,1fr); gap:12px; padding:12px 0; border-top:1px solid var(--tr-border); }
.topup-report-page .tx-label{ color:var(--tr-muted); font-weight:900; }
.topup-report-page .tx-value{ color:var(--tr-text); min-width:0; }
.topup-report-page .tx-actions{ margin-top:12px; }
.topup-report-page .pill{ display:inline-flex; align-items:center; border-radius:999px; padding:8px 12px; font-weight:1000; }
.topup-report-page .pill--completed{ background:color-mix(in srgb,var(--tr-green) 18%, transparent); color:var(--tr-green); }
.topup-report-page .pill--pending{ background:color-mix(in srgb,var(--tr-accent) 18%, transparent); color:var(--tr-accent-2); }
.topup-report-page .pill--reject,
.topup-report-page .pill--rejected,
.topup-report-page .pill--failed{ background:color-mix(in srgb,var(--tr-red) 18%, transparent); color:var(--tr-red); }

/* ===== Yearly summary ===== */
.topup-report-page .yearly-table{ min-width:980px; }
.topup-report-page .month-name{ color:var(--tr-text); font-size:16px; }
.topup-report-page .is-empty-month{ opacity:.58; }
.topup-report-page .method-chip-list{ display:flex; flex-wrap:wrap; gap:8px; }
.topup-report-page .method-chip{
  display:inline-grid;
  gap:2px;
  min-width:138px;
  padding:9px 11px;
  border:1px solid var(--tr-border);
  border-radius:16px;
  background:rgba(255,255,255,.035);
}
.topup-report-page .method-chip b{ color:var(--tr-accent-2); font-size:12px; }
.topup-report-page .method-chip em{ color:var(--tr-muted); font-style:normal; font-size:11px; }
.topup-report-page .method-chip strong{ color:var(--tr-green); font-size:13px; }

/* ===== Empty ===== */
.topup-report-page .empty-history{
  display:grid;
  place-items:center;
  gap:8px;
  padding:54px 18px;
  text-align:center;
  color:var(--tr-muted);
}
.topup-report-page .empty-title{ color:var(--tr-text); font-size:22px; font-weight:1000; }
.topup-report-page .empty-sub{ font-size:14px; }
.topup-report-page .soft{ background:var(--tr-soft); }

/* Period Control responsive */
@media (max-width: 1180px){
  .topup-report-page .period-control-head{
    grid-template-columns:1fr;
  }
  .topup-report-page .period-current{
    align-items:flex-start;
    text-align:left;
  }
  .topup-report-page .period-control-card .report-mode-tabs{
    justify-content:stretch;
    width:100%;
  }
  .topup-report-page .period-control-card .report-mode-tabs .btn{
    flex:1;
  }
  .topup-report-page .period-control-body{
    justify-content:stretch;
  }
  .topup-report-page .period-control-card .month-toolbar{
    width:100%;
  }
}
@media (max-width: 760px){
  .topup-report-page .period-control-card{
    padding:16px;
    border-radius:26px;
  }
  .topup-report-page .period-title-wrap{
    align-items:flex-start;
  }
  .topup-report-page .period-icon{
    width:52px;
    height:52px;
    flex-basis:52px;
  }
  .topup-report-page .period-copy h2{
    font-size:26px;
  }
  .topup-report-page .period-control-card .month-toolbar{
    display:grid;
    grid-template-columns:48px minmax(0,1fr) 48px;
    gap:8px;
  }
  .topup-report-page .period-control-card .month-toolbar .btn:last-child{
    grid-column:1 / -1;
  }
  .topup-report-page .period-control-card .month-ctrl{
    order:0;
    flex:initial;
    width:100%;
  }
  .topup-report-page .period-control-card #monthInput{
    width:100%;
  }
}
@media (max-width: 520px){
  .topup-report-page .period-title-wrap{
    flex-direction:column;
  }
}

/* ===== Responsive ===== */
@media (max-width: 1200px){
  .topup-report-page .grid.cards{ grid-template-columns:repeat(2,minmax(0,1fr)); }
}
@media (max-width: 760px){
  .topup-report-page{ padding:12px; }
  .topup-report-page .page-head{ border-radius:24px; padding:24px; }
  .topup-report-page .grid.cards,
  .topup-report-page .grid.cards.single{ grid-template-columns:1fr; }
  .topup-report-page .month-toolbar{ justify-content:stretch; flex-wrap:wrap; }
  .topup-report-page .month-ctrl{ flex:1 1 100%; order:-1; }
  .topup-report-page #monthInput{ width:100%; }
  .topup-report-page .month-toolbar .btn{ flex:1; }
  .topup-report-page .desktop-only{ display:none!important; }
  .topup-report-page .mobile-only{ display:grid!important; }
  .topup-report-page .history-wrapper{ padding:12px; }
  .topup-report-page .tx-row{ grid-template-columns:1fr; gap:5px; }
}

@keyframes trFadeUp{ from{ opacity:0; transform:translateY(14px); } to{ opacity:1; transform:translateY(0); } }
@keyframes trModalIn{ from{ opacity:0; transform:translateY(12px) scale(.985); } to{ opacity:1; transform:translateY(0) scale(1); } }
@keyframes trPicker{ from{ opacity:0; transform:translateY(8px) scale(.98); } to{ opacity:1; transform:none; } }

@media (prefers-reduced-motion: reduce){
  .topup-report-page *,
  .topup-report-page *::before,
  .topup-report-page *::after{ animation:none!important; transition:none!important; }
}
`;

const MONTHS_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

const BANK_LABELS = {
  bbl:'ธนาคารกรุงเทพ', kbank:'ธนาคารกสิกรไทย', ktb:'ธนาคารกรุงไทย',
  bay:'ธนาคารกรุงศรีอยุธยา', scb:'ธนาคารไทยพาณิชย์', tmb:'ทหารไทยธนชาต (TTB)',
  cimb:'ธนาคารซีไอเอ็มบีไทย', uob:'ธนาคารยูโอบี', gsb:'ธนาคารออมสิน',
  baac:'ธ.เพื่อการเกษตรและสหกรณ์การเกษตร', kkb:'ธนาคารเกียรตินาคินภัทร',
  lhfg:'ธนาคารแลนด์ แอนด์ เฮ้าส์', icbc:'ธนาคารไอซีบีซี (ไทย)', tisco:'ธนาคารทิสโก้',
};

function methodLabel(m) {
  const map = { tw:'True Wallet', truewallet:'True Wallet', qr:'PromptPay QR', kbank:'กสิกรไทย', scb:'ไทยพาณิชย์', admin:'Admin', manual:'เติมมือ' };
  return map[(m || '').toLowerCase()] || m || '—';
}

function statusLabel(s) {
  const map = { completed:'สำเร็จ', pending:'รอดำเนินการ', reject:'ถูกปฏิเสธ', rejected:'ถูกปฏิเสธ', failed:'ล้มเหลว', cancelled:'ยกเลิก', canceled:'ยกเลิก' };
  return map[(s || '').toLowerCase()] || s || '—';
}

export default function ReportClient({ mode, monthStr, selectedYear, selectedLabel, sumNoAdmin, countNoAdmin, methodTotals, transactions, yearlyRows }) {
  const router = useRouter();
  const now = new Date();
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth();

  const isYearMode = mode === 'year';
  const [yy, mm] = monthStr.split('-').map(Number);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTempYear, setPickerTempYear] = useState(isYearMode ? selectedYear : yy);
  const [pickerTempMonth, setPickerTempMonth] = useState(isYearMode ? 0 : mm - 1);
  const [pickerPos, setPickerPos] = useState({ left: '50%', top: '50%' });
  const [openAccordions, setOpenAccordions] = useState(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [prefill, setPrefill] = useState({});
  const toolbarRef = useRef(null);

  function toYYYYMM(y, m) { return `${y}-${String(m + 1).padStart(2, '0')}`; }

  function goMonth(ms) {
    const p = new URLSearchParams({ mode: 'month', month: ms });
    router.push(`?${p.toString()}`);
  }
  function goYear(y) {
    const p = new URLSearchParams({ mode: 'year', year: String(y) });
    router.push(`?${p.toString()}`);
  }
  function goSelected() {
    if (isYearMode) goYear(pickerTempYear);
    else goMonth(toYYYYMM(pickerTempYear, pickerTempMonth));
  }

  const openPicker = useCallback(() => {
    setPickerTempYear(isYearMode ? selectedYear : yy);
    setPickerTempMonth(isYearMode ? 0 : mm - 1);
    if (toolbarRef.current) {
      const rect = toolbarRef.current.getBoundingClientRect();
      const cardW = Math.min(342, window.innerWidth * 0.92);
      let left = rect.left + rect.width / 2 - cardW / 2;
      let top = rect.bottom + 10;
      left = Math.max(12, Math.min(left, window.innerWidth - cardW - 12));
      top = Math.max(12, Math.min(top, window.innerHeight - 340));
      setPickerPos({ left: `${Math.round(left)}px`, top: `${Math.round(top)}px` });
    }
    setPickerOpen(true);
  }, [isYearMode, selectedYear, yy, mm]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setPickerOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [pickerOpen]);

  function toggleAccordion(id) {
    setOpenAccordions(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function openManual(tx) {
    setPrefill({ txId: tx.transactionId, amount: tx.amount, username: tx.userId?.username || tx.username, method: tx.method });
    setModalOpen(true);
  }

  async function rejectTx(id) {
    if (!await confirmAction({ title: 'ปฏิเสธรายการเติมเงิน', message: 'ยืนยันปฏิเสธรายการนี้?', confirmText: 'ปฏิเสธ', cancelText: 'ยกเลิก', variant: 'danger' })) return;
    try {
      const r = await fetch(`/api/admin/topup/${encodeURIComponent(id)}/reject`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j?.error || 'ปฏิเสธไม่สำเร็จ');
      window.location.reload();
    } catch (err: any) {
      notifyFromPayload({ variant: 'error', title: 'ทำรายการไม่สำเร็จ', text: err.message || 'ทำรายการไม่สำเร็จ' });
    }
  }

  function renderPickerGrid() {
    if (isYearMode) {
      const startYear = pickerTempYear - 5;
      return Array.from({ length: 12 }, (_, i) => {
        const y = startYear + i;
        return (
          <button key={y} type="button"
            className={`mp-m${y === pickerTempYear ? ' active' : ''}${y === nowYear ? ' current' : ''}`}
            onClick={() => setPickerTempYear(y)}>
            {y + 543}
          </button>
        );
      });
    }
    return MONTHS_TH.map((name, m) => (
      <button key={m} type="button"
        className={`mp-m${m === pickerTempMonth && pickerTempYear === yy ? ' active' : ''}${m === nowMonth && pickerTempYear === nowYear ? ' current' : ''}`}
        onClick={() => setPickerTempMonth(m)}>
        {name}
      </button>
    ));
  }

  const inputValue = isYearMode ? String(selectedYear) : monthStr;

  return (
    <div className="topup-report-page">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* Page header */}
      <section className="page-head">
        <div className="page-title">
          <h1>ประวัติการเติมเงินทั้งหมด</h1>
          <small className="muted">หลังบ้าน → รายการเติมเงินทั้งหมด</small>
        </div>
      </section>

      {/* Sum no-admin */}
      {sumNoAdmin > 0 && (
        <div className="grid cards single">
          <section className="card">
            <div className="card-head row-head">
              <h3>ยอดเติมรวมทั้งหมด (ไม่รวมแอดมิน){selectedLabel ? ` • ${selectedLabel}` : ''}</h3>
              <div className="head-right">
                <span className="metric-badge" style={{ color: '#05b84f', padding: '2px 18px' }}>
                  {(countNoAdmin || 0).toLocaleString('th-TH')} รายการ
                </span>
              </div>
            </div>
            <div className="big" style={{ color: '#35cc10', padding: '6px 2px' }}>
              ฿{Number(sumNoAdmin).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </section>
        </div>
      )}

      {/* Method totals */}
      {methodTotals.length > 0 && (
        <div className="grid cards">
          {methodTotals.map(m => (
            <section key={m.method} className="card2">
              <div className="card-head row-head">
                <h3>ยอดเติมรวม {m.label}{selectedLabel ? ` • ${selectedLabel}` : ''}</h3>
                <div className="head-right">
                  <span className="metric-badge" style={{ color: '#05b84f', padding: '2px 18px' }}>
                    {(m.count || 0).toLocaleString('th-TH')} รายการ
                  </span>
                </div>
              </div>
              <div className="big" style={{ color: '#35cc10', padding: '6px 2px' }}>
                ฿{Number(m.sum || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Period control card */}
      <section className="period-control-card" aria-label="เลือกเดือนหรือปีรายงาน">
        <div className="period-control-glow" aria-hidden="true" />
        <div className="period-control-glow period-control-glow--right" aria-hidden="true" />

        <div className="period-control-head">
          <div className="period-title-wrap">
            <span className="period-icon" aria-hidden="true">📅</span>
            <div className="period-copy">
              <span className="period-kicker">Report Period</span>
              <h2>เลือกเดือน/ปี</h2>
              <p>สลับมุมมองรายเดือนหรือรายปี แล้วเลือกช่วงเวลาที่ต้องการดูรายงานเติมเงิน</p>
            </div>
          </div>

          <div className="period-current">
            <span>กำลังดูข้อมูล</span>
            <strong>{selectedLabel}</strong>
          </div>

          <div className="report-mode-tabs" role="tablist" aria-label="เลือกมุมมองรายงาน">
            <button className={`btn ghost${!isYearMode ? ' active' : ''}`} type="button"
              onClick={() => goMonth(toYYYYMM(isYearMode ? selectedYear : yy, isYearMode ? nowMonth : mm - 1))}>
              รายเดือน
            </button>
            <button className={`btn ghost${isYearMode ? ' active' : ''}`} type="button"
              onClick={() => goYear(isYearMode ? selectedYear : yy)}>
              รายปี
            </button>
          </div>
        </div>

        <div className="period-control-body">
          <div className="month-toolbar" ref={toolbarRef} role="group" aria-label="เลือกช่วงเวลา">
            <button className="btn ghost" type="button" aria-label="ก่อนหน้า"
              onClick={() => {
                if (isYearMode) { goYear(selectedYear - 1); return; }
                const d = new Date(yy, mm - 2, 1);
                goMonth(toYYYYMM(d.getFullYear(), d.getMonth()));
              }}>◀︎</button>
            <label className="month-ctrl">
              <input id="monthInput" type="text" value={inputValue} readOnly
                aria-label="เลือกช่วงเวลา" onClick={openPicker} />
              <button className="icon-btn" type="button" aria-label="เปิดตัวเลือกช่วงเวลา" onClick={openPicker}>📅</button>
            </label>
            <button className="btn ghost" type="button" aria-label="ถัดไป"
              onClick={() => {
                if (isYearMode) { goYear(selectedYear + 1); return; }
                const d = new Date(yy, mm, 1);
                goMonth(toYYYYMM(d.getFullYear(), d.getMonth()));
              }}>▶︎</button>
            <button className="btn" type="button"
              onClick={() => isYearMode ? goYear(nowYear) : goMonth(toYYYYMM(nowYear, nowMonth))}>
              {isYearMode ? 'ปีนี้' : 'เดือนนี้'}
            </button>
          </div>
        </div>
      </section>

      {/* Month/Year picker popup */}
      {pickerOpen && (
        <div className="mp-popup" aria-hidden="false">
          <div className="mp-backdrop" onClick={() => setPickerOpen(false)} />
          <div className="mp-card" role="dialog" aria-modal="true" aria-label="เลือกช่วงเวลา"
            style={{ left: pickerPos.left, top: pickerPos.top }}>
            <div className="mp-head">
              <button className="mp-nav" type="button" aria-label="ปีก่อนหน้า"
                onClick={() => setPickerTempYear(y => y + (isYearMode ? -12 : -1))}>‹</button>
              <div className="mp-year">{isYearMode ? 'เลือกปี' : String(pickerTempYear + 543)}</div>
              <button className="mp-nav" type="button" aria-label="ปีถัดไป"
                onClick={() => setPickerTempYear(y => y + (isYearMode ? 12 : 1))}>›</button>
            </div>
            <div className="mp-grid" role="grid" aria-label="รายชื่อเดือนหรือปี">
              {renderPickerGrid()}
            </div>
            <div className="mp-actions">
              <button className="btn ghost" type="button" onClick={() => {
                setPickerOpen(false);
                isYearMode ? goYear(nowYear) : goMonth(toYYYYMM(nowYear, nowMonth));
              }}>ล้าง</button>
              <div className="spacer" />
              <button className="btn ghost" type="button" onClick={() => {
                setPickerTempYear(nowYear);
                setPickerTempMonth(nowMonth);
              }}>{isYearMode ? 'ปีนี้' : 'เดือนนี้'}</button>
              <button className="btn" type="button" onClick={() => { setPickerOpen(false); goSelected(); }}>ตกลง</button>
            </div>
          </div>
        </div>
      )}

      {/* History wrapper */}
      <div className="history-wrapper card soft">
        <div className="title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
          <h3 style={{ margin: 0 }}>
            {isYearMode ? `สรุปเติมเงินรายเดือน ${selectedLabel}` : 'ทุกรายการเติมเงิน'}
          </h3>
          {isYearMode && (
            <span className="metric-badge">รวม {(countNoAdmin || 0).toLocaleString('th-TH')} รายการสำเร็จ</span>
          )}
        </div>

        {isYearMode ? (
          yearlyRows.some(r => r.count > 0) ? (
            <>
              {/* Desktop yearly table */}
              <div className="table-wrap desktop-only">
                <table className="history-table yearly-table">
                  <thead>
                    <tr>
                      <th>เดือน</th>
                      <th style={{ textAlign: 'center' }}>จำนวนรายการเติม</th>
                      <th style={{ textAlign: 'right' }}>ยอดรวมไม่รวมแอดมิน</th>
                      <th style={{ textAlign: 'left' }}>ยอดแยกตาม Method</th>
                      <th style={{ textAlign: 'right' }}>ยอดรวม Completed</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearlyRows.map(row => (
                      <tr key={row.month} className={row.count <= 0 ? 'is-empty-month' : ''}>
                        <td>
                          <b className="month-name">{row.label}</b>
                          <div className="muted">{row.month}</div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="metric-badge">{(row.noAdminCount || 0).toLocaleString('th-TH')} รายการ</span>
                        </td>
                        <td className="amount">฿{Number(row.noAdminSum || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td>
                          {row.methods?.length > 0 ? (
                            <div className="method-chip-list">
                              {row.methods.map(m => (
                                <span key={m.method} className="method-chip">
                                  <b>{m.label}</b>
                                  <em>{(m.count || 0).toLocaleString('th-TH')} รายการ</em>
                                  <strong>฿{Number(m.sum || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="muted">ไม่มีรายการสำเร็จ</span>
                          )}
                        </td>
                        <td className="amount">฿{Number(row.sum || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button className="btn small ghost" type="button" onClick={() => goMonth(row.month)}>ดูรายการ</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile yearly accordion */}
              <div className="mobile-only tx-accordion-list" style={{ marginTop: '10px' }}>
                {yearlyRows.map(row => (
                  <div key={row.month} className="tx-accordion" data-open={openAccordions.has(row.month) ? '1' : '0'}>
                    <button className="tx-accordion__head" type="button" onClick={() => toggleAccordion(row.month)}>
                      <div className="tx-accordion__title">
                        <span className="tx-id">{row.label}</span>
                      </div>
                      <div className="tx-accordion__meta">
                        <span className="tx-date">{(row.noAdminCount || 0).toLocaleString('th-TH')} รายการ</span>
                        <span className="tx-toggle" />
                      </div>
                    </button>
                    <div className="tx-accordion__body">
                      <div className="tx-row">
                        <div className="tx-label">ยอดรวมไม่รวมแอดมิน</div>
                        <div className="tx-value"><b>฿{Number(row.noAdminSum || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</b></div>
                      </div>
                      <div className="tx-row">
                        <div className="tx-label">Completed ทั้งหมด</div>
                        <div className="tx-value"><b>฿{Number(row.sum || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</b></div>
                      </div>
                      <div className="tx-row">
                        <div className="tx-label">Method</div>
                        <div className="tx-value">
                          {row.methods?.length > 0 ? (
                            <div className="method-chip-list">
                              {row.methods.map(m => (
                                <span key={m.method} className="method-chip">
                                  <b>{m.label}</b>
                                  <em>{(m.count || 0).toLocaleString('th-TH')} รายการ</em>
                                  <strong>฿{Number(m.sum || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                                </span>
                              ))}
                            </div>
                          ) : <span className="muted">ไม่มีรายการสำเร็จ</span>}
                        </div>
                      </div>
                      <div className="tx-actions">
                        <button className="btn small ghost" type="button" style={{ width: '100%', textAlign: 'center' }} onClick={() => goMonth(row.month)}>ดูรายการเดือนนี้</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-history" role="status">
              <div className="empty-title">ปีนี้ยังไม่มีรายการเติมเงินสำเร็จ</div>
              <div className="empty-sub">เลือกปีอื่น หรือกลับไปดูแบบรายเดือน</div>
            </div>
          )
        ) : transactions.length > 0 ? (
          <>
            {/* Desktop monthly table */}
            <div className="table-wrap desktop-only">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>วันที่ / เวลา</th>
                    <th>รหัสรายการ</th>
                    <th>ผู้ใช้</th>
                    <th style={{ textAlign: 'left' }}>วิธีเติม</th>
                    <th>ข้อมูลผู้โอน</th>
                    <th style={{ textAlign: 'right' }}>จำนวนเงิน</th>
                    <th style={{ textAlign: 'center' }}>สถานะ</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(tx => {
                    const m = (tx.method || '').toLowerCase();
                    const sc = (tx.status || '').toLowerCase();
                    return (
                      <tr key={tx._id}>
                        <td className="muted">
                          {new Date(tx.createdAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td title={tx.transactionId}>{tx.transactionId || '—'}</td>
                        <td>
                          <div className="user-cell">
                            <img className="avatar-sm" src={avatarSrc(tx.userId)} alt={tx.userId?.username || tx.username || 'user'} width={28} height={28} loading="lazy" onError={handleAvatarError} />
                            <div className="user-meta">
                              <b className="user-name">{tx.userId?.username || tx.username || '-'}</b>
                              {tx.userId?.email && <span className="user-email muted">{tx.userId.email}</span>}
                            </div>
                          </div>
                        </td>
                        <td>{methodLabel(tx.method)}</td>
                        <td>
                          {(m === 'truewallet' || m === 'tw') ? (
                            <>
                              <img src="/assets/payment/tw.webp" className="bank-logo" alt="" />
                              <b>TrueWallet</b>
                              <div className="muted">เบอร์ผู้โอน: {tx.senderNumber || '-'}</div>
                            </>
                          ) : (
                            <>
                              <img src="/assets/payment/mobilebanking.png" className="bank-logo" alt="" />
                              <b>{BANK_LABELS[tx.senderBank] || 'ไม่ระบุธนาคาร'}</b>
                              <div className="muted">เลขท้ายบัญชีผู้โอน: {tx.senderLast6 || '-'}</div>
                            </>
                          )}
                        </td>
                        <td className="amount">฿{Number(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className={`status ${sc}`}>{statusLabel(tx.status)}</td>
                        <td>
                          {tx.status === 'pending' && (
                            <div style={{ display: 'flex', gap: '6px', flexDirection: 'column' }}>
                              <button className="btn small success" type="button" onClick={() => openManual(tx)}>เติมให้ผู้ใช้</button>
                              <button className="btn small danger" type="button" onClick={() => rejectTx(tx._id || tx.transactionId)}>ปฏิเสธ</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile monthly accordion */}
            <div className="mobile-only tx-accordion-list" style={{ marginTop: '10px' }}>
              {transactions.map(tx => {
                const m = (tx.method || '').toLowerCase();
                return (
                  <div key={tx._id} className="tx-accordion" data-open={openAccordions.has(tx._id) ? '1' : '0'}>
                    <button className="tx-accordion__head" type="button" onClick={() => toggleAccordion(tx._id)}>
                      <div className="tx-accordion__title">
                        <span className="tx-id" title={tx.transactionId}>{tx.transactionId || '—'}</span>
                      </div>
                      <div className="tx-accordion__meta">
                        <span className="tx-date">
                          {new Date(tx.createdAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span className="tx-toggle" />
                      </div>
                    </button>
                    <div className="tx-accordion__body">
                      <div className="tx-row">
                        <div className="tx-label">ผู้ใช้</div>
                        <div className="tx-value">
                          <div className="user-cell">
                            <img className="avatar-sm" src={avatarSrc(tx.userId)} alt={tx.userId?.username || tx.username || 'user'} width={28} height={28} loading="lazy" onError={handleAvatarError} />
                            <div className="user-meta">
                              <b className="user-name">{tx.userId?.username || tx.username || '-'}</b>
                              {tx.userId?.email && <span className="user-email muted">{tx.userId.email}</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="tx-row">
                        <div className="tx-label">ผู้โอน</div>
                        <div className="tx-value">
                          {(m === 'truewallet' || m === 'tw') ? (
                            <>
                              <img src="/assets/payment/tw.webp" className="bank-logo" alt="" />
                              <b>TrueWallet</b><br />
                              <span className="muted">เบอร์ผู้โอน: {tx.senderNumber || '-'}</span>
                            </>
                          ) : (
                            <>
                              <img src="/assets/payment/mobilebanking.png" className="bank-logo" alt="" />
                              <b>{BANK_LABELS[tx.senderBank] || 'ไม่ระบุธนาคาร'}</b><br />
                              <span className="muted">เลขท้ายบัญชีผู้โอน: {tx.senderLast6 || '-'}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="tx-row">
                        <div className="tx-label">วิธีเติม</div>
                        <div className="tx-value">{methodLabel(tx.method)}</div>
                      </div>
                      <div className="tx-row">
                        <div className="tx-label">จำนวนเงิน</div>
                        <div className="tx-value"><b>฿{Number(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</b></div>
                      </div>
                      <div className="tx-row">
                        <div className="tx-label">สถานะ</div>
                        <div className="tx-value">
                          <span className={`pill pill--${(tx.status || '').toLowerCase()}`}>{statusLabel(tx.status)}</span>
                        </div>
                      </div>
                      {tx.status === 'pending' && (
                        <div className="tx-actions">
                          <button className="btn small success" type="button" style={{ width: '100%' }} onClick={() => openManual(tx)}>เติมให้ผู้ใช้</button>
                          <button className="btn small danger" type="button" style={{ width: '100%', marginTop: '8px' }} onClick={() => rejectTx(tx._id || tx.transactionId)}>ปฏิเสธ</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="empty-history" role="status" aria-live="polite">
            <div className="empty-title">ยังไม่มีรายการเติมเงิน</div>
            <div className="empty-sub">เมื่อมีรายการ ระบบจะแสดงที่นี่โดยอัตโนมัติ</div>
          </div>
        )}
      </div>

      <ManualTopupModal open={modalOpen} onClose={() => setModalOpen(false)} prefill={prefill} />
    </div>
  );
}
