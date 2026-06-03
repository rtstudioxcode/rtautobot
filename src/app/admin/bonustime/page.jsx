'use client';

import { useState, useEffect, useRef } from 'react';

const CSS = `
/* ===== BASE ===== */
.bonustime-admin{max-width:min(1760px,calc(100vw - 28px));margin-inline:auto;color:var(--bt-text);}
.bonustime-admin .bt-tabbar{display:flex;border-bottom:1px solid var(--border,#262932);margin:10px 0 18px;}
.bonustime-admin .bt-tab{flex:1;position:relative;padding:8px 10px 10px;border:none;background:transparent;color:var(--muted,#9ca3af);font-size:14px;cursor:pointer;text-align:center;}
.bonustime-admin .bt-tab span{position:relative;z-index:1;}
.bonustime-admin .bt-tab::after{content:"";position:absolute;inset-inline:0;bottom:-1px;height:2px;background:transparent;transition:background .18s ease;}
.bonustime-admin .bt-tab.active{color:var(--accent,#05b84f);font-weight:300;}
.bonustime-admin .bt-tab.active::after{background:var(--accent,#05b84f);}
.bonustime-admin .tabpane{display:none;}
.bonustime-admin .tabpane.show{display:block;}
.bonustime-admin .bt-admin-list{display:flex;flex-direction:column;gap:12px;}
.bonustime-admin .bonustime-card.admin{background:var(--card);border:1px solid #05b84f40;border-radius:18px;padding:14px 16px;font-size:14px;color:var(--text);transition:background .15s ease,border-color .15s ease,box-shadow .15s ease;width:100%;max-width:1980px;margin-inline:auto;}
.bonustime-admin .bonustime-card.admin:hover{border-color:var(--accent,#05b84f);box-shadow:0 0 0 1px rgba(6,199,85,.08);}
.bonustime-admin .bonustime-card.admin .collapse-head{display:flex;justify-content:space-between;align-items:flex-start;cursor:pointer;gap:12px;}
.bonustime-admin .bonustime-card.admin .tenant-name{font-weight:300;font-size:15px;}
.bonustime-admin .bonustime-card.admin .tenant-meta{margin-top:2px;}
.bonustime-admin .bonustime-card.admin .status-right{display:flex;flex-direction:row;align-items:center;gap:8px;}
.bonustime-admin .bonustime-card.admin .status-pill{font-size:12px;padding:4px 10px;border-radius:999px;border:1px solid var(--border);background:var(--page);color:var(--muted);white-space:nowrap;}
.bonustime-admin .bonustime-card.admin .status-pill.sold{background:rgba(34,197,94,.08);color:#4ade80;border-color:rgba(34,197,94,.4);}
.bonustime-admin .bonustime-card.admin .status-pill.free{background:rgba(148,163,184,.1);color:#e5e7eb;}
.bonustime-admin .expiry-pill{font-size:12px;padding:4px 10px;border-radius:999px;border:1px solid rgba(6,199,85,.7);background:rgba(6,199,85,.15);color:#21b95c;white-space:nowrap;}
.bonustime-admin .expiry-pill.expired{border-color:rgba(248,113,113,.9);background:rgba(127,29,29,.9);color:#fee2e2;}
.bonustime-admin .expiry-pill.no-expiry{border-color:rgba(6,199,85,.52);background:rgba(6,199,85,.10);color:#08b84f;}
.bt-delete-btn{border-radius:999px;border:1px solid rgba(248,113,113,.6);background:rgba(127,29,29,.9);color:#fee2e2;font-size:12px;padding:4px 10px;cursor:pointer;transition:background .15s ease,border-color .15s ease,transform .1s ease,box-shadow .1s ease;}
.bt-delete-btn:hover{background:rgba(185,28,28,1);border-color:rgba(248,113,113,1);}
.bt-reset-btn{border-radius:999px;border:1px solid rgba(6,199,85,.62);background:linear-gradient(135deg,rgba(6,199,85,.18),rgba(0,184,74,.10));color:#08b84f;font-size:12px;padding:4px 10px;cursor:pointer;transition:background .15s ease,border-color .15s ease;}
.bt-reset-btn:hover{background:linear-gradient(135deg,rgba(6,199,85,.34),rgba(0,184,74,.20));border-color:rgba(6,199,85,.95);}
.bonustime-admin .bonustime-card.admin .collapse-icon{font-size:12px;transform:rotate(180deg);transition:transform .15s ease;opacity:.7;}
.bonustime-admin .bonustime-card.admin .collapse-body{border-top:1px solid var(--border);margin-top:10px;padding-top:10px;display:none;}
.bonustime-admin .bonustime-card.admin.open .collapse-body{display:block;}
.bonustime-admin .bonustime-card.admin.open .collapse-icon{transform:rotate(0deg);}
.bonustime-admin .bt-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 16px;}
.bonustime-admin .bt-field{display:flex;flex-direction:column;gap:4px;font-size:13px;}
.bonustime-admin .bt-field-wide{grid-column:1/-1;}
.bonustime-admin .bt-field label{color:var(--muted);}
.bonustime-admin .bt-field input,.bonustime-admin .bt-field textarea,.bonustime-admin .bt-field select{border-radius:10px;border:1px solid var(--border);background:var(--page);color:var(--text);padding:6px 8px;font:inherit;resize:vertical;}
.bonustime-admin .bt-field input[readonly]{opacity:.8;cursor:default;}
.link-row{display:flex;gap:8px;}.bt-copy-link{border-radius:999px;border:1px solid var(--border);background:var(--page);color:var(--accent);font-size:12px;padding:4px 10px;cursor:pointer;white-space:nowrap;}
.bt-copy-link:hover{border-color:var(--accent);}
.bt-admin-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:14px;padding-top:12px;border-top:1px solid var(--border,#262932);}
.bt-flex-spacer{flex:1;}
.bt-add-wrapper{display:flex;justify-content:flex-end;margin:8px 0 18px;}
.bt-add-btn{display:inline-flex;align-items:center;gap:8px;padding:10px 22px;border-radius:999px;border:none;cursor:pointer;background:linear-gradient(135deg,#05b84f,#05b84f);color:#111827;font-size:14px;font-weight:300;box-shadow:0 8px 18px rgba(6,199,85,.25);transition:transform .15s ease,box-shadow .15s ease;}
.bt-add-btn .bt-add-icon{width:22px;height:22px;border-radius:999px;display:grid;place-items:center;background:rgba(17,24,39,.08);font-size:16px;}
.bt-add-btn:hover{transform:translateY(-1px);box-shadow:0 12px 24px rgba(6,199,85,.3);}
@media(max-width:768px){.bonustime-admin .bt-admin-list{align-items:center;}.bonustime-admin .bonustime-card.admin{width:99%;max-width:720px;padding:12px;}.bonustime-admin .bt-grid{grid-template-columns:1fr;}}
@media(max-width:480px){.bonustime-admin .bonustime-card.admin{width:99%;max-width:100%;border-radius:14px;}}

/* ===== ULTRA SUMMARY ===== */
.ultra-summary{--ultra-gap:8px;--ultra-radius:18px;--ultra-card-bg:var(--card,#14151a);--ultra-border:var(--border,#262730);--ultra-text:var(--text,#fff);--ultra-muted:var(--muted,#a1a1aa);--ultra-accent:var(--accent,#05b84f);--ultra-bg-soft:rgba(6,199,85,.06);padding-top:10px;padding-bottom:18px;display:flex;flex-direction:column;gap:var(--ultra-gap);}
.ultra-summary-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:8px;}
.ultra-summary-title h2{font-size:clamp(18px,2.2vw,22px);margin:0;}
.ultra-summary-title p{margin:4px 0 0;color:var(--ultra-muted);}
.ultra-month-select{display:flex;align-items:center;gap:8px;font-size:14px;}
.ultra-month-select select{background:var(--ultra-card-bg);color:var(--ultra-text);border-radius:999px;border:1px solid var(--ultra-border);padding:6px 14px;font-size:14px;}
.ultra-cards{display:grid;margin-bottom:20px;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:var(--ultra-gap);}
.ultra-card.glass{background:linear-gradient(135deg,rgba(24,24,27,.96),rgba(15,23,42,.96));border-radius:var(--ultra-radius);border:1px solid var(--ultra-border);padding:14px 16px 12px;display:flex;flex-direction:column;gap:8px;}
.ultra-card h3{font-size:14px;font-weight:500;margin:0;color:var(--ultra-muted);}
.ultra-card .ultra-value{font-size:clamp(22px,2.4vw,26px);font-weight:600;color:var(--ultra-text);}
.ultra-trend{display:inline-flex;align-items:center;gap:8px;font-size:12px;color:var(--ultra-muted);}
.ultra-trend .dot{width:8px;height:8px;border-radius:999px;background:var(--ultra-muted);}
.ultra-trend.up .dot{background:#4ade80;}
.ultra-trend.flat .dot{background:#a1a1aa;}
.ultra-charts-grid{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);margin-bottom:22px;gap:var(--ultra-gap);}
@media(max-width:960px){.ultra-charts-grid{grid-template-columns:minmax(0,1fr);}}
.ultra-chart.glass{background:radial-gradient(circle at top left,rgba(6,199,85,.12),transparent 46%),var(--ultra-card-bg);border-radius:var(--ultra-radius);border:1px solid var(--ultra-border);padding:12px 16px 14px;display:flex;flex-direction:column;gap:8px;min-height:230px;}
.ultra-chart-head h3{margin:0;font-size:14px;color:var(--ultra-muted);}
.ultra-chart-body{margin-top:4px;flex:1;display:flex;align-items:stretch;}
.ultra-topdays.glass{background:var(--ultra-card-bg);border-radius:var(--ultra-radius);border:1px solid var(--ultra-border);padding:14px 16px;margin-top:4px;}
.ultra-topdays h3{margin:0 0 10px;font-size:14px;color:var(--ultra-muted);}
.topdays-list{display:flex;flex-direction:column;gap:8px;}
.topdays-list .top-item{display:grid;grid-template-columns:28px minmax(0,1.4fr) minmax(0,2fr) max-content;gap:8px;align-items:center;font-size:13px;}
.topdays-list .rank{width:22px;height:22px;border-radius:999px;display:grid;place-items:center;background:var(--ultra-bg-soft);color:var(--ultra-accent);font-size:12px;}
.topdays-list .label{color:var(--ultra-text);}
.topdays-list .bar{height:6px;border-radius:999px;background:rgba(39,39,42,.9);overflow:hidden;}
.topdays-list .bar > div{height:100%;background:linear-gradient(90deg,#05b84f,#08b84f);border-radius:inherit;}
.topdays-list .amount{font-variant-numeric:tabular-nums;color:var(--ultra-muted);white-space:nowrap;}
@media(max-width:640px){.ultra-summary-head{flex-direction:column;align-items:flex-start;}}
.ultra-yearly{margin-top:22px;padding:22px;border-radius:28px;border:1px solid color-mix(in srgb,var(--ultra-accent,#08b84f) 20%,transparent);background:linear-gradient(135deg,rgba(255,255,255,.07),rgba(255,255,255,.025));box-shadow:0 20px 60px rgba(0,0,0,.22);}
.ultra-yearly-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;margin-bottom:18px;}
.ultra-yearly-head h3{margin:0 0 6px;font-size:clamp(20px,2.4vw,30px);}
.ultra-year-select{display:grid;gap:7px;min-width:180px;color:var(--ultra-accent,#08b84f);font-weight:900;font-size:12px;text-transform:uppercase;letter-spacing:.04em;}
.ultra-year-select select{height:48px;border-radius:16px;border:1px solid color-mix(in srgb,var(--ultra-accent,#08b84f) 34%,transparent);background:rgba(8,8,12,.84);color:var(--text,#eef6ff);font-weight:900;padding:0 14px;}
.ultra-year-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;}
@media(max-width:1100px){.ultra-year-cards{grid-template-columns:repeat(2,minmax(0,1fr));}}
@media(max-width:680px){.ultra-yearly-head{flex-direction:column;}.ultra-year-select{width:100%;}.ultra-year-cards{grid-template-columns:1fr;}}

/* ===== ENTERPRISE SKIN ===== */
.bonustime-admin{
  --bt-page: var(--page, #08090d);
  --bt-card: color-mix(in srgb, var(--card, #17181d) 92%, transparent);
  --bt-card-2: color-mix(in srgb, var(--card, #17181d) 78%, var(--page, #08090d));
  --bt-soft: color-mix(in srgb, var(--card, #17181d) 84%, transparent);
  --bt-text: var(--text, #e8fff1);
  --bt-muted: var(--muted, #a7abb7);
  --bt-border: color-mix(in srgb, var(--border, #2a2d36) 78%, transparent);
  --bt-accent: var(--accent, #08b84f);
  --bt-accent-2: color-mix(in srgb, var(--accent, #08b84f) 72%, #ffffff);
  --bt-green: #22c55e;
  --bt-red: #ef4444;
  --bt-blue: #38bdf8;
  --bt-shadow: rgba(0,0,0,.35);
}
.btx-hero{position:relative;isolation:isolate;display:grid;grid-template-columns:minmax(0,1.2fr) minmax(360px,.8fr);gap:24px;align-items:end;overflow:hidden;margin:10px 0 18px;padding:38px;border:1px solid var(--bt-border);border-radius:30px;background:radial-gradient(circle at 18% 0%,color-mix(in srgb,var(--bt-accent) 24%,transparent),transparent 34%),radial-gradient(circle at 88% 18%,rgba(99,102,241,.16),transparent 34%),linear-gradient(135deg,color-mix(in srgb,var(--bt-card) 92%,transparent),color-mix(in srgb,var(--bt-page) 86%,transparent));box-shadow:0 24px 70px var(--bt-shadow),inset 0 1px 0 rgba(255,255,255,.08);backdrop-filter:blur(18px);animation:btxFadeUp .52s cubic-bezier(.2,.8,.2,1) both;}
.btx-hero::after{content:"";position:absolute;inset:-2px;z-index:-1;background:linear-gradient(110deg,transparent 15%,rgba(255,255,255,.09) 34%,transparent 52%);transform:translateX(-120%);animation:btxSheen 5.5s ease-in-out infinite;}
.btx-hero-glow{position:absolute;border-radius:999px;filter:blur(46px);opacity:.36;pointer-events:none;z-index:-1;}
.btx-hero-glow-a{width:220px;height:220px;left:10%;top:-70px;background:var(--bt-accent);}
.btx-hero-glow-b{width:260px;height:260px;right:6%;bottom:-100px;background:#6366f1;}
.btx-kicker{display:inline-flex;align-items:center;gap:8px;width:max-content;padding:9px 14px;border-radius:999px;border:1px solid color-mix(in srgb,var(--bt-accent) 46%,transparent);color:var(--bt-accent-2);background:color-mix(in srgb,var(--bt-accent) 10%,transparent);font-weight:900;font-size:12px;letter-spacing:.08em;text-transform:uppercase;}
.btx-hero h1{margin:14px 0 10px;font-size:clamp(38px,5vw,76px);line-height:.95;letter-spacing:-.05em;color:var(--bt-text);}
.btx-hero p{margin:0;max-width:820px;color:color-mix(in srgb,var(--bt-text) 78%,var(--bt-muted));font-size:clamp(15px,1.35vw,20px);line-height:1.75;font-weight:700;}
.btx-hero-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;}
.btx-metric-card{min-height:110px;padding:18px;border-radius:22px;border:1px solid var(--bt-border);background:linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.018)),color-mix(in srgb,var(--bt-soft) 92%,transparent);box-shadow:inset 0 1px 0 rgba(255,255,255,.07);transition:transform .22s ease,border-color .22s ease,box-shadow .22s ease;}
.btx-metric-card:hover{transform:translateY(-3px);border-color:color-mix(in srgb,var(--bt-accent) 45%,var(--bt-border));box-shadow:0 18px 34px var(--bt-shadow),inset 0 1px 0 rgba(255,255,255,.12);}
.btx-metric-card span{display:block;color:var(--bt-muted);font-size:12px;font-weight:900;margin-bottom:10px;}
.btx-metric-card strong{display:block;color:var(--bt-accent-2);font-size:clamp(24px,2.6vw,38px);line-height:1;font-weight:1000;}
.bonustime-admin > .bt-tabbar,.bonustime-admin .tabpane > .bt-tabbar{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:8px!important;margin:0 0 18px!important;border:1px solid var(--bt-border)!important;border-radius:24px!important;background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.014)),var(--bt-card)!important;box-shadow:0 18px 42px var(--bt-shadow),inset 0 1px 0 rgba(255,255,255,.06);}
.bonustime-admin .bt-tab{min-height:54px!important;border:0!important;border-radius:18px!important;padding:12px 16px!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:10px!important;color:var(--bt-muted)!important;background:transparent!important;font-weight:900!important;font-size:14px!important;transition:transform .2s ease,background .2s ease,color .2s ease,box-shadow .2s ease!important;}
.bonustime-admin .bt-tab:hover{transform:translateY(-1px);color:var(--bt-text)!important;background:var(--bt-soft)!important;}
.bonustime-admin .bt-tab.active{color:#1c1608!important;background:linear-gradient(135deg,#12b957,#08a94b 52%,#067f3a)!important;box-shadow:0 14px 30px color-mix(in srgb,var(--bt-accent) 22%,transparent),inset 0 1px 0 rgba(255,255,255,.55)!important;}
.bonustime-admin .bt-tab::after,.bonustime-admin .bt-tab.active::after{display:none!important;content:none!important;}
.bonustime-admin .page-head{display:flex;align-items:center;justify-content:space-between;gap:18px;margin:18px 0 14px;padding:22px;border:1px solid var(--bt-border);border-radius:26px;background:var(--bt-card);box-shadow:0 18px 44px var(--bt-shadow);}
.bonustime-admin .page-head h1{margin:0;font-size:clamp(26px,2.4vw,42px);letter-spacing:-.035em;color:var(--bt-text);}
.bonustime-admin .unsold-summary{margin:0 0 18px;padding:14px 18px;border:1px solid var(--bt-border);border-radius:18px;background:var(--bt-soft);color:var(--bt-muted);font-weight:800;}
.bonustime-admin .unsold-summary strong{color:var(--bt-accent-2);}
.bonustime-admin .bt-section{margin:18px 0 26px;animation:btxFadeUp .45s ease both;}
.bonustime-admin .bt-section-title{display:flex;align-items:center;gap:10px;margin:0 0 12px;font-size:22px;color:var(--bt-text);}
.bonustime-admin .bt-section-title::before{content:"";width:10px;height:10px;border-radius:999px;background:var(--bt-accent);box-shadow:0 0 0 6px color-mix(in srgb,var(--bt-accent) 12%,transparent);}
.bonustime-admin .bt-section-title .count{color:var(--bt-muted);font-size:13px;font-weight:800;}
.bonustime-admin .bt-add-btn,.bonustime-admin button[type="submit"],.bonustime-admin .save-btn,.bonustime-admin .btn-primary{border:0!important;border-radius:18px!important;background:linear-gradient(135deg,#12b957,#08a94b 52%,#067f3a)!important;color:#17130a!important;font-weight:1000!important;box-shadow:0 14px 28px color-mix(in srgb,var(--bt-accent) 20%,transparent)!important;transition:transform .2s ease,filter .2s ease,box-shadow .2s ease!important;}
.bonustime-admin .bt-add-btn{display:inline-flex;align-items:center;gap:10px;padding:14px 20px;cursor:pointer;}
.bonustime-admin .bt-add-btn:hover,.bonustime-admin button[type="submit"]:hover{transform:translateY(-2px);filter:saturate(1.05) brightness(1.03);}
.bonustime-admin .bt-admin-list{gap:14px!important;}
.bonustime-admin .bonustime-card.admin,.bonustime-admin .card,.bonustime-admin .glass,.bonustime-admin .ultra-chart,.bonustime-admin .ultra-topdays{border:1px solid var(--bt-border)!important;border-radius:26px!important;background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.015)),var(--bt-card)!important;color:var(--bt-text)!important;box-shadow:0 18px 46px var(--bt-shadow),inset 0 1px 0 rgba(255,255,255,.055)!important;backdrop-filter:blur(16px);}
.bonustime-admin .bonustime-card.admin{padding:16px 18px!important;overflow:hidden;transition:transform .22s ease,border-color .22s ease,box-shadow .22s ease!important;}
.bonustime-admin .bonustime-card.admin:hover{transform:translateY(-2px);border-color:color-mix(in srgb,var(--bt-accent) 44%,var(--bt-border))!important;box-shadow:0 26px 58px var(--bt-shadow),0 0 0 1px color-mix(in srgb,var(--bt-accent) 10%,transparent)!important;}
.bonustime-admin .collapse-head{align-items:center!important;}
.bonustime-admin .tenant-name{font-size:17px!important;font-weight:1000!important;letter-spacing:-.01em;color:var(--bt-text);}
.bonustime-admin .tenant-meta{color:var(--bt-muted)!important;font-weight:750!important;}
.bonustime-admin .status-pill,.bonustime-admin .expiry-pill{border-radius:999px!important;padding:7px 11px!important;font-weight:950!important;font-size:11px!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.08);}
.bonustime-admin .status-pill.sold{background:linear-gradient(135deg,rgba(34,197,94,.22),rgba(16,185,129,.12))!important;color:#86efac!important;border-color:rgba(34,197,94,.35)!important;}
.bonustime-admin .status-pill.free{background:linear-gradient(135deg,rgba(6,199,85,.16),rgba(0,184,74,.1))!important;color:var(--bt-accent-2)!important;border-color:rgba(6,199,85,.35)!important;}
.bonustime-admin .bt-delete-btn,.bonustime-admin .bt-action-btn.delete{border-radius:14px!important;background:rgba(239,68,68,.1)!important;color:#fecaca!important;border:1px solid rgba(239,68,68,.24)!important;}
.bonustime-admin .bt-delete-btn:hover,.bonustime-admin .bt-action-btn.delete:hover{background:#ef4444!important;color:white!important;}
.bonustime-admin .bt-reset-btn{border-radius:14px!important;background:linear-gradient(135deg,rgba(6,199,85,.16),rgba(0,184,74,.08))!important;color:#08b84f!important;border:1px solid rgba(5,184,79,.24)!important;}
.bonustime-admin .bt-reset-btn:hover{background:linear-gradient(135deg,rgba(5,184,79,.24),rgba(0,184,74,.18))!important;color:#d8ffe6!important;border-color:rgba(6,199,85,.72)!important;}
.bonustime-admin .collapse-icon{width:34px;height:34px;border-radius:13px;display:grid;place-items:center;background:var(--bt-soft);border:1px solid var(--bt-border);color:var(--bt-accent-2);transition:transform .22s ease;}
.bonustime-admin .bonustime-card.open .collapse-icon{transform:rotate(180deg);}
.bonustime-admin .collapse-body{margin-top:16px;padding-top:16px;border-top:1px solid var(--bt-border);}
.bonustime-admin .bt-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;}
.bonustime-admin .bt-field{display:flex;flex-direction:column;gap:8px;}
.bonustime-admin .bt-field-wide{grid-column:span 2;}.bonustime-admin .bt-field-wide.full-link-field{grid-column:1/-1;}
.bonustime-admin label{color:color-mix(in srgb,var(--bt-text) 82%,var(--bt-accent));font-weight:900;font-size:12px;}
.bonustime-admin input,.bonustime-admin textarea,.bonustime-admin select{min-height:46px!important;width:100%;border-radius:16px!important;border:1px solid var(--bt-border)!important;background:color-mix(in srgb,var(--bt-page) 76%,transparent)!important;color:var(--bt-text)!important;padding:10px 13px!important;outline:none!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.04);transition:border-color .18s ease,box-shadow .18s ease;}
.bonustime-admin input:focus,.bonustime-admin textarea:focus,.bonustime-admin select:focus{border-color:color-mix(in srgb,var(--bt-accent) 62%,var(--bt-border))!important;box-shadow:0 0 0 4px color-mix(in srgb,var(--bt-accent) 14%,transparent)!important;}
.bonustime-admin .link-row{display:flex;gap:10px;}.bonustime-admin .link-row input{flex:1;}
.bonustime-admin .bt-copy-link,.bonustime-admin .bt-action-btn,.bonustime-admin .copy-btn{border-radius:15px!important;border:1px solid var(--bt-border)!important;background:var(--bt-soft)!important;color:var(--bt-text)!important;font-weight:900!important;transition:transform .18s ease,background .18s ease,border-color .18s ease!important;}
.bonustime-admin .bt-copy-link:hover,.bonustime-admin .bt-action-btn:hover,.bonustime-admin .copy-btn:hover{transform:translateY(-2px);border-color:color-mix(in srgb,var(--bt-accent) 42%,var(--bt-border))!important;background:color-mix(in srgb,var(--bt-accent) 12%,var(--bt-soft))!important;}

/* Toggle switch */
.bonustime-admin .bt-toggle-field{position:relative;}
.bonustime-admin .bt-switch-row{width:100%;min-height:48px;display:flex!important;align-items:center;gap:12px;padding:8px 14px;border-radius:16px;border:1px solid rgba(255,255,255,.08);background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.015)),rgba(7,8,12,.82);box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 14px 34px rgba(0,0,0,.22);cursor:pointer;user-select:none;transition:border-color .22s ease,background .22s ease,box-shadow .22s ease,transform .18s ease;}
.bonustime-admin .bt-switch-row:hover{border-color:rgba(124,255,178,.42);background:radial-gradient(circle at 18% 50%,rgba(124,255,178,.12),transparent 30%),linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.018)),rgba(8,9,13,.9);box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 18px 44px rgba(0,0,0,.30),0 0 26px rgba(124,255,178,.08);}
.bonustime-admin .bt-switch-input{position:absolute!important;opacity:0!important;inline-size:1px!important;block-size:1px!important;pointer-events:none!important;}
.bonustime-admin .bt-switch-ui{width:58px;height:31px;min-width:58px;border-radius:999px;position:relative;display:inline-flex;align-items:center;padding:3px;background:linear-gradient(180deg,#f1f1f1,#cfd1d3);border:1px solid rgba(255,255,255,.20);box-shadow:inset 0 2px 8px rgba(0,0,0,.16),0 8px 16px rgba(0,0,0,.22);transition:background .26s ease,box-shadow .26s ease,border-color .26s ease;}
.bonustime-admin .bt-switch-ui::before{content:"";width:25px;height:25px;border-radius:50%;background:radial-gradient(circle at 30% 25%,#fff,#f6f6f6 45%,#e7e7e7);box-shadow:0 6px 12px rgba(0,0,0,.26),inset 0 1px 0 rgba(255,255,255,.9);transform:translateX(0);transition:transform .28s cubic-bezier(.2,.9,.2,1.2),box-shadow .26s ease;}
.bonustime-admin .bt-switch-input:checked + .bt-switch-ui{background:linear-gradient(135deg,#72ef62,#3cca45 58%,#2dbb40);border-color:rgba(117,255,129,.36);box-shadow:inset 0 1px 0 rgba(255,255,255,.24),inset 0 -8px 16px rgba(0,80,20,.16),0 0 0 1px rgba(89,255,106,.10),0 12px 26px rgba(45,204,74,.24);}
.bonustime-admin .bt-switch-input:checked + .bt-switch-ui::before{transform:translateX(27px);box-shadow:0 7px 14px rgba(0,0,0,.26),0 0 16px rgba(255,255,255,.26),inset 0 1px 0 rgba(255,255,255,.95);}
.bonustime-admin .bt-switch-label{color:var(--bt-text,#eef6ff);font-size:13px;font-weight:900;letter-spacing:.01em;line-height:1.2;white-space:nowrap;}
.bonustime-admin .bt-switch-input:not(:checked) ~ .bt-switch-label{color:rgba(238,246,255,.78);}
.bonustime-admin .bt-switch-input:checked ~ .bt-switch-label{color:#78f28a;text-shadow:0 0 14px rgba(77,255,96,.22);}

/* Summary enterprise */
.bonustime-admin .ultra-summary,.bonustime-admin .summary-grid,.bonustime-admin .ultra-chart-grid{display:grid;gap:16px;}
.bonustime-admin .ultra-chart-grid{grid-template-columns:repeat(2,minmax(0,1fr));}
.bonustime-admin .ultra-card,.bonustime-admin .stat-card,.bonustime-admin .top-item{border:1px solid var(--bt-border)!important;border-radius:22px!important;background:var(--bt-soft)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.05)!important;}
.bonustime-admin .ultra-chart-head,.bonustime-admin .monitor-header{border-bottom:1px solid var(--bt-border)!important;}
.bonustime-admin .bar > div{background:var(--bt-green,#22c55e)!important;border-radius:999px;}

/* Dialogs / modals */
.bonustime-admin .bt-modal,.bonustime-admin .modal-overlay{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.68);backdrop-filter:blur(10px);}
.bonustime-admin .bt-modal-card{border:1px solid var(--bt-border);border-radius:26px;background:linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.018)),var(--bt-card-2);color:var(--bt-text);box-shadow:0 30px 100px rgba(0,0,0,.56);width:min(420px,calc(100vw - 32px));padding:24px;display:flex;flex-direction:column;gap:16px;}
.bonustime-admin .bt-modal-head{display:flex;align-items:center;justify-content:space-between;gap:12px;}
.bonustime-admin .bt-modal-head h3{margin:0;font-size:20px;font-weight:1000;color:var(--bt-text);}
.bonustime-admin .bt-modal-close{width:38px;height:38px;border-radius:14px;border:1px solid var(--bt-border);background:var(--bt-soft);color:var(--bt-text);font-size:22px;cursor:pointer;display:grid;place-items:center;}

@keyframes btxFadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
@keyframes btxSheen{0%,58%{transform:translateX(-120%)}76%,100%{transform:translateX(120%)}}

@media(max-width:1180px){.btx-hero{grid-template-columns:1fr;padding:28px}.btx-hero-metrics{grid-template-columns:repeat(3,minmax(0,1fr))}.bonustime-admin .bt-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.bonustime-admin .ultra-chart-grid{grid-template-columns:1fr}}
@media(max-width:760px){.bonustime-admin{max-width:calc(100vw - 16px)}.btx-hero{padding:22px;border-radius:24px}.btx-hero-metrics{grid-template-columns:1fr}.btx-metric-card{min-height:86px}.bonustime-admin > .bt-tabbar{grid-template-columns:1fr!important}.bonustime-admin .bt-tab{min-height:48px!important}.bonustime-admin .page-head{display:grid;padding:18px}.bonustime-admin .bt-add-wrapper,.bonustime-admin .bt-add-btn{width:100%;justify-content:center}.bonustime-admin .bt-grid{grid-template-columns:1fr}.bonustime-admin .bt-field-wide,.bonustime-admin .bt-field-wide.full-link-field{grid-column:auto}.bonustime-admin .collapse-head{align-items:flex-start!important;flex-direction:column}.bonustime-admin .status-right{width:100%;flex-wrap:wrap;justify-content:flex-start}.bonustime-admin .link-row{flex-direction:column}}
@media(prefers-reduced-motion:reduce){.bonustime-admin *,.btx-hero::after{animation:none!important;transition:none!important}}
`;

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

