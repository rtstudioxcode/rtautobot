'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import GlobalSelect from '../../components/GlobalSelect.jsx';

const BANK_LABELS = {
  bbl:'ธนาคารกรุงเทพ', kbank:'ธนาคารกสิกรไทย', ktb:'ธนาคารกรุงไทย',
  bay:'ธนาคารกรุงศรีอยุธยา', scb:'ธนาคารไทยพาณิชย์', tmb:'ทหารไทยธนชาต (TTB)',
  tw:'TrueMoney Wallet', truewallet:'TrueMoney Wallet', qr:'PromptPay QR',
};

const QUICK_AMOUNTS = [50, 100, 300, 500, 1000, 3000];

const FALLBACK_QR_MAP = {
  kbank: '/assets/payment/qr-kbank.jpg',
  scb: '/assets/payment/qr-scb.jpg',
  qr: '/assets/payment/qrcode.png',
};

const STATUS_LABELS = {
  completed:'สำเร็จ', pending:'รอดำเนินการ', failed:'ล้มเหลว',
  cancelled:'ยกเลิก', canceled:'ยกเลิก', reject:'ยกเลิก', processing:'กำลังตรวจ',
};

const NOTICE_KEY = 'topup_notice_suppress_until_v1';

const CSS = `
.topup-enterprise{
  --tp-page:var(--page,#08090d);--tp-card:var(--card,#12141b);
  --tp-card-2:color-mix(in srgb,var(--card,#12141b) 86%,#ffffff 5%);
  --tp-text:var(--text,#eef6ff);--tp-muted:var(--muted,#9aa1ad);
  --tp-border:var(--border,rgba(255,255,255,.10));--tp-accent:var(--accent,#08b84f);
  --tp-accent-2:#08b84f;--tp-danger:#ff6262;--tp-success:#4ade80;
  --tp-shadow:rgba(0,0,0,.34);--tp-soft:rgba(255,255,255,.055);
  color:var(--tp-text);position:relative;isolation:isolate;
  width:min(2000px,calc(100% - 36px));
  margin:0 auto;
  padding:clamp(18px,2vw,24px) 0 34px;
}
.topup-enterprise *{box-sizing:border-box;}
.topup-enterprise button,.topup-enterprise input{font:inherit;}
.tp-hero{position:relative;overflow:hidden;border:1px solid var(--tp-border);border-radius:30px;
  padding:clamp(22px,3.2vw,42px);
  background:radial-gradient(circle at 14% 0%,color-mix(in srgb,var(--tp-accent) 22%,transparent) 0%,transparent 34%),radial-gradient(circle at 88% 18%,rgba(255,255,255,.13) 0%,transparent 30%),linear-gradient(135deg,color-mix(in srgb,var(--tp-card) 82%,#000 18%),var(--tp-card-2));
  box-shadow:0 24px 70px var(--tp-shadow),inset 0 1px 0 rgba(255,255,255,.08);margin-bottom:18px;}
.tp-hero-glow{position:absolute;border-radius:999px;filter:blur(8px);opacity:.55;pointer-events:none;animation:tpFloat 7s ease-in-out infinite;}
.tp-hero-glow-a{width:220px;height:220px;background:color-mix(in srgb,var(--tp-accent) 32%,transparent);right:8%;top:-90px;}
.tp-hero-glow-b{width:150px;height:150px;background:rgba(99,102,241,.20);left:12%;bottom:-75px;animation-delay:-2.4s;}
@keyframes tpFloat{0%,100%{transform:translate3d(0,0,0) scale(1);}50%{transform:translate3d(0,12px,0) scale(1.05);}}
.tp-hero-content{position:relative;display:flex;justify-content:space-between;gap:28px;align-items:flex-end;}
.tp-eyebrow{display:inline-flex;align-items:center;gap:10px;color:var(--tp-accent-2);font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;margin-bottom:12px;}
.tp-eyebrow span{width:9px;height:9px;border-radius:50%;background:var(--tp-accent);box-shadow:0 0 18px var(--tp-accent);}
.tp-hero h1{margin:0;font-size:clamp(28px,4vw,48px);letter-spacing:-.04em;line-height:1.04;}
.tp-hero p{margin:12px 0 0;color:var(--tp-muted);max-width:720px;line-height:1.65;}
.tp-hero-metrics{display:grid;grid-template-columns:repeat(3,minmax(92px,1fr));gap:10px;min-width:min(420px,100%);}
.tp-metric{padding:14px 16px;border-radius:18px;border:1px solid var(--tp-border);background:rgba(255,255,255,.05);backdrop-filter:blur(12px);}
.tp-metric small{display:block;color:var(--tp-muted);font-size:12px;margin-bottom:4px;}
.tp-metric b{font-size:24px;color:var(--tp-text);}
.tabs.tp-main-tabs{width:100%;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;padding:8px;border-radius:24px;
  background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.018)),color-mix(in srgb,var(--tp-card) 88%,transparent);
  border:1px solid var(--tp-border);box-shadow:0 18px 42px var(--tp-shadow),inset 0 1px 0 rgba(255,255,255,.06);margin:0 0 18px;backdrop-filter:blur(14px);}
.tabs .tab{position:relative;width:100%;border:0;border-radius:18px;padding:16px 18px;cursor:pointer;color:var(--tp-muted);background:transparent;
  display:flex;align-items:center;justify-content:center;gap:10px;font-weight:600;
  transition:transform .22s ease,color .22s ease,background .22s ease,box-shadow .22s ease;}
.tabs .tab:hover{transform:translateY(-1px);color:var(--tp-text);background:var(--tp-soft);}
.tabs .tab.active{color:#17130a;background:linear-gradient(135deg,#08b84f,#08b84f 54%,#05b84f);box-shadow:0 14px 30px color-mix(in srgb,var(--tp-accent) 27%,transparent),inset 0 1px 0 rgba(255,255,255,.52);}
.tab-ico{display:grid;place-items:center;width:22px;height:22px;border-radius:999px;background:rgba(0,0,0,.12);}
.tabpane{display:none;animation:tpFadeUp .34s ease both;}
.tabpane.show{display:block;}
@keyframes tpFadeUp{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:none;}}
.tp-layout{display:grid;grid-template-columns:minmax(280px,360px) minmax(0,1fr);gap:18px;align-items:start;}
.tp-side-card,.tp-main-card,.tp-history-card{border:1px solid var(--tp-border);border-radius:28px;background:linear-gradient(180deg,color-mix(in srgb,var(--tp-card) 92%,#fff 3%),var(--tp-card));box-shadow:0 20px 54px var(--tp-shadow),inset 0 1px 0 rgba(255,255,255,.055);}
.tp-side-card{padding:18px;position:sticky;top:16px;}
.tp-main-card,.tp-history-card{padding:clamp(16px,2vw,22px);overflow:hidden;}
.tp-section-head{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-bottom:18px;}
.tp-section-head span{display:block;color:var(--tp-accent);font-size:12px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;margin-bottom:4px;}
.tp-section-head h2{margin:0;font-size:clamp(20px,2vw,26px);letter-spacing:-.03em;}
.tp-section-head.compact{margin-bottom:12px;}
.tp-history-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end;}
.tp-history-filter{min-height:42px;border-radius:14px;border:1px solid var(--tp-border);background:var(--tp-soft);color:var(--tp-text);padding:0 12px;font-weight:800;outline:none;}
.tp-history-custom-select{width:min(260px,100%);}
.tp-history-count{padding:8px 12px;border-radius:999px;background:var(--tp-soft);color:var(--tp-muted);border:1px solid var(--tp-border);}
.tp-wallet-rail{display:grid;gap:10px;border:0;margin:0;padding:0;overflow:visible;}
.tp-wallet-tab{width:100%;border:1px solid transparent;border-radius:20px;background:transparent;padding:12px;display:grid;grid-template-columns:48px 1fr 22px;gap:12px;align-items:center;color:var(--tp-text);cursor:pointer;text-align:left;transition:transform .22s ease,border .22s ease,background .22s ease,box-shadow .22s ease;}
.tp-wallet-tab:hover{transform:translateX(3px);background:var(--tp-soft);border-color:var(--tp-border);}
.tp-wallet-tab.active{background:linear-gradient(135deg,color-mix(in srgb,var(--tp-accent) 16%,transparent),var(--tp-soft));border-color:color-mix(in srgb,var(--tp-accent) 34%,var(--tp-border));box-shadow:0 10px 28px color-mix(in srgb,var(--tp-accent) 12%,transparent);}
.tp-wallet-icon-wrap{width:48px;height:48px;border-radius:16px;display:grid;place-items:center;background:rgba(255,255,255,.08);border:1px solid var(--tp-border);}
.tp-wallet-icon-wrap img{width:28px;height:28px;object-fit:contain;}
.tp-wallet-copy strong{display:block;font-size:14px;line-height:1.25;}
.tp-wallet-copy small{display:block;color:var(--tp-muted);margin-top:3px;font-size:12px;}
.tp-wallet-arrow{color:var(--tp-accent);font-size:24px;line-height:1;}
.tp-wallet-panel{display:none;}
.tp-wallet-panel.active{display:block;animation:tpFadeUp .34s ease both;}
.tp-payment-header{display:flex;justify-content:space-between;gap:18px;align-items:center;margin-bottom:18px;}
.tp-payment-brand{display:flex;align-items:center;gap:14px;min-width:0;}
.tp-payment-logo{width:64px;height:64px;border-radius:22px;display:grid;place-items:center;background:linear-gradient(145deg,rgba(255,255,255,.10),rgba(255,255,255,.03));border:1px solid var(--tp-border);box-shadow:inset 0 1px 0 rgba(255,255,255,.09);}
.tp-payment-logo img{width:36px;height:36px;object-fit:contain;}
.tp-payment-brand span{color:var(--tp-accent);font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.12em;}
.tp-payment-brand h2{margin:3px 0;font-size:clamp(22px,2.8vw,34px);letter-spacing:-.04em;}
.tp-payment-brand p{margin:0;color:var(--tp-muted);}
.tp-expire-badge{flex:0 0 auto;padding:12px 16px;border-radius:18px;background:var(--tp-soft);border:1px solid var(--tp-border);text-align:center;}
.tp-expire-badge small{display:block;color:var(--tp-muted);font-size:12px;}
.tp-expire-badge b{color:var(--tp-accent-2);font-size:18px;}
.tp-checkout-grid{display:grid;grid-template-columns:minmax(0,1.04fr) minmax(280px,.8fr);gap:18px;}
.tp-form-card,.tp-info-card{border:1px solid var(--tp-border);border-radius:24px;background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.018));padding:18px;}
.tp-form{display:grid;gap:14px;}
.tp-label{font-weight:800;color:var(--tp-text);}
.tp-amount-shell{display:flex;align-items:center;gap:12px;border:1px solid color-mix(in srgb,var(--tp-accent) 28%,var(--tp-border));border-radius:22px;background:color-mix(in srgb,var(--tp-page) 58%,var(--tp-card));padding:8px 16px;box-shadow:inset 0 1px 0 rgba(255,255,255,.04);}
.tp-amount-shell span{color:var(--tp-accent);font-weight:900;font-size:24px;}
.tp-amount-shell input{width:100%;border:0;outline:0;background:transparent;color:var(--tp-text);font-size:clamp(28px,4vw,46px);font-weight:400;letter-spacing:-.04em;padding:12px 0;}
.tp-amount-shell input::placeholder{color:color-mix(in srgb,var(--tp-muted) 30%,transparent);}
.tp-quick-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;}
.tp-chip{border:1px solid var(--tp-border);border-radius:14px;padding:10px 8px;background:var(--tp-soft);color:var(--tp-muted);cursor:pointer;transition:.2s ease;font-size:13px;}
.tp-chip:hover,.tp-chip.active{color:#18130a;background:linear-gradient(135deg,#08b84f,#08b84f);transform:translateY(-1px);border-color:transparent;}
.tp-summary-strip{display:flex;justify-content:space-between;align-items:center;padding:13px 14px;border-radius:18px;background:var(--tp-soft);border:1px solid var(--tp-border);color:var(--tp-muted);}
.tp-summary-strip b{color:var(--tp-text);font-size:18px;}
.tp-primary-btn{position:relative;overflow:hidden;border:0;border-radius:18px;padding:15px 18px;min-height:54px;background:linear-gradient(135deg,#08b84f 0%,#08b84f 55%,#05b84f 100%);color:#17130a;font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;box-shadow:0 16px 32px color-mix(in srgb,var(--tp-accent) 22%,transparent),inset 0 1px 0 rgba(255,255,255,.58);transition:transform .2s ease,filter .2s ease;font-family:inherit;}
.tp-primary-btn:hover{transform:translateY(-2px);filter:saturate(1.08);}
.tp-primary-btn:disabled{opacity:.55;cursor:not-allowed;}
.btn-shine{position:absolute;inset:-60% auto -60% -40%;width:38%;transform:rotate(18deg);background:linear-gradient(90deg,transparent,rgba(255,255,255,.45),transparent);animation:tpShine 3.8s ease-in-out infinite;}
@keyframes tpShine{0%,45%{left:-50%;}70%,100%{left:120%;}}
.tp-info-card{display:grid;gap:12px;}
.tp-account-card,.tp-alert-card,.tp-steps-card{border:1px solid var(--tp-border);border-radius:20px;background:color-mix(in srgb,var(--tp-card) 84%,transparent);padding:14px;}
.tp-account-card{display:flex;gap:12px;align-items:center;}
.tp-account-icon{width:50px;height:50px;border-radius:16px;background:var(--tp-soft);border:1px solid var(--tp-border);display:grid;place-items:center;flex:0 0 auto;}
.tp-account-icon img{width:28px;height:28px;object-fit:contain;}
.tp-account-card small{display:block;color:var(--tp-muted);}
.tp-account-card strong{display:block;margin:2px 0;}
.tp-account-card span{display:block;color:var(--tp-muted);font-size:13px;}
.tp-alert-card{display:flex;gap:12px;}
.tp-alert-card>span{color:var(--tp-accent);font-size:22px;}
.tp-alert-card b{display:block;margin-bottom:4px;}
.tp-alert-card p,.tp-steps-card p{margin:0;color:var(--tp-muted);line-height:1.55;}
.tp-steps-card h3{margin:0 0 10px;}
.tp-steps-card ol{margin:0;padding-left:20px;color:var(--tp-muted);line-height:1.8;}
.tp-steps-card li::marker{color:var(--tp-accent);font-weight:900;}
.tp-history-card{margin-top:0;}
.d-desktop{display:table;}
.d-mobile{display:none;}
.tp-history-table{width:100%;border-collapse:separate;border-spacing:0;overflow:hidden;border-radius:22px;border:1px solid var(--tp-border);background:var(--tp-card);}
.tp-history-table th,.tp-history-table td{padding:15px 16px;text-align:left;border-bottom:1px solid var(--tp-border);}
.tp-history-table th{color:var(--tp-muted);font-size:13px;font-weight:300;background:var(--tp-soft);}
.tp-history-table tr:last-child td{border-bottom:0;}
.tp-history-table tbody tr{transition:background .2s ease;}
.tp-history-table tbody tr:hover{background:var(--tp-soft);}
.right{text-align:right!important;}
.tp-method{display:flex;align-items:center;gap:10px;}
.method-ico{width:24px;height:24px;object-fit:contain;border-radius:7px;}
.money{color:var(--tp-accent-2);font-weight:600;}
.pill{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;color:#f8fafc;border:1px solid rgba(255,255,255,.10);background:#30343a;box-shadow:inset 1px 1px 2px rgba(255,255,255,.12),inset -2px -2px 4px rgba(0,0,0,.42),0 4px 12px rgba(0,0,0,.18);font-weight:800;}
.pill.sm{padding:7px 10px;font-size:13px;}
.pill .st-ico{width:16px;height:16px;border-radius:50%;background:center/contain no-repeat;flex:0 0 16px;}
.pill.st-completed{background:linear-gradient(145deg,#0b3d2e,#144f3d);}
.pill.st-pending,.pill.st-processing{background:linear-gradient(145deg,#2e3136,#383c42);}
.pill.st-failed,.pill.st-reject,.pill.st-canceled,.pill.st-cancelled{background:linear-gradient(145deg,#6f1f1f,#4d0f10);}
.hx-card{border:1px solid var(--tp-border);background:var(--tp-card);border-radius:18px;margin:12px 0;overflow:hidden;box-shadow:0 12px 28px var(--tp-shadow);}
.hx-head{display:flex;align-items:center;justify-content:space-between;padding:14px;list-style:none;cursor:pointer;}
.hx-head::-webkit-details-marker{display:none;}
.hx-toggle{border:0;background:transparent;color:var(--tp-muted);font-size:18px;line-height:1;padding:2px 6px;border-radius:8px;cursor:pointer;font-family:inherit;}
.hx-body{padding:12px 14px 14px;border-top:1px dashed var(--tp-border);animation:tpFadeUp .18s ease-out;}
.hx-row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0;}
.hx-label{color:var(--tp-muted);}
.hx-val.money{font-weight:600;color:var(--tp-accent-2);}
.hx-date.mono{font-family:monospace;font-size:13px;}
.tp-empty{text-align:center;padding:24px;color:var(--tp-muted);}
.tp-empty.large{padding:58px 18px;}
.tp-empty-icon{width:58px;height:58px;border-radius:20px;margin:0 auto 12px;display:grid;place-items:center;color:var(--tp-accent);background:var(--tp-soft);border:1px solid var(--tp-border);font-size:24px;}
.tp-empty h3{margin:0 0 6px;color:var(--tp-text);}
.tp-empty p{margin:0;}
.tp-flash{border-radius:18px;padding:13px 16px;margin-bottom:16px;font-weight:800;}
.tp-flash.ok{border:1px solid color-mix(in srgb,var(--tp-success) 40%,var(--tp-border));background:color-mix(in srgb,var(--tp-success) 10%,transparent);color:var(--tp-success);}
.tp-flash.err{border:1px solid color-mix(in srgb,var(--tp-danger) 40%,var(--tp-border));background:color-mix(in srgb,var(--tp-danger) 10%,transparent);color:var(--tp-danger);}
.tp-expired-box{padding:12px;border-radius:16px;background:color-mix(in srgb,var(--tp-danger) 10%,transparent);border:1px solid color-mix(in srgb,var(--tp-danger) 30%,transparent);text-align:center;display:grid;gap:8px;}
.tp-expired-box b{color:var(--tp-danger);}
.tp-expired-box span{color:var(--tp-muted);font-size:13px;}
.tp-cancel-old-btn{border:0;border-radius:14px;padding:10px 16px;background:linear-gradient(135deg,#ff6262,#e84040);color:#fff;font-weight:900;cursor:pointer;font-family:inherit;}
.tp-qr-modal{position:fixed!important;inset:0!important;z-index:99990!important;display:grid!important;place-items:center!important;padding:clamp(10px,2.2vw,24px)!important;isolation:isolate!important;}
.tp-qr-modal .overlay{position:fixed!important;inset:0!important;z-index:0!important;
  background:radial-gradient(circle at 18% 14%,color-mix(in srgb,var(--tp-accent) 20%,transparent),transparent 28%),radial-gradient(circle at 88% 78%,rgba(38,54,96,.28),transparent 34%),color-mix(in srgb,var(--tp-page) 72%,rgba(0,0,0,.70))!important;
  -webkit-backdrop-filter:blur(18px) saturate(132%)!important;backdrop-filter:blur(18px) saturate(132%)!important;}
.tp-qr-modal .dialog{position:relative!important;z-index:1!important;width:min(440px,calc(100vw - 24px))!important;max-height:calc(100dvh - 24px)!important;overflow:visible!important;border-radius:30px!important;padding:0!important;color:var(--tp-text)!important;
  background:linear-gradient(145deg,color-mix(in srgb,#15161b 96%,#ffffff 4%),color-mix(in srgb,#15161b 90%,#000000 10%) 55%,color-mix(in srgb,#263660 20%,#15161b)) padding-box,
  linear-gradient(135deg,color-mix(in srgb,var(--tp-accent) 72%,transparent),color-mix(in srgb,var(--tp-border) 62%,transparent) 48%,color-mix(in srgb,#263660 52%,transparent)) border-box!important;
  border:1px solid transparent!important;
  box-shadow:0 28px 90px rgba(0,0,0,.58),0 0 0 1px rgba(255,255,255,.035),inset 0 1px 0 rgba(255,255,255,.12)!important;
  -webkit-backdrop-filter:blur(22px) saturate(140%)!important;backdrop-filter:blur(22px) saturate(140%)!important;
  animation:tpEnterpriseModalIn .24s cubic-bezier(.2,.8,.2,1) both!important;}
@keyframes tpEnterpriseModalIn{from{opacity:0;transform:translateY(14px) scale(.968);filter:blur(4px);}to{opacity:1;transform:translateY(0) scale(1);filter:blur(0);}}
.tp-qr-modal .dialog::before{content:"";position:absolute;inset:0;pointer-events:none;border-radius:inherit;
  background:radial-gradient(circle at 20% 0%,color-mix(in srgb,var(--tp-accent) 20%,transparent),transparent 35%),linear-gradient(115deg,rgba(255,255,255,.10),transparent 30%,rgba(255,255,255,.035) 70%,transparent);}
.tp-qr-modal .dialog::after{content:"";position:absolute;left:28px;right:28px;top:0;height:1px;background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--tp-accent) 88%,transparent),transparent);pointer-events:none;}
.tp-qr-modal .close{position:absolute!important;top:14px!important;right:14px!important;z-index:4!important;width:40px!important;height:40px!important;border-radius:16px!important;border:1px solid color-mix(in srgb,var(--tp-border) 80%,transparent)!important;color:var(--tp-text)!important;background:color-mix(in srgb,#15161b 82%,transparent)!important;cursor:pointer!important;font-size:20px!important;line-height:1!important;font-family:inherit!important;}
.tp-modal-head{position:relative;z-index:2;padding:26px 22px 10px;text-align:center;}
.tp-modal-head .tp-countdown-pill{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:34px;padding:8px 15px;border-radius:999px;font-size:13px;font-weight:950;letter-spacing:.01em;line-height:1;color:#ecfff4;border:1px solid color-mix(in srgb,var(--tp-accent) 44%,rgba(255,255,255,.18));background:linear-gradient(135deg,color-mix(in srgb,#052613 88%,#ffffff 4%),color-mix(in srgb,var(--tp-accent) 30%,#07120c));box-shadow:0 14px 34px color-mix(in srgb,var(--tp-accent) 28%,transparent),0 0 0 4px color-mix(in srgb,var(--tp-accent) 9%,transparent),inset 0 1px 0 rgba(255,255,255,.20);text-shadow:0 1px 10px rgba(0,0,0,.55);}
.tp-modal-head .tp-countdown-pill::before{content:"";width:8px;height:8px;border-radius:50%;background:#49ff93;box-shadow:0 0 12px #49ff93;animation:tpCountdownPulse 1.15s ease-in-out infinite;}
.tp-modal-head .tp-countdown-pill.is-expired{color:#fff1f1;border-color:color-mix(in srgb,var(--tp-danger) 55%,rgba(255,255,255,.16));background:linear-gradient(135deg,color-mix(in srgb,#3a1010 86%,#ffffff 3%),color-mix(in srgb,var(--tp-danger) 34%,#15161b));box-shadow:0 14px 34px color-mix(in srgb,var(--tp-danger) 26%,transparent),0 0 0 4px color-mix(in srgb,var(--tp-danger) 10%,transparent),inset 0 1px 0 rgba(255,255,255,.18);}
.tp-modal-head .tp-countdown-pill.is-expired::before{background:#ff6b6b;box-shadow:0 0 12px #ff6b6b;animation:none;}
@keyframes tpCountdownPulse{0%,100%{opacity:.58;transform:scale(.85);}50%{opacity:1;transform:scale(1.18);}}
.tp-modal-head h3{margin:12px 0 0;font-size:clamp(24px,3.1vw,31px);letter-spacing:-.04em;line-height:1.12;color:var(--tp-text);}
.tp-modal-clock{width:68px;height:68px;margin:0 auto 12px;border-radius:24px;display:grid;place-items:center;position:relative;
  background:radial-gradient(circle at 32% 28%,rgba(255,255,255,.82),transparent 24%),linear-gradient(135deg,#08b84f 0%,#08b84f 48%,#008c38 100%);
  box-shadow:0 0 34px color-mix(in srgb,var(--tp-accent) 34%,transparent),0 14px 28px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.48),inset 0 -10px 20px rgba(75,45,8,.20);
  animation:clockFloat 2.8s ease-in-out infinite;}
.tp-modal-clock::before{content:"";position:absolute;inset:-8px;border-radius:28px;background:radial-gradient(circle,color-mix(in srgb,var(--tp-accent) 30%,transparent),transparent 68%);opacity:.72;z-index:-1;animation:clockGlow 2.4s ease-in-out infinite;}
.clock-face{width:42px;height:42px;border-radius:50%;position:relative;display:block;
  background:radial-gradient(circle at 50% 50%,rgba(255,255,255,.95) 0 4px,transparent 5px),radial-gradient(circle at 50% 50%,rgba(20,17,10,.08),rgba(20,17,10,.18));
  border:3px solid rgba(24,19,10,.82);box-shadow:inset 0 0 0 2px rgba(255,255,255,.35),0 4px 10px rgba(0,0,0,.22);}
.clock-face::before,.clock-face::after{content:"";position:absolute;background:rgba(24,19,10,.72);border-radius:999px;}
.clock-face::before{width:4px;height:4px;top:4px;left:50%;transform:translateX(-50%);box-shadow:0 30px 0 rgba(24,19,10,.72),15px 15px 0 rgba(24,19,10,.72),-15px 15px 0 rgba(24,19,10,.72);}
.clock-face::after{width:3px;height:3px;top:8px;left:8px;opacity:.65;box-shadow:23px 0 0 rgba(24,19,10,.72),23px 23px 0 rgba(24,19,10,.72),0 23px 0 rgba(24,19,10,.72);}
.clock-hand{position:absolute;left:50%;bottom:50%;transform-origin:50% 100%;border-radius:999px;background:#17130a;z-index:2;}
.clock-hand.hour{width:4px;height:12px;margin-left:-2px;animation:clockHour 43200s linear infinite;}
.clock-hand.minute{width:3px;height:16px;margin-left:-1.5px;background:#2a210f;animation:clockMinute 3600s linear infinite;}
.clock-hand.second{width:2px;height:18px;margin-left:-1px;background:#f43f5e;box-shadow:0 0 8px rgba(244,63,94,.45);animation:clockSecond 60s steps(60,end) infinite;}
.clock-center{position:absolute;width:8px;height:8px;left:50%;top:50%;transform:translate(-50%,-50%);border-radius:50%;background:#17130a;border:2px solid #08b84f;z-index:4;}
@keyframes clockSecond{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
@keyframes clockMinute{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
@keyframes clockHour{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
@keyframes clockFloat{0%,100%{transform:translateY(0) scale(1);}50%{transform:translateY(-3px) scale(1.035);}}
@keyframes clockGlow{0%,100%{opacity:.45;transform:scale(.96);}50%{opacity:.82;transform:scale(1.08);}}
.tp-qr-modal .body{position:relative;z-index:2;padding:0 22px 16px;gap:12px;display:grid;justify-items:center;}
.qr-img-wrap{display:flex;justify-content:center;width:80%;}
.tp-qr-ring{position:relative;border-radius:28px;padding:8px;
  background:conic-gradient(from 180deg,color-mix(in srgb,var(--tp-accent) 18%,transparent),color-mix(in srgb,var(--tp-accent) 92%,transparent),color-mix(in srgb,#263660 44%,transparent),color-mix(in srgb,var(--tp-accent) 18%,transparent));
  box-shadow:0 16px 36px rgba(0,0,0,.24),0 0 30px color-mix(in srgb,var(--tp-accent) 13%,transparent);}
.tp-qr-ring::before{content:'';position:absolute;inset:2px;border-radius:26px;background:linear-gradient(180deg,color-mix(in srgb,#15161b 96%,#000),color-mix(in srgb,#15161b 88%,#000));}
.qr-img{position:relative;display:block;width:min(270px,63vw);max-width:270px;aspect-ratio:1/1;border-radius:22px;background:#fff;padding:9px;box-shadow:0 16px 38px rgba(0,0,0,.32);}
.qr-meta{width:100%;border:1px solid color-mix(in srgb,var(--tp-border) 82%,transparent);border-radius:22px;padding:12px;
  background:linear-gradient(180deg,color-mix(in srgb,#15161b 78%,rgba(255,255,255,.08)),color-mix(in srgb,#15161b 90%,transparent));
  box-shadow:inset 0 1px 0 rgba(255,255,255,.08);text-align:left;}
.tp-pay-amount{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 13px;border-radius:17px;background:color-mix(in srgb,var(--tp-accent) 10%,transparent);border:1px solid color-mix(in srgb,var(--tp-accent) 18%,var(--tp-border));}
.tp-pay-amount b{color:color-mix(in srgb,var(--tp-accent) 88%,var(--tp-text));font-size:17px;}
.tp-warning-line{padding:10px 13px;border-radius:17px;margin-top:10px;color:color-mix(in srgb,var(--tp-accent) 70%,var(--tp-text));background:color-mix(in srgb,var(--tp-accent) 9%,transparent);border:1px solid color-mix(in srgb,var(--tp-accent) 15%,var(--tp-border));line-height:1.5;}
.tp-expire-line{color:var(--tp-muted);padding:8px 2px 0;text-align:center;font-size:13px;}
.tp-qr-modal .footer{position:relative;z-index:2;padding:0 22px 20px;display:flex;justify-content:center;}
.tp-qr-modal #qrStatus{position:relative;z-index:2;padding:0 22px 20px;}
.tp-notice-modal{position:fixed!important;inset:0!important;z-index:2147483000!important;display:grid;place-items:center;padding:clamp(10px,2vw,20px);overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;isolation:isolate;}
.tp-notice-modal .overlay{position:fixed;inset:0;z-index:0;
  background:radial-gradient(circle at 16% 14%,color-mix(in srgb,#05b84f 18%,transparent),transparent 30%),radial-gradient(circle at 88% 88%,rgba(91,95,255,.16),transparent 34%),rgba(0,0,0,.68);
  -webkit-backdrop-filter:blur(18px) saturate(128%);backdrop-filter:blur(18px) saturate(128%);}
.tp-notice-modal .toast-card{position:relative;z-index:1;overflow:hidden;width:min(560px,calc(100vw - 28px));max-height:min(760px,calc(100dvh - 24px));display:grid;grid-template-rows:auto minmax(0,1fr) auto;border-radius:34px;isolation:isolate;
  background:linear-gradient(145deg,color-mix(in srgb,#15161b 94%,#fff 5%),color-mix(in srgb,#15161b 88%,#000 12%) 64%,color-mix(in srgb,#261d10 22%,#15161b)) padding-box,
  linear-gradient(135deg,color-mix(in srgb,#21b95c 88%,transparent),rgba(255,255,255,.10) 22%,color-mix(in srgb,#05b84f 56%,transparent) 48%,rgba(0,140,56,.42) 100%) border-box;
  border:1px solid transparent;color:var(--tp-text);
  box-shadow:0 38px 120px rgba(0,0,0,.55),0 12px 32px color-mix(in srgb,#05b84f 14%,transparent),inset 0 1px 0 rgba(255,255,255,.12);
  animation:tnCardIn .42s cubic-bezier(.16,1,.3,1) both;}
@keyframes tnCardIn{from{opacity:0;transform:translateY(18px) scale(.94);filter:blur(10px);}to{opacity:1;transform:none;filter:none;}}
.tp-notice-modal .notice-glow{position:absolute;pointer-events:none;border-radius:999px;filter:blur(12px);z-index:-1;opacity:.6;animation:tnGlowFloat 6.8s ease-in-out infinite;}
.tp-notice-modal .notice-glow-a{width:190px;height:190px;right:-74px;top:-78px;background:color-mix(in srgb,#05b84f 28%,transparent);}
.tp-notice-modal .notice-glow-b{width:150px;height:150px;left:-70px;bottom:-72px;background:rgba(96,80,255,.18);animation-delay:-2.4s;}
@keyframes tnGlowFloat{0%,100%{transform:translate3d(0,0,0) scale(1);}50%{transform:translate3d(0,12px,0) scale(1.06);}}
.tp-notice-modal .toast-headbar{position:relative;display:flex;align-items:center;gap:16px;padding:24px 76px 20px 24px;color:var(--tp-text);min-height:0;
  background:radial-gradient(circle at 16% 6%,rgba(255,255,255,.18),transparent 30%),linear-gradient(135deg,color-mix(in srgb,#21b95c 22%,transparent),color-mix(in srgb,#05b84f 18%,transparent) 52%,transparent);}
.tp-notice-modal .toast-headbar::after{content:"";position:absolute;left:24px;right:24px;bottom:0;height:1px;background:linear-gradient(90deg,transparent,color-mix(in srgb,#05b84f 46%,transparent),transparent);}
.tp-notice-modal .toast-badge{position:relative;width:62px;height:62px;flex:0 0 62px;display:grid;place-items:center;border-radius:22px;
  background:radial-gradient(circle at 32% 24%,rgba(255,255,255,.82),transparent 28%),linear-gradient(135deg,#21b95c,#05b84f 60%,#008c38);
  box-shadow:0 18px 34px color-mix(in srgb,#05b84f 26%,transparent),inset 0 1px 0 rgba(255,255,255,.50),inset 0 -10px 18px rgba(58,37,7,.18);
  animation:tnBadgeFloat 2.8s ease-in-out infinite;}
@keyframes tnBadgeFloat{0%,100%{transform:translateY(0) rotate(0deg);}50%{transform:translateY(-4px) rotate(-2deg);}}
.tp-notice-modal .notice-badge-core{position:relative;z-index:2;color:#1b1408;font-size:28px;line-height:1;}
.tp-notice-modal .notice-badge-ring{position:absolute;inset:-7px;border-radius:26px;border:1px solid color-mix(in srgb,#21b95c 42%,transparent);opacity:.7;animation:tnPulse 2.2s ease-in-out infinite;}
.tp-notice-modal .notice-close{position:absolute;top:18px;right:18px;width:42px;height:42px;border-radius:16px;border:1px solid rgba(255,255,255,.11);background:rgba(255,255,255,.055);color:var(--tp-text);display:grid;place-items:center;font-size:22px;line-height:1;cursor:pointer;box-shadow:0 14px 28px rgba(0,0,0,.24);transition:transform .2s ease,background .2s ease,border-color .2s ease;}
.tp-notice-modal .notice-close:hover{transform:translateY(-2px);background:rgba(33,185,92,.12);border-color:rgba(33,185,92,.38);}
@keyframes tnPulse{0%,100%{transform:scale(.96);opacity:.38;}50%{transform:scale(1.06);opacity:.86;}}
.tp-notice-modal .notice-kicker{display:inline-flex;align-items:center;gap:8px;margin-bottom:4px;color:#21b95c;font-size:11px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;}
.tp-notice-modal .notice-kicker::before{content:"";width:7px;height:7px;border-radius:999px;background:#05b84f;box-shadow:0 0 18px #05b84f;}
.tp-notice-modal .toast-title{margin:0;font-size:clamp(22px,4.6vw,30px);line-height:1.16;letter-spacing:-.035em;}
.tp-notice-modal .toast-headtxt .muted{margin-top:6px;color:var(--tp-muted)!important;font-size:13px!important;line-height:1.55;}
.tp-notice-modal .toast-body{min-height:0;padding:20px 24px 8px;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;scrollbar-gutter:stable;}
.tp-notice-modal .notice-list{display:grid;gap:10px;margin:0;padding:0;list-style:none;}
.tp-notice-modal .notice-list li{display:grid;grid-template-columns:42px 1fr;align-items:start;gap:12px;padding:12px 13px;border-radius:18px;border:1px solid color-mix(in srgb,var(--tp-border) 78%,transparent);background:linear-gradient(135deg,rgba(255,255,255,.055),rgba(255,255,255,.018));color:color-mix(in srgb,var(--tp-text) 82%,var(--tp-muted));line-height:1.55;box-shadow:inset 0 1px 0 rgba(255,255,255,.045);}
.tp-notice-modal .notice-dot{display:grid;place-items:center;width:34px;height:34px;border-radius:13px;color:#17130a;font-size:11px;font-weight:950;background:linear-gradient(135deg,#21b95c,#05b84f);box-shadow:0 8px 18px color-mix(in srgb,#05b84f 18%,transparent),inset 0 1px 0 rgba(255,255,255,.42);}
.tp-notice-modal .notice-check-row{position:relative;display:grid;grid-template-columns:48px 1fr;align-items:center;gap:12px;margin-top:16px;padding:13px;border-radius:20px;cursor:pointer;user-select:none;border:1px solid color-mix(in srgb,var(--tp-border) 82%,transparent);background:color-mix(in srgb,var(--tp-page) 42%,transparent);transition:transform .2s ease,border-color .2s ease,background .2s ease;}
.tp-notice-modal .notice-check-row:hover{transform:translateY(-1px);border-color:color-mix(in srgb,#05b84f 40%,var(--tp-border));background:color-mix(in srgb,#05b84f 7%,transparent);}
.tp-notice-modal .notice-check-input{position:absolute;opacity:0;pointer-events:none;}
.tp-notice-modal .notice-check-ui{width:46px;height:28px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:linear-gradient(180deg,rgba(255,255,255,.10),rgba(255,255,255,.035));box-shadow:inset 0 2px 8px rgba(0,0,0,.38);position:relative;transition:.24s ease;}
.tp-notice-modal .notice-check-ui::before{content:"";position:absolute;top:4px;left:4px;width:20px;height:20px;border-radius:50%;background:#f5f5f2;box-shadow:0 5px 14px rgba(0,0,0,.38),inset 0 1px 0 rgba(255,255,255,.75);transition:transform .24s cubic-bezier(.2,.8,.2,1),background .24s ease;}
.tp-notice-modal .notice-check-input:checked + .notice-check-ui{background:linear-gradient(135deg,#36d56d,#20a955);box-shadow:0 0 22px rgba(54,213,109,.26),inset 0 1px 0 rgba(255,255,255,.18);}
.tp-notice-modal .notice-check-input:checked + .notice-check-ui::before{transform:translateX(18px);}
.tp-notice-modal .notice-check-copy b{display:block;color:var(--tp-text);font-size:14px;}
.tp-notice-modal .notice-check-copy small{display:block;color:var(--tp-muted);margin-top:2px;font-size:12px;}
.tp-notice-modal .toast-actions{position:relative;z-index:2;display:flex;justify-content:flex-end;padding:16px 24px 24px;background:linear-gradient(180deg,color-mix(in srgb,#15161b 74%,transparent),color-mix(in srgb,#15161b 96%,#000 4%));border-top:1px solid color-mix(in srgb,var(--tp-border) 62%,transparent);box-shadow:0 -18px 38px rgba(0,0,0,.28);}
.tp-notice-modal .notice-accept-btn{position:relative;overflow:hidden;min-height:48px;border:0!important;border-radius:999px;padding:0 20px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:10px;color:#17130a!important;font-weight:950;background:linear-gradient(135deg,#21b95c 0%,#08b84f 54%,#05b84f 100%)!important;box-shadow:0 16px 34px color-mix(in srgb,#05b84f 24%,transparent),inset 0 1px 0 rgba(255,255,255,.62)!important;transition:transform .2s ease,filter .2s ease;font-family:inherit;}
.tp-notice-modal .notice-accept-btn:hover{transform:translateY(-2px);filter:saturate(1.08) brightness(1.03);}
.tp-notice-modal .notice-accept-btn i{font-style:normal;font-size:18px;transition:transform .2s ease;}
.tp-notice-modal .notice-accept-btn:hover i{transform:translateX(3px);}
@media(max-width:1100px){.tp-layout{grid-template-columns:minmax(240px,300px) minmax(0,1fr);}}
@media(max-width:860px){
  .tp-layout{grid-template-columns:1fr;}
  .tp-side-card{position:static;}
  .tp-checkout-grid{grid-template-columns:1fr;}
  .d-desktop{display:none!important;}
  .d-mobile{display:block!important;}
}
@media(max-width:640px){
  .topup-enterprise{width:calc(100% - 22px);padding-top:12px;}
  .tp-hero{border-radius:24px;padding:22px;}
  .tp-hero-metrics{grid-template-columns:1fr;}
  .tp-quick-grid{grid-template-columns:repeat(3,minmax(0,1fr));}
  .tp-hero-content{flex-direction:column;align-items:flex-start;}
  .tp-notice-modal{padding:10px;place-items:center;}
  .tp-notice-modal .toast-card{width:min(420px,calc(100vw - 20px));max-height:calc(100dvh - 20px);border-radius:26px;}
  .tp-notice-modal .toast-headbar{padding:18px 62px 16px 18px;align-items:flex-start;gap:12px;}
  .tp-notice-modal .toast-badge{width:52px;height:52px;flex-basis:52px;border-radius:18px;}
  .tp-notice-modal .notice-close{top:14px;right:14px;width:38px;height:38px;border-radius:14px;}
  .tp-notice-modal .toast-body{padding:14px 16px 6px;}
  .tp-notice-modal .notice-list{gap:8px;}
  .tp-notice-modal .notice-list li{grid-template-columns:36px 1fr;padding:10px 11px;border-radius:16px;font-size:13px;}
  .tp-notice-modal .notice-dot{width:32px;height:32px;border-radius:12px;}
  .tp-notice-modal .notice-check-row{grid-template-columns:46px 1fr;margin-top:12px;padding:11px;}
  .tp-notice-modal .toast-actions{padding:12px 16px 16px;}
  .tp-notice-modal .notice-accept-btn{width:100%;}
}
@media(prefers-reduced-motion:reduce){.topup-enterprise *,.topup-enterprise *::before,.topup-enterprise *::after{animation:none!important;transition:none!important;}}
`;

