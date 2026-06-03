'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

const CSS = `
.rtx-auth{
  --rtx-page:#08090b;--rtx-card:#17181d;
  --rtx-card2:color-mix(in srgb,#17181d 88%,#000 12%);
  --rtx-soft:color-mix(in srgb,#17181d 72%,#08090b);
  --rtx-text:#eef6ff;--rtx-muted:#08b84f;
  --rtx-border:rgba(255,255,255,.11);--rtx-accent:#05b84f;
  --rtx-danger:#ff5a7a;
  min-height:100vh;position:relative;isolation:isolate;overflow:hidden;
  padding:clamp(18px,3vw,42px);color:var(--rtx-text);
  background:
    radial-gradient(circle at 10% 18%,color-mix(in srgb,var(--rtx-accent) 22%,transparent),transparent 31%),
    radial-gradient(circle at 88% 72%,rgba(32,119,255,.24),transparent 36%),
    linear-gradient(135deg,color-mix(in srgb,var(--rtx-page) 96%,#15161c),var(--rtx-page));
}
.rtx-bg{position:absolute;inset:0;pointer-events:none;z-index:-1;
  background-image:linear-gradient(rgba(255,255,255,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.03) 1px,transparent 1px);
  background-size:64px 64px;mask-image:radial-gradient(circle at center,#000 0 58%,transparent 84%)}
.orb{position:absolute;border-radius:999px;filter:blur(38px);opacity:.65;animation:rtxFloat 9s ease-in-out infinite alternate}
.orb-a{width:220px;height:220px;left:5%;top:18%;background:color-mix(in srgb,var(--rtx-accent) 54%,transparent)}
.orb-b{width:260px;height:260px;right:8%;bottom:10%;background:rgba(49,118,255,.42);animation-delay:-2.2s}
.orb-c{width:160px;height:160px;left:45%;bottom:18%;background:rgba(138,92,246,.38);animation-delay:-4s}
@keyframes rtxFloat{from{transform:translate3d(0,0,0) scale(1)}to{transform:translate3d(18px,-22px,0) scale(1.08)}}
.rtx-auth-grid{width:min(1240px,100%);margin:0 auto;min-height:calc(100vh - 160px);display:grid;
  grid-template-columns:minmax(0,1.22fr) minmax(380px,.78fr);align-items:center;gap:clamp(20px,4vw,44px)}
.rtx-hero-panel,.rtx-form-panel{position:relative;border:1px solid var(--rtx-border);
  background:linear-gradient(145deg,color-mix(in srgb,var(--rtx-card) 88%,transparent),color-mix(in srgb,var(--rtx-card2) 92%,transparent));
  box-shadow:0 30px 90px rgba(0,0,0,.36),inset 0 1px 0 rgba(255,255,255,.07);
  backdrop-filter:blur(18px);overflow:hidden;animation:rtxRise .68s cubic-bezier(.2,.8,.2,1) both}
.rtx-hero-panel{border-radius:30px;padding:clamp(28px,4vw,54px)}
.rtx-hero-panel::before,.rtx-form-panel::before{content:"";position:absolute;inset:-1px;
  background:linear-gradient(115deg,transparent 0 45%,rgba(255,255,255,.12) 46% 54%,transparent 55%);
  transform:translateX(-55%);animation:rtxSheen 6.5s ease-in-out infinite;pointer-events:none}
.rtx-form-panel::before{animation-delay:-1.4s}
@keyframes rtxSheen{0%,42%{transform:translateX(-60%)}70%,100%{transform:translateX(72%)}}
@keyframes rtxRise{from{opacity:0;transform:translateY(18px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}
.rtx-kicker{width:max-content;max-width:100%;display:inline-flex;align-items:center;gap:9px;padding:9px 15px;
  border-radius:999px;border:1px solid color-mix(in srgb,var(--rtx-accent) 52%,transparent);
  background:color-mix(in srgb,var(--rtx-accent) 12%,transparent);
  color:color-mix(in srgb,var(--rtx-accent) 74%,var(--rtx-text));
  font-size:12px;font-weight:650;letter-spacing:.07em;text-transform:uppercase;
  box-shadow:0 12px 30px color-mix(in srgb,var(--rtx-accent) 12%,transparent)}
.rtx-hero-panel h1{position:relative;margin:26px 0 16px;font-size:clamp(42px,5.5vw,72px);
  line-height:.98;letter-spacing:-.055em;font-weight:650;color:var(--rtx-text);text-wrap:balance}
.rtx-hero-panel>p{position:relative;margin:0;max-width:720px;
  color:color-mix(in srgb,var(--rtx-muted) 86%,var(--rtx-text));
  font-size:clamp(16px,1.45vw,19px);line-height:1.8;font-weight:750}
.rtx-benefits{position:relative;margin-top:42px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.rtx-benefit{border:1px solid var(--rtx-border);border-radius:22px;padding:17px;
  background:color-mix(in srgb,var(--rtx-soft) 64%,transparent);
  transition:transform .22s ease,border-color .22s ease,background .22s ease}
.rtx-benefit:hover{transform:translateY(-4px);
  border-color:color-mix(in srgb,var(--rtx-accent) 42%,var(--rtx-border));
  background:color-mix(in srgb,var(--rtx-accent) 8%,var(--rtx-soft))}
.rtx-benefit-icon{width:44px;height:44px;display:grid;place-items:center;border-radius:15px;
  background:linear-gradient(135deg,#08b84f,#05b84f);box-shadow:0 16px 30px rgba(6,199,85,.22);margin-bottom:13px}
.rtx-benefit strong{display:block;font-weight:650;color:var(--rtx-text);margin-bottom:5px}
.rtx-benefit small{display:block;color:var(--rtx-muted);line-height:1.45;font-weight:650}
.rtx-meta{margin-top:auto;padding-top:36px;display:flex;align-items:center;flex-wrap:wrap;gap:10px;
  color:color-mix(in srgb,var(--rtx-accent) 76%,var(--rtx-muted));font-size:12px;font-weight:900}
.rtx-meta i{width:5px;height:5px;border-radius:50%;background:var(--rtx-accent);opacity:.76}
.rtx-form-panel{border-radius:28px;padding:clamp(24px,2.4vw,34px);animation-delay:.08s}
.rtx-form-head{position:relative;display:flex;align-items:center;gap:16px;margin-bottom:22px}
.rtx-lock{width:54px;height:54px;border-radius:18px;display:grid;place-items:center;
  background:linear-gradient(135deg,#08b84f,#05b84f);box-shadow:0 18px 36px rgba(6,199,85,.22);font-size:22px}
.rtx-form-head h2{margin:0;font-size:clamp(28px,2.7vw,38px);font-weight:950;letter-spacing:-.035em;color:var(--rtx-text)}
.rtx-form-head>div>p{margin:2px 0 0;color:var(--rtx-muted);font-weight:800}
.rtx-alert{padding:13px 15px;border-radius:16px;margin-bottom:16px}
.rtx-alert.error{border:1px solid color-mix(in srgb,var(--rtx-danger) 45%,transparent);
  background:color-mix(in srgb,var(--rtx-danger) 11%,transparent);color:#ffd4dc;font-weight:550}
.rtx-form{display:grid;gap:15px}
.rtx-field{display:grid;gap:8px}
.rtx-label{font-weight:650;color:color-mix(in srgb,var(--rtx-muted) 84%,var(--rtx-text));font-size:13px}
.rtx-field small{color:color-mix(in srgb,var(--rtx-muted) 78%,transparent);font-weight:650;line-height:1.35}
.rtx-input-wrap{min-height:54px;display:grid;grid-template-columns:56px minmax(0,1fr);align-items:center;
  border:1px solid color-mix(in srgb,var(--rtx-border) 92%,transparent);border-radius:18px;
  background:color-mix(in srgb,var(--rtx-soft) 68%,transparent);overflow:hidden;
  transition:border-color .18s ease,box-shadow .18s ease,background .18s ease}
.rtx-input-wrap:focus-within{
  border-color:color-mix(in srgb,var(--rtx-accent) 72%,transparent);
  box-shadow:0 0 0 4px color-mix(in srgb,var(--rtx-accent) 14%,transparent),0 16px 32px rgba(0,0,0,.18);
  background:color-mix(in srgb,var(--rtx-soft) 86%,transparent)}
.rtx-input-icon{height:100%;display:grid;place-items:center;background:rgba(0,0,0,.34);color:var(--rtx-accent);font-weight:950}
.rtx-input{width:100%;height:100%;border:0;outline:0;background:transparent;
  color:var(--rtx-text);font:inherit;font-weight:850;padding:0 16px}
.rtx-input::placeholder{color:color-mix(in srgb,var(--rtx-muted) 48%,transparent)}
.rtx-password-wrap{grid-template-columns:56px minmax(0,1fr) 58px}
.rtx-pass{width:44px;height:44px;border:1px solid color-mix(in srgb,var(--rtx-border) 85%,transparent);
  border-radius:15px;background:color-mix(in srgb,var(--rtx-soft) 58%,transparent);
  color:var(--rtx-text);cursor:pointer;display:grid;place-items:center;justify-self:center;
  transition:transform .18s ease,border-color .18s ease,background .18s ease}
.rtx-pass:hover{transform:translateY(-1px);
  border-color:color-mix(in srgb,var(--rtx-accent) 60%,transparent);
  background:color-mix(in srgb,var(--rtx-accent) 12%,var(--rtx-soft))}
.rtx-pass .eye-off{display:none}.rtx-pass.is-visible .eye-open{display:none}.rtx-pass.is-visible .eye-off{display:block}
.rtx-submit{margin-top:8px;min-height:58px;border:0;border-radius:19px;
  background:linear-gradient(135deg,#08b84f,#08b84f 55%,#05b84f);color:#17130a;
  font-weight:650;font-size:16px;display:flex;align-items:center;justify-content:center;gap:14px;cursor:pointer;
  box-shadow:0 22px 42px color-mix(in srgb,var(--rtx-accent) 24%,transparent);
  transition:transform .2s ease,filter .2s ease,box-shadow .2s ease}
.rtx-submit:hover{transform:translateY(-2px);filter:saturate(1.05);
  box-shadow:0 26px 48px color-mix(in srgb,var(--rtx-accent) 32%,transparent)}
.rtx-submit:disabled{opacity:.65;cursor:wait;transform:none}
.rtx-submit b{font-size:20px}
.rtx-form-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;
  color:var(--rtx-muted);font-weight:550;flex-wrap:wrap}
.rtx-form-foot a{color:var(--rtx-accent);text-decoration:none;font-weight:650}
.rtx-form-foot a:hover{text-decoration:underline}

/* overlay */
.rg-overlay{position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;padding:1rem;
  background:radial-gradient(circle at 20% 15%,color-mix(in srgb,#05b84f 18%,transparent),transparent 34%),
    radial-gradient(circle at 85% 80%,rgba(124,92,255,.22),transparent 36%),rgba(0,0,0,.72);
  backdrop-filter:blur(18px) saturate(135%);animation:rgBackIn .28s ease both}
@keyframes rgBackIn{from{opacity:0}to{opacity:1}}

/* notice card */
.rtx-notice-card{position:relative;overflow:hidden;border-radius:30px;
  border:1px solid transparent;
  background:linear-gradient(145deg,color-mix(in srgb,#17181d 96%,#05060a 4%),color-mix(in srgb,#101116 92%,#1c2437 8%)) padding-box,
    linear-gradient(135deg,color-mix(in srgb,#05b84f 72%,#fff 8%),rgba(124,92,255,.60),color-mix(in srgb,#05b84f 72%,#000 8%)) border-box;
  box-shadow:0 34px 110px rgba(0,0,0,.58),0 0 0 1px rgba(255,255,255,.035),inset 0 1px 0 rgba(255,255,255,.10);
  animation:rtxNoticeIn .42s cubic-bezier(.2,.88,.2,1) both;isolation:isolate;
  width:min(560px,calc(100vw - 24px))}
.rtx-notice-card.is-closing{animation:rtxNoticeOut .18s ease both}
.rtx-notice-card::before{content:"";position:absolute;inset:0 0 auto 0;height:4px;
  background:linear-gradient(90deg,#08b84f,#05b84f,#7c5cff,#08b84f);background-size:220% 100%;
  animation:rtxNoticeTopline 4.8s linear infinite;opacity:.95}
.rtx-notice-card::after{content:"";position:absolute;inset:-42% -30% auto auto;width:320px;height:320px;border-radius:999px;
  background:radial-gradient(circle,color-mix(in srgb,#05b84f 24%,transparent),transparent 66%);
  filter:blur(3px);pointer-events:none;z-index:-1;animation:rtxNoticeOrb 5.4s ease-in-out infinite}
.rtx-notice-aura{position:absolute;inset:auto auto -90px -85px;width:260px;height:260px;border-radius:999px;
  background:radial-gradient(circle,rgba(124,92,255,.20),transparent 68%);pointer-events:none;z-index:-1;
  animation:rtxNoticeOrb 6.2s ease-in-out infinite reverse}
.rtx-notice-head{position:relative;display:flex;gap:16px;align-items:center;padding:24px 24px 20px;
  border-bottom:1px solid rgba(255,255,255,.075);
  background:radial-gradient(circle at 12% 20%,color-mix(in srgb,#05b84f 18%,transparent),transparent 28%),
    linear-gradient(135deg,rgba(255,255,255,.08),rgba(255,255,255,.015))}
.rtx-notice-badge{position:relative;width:62px;height:62px;flex:0 0 62px;border-radius:22px;
  display:grid;place-items:center;
  background:radial-gradient(circle at 30% 24%,rgba(255,255,255,.88),transparent 24%),
    linear-gradient(135deg,#08b84f 0%,#05b84f 55%,#008c38 100%);color:#17130a;
  box-shadow:0 18px 36px color-mix(in srgb,#05b84f 28%,transparent),inset 0 1px 0 rgba(255,255,255,.55),inset 0 -10px 18px rgba(78,43,5,.20);
  animation:rtxNoticeBadgeFloat 2.9s ease-in-out infinite}
.rtx-notice-badge::before{content:"";position:absolute;inset:-8px;border-radius:26px;
  border:1px solid color-mix(in srgb,#05b84f 35%,transparent);opacity:.72;animation:rtxNoticePulse 2.2s ease-in-out infinite}
.rtx-notice-badge span{font-size:28px;filter:drop-shadow(0 3px 8px rgba(0,0,0,.18))}
.rtx-notice-titlebox{display:flex;flex-direction:column;gap:4px;min-width:0}
.rtx-notice-kicker{color:color-mix(in srgb,#05b84f 88%,#fff 8%);font-size:11px;font-weight:950;letter-spacing:.12em;text-transform:uppercase}
.rtx-notice-heading{margin:0;font-size:clamp(22px,3vw,30px);line-height:1.15;letter-spacing:-.035em;font-weight:950;color:#eef6ff}
.rtx-notice-copy{margin:6px 0 0;color:color-mix(in srgb,#08b84f 88%,#eef6ff 12%);font-weight:750;line-height:1.45}
.rtx-notice-body{padding:20px 22px 6px}
.rtx-notice-list{display:grid;gap:12px}
.rtx-notice-item{display:grid;grid-template-columns:46px minmax(0,1fr);gap:13px;align-items:start;
  padding:14px;border-radius:20px;border:1px solid rgba(255,255,255,.075);
  background:linear-gradient(135deg,rgba(255,255,255,.055),rgba(255,255,255,.018));
  box-shadow:inset 0 1px 0 rgba(255,255,255,.055);
  transform:translateY(8px);opacity:0;animation:rtxNoticeItemIn .42s cubic-bezier(.2,.8,.2,1) forwards}
.rtx-notice-item:nth-child(2){animation-delay:.08s}.rtx-notice-item:nth-child(3){animation-delay:.16s}
.rtx-notice-item.warn{border-color:color-mix(in srgb,#05b84f 34%,rgba(255,255,255,.075));
  background:radial-gradient(circle at 8% 12%,color-mix(in srgb,#05b84f 16%,transparent),transparent 44%),
    linear-gradient(135deg,rgba(255,255,255,.058),rgba(255,255,255,.018))}
.rtx-notice-no{width:42px;height:42px;border-radius:16px;display:grid;place-items:center;
  color:#17130a;background:linear-gradient(135deg,#08b84f,#05b84f);font-size:13px;font-weight:950;
  box-shadow:0 12px 24px color-mix(in srgb,#05b84f 20%,transparent)}
.rtx-notice-item strong{display:block;color:#eef6ff;font-weight:950;margin:1px 0 4px}
.rtx-notice-item small{display:block;color:color-mix(in srgb,#08b84f 88%,transparent);line-height:1.55;font-weight:700}
.rtx-notice-warning{margin-top:14px;display:flex;align-items:flex-start;gap:10px;padding:13px 14px;border-radius:18px;
  border:1px solid color-mix(in srgb,#05b84f 24%,rgba(255,255,255,.08));background:color-mix(in srgb,#05b84f 8%,transparent)}
.rtx-notice-warning span{color:#05b84f;margin-top:1px;text-shadow:0 0 18px color-mix(in srgb,#05b84f 62%,transparent)}
.rtx-notice-warning p{margin:0;color:color-mix(in srgb,#08b84f 92%,#eef6ff 8%);line-height:1.55;font-weight:800}
.rtx-notice-actions{display:flex;justify-content:flex-end;padding:16px 22px 22px}
.rtx-notice-accept{position:relative;overflow:hidden;min-height:48px;border:0;border-radius:999px;
  padding:0 18px 0 22px;display:inline-flex;align-items:center;justify-content:center;gap:10px;
  cursor:pointer;color:#17130a;background:linear-gradient(135deg,#08b84f 0%,#05b84f 48%,#05b84f 100%);font-weight:950;
  box-shadow:0 18px 38px color-mix(in srgb,#05b84f 26%,transparent),inset 0 1px 0 rgba(255,255,255,.58);
  transition:transform .2s ease,filter .2s ease,box-shadow .2s ease}
.rtx-notice-accept:hover{transform:translateY(-2px);filter:saturate(1.08);
  box-shadow:0 23px 45px color-mix(in srgb,#05b84f 34%,transparent),inset 0 1px 0 rgba(255,255,255,.62)}
.rtx-notice-accept .shine{position:absolute;inset:-70% auto -70% -42%;width:42%;transform:rotate(18deg);
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.55),transparent);
  animation:rtxNoticeShine 3.6s ease-in-out infinite;pointer-events:none}
.rtx-notice-accept b{display:grid;place-items:center;width:22px;height:22px;border-radius:999px;background:rgba(0,0,0,.13);font-size:15px}

/* generic dialog */
.rtx-dialog-card{border:1px solid rgba(255,255,255,.11);border-radius:26px;
  background:linear-gradient(145deg,color-mix(in srgb,#17181d 94%,transparent),color-mix(in srgb,#101116 92%,transparent));
  box-shadow:0 40px 110px rgba(0,0,0,.5);overflow:hidden;width:min(480px,calc(100vw - 32px))}
.rtx-dialog-head{display:flex;gap:14px;align-items:center;padding:22px;
  border-bottom:1px solid rgba(255,255,255,.11);
  background:linear-gradient(135deg,color-mix(in srgb,#05b84f 15%,transparent),transparent)}
.rtx-dialog-badge{width:48px;height:48px;border-radius:16px;display:grid;place-items:center;
  background:linear-gradient(135deg,#08b84f,#05b84f);color:#17130a;font-weight:650;font-size:20px}
.rtx-dialog-card h3{margin:0;font-size:23px;font-weight:650;color:#eef6ff}
.rtx-dialog-card .dlg-sub{margin:3px 0 0;color:#08b84f;font-weight:750}
.rtx-dialog-body{padding:20px 22px;color:#eef6ff}
.rtx-dialog-actions{display:flex;justify-content:flex-end;gap:10px;padding:16px 22px;
  border-top:1px solid rgba(255,255,255,.11);background:rgba(0,0,0,.08)}
.rtx-mini{height:44px;padding:0 18px;border-radius:15px;border:1px solid rgba(255,255,255,.11);
  background:color-mix(in srgb,#17181d 72%,#08090b);color:#eef6ff;font-weight:650;cursor:pointer;font:inherit}
.rtx-mini.primary{border:0;background:linear-gradient(135deg,#08b84f,#05b84f);color:#17130a}
.rtx-mini.ghost{background:rgba(255,255,255,.06)}
.otp-input{width:100%;height:56px;padding:0 16px;text-align:center;letter-spacing:8px;font-size:26px;font-weight:650;
  border:1px solid rgba(255,255,255,.12);border-radius:18px;
  background:color-mix(in srgb,#17181d 72%,#08090b);color:#eef6ff;outline:none;font-family:inherit;
  transition:border-color .18s ease,box-shadow .18s ease}
.otp-input:focus{border-color:color-mix(in srgb,#05b84f 72%,transparent);
  box-shadow:0 0 0 4px color-mix(in srgb,#05b84f 14%,transparent)}
.rtx-otp-tools{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:10px;color:#08b84f;font-weight:550}
.rtx-link-btn{border:0;background:transparent;color:#05b84f;font-weight:650;cursor:pointer;font:inherit}
.rtx-link-btn:disabled{opacity:.45;cursor:not-allowed}

@keyframes rtxNoticeIn{from{opacity:0;transform:translateY(16px) scale(.955);filter:blur(8px)}to{opacity:1;transform:translateY(0) scale(1);filter:blur(0)}}
@keyframes rtxNoticeOut{from{opacity:1;transform:translateY(0) scale(1);filter:blur(0)}to{opacity:0;transform:translateY(10px) scale(.97);filter:blur(5px)}}
@keyframes rtxNoticeTopline{from{background-position:0 0}to{background-position:220% 0}}
@keyframes rtxNoticeOrb{0%,100%{transform:translate3d(0,0,0) scale(1);opacity:.85}50%{transform:translate3d(-12px,12px,0) scale(1.08);opacity:.55}}
@keyframes rtxNoticeBadgeFloat{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-4px) rotate(-1deg)}}
@keyframes rtxNoticePulse{0%,100%{transform:scale(.94);opacity:.35}50%{transform:scale(1.08);opacity:.86}}
@keyframes rtxNoticeItemIn{to{opacity:1;transform:translateY(0)}}
@keyframes rtxNoticeShine{0%,45%{left:-48%}72%,100%{left:122%}}

@media(prefers-reduced-motion:reduce){.rtx-auth *,.rg-overlay *{animation:none!important;transition:none!important}}
@media(max-width:980px){
  .rtx-auth-grid{grid-template-columns:1fr;align-items:start}
  .rtx-hero-panel{padding:28px}.rtx-benefits{grid-template-columns:1fr}
  .rtx-form-panel{max-width:620px;width:100%;margin:0 auto}
  .rtx-hero-panel h1{font-size:clamp(36px,9vw,56px)}}
@media(max-width:560px){
  .rtx-auth{padding:14px}.rtx-auth-grid{gap:14px;min-height:auto}
  .rtx-hero-panel,.rtx-form-panel{border-radius:24px}.rtx-hero-panel{padding:24px 18px}
  .rtx-hero-panel>p{font-size:15px}.rtx-benefits{margin-top:24px;gap:10px}
  .rtx-benefit{padding:14px;display:grid;grid-template-columns:42px 1fr;column-gap:12px;align-items:center}
  .rtx-benefit-icon{margin:0;width:40px;height:40px;grid-row:span 2}
  .rtx-form-panel{padding:22px 18px}.rtx-form-head{align-items:flex-start}
  .rtx-lock{width:48px;height:48px;border-radius:16px}
  .rtx-form-head h2{font-size:30px}
  .rtx-input-wrap{min-height:52px;grid-template-columns:48px minmax(0,1fr)}
  .rtx-password-wrap{grid-template-columns:48px minmax(0,1fr) 54px}
  .rtx-input{padding:0 12px}.rtx-pass{width:40px;height:40px;border-radius:14px}
  .rtx-submit{min-height:56px}.rtx-mini{flex:1}
  .rtx-form-foot{justify-content:center;text-align:center}}
@media(max-width:390px){
  .rtx-hero-panel h1{font-size:34px}.rtx-form-head h2{font-size:27px}
  .rtx-input-wrap{grid-template-columns:44px minmax(0,1fr)}
  .rtx-password-wrap{grid-template-columns:44px minmax(0,1fr) 50px}
  .rtx-input-icon{font-size:13px}.rtx-input{font-size:14px}
  .rtx-benefit{grid-template-columns:1fr}.rtx-benefit-icon{grid-row:auto;margin-bottom:10px}}
`;

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const affKey = searchParams.get('aff') || '';

  const [form, setForm] = useState({ username: '', email: '', name: '', password: '', affiliateKey: affKey });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [noticeClosing, setNoticeClosing] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpCodeVal, setOtpCodeVal] = useState('');
  const [otpTimerText, setOtpTimerText] = useState('ส่งใหม่ได้ใน 60s');
  const [otpResendReady, setOtpResendReady] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [otpHelpText, setOtpHelpText] = useState('เราได้ส่งรหัส 6 หลักไปที่อีเมลของคุณแล้ว');
  const [msgOpen, setMsgOpen] = useState(false);
  const [msgVariant, setMsgVariant] = useState('info');
  const [msgIcon, setMsgIcon] = useState('❔');
  const [msgTitle, setMsgTitle] = useState('');
  const [msgText, setMsgText] = useState('');
  const timerRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setNoticeOpen(true), 120);
    if (!affKey) {
      try {
        const m = document.cookie.match(/affiliate_ref=([^;]+)/);
        if (m) setForm(f => ({ ...f, affiliateKey: decodeURIComponent(m[1]) }));
      } catch {}
    }
    return () => clearTimeout(t);
  }, []);

  const showMsg = ({ variant = 'info', icon, title = '', text = '' }) => {
    const imap = { info: '❔', success: '✅', warn: '⚠️', error: '✖' };
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('rt:notify', { detail: { variant, title, text } }));
    }
    setMsgVariant(variant);
    setMsgIcon(icon || imap[variant] || '❔');
    setMsgTitle(title);
    setMsgText(text);
    setMsgOpen(true);
  };

  const closeNotice = () => {
    setNoticeClosing(true);
    setTimeout(() => { setNoticeOpen(false); setNoticeClosing(false); }, 190);
  };

  const startTimer = (sec) => {
    clearInterval(timerRef.current);
    let left = sec;
    setOtpTimerText(`ส่งใหม่ได้ใน ${left}s`);
    setOtpResendReady(false);
    timerRef.current = setInterval(() => {
      left--;
      if (left <= 0) { clearInterval(timerRef.current); setOtpTimerText('ส่งใหม่ได้ตอนนี้'); setOtpResendReady(true); }
      else setOtpTimerText(`ส่งใหม่ได้ใน ${left}s`);
    }, 1000);
  };

  const openOtp = (email, cooldown = 60) => {
    setPendingEmail(email);
    setOtpHelpText(`เราได้ส่งรหัส 6 หลักไปที่ ${email}`);
    setOtpCodeVal('');
    startTimer(cooldown);
    setOtpOpen(true);
  };

  const closeOtp = () => { clearInterval(timerRef.current); setOtpOpen(false); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const r = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: form.username, email: form.email, name: form.name, password: form.password, affiliateKey: form.affiliateKey, aff: form.affiliateKey }),
      });
      const d = await r.json();
      if (!d.ok) { setError(d.message || 'สมัครสมาชิกไม่สำเร็จ'); return; }
      if (d.needOtp) { openOtp(form.email, 60); return; }
      showMsg({ variant: 'success', title: 'ส่งอีเมลยืนยันแล้ว', text: 'โปรดตรวจกล่องจดหมายของคุณ แล้วคลิกลิงก์เพื่อเปิดใช้งานบัญชี' });
    } catch { setError('เกิดข้อผิดพลาด กรุณาลองใหม่'); }
    finally { setLoading(false); }
  };

  const handleVerifyOtp = async () => {
    if (!/^\d{6}$/.test(otpCodeVal.trim())) {
      showMsg({ variant: 'warn', title: 'รหัสไม่ครบ', text: 'กรอกรหัส OTP 6 หลักให้ถูกต้อง' }); return;
    }
    try {
      const vr = await (await fetch('/api/auth/otp/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingEmail, code: otpCodeVal.trim() }),
      })).json().catch(() => ({}));
      if (!vr?.ok) { showMsg({ variant: 'error', title: 'ยืนยันไม่สำเร็จ', text: vr?.error || 'รหัสไม่ถูกต้อง' }); return; }
      closeOtp();
      showMsg({ variant: 'success', title: 'สมัครสำเร็จ!', text: 'กำลังพาไปหน้าหลัก...' });
      setTimeout(() => router.push('/dashboard'), 800);
    } catch { showMsg({ variant: 'error', title: 'เครือข่ายมีปัญหา', text: 'โปรดลองใหม่อีกครั้ง' }); }
  };

  const handleResendOtp = async () => {
    setOtpResendReady(false);
    try {
      const d = await (await fetch('/api/auth/otp/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingEmail }),
      })).json().catch(() => ({}));
      if (!d?.ok) { showMsg({ variant: 'error', title: 'ส่งรหัสไม่สำเร็จ', text: d?.error || 'โปรดลองใหม่' }); setOtpResendReady(true); return; }
      startTimer(60);
    } catch { showMsg({ variant: 'error', title: 'ส่งรหัสไม่สำเร็จ', text: 'โปรดลองใหม่' }); setOtpResendReady(true); }
  };

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <section className="rtx-auth rtx-register">
        <div className="rtx-bg" aria-hidden="true">
          <span className="orb orb-a" />
          <span className="orb orb-b" />
          <span className="orb orb-c" />
        </div>

        <div className="rtx-auth-grid">
          <aside className="rtx-hero-panel">
            <div className="rtx-kicker"><span>✦</span> RTAUTOBOT REGISTER MEMBER</div>
            <h1>สมัครสมาชิกเพื่อเริ่มใช้ Bonustime Automation</h1>
            <p>เปิดบัญชีเดียวเพื่อสั่งซื้อบริการ เพิ่มผู้ติดตาม ไลค์ วิว เอนเกจเมนต์ เติมเครดิต และติดตามงานทั้งหมดได้แบบปลอดภัย</p>

            <div className="rtx-benefits">
              <div className="rtx-benefit">
                <span className="rtx-benefit-icon">⚡</span>
                <strong>เริ่มใช้งานไว</strong>
                <small>สมัครง่ายไม่กี่ขั้นตอน พร้อมใช้งานได้ทันทีทุกเวลา</small>
              </div>
              <div className="rtx-benefit">
                <span className="rtx-benefit-icon">🛡️</span>
                <strong>ปลอดภัยกว่า</strong>
                <small>ยืนยันอีเมล รองรับระบบ OTP และ Session</small>
              </div>
              <div className="rtx-benefit">
                <span className="rtx-benefit-icon">📈</span>
                <strong>ครบในที่เดียว</strong>
                <small>เติมเครดิตออโต้ สั่งออเดอร์ รายงานสถานะ และบริการหลากหลายแพลตฟอร์ม</small>
              </div>
            </div>

            <div className="rtx-meta">
              <span>All Right Reserved</span><i /><span>© 2026</span><i /><span>RTAUTOBOT</span>
            </div>
          </aside>

          <main className="rtx-form-panel">
            <div className="rtx-form-head">
              <span className="rtx-lock">✨</span>
              <div>
                <h2>สร้างบัญชีใหม่</h2>
                <p>กรอกข้อมูลให้ครบ เพื่อเปิดใช้งานบัญชี RTAUTOBOT</p>
              </div>
            </div>

            {error && <div className="rtx-alert error">{error}</div>}

            <form className="rtx-form" onSubmit={handleSubmit} noValidate>
              <label className="rtx-field">
                <span className="rtx-label">ชื่อผู้ใช้</span>
                <div className="rtx-input-wrap">
                  <span className="rtx-input-icon">👤</span>
                  <input className="rtx-input" name="username" required autoComplete="username" placeholder="เช่น rtssm-th" value={form.username} onChange={set('username')} />
                </div>
                <small>ใช้อักษร a–z, 0–9 และขีดกลางได้</small>
              </label>

              <label className="rtx-field">
                <span className="rtx-label">อีเมล</span>
                <div className="rtx-input-wrap">
                  <span className="rtx-input-icon">✉️</span>
                  <input className="rtx-input" type="email" name="email" required placeholder="you@email.com" autoComplete="email" value={form.email} onChange={set('email')} />
                </div>
                <small>ใช้สำหรับยืนยันตัวตนและกู้รหัสผ่าน</small>
              </label>

              <label className="rtx-field">
                <span className="rtx-label">ชื่อ–นามสกุล</span>
                <div className="rtx-input-wrap">
                  <span className="rtx-input-icon">🪪</span>
                  <input className="rtx-input" name="name" required autoComplete="name" placeholder="ชื่อจริง นามสกุล" value={form.name} onChange={set('name')} />
                </div>
                <small>แนะนำให้ใช้ชื่อจริงเพื่อความปลอดภัยของบัญชี</small>
              </label>

              <label className="rtx-field">
                <span className="rtx-label">รหัสผ่าน</span>
                <div className="rtx-input-wrap rtx-password-wrap">
                  <span className="rtx-input-icon">••</span>
                  <input
                    className="rtx-input"
                    type={showPass ? 'text' : 'password'}
                    name="password"
                    required
                    autoComplete="new-password"
                    minLength={6}
                    placeholder="อย่างน้อย 6 ตัวอักษร"
                    value={form.password}
                    onChange={set('password')}
                  />
                  <button
                    type="button"
                    className={`rtx-pass${showPass ? ' is-visible' : ''}`}
                    onClick={() => setShowPass(v => !v)}
                    aria-pressed={showPass}
                    aria-label="แสดงหรือซ่อนรหัสผ่าน"
                  >
                    <svg className="eye eye-open" viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">
                      <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="12" cy="12" r="2.7" fill="none" stroke="currentColor" strokeWidth="1.9"/>
                    </svg>
                    <svg className="eye eye-off" viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">
                      <path d="M3 3l18 18" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round"/>
                      <path d="M10.6 5.7A9.9 9.9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a18 18 0 0 1-2.3 3.2M6.7 6.9C4 8.7 2.5 12 2.5 12s3.5 6.5 9.5 6.5c1.8 0 3.4-.6 4.7-1.4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
                <small>ตั้งรหัสอย่างน้อย 6 ตัวอักษร ยิ่งยาวยิ่งปลอดภัย</small>
              </label>

              <button className="rtx-submit" type="submit" disabled={loading}>
                <span>{loading ? 'กำลังสมัคร...' : 'สมัครสมาชิก'}</span>
                {!loading && <b>→</b>}
              </button>

              <div className="rtx-form-foot">
                <span>มีบัญชีอยู่แล้ว?</span>
                <Link href="/login">เข้าสู่ระบบ</Link>
              </div>
            </form>
          </main>
        </div>
      </section>

      {/* Notice modal */}
      {noticeOpen && (
        <div className="rg-overlay" onClick={(e) => e.target === e.currentTarget && closeNotice()}>
          <div className={`rtx-notice-card${noticeClosing ? ' is-closing' : ''}`}>
            <div className="rtx-notice-aura" aria-hidden="true" />
            <div className="rtx-notice-head">
              <span className="rtx-notice-badge" aria-hidden="true">
                <span>⚠️</span>
              </span>
              <span className="rtx-notice-titlebox">
                <span className="rtx-notice-kicker">REGISTER SECURITY NOTICE</span>
                <span className="rtx-notice-heading">แจ้งเตือนก่อนสมัคร</span>
                <span className="rtx-notice-copy">โปรดตรวจสอบข้อมูลให้ถูกต้องก่อนสร้างบัญชี</span>
              </span>
            </div>
            <div className="rtx-notice-body">
              <div className="rtx-notice-list">
                <div className="rtx-notice-item">
                  <span className="rtx-notice-no">01</span>
                  <div>
                    <strong>ใช้ข้อมูลจริงตามกฎหมาย</strong>
                    <small>ข้อมูลบัญชีควรตรงกับตัวตนจริง เพื่อความปลอดภัยและการตรวจสอบในอนาคต</small>
                  </div>
                </div>
                <div className="rtx-notice-item">
                  <span className="rtx-notice-no">02</span>
                  <div>
                    <strong>อีเมลต้องยืนยันได้จริง</strong>
                    <small>ระบบจะใช้สำหรับ OTP, แจ้งเตือน, กู้รหัสผ่าน และความปลอดภัยของบัญชี</small>
                  </div>
                </div>
                <div className="rtx-notice-item warn">
                  <span className="rtx-notice-no">03</span>
                  <div>
                    <strong>ชื่อ–นามสกุลควรตรงกับเอกสารจริง</strong>
                    <small>กรอกข้อมูลให้ครบและถูกต้อง เพราะมีผลต่อความปลอดภัยของบัญชี</small>
                  </div>
                </div>
              </div>
              <div className="rtx-notice-warning">
                <span>✦</span>
                <p>Notice นี้จะแสดงทุกครั้งที่เข้าหน้าสมัคร เพื่อให้ผู้ใช้ตรวจสอบข้อมูลก่อนสมัครสมาชิกเสมอ</p>
              </div>
            </div>
            <div className="rtx-notice-actions">
              <button className="rtx-notice-accept" type="button" onClick={closeNotice}>
                <span className="shine" aria-hidden="true" />
                <span>ปิดและยอมรับ</span>
                <b>→</b>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OTP dialog */}
      {otpOpen && (
        <div className="rg-overlay">
          <div className="rtx-dialog-card">
            <div className="rtx-dialog-head">
              <div className="rtx-dialog-badge">🔐</div>
              <div>
                <h3>ยืนยันอีเมล</h3>
                <p className="dlg-sub">{otpHelpText}</p>
              </div>
            </div>
            <div className="rtx-dialog-body">
              <label className="rtx-field" style={{ gap: 8 }}>
                <span className="rtx-label">รหัส OTP</span>
                <input
                  className="otp-input"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="______"
                  value={otpCodeVal}
                  onChange={(e) => setOtpCodeVal(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()}
                  autoFocus
                />
              </label>
              <div className="rtx-otp-tools">
                <span>{otpTimerText}</span>
                <button className="rtx-link-btn" disabled={!otpResendReady} type="button" onClick={handleResendOtp}>ส่งใหม่</button>
              </div>
            </div>
            <div className="rtx-dialog-actions">
              <button className="rtx-mini ghost" type="button" onClick={closeOtp}>ยกเลิก</button>
              <button className="rtx-mini primary" type="button" onClick={handleVerifyOtp}>ยืนยัน</button>
            </div>
          </div>
        </div>
      )}

      {/* Message dialog */}
      {msgOpen && (
        <div className="rg-overlay" onClick={(e) => e.target === e.currentTarget && setMsgOpen(false)}>
          <div className={`rtx-dialog-card msg-${msgVariant}`}>
            <div className="rtx-dialog-head">
              <div className="rtx-dialog-badge">{msgIcon}</div>
              <div>
                <h3>{msgTitle}</h3>
                <p className="dlg-sub">RTAUTOBOT Notification</p>
              </div>
            </div>
            <div className="rtx-dialog-body">
              <p style={{ margin: 0 }}>{msgText}</p>
            </div>
            <div className="rtx-dialog-actions">
              <button className="rtx-mini primary" type="button" onClick={() => setMsgOpen(false)}>ตกลง</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