const MONTHS_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

export default function AdminBonustimePage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('orders');
  const [editState, setEditState] = useState({});
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [savingIds, setSavingIds] = useState(new Set());
  const [savedIds, setSavedIds] = useState(new Set());
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addLotto, setAddLotto] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [statsYear, setStatsYear] = useState(new Date().getFullYear());
  const [statsMonth, setStatsMonth] = useState(new Date().getMonth() + 1);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [railwayBusy, setRailwayBusy] = useState(new Set());

  const editStateRef = useRef({});
  const saveTimers = useRef({});

  useEffect(() => { loadRecords(); }, []);
  useEffect(() => { if (tab === 'summary') loadStats(); }, [tab, statsYear, statsMonth]);

  async function loadRecords() {
    setLoading(true);
    const res = await fetch('/api/admin/bonustime?filter=all&page=1&perPage=500');
    const data = await res.json();
    const recs = data.records || [];
    setRecords(recs);
    const state = {};
    for (const r of recs) {
      const id = String(r._id);
      state[id] = { NAME: r.NAME || '', serial_key: r.serial_key || '', CHANNEL_ACCESS_TOKEN: r.CHANNEL_ACCESS_TOKEN || '', CHANNEL_SECRET: r.CHANNEL_SECRET || '', LOGO: r.LOGO || '', LOGIN_URL: r.LOGIN_URL || '', SIGNUP_URL: r.SIGNUP_URL || '', LINE_ADMIN: r.LINE_ADMIN || '', LINK: r.LINK || '', LICENSE_START_DATE: r.LICENSE_START_DATE || '', LICENSE_DURATION_DAYS: String(r.LICENSE_DURATION_DAYS ?? '0'), LOTTO_ENABLED: Boolean(r.LOTTO_ENABLED), LICENSE_DISABLED: Boolean(r.LICENSE_DISABLED), note: r.note || '' };
    }
    editStateRef.current = state;
    setEditState({ ...state });
    setLoading(false);
  }

  async function loadStats() {
    setStatsLoading(true);
    const res = await fetch(`/api/admin/bonustime?type=stats&year=${statsYear}&month=${statsMonth}`);
    const data = await res.json();
    if (data.ok) setStats(data);
    setStatsLoading(false);
  }

  function scheduleSave(id) {
    if (saveTimers.current[id]) clearTimeout(saveTimers.current[id]);
    saveTimers.current[id] = setTimeout(() => doAutoSave(id), 500);
  }

  async function doAutoSave(id) {
    const fields = editStateRef.current[id];
    if (!fields) return;
    setSavingIds(prev => new Set(prev).add(id));
    try {
      const res = await fetch('/api/admin/bonustime', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, fields }) });
      const data = await res.json();
      if (data.ok) {
        setRecords(prev => prev.map(r => String(r._id) === id ? { ...r, ...fields, LICENSE_DURATION_DAYS: parseInt(fields.LICENSE_DURATION_DAYS, 10) || 0 } : r));
        setSavedIds(prev => { const next = new Set(prev).add(id); setTimeout(() => setSavedIds(s => { const n = new Set(s); n.delete(id); return n; }), 2000); return next; });
      }
    } catch {}
    setSavingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
  }

  function handleFieldChange(id, field, value) {
    const updated = { ...(editStateRef.current[id] || {}), [field]: value };
    editStateRef.current = { ...editStateRef.current, [id]: updated };
    setEditState({ ...editStateRef.current });
    scheduleSave(id);
  }

  async function handleDeleteService(id, name) {
    if (!confirm(`ยืนยันลบ Service "${name || id}"?\nไม่สามารถกู้คืนได้`)) return;
    setBusy(true);
    const res = await fetch('/api/admin/bonustime', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete-service', id }) });
    const data = await res.json();
    setBusy(false);
    if (data.ok) { setRecords(prev => prev.filter(r => String(r._id) !== id)); setMsg({ type: 'success', text: 'ลบ Service สำเร็จ' }); }
    else setMsg({ type: 'error', text: data.error || 'ลบไม่สำเร็จ' });
  }

  async function handleResetService(id, name, force = false) {
    if (!confirm(`รีเซ็ต Service "${name || id}"?\nข้อมูลลูกค้าจะถูกล้างเพื่อให้ขายใหม่ได้`)) return;
    setBusy(true);
    const res = await fetch('/api/admin/bonustime', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reset-service', id, force }) });
    const data = await res.json();
    setBusy(false);
    if (data.ok) { setMsg({ type: 'success', text: 'รีเซ็ต Service สำเร็จ' }); loadRecords(); }
    else setMsg({ type: 'error', text: data.error || 'รีเซ็ตไม่สำเร็จ' });
  }

  async function handleAddService() {
    setAddBusy(true);
    const res = await fetch('/api/admin/bonustime', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add-service', lotto: addLotto }) });
    const data = await res.json();
    setAddBusy(false);
    if (data.ok) { setShowAdd(false); setMsg({ type: 'success', text: 'เพิ่ม Service สำเร็จ' }); loadRecords(); }
    else setMsg({ type: 'error', text: data.error || 'เพิ่มไม่สำเร็จ' });
  }

  async function handleRailwayRestart(rec) {
    const key = rec.serviceKey || rec.tenantId;
    if (!key) return;
    if (!confirm(`ยืนยัน Restart Service ${key}?`)) return;
    const id = String(rec._id);
    setRailwayBusy(prev => new Set(prev).add(id));
    try {
      const infoRes = await fetch(`/api/railway/service-info/${encodeURIComponent(key)}`);
      const info = await infoRes.json();
      if (!info.ok) { setMsg({ type: 'error', text: 'โหลดข้อมูล Railway ไม่สำเร็จ' }); return; }
      const res = await fetch('/api/railway/restart', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ serviceId: info.serviceId, environmentId: info.environmentId, tenantId: key, deploymentId: info.deploymentId }) });
      const data = await res.json();
      setMsg(data.ok ? { type: 'success', text: `Restart ${key} สำเร็จ` } : { type: 'error', text: data.error || 'Restart ไม่สำเร็จ' });
    } catch { setMsg({ type: 'error', text: 'Restart ไม่สำเร็จ' }); }
    setRailwayBusy(prev => { const n = new Set(prev); n.delete(id); return n; });
  }

  function toggleExpand(id) {
    setExpandedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  const pkg1 = records.filter(r => !r.LOTTO_ENABLED);
  const pkg2 = records.filter(r => r.LOTTO_ENABLED);
  const soldCount = records.filter(r => r.serial_key).length;
  const unsoldCount = records.length - soldCount;
  const unsoldPkg1 = pkg1.filter(r => !r.serial_key).length;
  const unsoldPkg2 = pkg2.filter(r => !r.serial_key).length;

  return (
    <div className="bonustime-admin">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* Hero */}
      <section className="btx-hero" aria-label="Bonustime Control Center">
        <div className="btx-hero-glow btx-hero-glow-a" aria-hidden="true" />
        <div className="btx-hero-glow btx-hero-glow-b" aria-hidden="true" />
        <div className="btx-hero-content">
          <span className="btx-kicker">✦ BONUSTIME CONTROL CENTER</span>
          <h1>Bonustime Panel</h1>
          <p>จัดการ Service, Serial Key, รายการเช่า และสรุปยอดขายแบบมืออาชีพในหน้าเดียว — เร็ว ลื่น และอ่านสถานะได้ชัดเจนทุกออเดอร์</p>
        </div>
        <div className="btx-hero-metrics" aria-label="ข้อมูลภาพรวม">
          {[
            { label: 'Services ทั้งหมด', value: records.length },
            { label: 'ยังไม่ขาย', value: unsoldCount },
            { label: 'ขายแล้ว', value: soldCount },
          ].map(({ label, value }) => (
            <div key={label} className="btx-metric-card">
              <span>{label}</span>
              <strong>{value.toLocaleString('th-TH')}</strong>
            </div>
          ))}
        </div>
      </section>

      {/* Flash message */}
      {msg && (
        <div style={{ margin: '0 0 14px', padding: '14px 18px', borderRadius: '18px', border: `1px solid ${msg.type === 'error' ? 'rgba(239,68,68,.3)' : 'rgba(34,197,94,.3)'}`, background: msg.type === 'error' ? 'rgba(239,68,68,.1)' : 'rgba(34,197,94,.1)', color: msg.type === 'error' ? '#fca5a5' : '#86efac', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '18px', opacity: .7 }}>✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="bt-tabbar">
        {[{ key: 'orders', label: 'รายการเช่า Service' }, { key: 'summary', label: 'สรุปยอดขายรายเดือน' }].map(({ key, label }) => (
          <button key={key} className={`bt-tab${tab === key ? ' active' : ''}`} onClick={() => setTab(key)} type="button">
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Tab: Orders */}
      <section id="tab-orders" className={`tabpane${tab === 'orders' ? ' show' : ''}`}>
        <header className="page-head">
          <div className="bt-head-left"><h1>รายการออเดอร์</h1></div>
          <div className="bt-add-wrapper">
            <button className="bt-add-btn" type="button" onClick={() => setShowAdd(true)}>
              <span className="bt-add-icon">＋</span>
              <span>เพิ่ม Service ใหม่</span>
            </button>
          </div>
        </header>

        <p className="unsold-summary">
          Services ที่เหลือ <strong>{unsoldCount}</strong> ออเดอร์ · Package 1: <strong>{unsoldPkg1} รายการ</strong> | Package 2: <strong>{unsoldPkg2} รายการ</strong>
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--bt-muted)' }}>กำลังโหลด...</div>
        ) : (
          <>
            <PackageSection title="Package 1 — สล็อต + บาคาร่า" records={pkg1} editState={editState} expandedIds={expandedIds} savingIds={savingIds} savedIds={savedIds} railwayBusy={railwayBusy} busy={busy} onToggleExpand={toggleExpand} onFieldChange={handleFieldChange} onDelete={handleDeleteService} onReset={handleResetService} onRestart={handleRailwayRestart} />
            <PackageSection title="Package 2 — สล็อต + บาคาร่า + หวย" records={pkg2} editState={editState} expandedIds={expandedIds} savingIds={savingIds} savedIds={savedIds} railwayBusy={railwayBusy} busy={busy} onToggleExpand={toggleExpand} onFieldChange={handleFieldChange} onDelete={handleDeleteService} onReset={handleResetService} onRestart={handleRailwayRestart} />
          </>
        )}
      </section>

      {/* Tab: Summary */}
      <section id="tab-summary" className={`tabpane${tab === 'summary' ? ' show' : ''}`}>
        <SummaryTab statsYear={statsYear} statsMonth={statsMonth} onYearChange={setStatsYear} onMonthChange={setStatsMonth} stats={stats} loading={statsLoading} />
      </section>

      {/* Add Service Modal */}
      {showAdd && (
        <div className="bt-modal">
          <div className="bt-modal-card">
            <div className="bt-modal-head">
              <h3>เพิ่ม Service ใหม่</h3>
              <button className="bt-modal-close" type="button" onClick={() => setShowAdd(false)}>×</button>
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--bt-muted)' }}>ระบบจะสร้าง Service Key ให้อัตโนมัติ (pk1serverN / pk2serverN)</p>
            <div className="bt-toggle-field">
              <label style={{ display: 'block', marginBottom: '8px' }}>หวย</label>
              <label className="bt-switch-row bt-switch-row--add">
                <input className="bt-switch-input" type="checkbox" checked={addLotto} onChange={e => setAddLotto(e.target.checked)} />
                <span className="bt-switch-ui" aria-hidden="true" />
                <span className="bt-switch-label">{addLotto ? 'เปิดใช้งานหวย' : 'ปิดใช้งานหวย'}</span>
              </label>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button type="button" onClick={() => setShowAdd(false)} style={{ minHeight: '44px', padding: '0 18px', borderRadius: '16px', border: '1px solid var(--bt-border)', background: 'var(--bt-soft)', color: 'var(--bt-text)', fontWeight: 900, cursor: 'pointer' }}>ยกเลิก</button>
              <button type="button" onClick={handleAddService} disabled={addBusy} className="btn-primary" style={{ minHeight: '44px', padding: '0 18px', borderRadius: '16px', cursor: 'pointer', opacity: addBusy ? .6 : 1 }}>
                {addBusy ? 'กำลังสร้าง...' : 'สร้าง Service'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PackageSection({ title, records, editState, expandedIds, savingIds, savedIds, railwayBusy, busy, onToggleExpand, onFieldChange, onDelete, onReset, onRestart }) {
  return (
    <section className="bt-section">
      <h2 className="bt-section-title">
        {title}
        <span className="count">({records.length} รายการ)</span>
      </h2>
      {records.length === 0 ? (
        <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--bt-muted)' }}>ไม่มีรายการในหมวดนี้</div>
      ) : (
        <div className="bt-admin-list">
          {records.map(rec => {
            const id = String(rec._id);
            return (
              <ServiceCard key={id} rec={rec} editData={editState[id] || {}} expanded={expandedIds.has(id)} saving={savingIds.has(id)} saved={savedIds.has(id)} railwayBusy={railwayBusy.has(id)} busy={busy} onToggleExpand={() => onToggleExpand(id)} onFieldChange={(field, value) => onFieldChange(id, field, value)} onDelete={() => onDelete(id, rec.NAME)} onReset={(force) => onReset(id, rec.NAME, force)} onRestart={() => onRestart(rec)} />
            );
          })}
        </div>
      )}
    </section>
  );
}

function ServiceCard({ rec, editData, expanded, saving, saved, railwayBusy, busy, onToggleExpand, onFieldChange, onDelete, onReset, onRestart }) {
  const isPermanent = Boolean(editData.LICENSE_DISABLED);
  const expiry = isPermanent ? null : calcExpiry({ LICENSE_START_DATE: editData.LICENSE_START_DATE, LICENSE_DURATION_DAYS: editData.LICENSE_DURATION_DAYS });
  const isExpired = expiry ? expiry.getTime() < Date.now() : false;
  const hasSold = Boolean(editData.serial_key || rec.serial_key);
  const resetEligible = hasSold && expiry && expiry.getTime() < Date.now() - 30 * DAY_MS;

  function expiryLabel() {
    if (!hasSold) return null;
    if (isPermanent) return <div className="expiry-pill no-expiry">ไม่มีวันหมดอายุ</div>;
    if (!expiry) return <div className="expiry-pill">กำลังคำนวณ…</div>;
    const dateStr = expiry.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
    return <div className={`expiry-pill${isExpired ? ' expired' : ''}`}>{isExpired ? `หมดอายุแล้ว (${dateStr})` : `หมดอายุ ${dateStr}`}</div>;
  }

  return (
    <article className={`bonustime-card admin${expanded ? ' open' : ''}`} data-tenant-id={rec.tenantId} data-serial={editData.serial_key || ''}>
      <header className="collapse-head" onClick={onToggleExpand}>
        <div className="tenant">
          <div className="tenant-name">{editData.NAME || rec.NAME || `Service: ${rec.tenantId || '-'}`}</div>
          <div className="tenant-meta small muted">
            Service: <span>{rec.serviceKey || rec.tenantId || '-'}</span>
            {editData.serial_key && <> · Serial: <span>{editData.serial_key}</span></>}
            {rec.username && <> · Owner: <span>{rec.username}</span></>}
          </div>
        </div>
        <div className="status-right">
          {saving && <span style={{ fontSize: '11px', color: '#facc15' }}>บันทึก...</span>}
          {saved && !saving && <span style={{ fontSize: '11px', color: '#4ade80' }}>✓</span>}
          <div className={`status-pill${hasSold ? ' sold' : ' free'}`}>{hasSold ? 'ขายไปแล้ว' : 'ยังไม่ขาย'}</div>
          {expiryLabel()}
          <button type="button" className="bt-delete-btn" onClick={e => { e.stopPropagation(); onDelete(); }} title="ลบ Service นี้">ลบ</button>
          {resetEligible && <button type="button" className="bt-reset-btn" onClick={e => { e.stopPropagation(); onReset(false); }} title="รีเซ็ต Service">รีเซ็ต</button>}
          <div className="collapse-icon" aria-hidden="true">⌃</div>
        </div>
      </header>

      {expanded && (
        <div className="collapse-body">
          <div className="bt-grid">
            <BtField label="ชื่อ Server (NAME)" value={editData.NAME ?? ''} onChange={v => onFieldChange('NAME', v)} />
            <BtField label="Service" value={rec.serviceKey || rec.tenantId || ''} readOnly />
            <BtField label="Serial Key" value={editData.serial_key ?? ''} onChange={v => onFieldChange('serial_key', v)} />
            <BtField label="เจ้าของ Service" value={rec.username || '-'} readOnly className="owner-readonly" />

            <div className="bt-field bt-field-wide full-link-field">
              <label>ลิงก์เชื่อมต่อ (Webhook)</label>
              <div className="link-row full-link">
                <input className="bt-edit" type="text" value={editData.LINK ?? ''} onChange={e => onFieldChange('LINK', e.target.value)} />
                {(editData.LINK || rec.LINK) && <button type="button" className="bt-copy-link" onClick={() => navigator.clipboard?.writeText(editData.LINK || rec.LINK || '')}>คัดลอก</button>}
              </div>
            </div>

            <BtField label="โลโก้" value={editData.LOGO ?? ''} onChange={v => onFieldChange('LOGO', v)} className="bt-field-wide" />
            <BtField label="ลิงก์เข้าสู่ระบบ" value={editData.LOGIN_URL ?? ''} onChange={v => onFieldChange('LOGIN_URL', v)} />
            <BtField label="ลิงก์สมัครสมาชิก" value={editData.SIGNUP_URL ?? ''} onChange={v => onFieldChange('SIGNUP_URL', v)} />
            <BtField label="ลิงก์ไลน์ติดต่อ" value={editData.LINE_ADMIN ?? ''} onChange={v => onFieldChange('LINE_ADMIN', v)} />

            <BtField label="วันเริ่มต้นใช้งาน" value={editData.LICENSE_START_DATE ?? ''} onChange={v => onFieldChange('LICENSE_START_DATE', v)} placeholder="01/01/2568" />
            <BtField label="ระยะเวลาใช้งาน (วัน)" value={editData.LICENSE_DURATION_DAYS ?? '0'} onChange={v => onFieldChange('LICENSE_DURATION_DAYS', v)} type="number" />

            <div className="bt-field bt-field-wide">
              <label>CHANNEL_ACCESS_TOKEN</label>
              <textarea className="bt-edit" rows={2} value={editData.CHANNEL_ACCESS_TOKEN ?? ''} onChange={e => onFieldChange('CHANNEL_ACCESS_TOKEN', e.target.value)} />
            </div>
            <BtField label="CHANNEL_SECRET" value={editData.CHANNEL_SECRET ?? ''} onChange={v => onFieldChange('CHANNEL_SECRET', v)} className="bt-field-wide" mono />
            <div className="bt-field bt-field-wide">
              <label>โน้ตภายใน</label>
              <textarea className="bt-edit" rows={2} value={editData.note ?? ''} onChange={e => onFieldChange('note', e.target.value)} />
            </div>

            <div className="bt-field bt-toggle-field">
              <label>หวย</label>
              <label className="bt-switch-row">
                <input className="bt-edit bt-switch-input" data-field="LOTTO_ENABLED" type="checkbox" checked={Boolean(editData.LOTTO_ENABLED)} onChange={e => onFieldChange('LOTTO_ENABLED', e.target.checked)} />
                <span className="bt-switch-ui" aria-hidden="true" />
                <span className="bt-switch-label">{editData.LOTTO_ENABLED ? 'เปิดใช้งานหวย' : 'ปิดใช้งานหวย'}</span>
              </label>
            </div>

            <div className="bt-field bt-toggle-field">
              <label>ระบบวันหมดอายุ</label>
              <label className="bt-switch-row">
                <input className="bt-edit bt-switch-input" data-field="LICENSE_DISABLED" type="checkbox" checked={!Boolean(editData.LICENSE_DISABLED)} onChange={e => onFieldChange('LICENSE_DISABLED', !e.target.checked)} />
                <span className="bt-switch-ui" aria-hidden="true" />
                <span className="bt-switch-label">{!editData.LICENSE_DISABLED ? 'เปิดระบบวันหมดอายุ' : 'ปิดระบบวันหมดอายุ'}</span>
              </label>
            </div>
          </div>

          <div className="bt-admin-actions">
            <button type="button" className="bt-action-btn restart" onClick={onRestart} disabled={railwayBusy} style={{ opacity: railwayBusy ? .4 : 1 }}>
              {railwayBusy ? '...' : '🔄 รีสตาร์ท Server'}
            </button>
            <div className="bt-flex-spacer" />
            {hasSold && !resetEligible && (
              <button type="button" className="bt-reset-btn" onClick={() => onReset(true)} disabled={busy} style={{ opacity: busy ? .4 : 1 }}>รีเซ็ต (บังคับ)</button>
            )}
            <button type="button" className="bt-delete-btn" onClick={onDelete} disabled={busy} style={{ opacity: busy ? .4 : 1 }}>ลบ Service</button>
          </div>
        </div>
      )}
    </article>
  );
}

function BtField({ label, value, onChange, type = 'text', placeholder = '', mono = false, readOnly = false, className = '' }) {
  return (
    <div className={`bt-field${className ? ' ' + className : ''}`}>
      <label>{label}</label>
      <input type={type} placeholder={placeholder} className={`bt-edit${mono ? ' font-mono' : ''}`} value={value} onChange={e => onChange?.(e.target.value)} readOnly={readOnly} style={readOnly ? { opacity: .8, cursor: 'default' } : {}} />
    </div>
  );
}

function SummaryTab({ statsYear, statsMonth, onYearChange, onMonthChange, stats, loading }) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div className="ultra-summary">
      <header className="ultra-summary-head">
        <div className="ultra-summary-title">
          <h2>สรุปยอด Bonustime รายเดือน</h2>
          <p className="muted small">เลือกเดือนด้านขวาเพื่อดูยอดขาย</p>
        </div>
        <div className="ultra-month-select">
          <select value={statsMonth} onChange={e => onMonthChange(Number(e.target.value))}>
            {MONTHS_TH.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
          <select value={statsYear} onChange={e => onYearChange(Number(e.target.value))}>
            {years.map(y => <option key={y} value={y}>{y + 543}</option>)}
          </select>
        </div>
      </header>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--bt-muted)' }}>กำลังโหลด...</div>
      ) : !stats ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--bt-muted)' }}>ยังไม่มีข้อมูล</div>
      ) : (
        <>
          <div className="ultra-cards">
            {[
              { id: 'cardTotal', label: 'ยอดขายรวมเดือนนี้', value: `฿ ${(stats.totalRevenue || 0).toLocaleString()}`, trend: stats.totalRevenue > 0, trendLabel: stats.totalRevenue > 0 ? 'มีรายได้' : 'ยังไม่มีรายการ' },
              { id: 'cardPkg1', label: 'Package 1 (สล็อต+บาคาร่า)', value: `฿ ${(stats.pkg1Revenue || 0).toLocaleString()}`, trend: stats.pkg1Revenue > 0, trendLabel: stats.pkg1Count > 0 ? `มี ${stats.pkg1Count} รายการ` : 'ยังไม่มีการขาย' },
              { id: 'cardPkg2', label: 'Package 2 (สล็อต+บาคาร่า+หวย)', value: `฿ ${(stats.pkg2Revenue || 0).toLocaleString()}`, trend: stats.pkg2Revenue > 0, trendLabel: stats.pkg2Count > 0 ? `มี ${stats.pkg2Count} รายการ` : 'ยังไม่มีการขาย' },
              { id: 'cardOrders', label: 'จำนวนออเดอร์รวม', value: `${stats.orderCount || 0} ออเดอร์`, trend: stats.orderCount > 0, trendLabel: stats.orderCount > 0 ? `ทั้งหมด ${stats.orderCount} รายการ` : 'ยังไม่มีคำสั่งซื้อ' },
            ].map(({ id, label, value, trend, trendLabel }) => (
              <section key={id} className="ultra-card glass" id={id}>
                <h3>{label}</h3>
                <div className="ultra-value">{value}</div>
                <div className={`ultra-trend ${trend ? 'up' : 'flat'}`}>
                  <span className="dot" />
                  <span className="label">{trendLabel}</span>
                </div>
              </section>
            ))}
          </div>

          <div className="ultra-charts-grid">
            <section className="ultra-chart glass">
              <div className="ultra-chart-head"><h3>ยอดขายรายวัน (รวม)</h3></div>
              <div className="ultra-chart-body" style={{ alignItems: 'flex-end' }}>
                {stats.daily?.length > 0 && <DailyChart daily={stats.daily} maxAmount={Math.max(...stats.daily.map(d => d.total), 1)} />}
              </div>
            </section>
            <section className="ultra-chart glass">
              <div className="ultra-chart-head"><h3>ยอดขายแยกตามแพ็กเกจ</h3></div>
              <div className="ultra-chart-body" style={{ alignItems: 'flex-end' }}>
                {stats.totalRevenue > 0 && (
                  <div style={{ width: '100%', display: 'flex', gap: '8px', alignItems: 'flex-end', height: '100%' }}>
                    {[
                      { label: 'Pkg1', value: stats.pkg1Revenue || 0, color: '#38bdf8' },
                      { label: 'Pkg2', value: stats.pkg2Revenue || 0, color: '#a78bfa' },
                    ].map(({ label, value, color }) => {
                      const pct = stats.totalRevenue > 0 ? Math.max(4, (value / stats.totalRevenue) * 100) : 0;
                      return (
                        <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', height: '100%', justifyContent: 'flex-end' }}>
                          <span style={{ fontSize: '11px', color: '#a1a1aa' }}>฿{value.toLocaleString()}</span>
                          <div style={{ width: '100%', height: `${pct}%`, background: color, borderRadius: '6px 6px 0 0', minHeight: '4px' }} />
                          <span style={{ fontSize: '11px', color: '#a1a1aa' }}>{label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </div>

          {stats.top5?.length > 0 && (
            <section className="ultra-topdays glass">
              <h3>Top 5 วันขายดีที่สุดในเดือนนี้</h3>
              <div id="topDaysList" className="topdays-list">
                {stats.top5.map((d, i) => (
                  <div key={d.day} className="top-item">
                    <div className="rank">{i + 1}</div>
                    <div className="label">วันที่ {d.day}</div>
                    <div className="bar">
                      <div style={{ width: `${stats.totalRevenue > 0 ? (d.total / stats.totalRevenue) * 100 : 0}%` }} />
                    </div>
                    <div className="amount">฿ {d.total.toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="ultra-yearly glass" aria-label="สรุปยอดขายรายปี Bonustime">
            <div className="ultra-yearly-head">
              <div>
                <h3>สรุปยอดขายรายปี</h3>
                <p className="muted small">ดูภาพรวมรายได้ Bonustime ทั้งปี</p>
              </div>
            </div>
            <div className="ultra-year-cards">
              {[
                { id: 'yearCardTotal', label: 'ยอดขายรวมทั้งปี', value: `฿ ${(stats.yearlyTotal || 0).toLocaleString()}`, trend: (stats.yearlyTotal || 0) > 0, trendLabel: (stats.yearlyOrderCount || 0) > 0 ? `${stats.yearlyOrderCount} ออเดอร์` : 'ยังไม่มีรายการ' },
                { id: 'yearCardPkg1', label: 'Package 1 ทั้งปี', value: `฿ ${(stats.yearlyPkg1Revenue || 0).toLocaleString()}`, trend: (stats.yearlyPkg1Revenue || 0) > 0, trendLabel: (stats.yearlyPkg1Count || 0) > 0 ? `${stats.yearlyPkg1Count} รายการ` : 'ยังไม่มีการขาย' },
                { id: 'yearCardPkg2', label: 'Package 2 ทั้งปี', value: `฿ ${(stats.yearlyPkg2Revenue || 0).toLocaleString()}`, trend: (stats.yearlyPkg2Revenue || 0) > 0, trendLabel: (stats.yearlyPkg2Count || 0) > 0 ? `${stats.yearlyPkg2Count} รายการ` : 'ยังไม่มีการขาย' },
                { id: 'yearCardBest', label: 'เดือนที่ขายดีที่สุด', value: stats.yearlyBestMonth?.total > 0 ? `เดือน ${stats.yearlyBestMonth.month}` : '-', trend: stats.yearlyBestMonth?.total > 0, trendLabel: stats.yearlyBestMonth?.total > 0 ? `฿ ${stats.yearlyBestMonth.total.toLocaleString()}` : 'รอข้อมูลยอดขาย' },
              ].map(({ id, label, value, trend, trendLabel }) => (
                <section key={id} className="ultra-card glass" id={id}>
                  <h3>{label}</h3>
                  <div className="ultra-value">{value}</div>
                  <div className={`ultra-trend ${trend ? 'up' : 'flat'}`}>
                    <span className="dot" />
                    <span className="label">{trendLabel}</span>
                  </div>
                </section>
              ))}
            </div>
            {stats.yearly?.length > 0 && (
              <div className="ultra-chart glass yearly-chart-wrap" style={{ marginTop: '14px' }}>
                <div className="ultra-chart-head"><h3>ยอดขายรายเดือนในปีที่เลือก</h3></div>
                <div className="ultra-chart-body" style={{ alignItems: 'flex-end', height: '200px' }}>
                  <YearlyChart monthly={stats.yearly} />
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function DailyChart({ daily, maxAmount }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1px', height: '112px', overflowX: 'auto', width: '100%', paddingBottom: '4px' }}>
      {Array.from({ length: 31 }, (_, i) => {
        const day = i + 1;
        const d = daily.find(x => x.day === day);
        const pct = d ? Math.max(4, (d.total / maxAmount) * 100) : 0;
        return (
          <div key={day} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', minWidth: '18px', flex: 1, height: '100%', justifyContent: 'flex-end' }} title={`วันที่ ${day}: ฿${(d?.total || 0).toLocaleString()}`}>
            <div style={{ width: '100%', height: `${pct}%`, background: pct > 0 ? 'rgba(34,197,94,.8)' : 'transparent', borderRadius: '3px 3px 0 0', transition: 'height .3s ease' }} />
            {day % 5 === 0 && <span style={{ fontSize: '9px', color: '#4b5563' }}>{day}</span>}
          </div>
        );
      })}
    </div>
  );
}

function YearlyChart({ monthly }) {
  const maxAmount = Math.max(...monthly.map(m => m.total), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '100%', width: '100%' }}>
      {monthly.map((m, i) => {
        const pct = m.total > 0 ? Math.max(4, (m.total / maxAmount) * 100) : 0;
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%', justifyContent: 'flex-end' }} title={`${MONTHS_TH[i]}: ฿${m.total.toLocaleString()}`}>
            <div style={{ width: '100%', height: `${pct}%`, minHeight: '2px', background: pct > 0 ? 'rgba(34,197,94,.8)' : 'rgba(39,39,42,.9)', borderRadius: '3px 3px 0 0' }} />
            <span style={{ fontSize: '9px', color: '#4b5563' }}>{MONTHS_TH[i]}</span>
          </div>
        );
      })}
    </div>
  );
}