export default function TopupPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [wallets, setWallets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [amount, setAmount] = useState('');
  const [activeChip, setActiveChip] = useState('');
  const [tab, setTab] = useState('topup');
  const [historyFilter, setHistoryFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  function notifyMsg(payload) {
    setMsg(payload);
    if (payload && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('rt:notify', { detail: payload }));
    }
  }

  const [qrModal, setQrModal] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const [qrExpired, setQrExpired] = useState(false);
  const [showNotice, setShowNotice] = useState(false);
  const [openAccordions, setOpenAccordions] = useState({});

  const txWatcherRef = useRef(null);
  const countdownRef = useRef(null);
  const expireAtRef = useRef(null);
  const currentTxIdRef = useRef(null);

  useEffect(() => {
    loadPage();
    try {
      const v = localStorage.getItem(NOTICE_KEY);
      const ts = v ? Number(v) : 0;
      if (!ts || Date.now() > ts) setShowNotice(true);
    } catch {}
    return () => { stopTxWatcher(); clearCountdown(); };
  }, []);

  async function loadPage() {
    setLoading(true);
    const [meRes, walletsRes, txRes] = await Promise.all([
      fetch('/api/auth/me'),
      fetch('/api/topup/wallets'),
      fetch('/api/topup/history'),
    ]);
    if (!meRes.ok) { router.push('/login'); return; }
    const me = await meRes.json();
    const wall = await walletsRes.json();
    const tx = await txRes.json();
    setUser(me.user);
    setWallets(wall.wallets || []);
    setTransactions(tx.transactions || []);
    setLoading(false);
  }

  function startCountdown(seconds) {
    clearCountdown();
    expireAtRef.current = Date.now() + seconds * 1000;
    setCountdown(seconds); setQrExpired(false);
    countdownRef.current = setInterval(() => {
      const left = Math.max(0, Math.ceil((expireAtRef.current - Date.now()) / 1000));
      setCountdown(left);
      if (left <= 0) { clearCountdown(); setQrExpired(true); }
    }, 1000);
  }

  function clearCountdown() {
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
  }

  function fmtMMSS(secs) {
    const s = Math.max(0, secs);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  function startTxWatcher(txId, timeoutSec = 300) {
    stopTxWatcher();
    const started = Date.now();
    let delay = 3000;
    const tick = async () => {
      try {
        if (timeoutSec > 0 && Date.now() - started > timeoutSec * 1000) {
          stopTxWatcher(); setQrExpired(true); return;
        }
        const r = await fetch(`/api/topup/tx/${txId}?_=${Date.now()}`, { cache: 'no-store' });
        if (!r.ok) { txWatcherRef.current = setTimeout(tick, delay); return; }
        const j = await r.json();
        if (j?.ok && ['completed', 'failed', 'cancelled', 'canceled', 'reject'].includes(j.status)) {
          stopTxWatcher(); clearCountdown();
          if (j.status === 'completed') {
            const amt = j.amount ?? null;
            notifyMsg({ type: 'ok', text: `เติมเงินสำเร็จ!${amt != null ? ` เพิ่มเครดิต ฿${Number(amt).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : ''}` });
            setQrModal(null); setQrExpired(false); loadPage();
          } else {
            notifyMsg({ type: 'err', text: j.status === 'failed' ? 'การชำระล้มเหลว กรุณาลองใหม่' : 'รายการถูกยกเลิก' });
            setQrModal(null);
          }
          return;
        }
        const age = Date.now() - started;
        delay = age > 120000 ? 10000 : age > 45000 ? 6000 : 3000;
      } catch {}
      txWatcherRef.current = setTimeout(tick, delay);
    };
    tick();
  }

  function stopTxWatcher() {
    if (txWatcherRef.current) { clearTimeout(txWatcherRef.current); txWatcherRef.current = null; }
  }

  async function submitTopup(e, walletCode) {
    e.preventDefault();
    const base = Math.floor(Number(amount));
    if (!base || base < 1) { notifyMsg({ type: 'err', text: 'จำนวนเงินขั้นต่ำ 1 บาท' }); return; }
    setBusy(true); setMsg(null);
    try {
      const res = await fetch('/api/topup/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: base, method: walletCode }),
      });
      const j = await res.json();
      if (!res.ok || !j?.ok) { notifyMsg({ type: 'err', text: j?.message || 'สร้างคำสั่งเติมเงินไม่สำเร็จ' }); setBusy(false); return; }
      currentTxIdRef.current = j.txId;
      const displayAmount = Number(j.displayAmount ?? j.amount ?? base);
      const expiresIn = Number(j.expiresIn || 300);
      const wallet = wallets[selectedIdx];
      const qrUrl = j.qrUrl || FALLBACK_QR_MAP[walletCode] || FALLBACK_QR_MAP[j.method] || '';
      const modalData = { txId: j.txId, method: j.method, displayAmount, expiresIn, qrUrl, accountNumber: wallet?.accountNumber || '', accountName: wallet?.accountName || '' };
      if (j.mustCancelOld || j.expiredPending) {
        setQrModal({ ...modalData, expiresIn: 0 }); setQrExpired(true); setCountdown(0);
      } else {
        setQrModal(modalData); startCountdown(expiresIn); startTxWatcher(j.txId, expiresIn);
      }
    } catch (err) { notifyMsg({ type: 'err', text: `ขัดข้อง: ${err.message}` }); }
    setBusy(false);
  }

  async function cancelTopup(txId) {
    const id = txId || currentTxIdRef.current;
    if (!id) return;
    try {
      const r = await fetch(`/api/topup/cancel/${encodeURIComponent(id)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.message || 'ยกเลิกไม่สำเร็จ');
      notifyMsg({ type: 'ok', text: 'ยกเลิกรายการแล้ว สามารถสร้างรายการใหม่ได้เลย' });
      stopTxWatcher(); clearCountdown(); setQrModal(null); setQrExpired(false); loadPage();
    } catch (err) { notifyMsg({ type: 'err', text: err.message }); }
  }

  function closeQrModal() { stopTxWatcher(); clearCountdown(); setQrModal(null); setQrExpired(false); }

  function closeNotice(dontShowToday) {
    if (dontShowToday) { try { localStorage.setItem(NOTICE_KEY, String(Date.now() + 86400000)); } catch {} }
    setShowNotice(false);
  }

  const completedCount = transactions.filter(t => t.status === 'completed').length;
  const pendingCount = transactions.filter(t => t.status === 'pending').length;
  const filteredTx = historyFilter === 'all' ? transactions : transactions.filter(t => String(t.status).toLowerCase() === historyFilter);
  const historyMethods = Array.from(new Set(transactions.map(t => String(t.method || '').toLowerCase()).filter(Boolean)));

  if (loading) return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="topup-enterprise" style={{ minHeight: '40vh', display: 'grid', placeItems: 'center', color: 'var(--tp-muted)' }}>⏳ กำลังโหลด...</div>
    </>
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="topup-enterprise">

        {/* Hero */}
        <section className="tp-hero" aria-label="Topup header">
          <div className="tp-hero-glow tp-hero-glow-a" />
          <div className="tp-hero-glow tp-hero-glow-b" />
          <div className="tp-hero-content">
            <div>
              <div className="tp-eyebrow"><span /> TOPUP CENTER</div>
              <h1>เติมเครดิตอัตโนมัติ</h1>
              <p>เลือกช่องทาง กรอกยอด สแกนจ่าย และรอระบบตรวจสอบยอดอัตโนมัติ</p>
            </div>
            <div className="tp-hero-metrics" aria-label="Topup summary">
              <div className="tp-metric">
                <small>ช่องทางพร้อมใช้</small>
                <b>{wallets.length.toLocaleString('th-TH')}</b>
              </div>
              <div className="tp-metric">
                <small>เติมเครดิตสำเร็จ</small>
                <b>{completedCount.toLocaleString('th-TH')}</b>
              </div>
              <div className="tp-metric">
                <small>รอดำเนินการ</small>
                <b>{pendingCount.toLocaleString('th-TH')}</b>
              </div>
            </div>
          </div>
        </section>

        {/* Flash msg */}
        {msg && <div className={`tp-flash ${msg.type}`}>{msg.text}</div>}

        {/* Tab bar */}
        <div className="tabs tp-main-tabs" role="tablist">
          <button className={`tab${tab === 'topup' ? ' active' : ''}`} onClick={() => setTab('topup')} type="button">
            <span className="tab-ico">✦</span><span>การเติมเครดิต</span>
          </button>
          <button className={`tab${tab === 'history' ? ' active' : ''}`} onClick={() => setTab('history')} type="button">
            <span className="tab-ico">◷</span><span>ประวัติการเติมเงิน</span>
          </button>
        </div>

        {/* Tab: Topup */}
        <section className={`tabpane${tab === 'topup' ? ' show' : ''}`} role="tabpanel">
          <div className="tp-layout">
            {/* Sidebar */}
            <aside className="tp-side-card">
              <div className="tp-section-head compact">
                <div>
                  <span>Payment methods</span>
                  <h2>ช่องทางเติมเงิน</h2>
                </div>
              </div>
              {wallets.length === 0 ? (
                <div className="tp-empty">
                  <div className="tp-empty-icon">⌁</div>
                  <h3>ยังไม่มีช่องทางพร้อมใช้งาน</h3>
                  <p>โปรดรอแอดมินเปิดช่องทางเติมเงิน</p>
                </div>
              ) : (
                <div className="tp-wallet-rail" role="tablist">
                  {wallets.map((w, i) => {
                    const code = String(w.accountCode || '').toLowerCase();
                    const isTW = code === 'tw';
                    const expireText = isTW || code === 'qr' ? '5 นาที' : '15 นาที';
                    return (
                      <button key={i} className={`tp-wallet-tab${selectedIdx === i ? ' active' : ''}`}
                        onClick={() => { setSelectedIdx(i); setAmount(''); setActiveChip(''); setMsg(null); }} type="button">
                        <span className="tp-wallet-icon-wrap">
                          <img src={`/assets/payment/${code}.webp`} alt={code} loading="lazy"
                            onError={e => { e.target.style.display = 'none'; }} />
                        </span>
                        <span className="tp-wallet-copy">
                          <strong>{BANK_LABELS[code] || code.toUpperCase()}</strong>
                          <small>{isTW ? 'TrueWallet QR' : 'Bank Transfer'} · {expireText}</small>
                        </span>
                        <span className="tp-wallet-arrow">›</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </aside>

            {/* Main panels */}
            <main className="tp-main-card">
              {wallets.length === 0 ? (
                <div className="tp-empty large">
                  <div className="tp-empty-icon">◌</div>
                  <h3>ยังไม่มีช่องทางเติมเงินที่พร้อมใช้งาน</h3>
                  <p>เมื่อเปิดใช้งานแล้ว รายการช่องทางจะปรากฏที่นี่</p>
                </div>
              ) : wallets.map((w, i) => {
                const code = String(w.accountCode || '').toLowerCase();
                const isTW = code === 'tw';
                const expireText = isTW || code === 'qr' ? '5 นาที' : '15 นาที';
                const methodTitle = BANK_LABELS[code] || code.toUpperCase();
                const summaryAmt = Number(amount);
                return (
                  <div key={i} className={`tp-wallet-panel${selectedIdx === i ? ' active' : ''}`}>
                    <div className="tp-payment-header">
                      <div className="tp-payment-brand">
                        <div className="tp-payment-logo">
                          <img src={`/assets/payment/${code}.webp`} alt={code} loading="lazy"
                            onError={e => { e.target.style.display = 'none'; }} />
                        </div>
                        <div>
                          <span>{isTW ? 'TrueMoney Wallet' : 'Bank Transfer'}</span>
                          <h2>{methodTitle}</h2>
                          <p>{w.accountName || 'RTAUTOBOT'}</p>
                        </div>
                      </div>
                      <div className="tp-expire-badge">
                        <small>กรุณาทำรายการใน</small>
                        <b>{expireText}</b>
                      </div>
                    </div>

                    <div className="tp-checkout-grid">
                      <section className="tp-form-card">
                        <form className="tp-form" onSubmit={e => submitTopup(e, code)}>
                          <label className="tp-label">จำนวนเงินที่ต้องการเติม</label>
                          <div className="tp-amount-shell">
                            <span>฿</span>
                            <input type="number" min="1" step="1" inputMode="numeric" required placeholder="เช่น 100"
                              value={amount}
                              onChange={e => { setAmount(e.target.value); setActiveChip(''); }} />
                          </div>
                          <div className="tp-quick-grid" aria-label="Quick amounts">
                            {QUICK_AMOUNTS.map(v => (
                              <button key={v} type="button"
                                className={`tp-chip${activeChip === String(v) ? ' active' : ''}`}
                                onClick={() => { setAmount(String(v)); setActiveChip(String(v)); }}>
                                ฿{v.toLocaleString('th-TH')}
                              </button>
                            ))}
                          </div>
                          <div className="tp-summary-strip">
                            <span>ยอดเติม</span>
                            <b>฿{summaryAmt >= 1 ? summaryAmt.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}</b>
                          </div>
                          <button className="tp-primary-btn" type="submit" disabled={busy}>
                            <span className="btn-shine" />
                            <span>{busy ? 'กำลังสร้างรายการ...' : isTW ? 'สร้าง QR TrueWallet' : 'สร้างรายการโอนเงิน'}</span>
                            <i style={{ fontStyle: 'normal' }}>→</i>
                          </button>
                        </form>
                      </section>

                      <section className="tp-info-card">
                        <div className="tp-account-card">
                          <div className="tp-account-icon">
                            <img src={`/assets/payment/${code}.webp`} alt={code} loading="lazy"
                              onError={e => { e.target.style.display = 'none'; }} />
                          </div>
                          <div>
                            <small>บัญชีปลายทาง</small>
                            <strong>{w.accountName || 'RTAUTOBOT'}</strong>
                            <span>{isTW ? 'สแกน QRCode ด้วยแอป TrueMoney Wallet เท่านั้น' : 'สแกน QRCode ได้ทุกธนาคาร'}</span>
                          </div>
                        </div>
                        <div className="tp-alert-card">
                          <span>⚠</span>
                          <div>
                            <b>โปรดโอนยอดให้ตรงตามระบบ</b>
                            <p>{isTW ? 'ใช้แอป TrueMoney Wallet สแกน QR และรอระบบตรวจสอบอัตโนมัติ' : 'ระบบจะสุ่มเศษสตางค์เพื่อจับคู่รายการ กรุณาโอนครั้งเดียวตามยอดที่แสดง'}</p>
                          </div>
                        </div>
                        <div className="tp-steps-card">
                          <h3>{isTW ? 'วิธีเติมผ่าน TrueWallet' : 'วิธีโอนผ่านธนาคาร'}</h3>
                          <ol>
                            <li>กรอกจำนวนเงินที่ต้องการเติม</li>
                            <li>กดปุ่มสร้างรายการเติมเงิน</li>
                            <li>{isTW ? 'เปิดแอป TrueMoney Wallet แล้วสแกน QR' : 'เปิดแอปธนาคาร แล้วสแกน QR Code'}</li>
                            <li>โอนตามยอดที่ระบบแสดงเท่านั้น</li>
                            <li>รอระบบตรวจสอบและเติมเครดิตอัตโนมัติ</li>
                          </ol>
                        </div>
                      </section>
                    </div>
                  </div>
                );
              })}
            </main>
          </div>
        </section>

        {/* Tab: History */}
        <section className={`tabpane${tab === 'history' ? ' show' : ''}`} role="tabpanel">
          <div className="tp-history-card">
            <div className="tp-section-head">
              <div>
                <span>Transaction history</span>
                <h2>ประวัติการเติมเงินล่าสุด</h2>
              </div>
              <div className="tp-history-actions">
                <GlobalSelect
                  className="tp-history-custom-select"
                  value={historyFilter}
                  onChange={(v) => setHistoryFilter(v)}
                  options={[
                    { value: 'all', label: 'ทุกช่องทาง' },
                    ...historyMethods.map((code) => ({ value: code, label: BANK_LABELS[code] || code.toUpperCase() })),
                  ]}
                  ariaLabel="กรองประวัติเติมเงินตามช่องทาง"
                />
                <div className="tp-history-count">{transactions.length.toLocaleString('th-TH')} รายการ</div>
              </div>
            </div>

            {filteredTx.length === 0 ? (
              <div className="tp-empty large">
                <div className="tp-empty-icon">◌</div>
                <h3>ยังไม่มีรายการเติมเงิน</h3>
                <p>เมื่อมีการเติมเครดิต รายการล่าสุดจะแสดงที่นี่</p>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <table className="tp-history-table d-desktop">
                  <thead>
                    <tr>
                      <th>วันที่ / เวลา</th>
                      <th>ช่องทาง</th>
                      <th className="right">จำนวนเงิน</th>
                      <th className="right">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTx.map(tx => {
                      const st = String(tx.status || '').toLowerCase();
                      const code = String(tx.method || '').toLowerCase();
                      return (
                        <tr key={String(tx._id)} data-status={st} data-method={code}>
                          <td className="mono" style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                            {tx.createdAt ? new Date(tx.createdAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td>
                            <span className="tp-method">
                              <img className="method-ico" src={`/assets/payment/${code}.webp`} alt={code} width="24" height="24" loading="lazy"
                                onError={e => { e.target.style.display = 'none'; }} />
                              <span>{BANK_LABELS[code] || code.toUpperCase() || 'ไม่ระบุ'}</span>
                            </span>
                          </td>
                          <td className="right"><span className="money">฿{Number(tx.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></td>
                          <td className="right" style={{ textAlign: 'right' }}>
                            <span className={`pill sm st-${st}`}><span className="st-ico" /><span className="txt">{STATUS_LABELS[st] || st}</span></span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Mobile accordion */}
                <div className="tp-history-list d-mobile">
                  {filteredTx.map(tx => {
                    const st = String(tx.status || '').toLowerCase();
                    const code = String(tx.method || '').toLowerCase();
                    const id = String(tx._id);
                    const isOpen = !!openAccordions[id];
                    return (
                      <div key={id} className="hx-card" data-status={st} data-method={code}>
                        <div className="hx-head" onClick={() => setOpenAccordions(p => ({ ...p, [id]: !p[id] }))}>
                          <span className="hx-date mono">
                            {tx.createdAt ? new Date(tx.createdAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                          </span>
                          <button className="hx-toggle" type="button">{isOpen ? '−' : '＋'}</button>
                        </div>
                        {isOpen && (
                          <div className="hx-body">
                            <div className="hx-row"><div className="hx-label">ช่องทาง</div><div className="hx-val tp-method"><img className="method-ico" src={`/assets/payment/${code}.webp`} alt={code} width="22" height="22" loading="lazy" onError={e => { e.target.style.display = 'none'; }} /><span>{BANK_LABELS[code] || code.toUpperCase()}</span></div></div>
                            <div className="hx-row"><div className="hx-label">จำนวนเงิน</div><div className="hx-val money">฿{Number(tx.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div></div>
                            <div className="hx-row"><div className="hx-label">สถานะ</div><div className="hx-val"><span className={`pill sm st-${st}`}><span className="st-ico" /><span className="txt">{STATUS_LABELS[st] || st}</span></span></div></div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      {/* QR Modal */}
      {qrModal && (
        <div id="qrModal" className="tp-qr-modal">
          <div className="overlay" onClick={closeQrModal} />
          <div className="dialog" role="dialog" aria-modal="true">
            <button className="close" onClick={closeQrModal} aria-label="ปิด">×</button>
            <div className="tp-modal-head">
              <div className="tp-modal-clock" aria-hidden="true">
                <span className="clock-face">
                  <i className="clock-hand hour" />
                  <i className="clock-hand minute" />
                  <i className="clock-hand second" />
                  <i className="clock-center" />
                </span>
              </div>
              <span className={`tp-countdown-pill ${qrExpired ? 'is-expired' : 'is-live'}`}>{qrExpired ? 'หมดเวลาแล้ว' : `หมดอายุใน ${fmtMMSS(countdown)}`}</span>
              <h3>{qrExpired ? 'รายการหมดเวลา' : 'สแกน QRCode เพื่อเติมเงิน'}</h3>
            </div>
            <div className="body">
              {qrModal.qrUrl && !qrExpired && (
                <div className="qr-img-wrap">
                  <div className="tp-qr-ring">
                    <img id="qrImage" src={`${qrModal.qrUrl}?v=${qrModal.txId}`} alt="QR Code" className="qr-img"
                      onError={e => { e.target.closest('.tp-qr-ring').style.display = 'none'; }} />
                  </div>
                </div>
              )}
              <div id="qrMeta" className="qr-meta">
                <div className="tp-pay-amount">
                  <span>ยอดที่ต้องโอน</span>
                  <b>฿{qrModal.displayAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท</b>
                </div>
                <div className="tp-warning-line">โปรดโอนตามยอดที่แสดงเท่านั้น ไม่งั้นเครดิตไม่เข้า</div>
                <div className="tp-expire-line">ระยะเวลาทำรายการ: {Math.ceil((qrModal.expiresIn || 300) / 60)} นาที</div>
              </div>
            </div>
            <div id="qrStatus" style={{ position: 'relative', zIndex: 2, padding: '0 22px 20px' }}>
              {qrExpired && (
                <div className="tp-expired-box">
                  <b>รายการนี้หมดเวลาแล้ว</b>
                  <span>กรุณายกเลิกรายการเก่าก่อนทำรายการใหม่</span>
                  <button type="button" className="tp-cancel-old-btn" onClick={() => cancelTopup(qrModal.txId)}>ยกเลิกรายการเก่า</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Notice Modal */}
      {showNotice && (
        <NoticeLayer>
          <NoticeModal onClose={closeNotice} />
        </NoticeLayer>
      )}
    </>
  );
}

function NoticeLayer({ children }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

function NoticeModal({ onClose }) {
  const [dontShow, setDontShow] = useState(false);
  const RULES = [
    { n: '01', text: 'ในส่วนการเติมเงินแบบสแกน QR Code ของธนาคาร' },
    { n: '02', text: 'ผู้ใช้งานต้องกรอกจำนวนให้ตรงกับหน้าเว็บ' },
    { n: '03', text: 'หากกรอกจำนวนไม่ตรง ระบบจะไม่สามารถเติมเครดิตให้อัตโนมัติ' },
    { n: '04', text: 'หลีกเลี่ยงการโอนเงินช่วง 23:30 - 01:30 น. เพราะระบบธนาคารอัปเดตข้อมูลช้า' },
    { n: '05', text: 'หากเติมเงินไม่เข้าเกิน 1 ชั่วโมง ให้ติดต่อไลน์แจ้งแอดมินทันที' },
  ];
  return (
    <div className="tp-notice-modal">
      <div className="overlay" onClick={() => onClose(dontShow)} />
      <div className="toast-card" role="alertdialog">
        <div className="notice-glow notice-glow-a" aria-hidden="true" />
        <div className="notice-glow notice-glow-b" aria-hidden="true" />
        <div className="toast-headbar">
          <div className="toast-badge" aria-hidden="true">
            <span className="notice-badge-core">⚠</span>
            <span className="notice-badge-ring" />
          </div>
          <div className="toast-headtxt">
            <span className="notice-kicker">Payment Notice</span>
            <h3 className="toast-title">แจ้งเตือนก่อนเติมเงิน</h3>
            <div className="muted">อ่านเงื่อนไขสำคัญก่อนสร้างรายการ เพื่อให้ระบบตรวจยอดได้อัตโนมัติ</div>
          </div>
          <button type="button" className="notice-close" onClick={() => onClose(dontShow)} aria-label="ปิดแจ้งเตือน">×</button>
        </div>
        <div className="toast-body">
          <ul className="notice-list">
            {RULES.map(({ n, text }) => (
              <li key={n}><span className="notice-dot">{n}</span><span>{text}</span></li>
            ))}
          </ul>
          <label className="notice-check-row">
            <input type="checkbox" className="notice-check-input" checked={dontShow} onChange={e => setDontShow(e.target.checked)} />
            <span className="notice-check-ui" aria-hidden="true" />
            <span className="notice-check-copy">
              <b>ไม่แสดงอีกในวันนี้</b>
              <small>ระบบจะจำค่าบนอุปกรณ์นี้เป็นเวลา 24 ชั่วโมง</small>
            </span>
          </label>
        </div>
        <div className="toast-actions">
          <button className="notice-accept-btn" type="button" onClick={() => onClose(dontShow)}>
            <span className="btn-shine" />
            <span>ปิดและยอมรับ</span>
            <i>→</i>
          </button>
        </div>
      </div>
    </div>
  );
}
