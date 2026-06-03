'use client';
import { useEffect } from 'react';

const CSS = `
  :root {
    --rt-page: #07080b;
    --rt-card: #17181d;
    --rt-card-2: color-mix(in srgb, #17181d 72%, #0a0b10);
    --rt-soft: color-mix(in srgb, #17181d 84%, #ffffff 4%);
    --rt-text: #e8fff1;
    --rt-muted: #08b84f;
    --rt-border: rgba(255,255,255,.12);
    --rt-accent: #08b84f;
    --rt-accent-2: #05b84f;
    --rt-green: #33e889;
    --rt-blue: #4eb7ff;
    --rt-red: #ff6b7e;
    --rt-shadow: rgba(0,0,0,.48);
    --rt-radius-xl: 34px;
    --rt-radius-lg: 26px;
    --rt-radius-md: 18px;
    color-scheme: dark;
  }
  * { box-sizing: border-box; }
  a { color: inherit; text-decoration: none; }
  img { max-width: 100%; display: block; }
  .rt-wrap { width: min(1480px, calc(100% - 32px)); margin: 0 auto; }

  /* Hide layout nav/sidebar when rt-landing-nav is present */
  body:has(.rt-landing-nav) .topbar,
  body:has(.rt-landing-nav) header.topbar,
  body:has(.rt-landing-nav) .rt-topbar,
  body:has(.rt-landing-nav) .m-topbar,
  body:has(.rt-landing-nav) .m-subnav,
  body:has(.rt-landing-nav) .sidebar,
  body:has(.rt-landing-nav) .sb-backdrop,
  body:has(.rt-landing-nav) [class*="topbar"],
  body.rt-home-clean-layout .topbar,
  body.rt-home-clean-layout [class*="topbar"],
  body.rt-home-clean-layout .sidebar,
  body.rt-home-clean-layout .m-topbar,
  body.rt-home-clean-layout .m-subnav {
    display: none !important;
    visibility: hidden !important;
    opacity: 0 !important;
    pointer-events: none !important;
    width: 0 !important;
    height: 0 !important;
    overflow: hidden !important;
  }
  body:has(.rt-landing-nav) main,
  body.rt-home-clean-layout main {
    padding-top: 0 !important;
  }
  body:has(.rt-landing-nav),
  body.rt-home-clean-layout {
    margin: 0 !important;
    padding: 0 !important;
    overflow-x: hidden !important;
  }

  /* Landing Nav */
  .rt-landing-nav {
    position: fixed;
    top: 0; left: 0; right: 0;
    z-index: 5000;
    width: 100vw;
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    background: color-mix(in srgb, var(--rt-page) 80%, transparent);
    border-bottom: 1px solid var(--rt-border);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.035);
  }
  .rt-nav-inner {
    height: 78px;
    display: grid;
    grid-template-columns: minmax(250px,1fr) auto minmax(250px,1fr);
    align-items: center;
    column-gap: clamp(18px,3vw,54px);
    padding-inline: clamp(16px,3.4vw,64px);
  }
  .rt-brand { display: flex; align-items: center; gap: 12px; font-weight: 900; letter-spacing: .02em; justify-self: start; color: var(--rt-text); }
  .rt-brand-mark { width: 36px; height: 36px; border-radius: 16px; display: grid; place-items: center; background: linear-gradient(135deg,#08b84f,#05b84f); color: #17130a; box-shadow: 0 18px 44px color-mix(in srgb,var(--rt-accent) 26%,transparent); font-size: 18px; font-weight: 900; flex: 0 0 auto; }
  .rt-brand small { display: block; color: var(--rt-muted); font-size: 12px; font-weight: 700; margin-top: 2px; }
  .rt-nav-links { display: flex; align-items: center; gap: 8px; color: var(--rt-muted); font-weight: 800; font-size: 14px; justify-self: center; }
  .rt-nav-links a { padding: 10px 13px; border-radius: 999px; transition: .2s ease; }
  .rt-nav-links a:hover { background: var(--rt-soft); color: var(--rt-text); transform: translateY(-1px); }
  .rt-btn { border: 0; border-radius: 18px; padding: 14px 20px; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; gap: 10px; cursor: pointer; transition: transform .2s ease, filter .2s ease; font-family: inherit; font-size: 14px; }
  .rt-btn:hover { transform: translateY(-2px); filter: saturate(1.05); }
  .rt-btn-primary { background: linear-gradient(135deg,#21b95c,#08b84f 55%,#05b84f); color: #17130a; box-shadow: 0 18px 44px color-mix(in srgb,var(--rt-accent) 26%,transparent); justify-self: end; }
  .rt-btn-ghost { background: color-mix(in srgb,var(--rt-card) 70%,transparent); border: 1px solid var(--rt-border); color: var(--rt-text); }

  /* Main */
  .rt-home-main { padding-top: 78px; }

  /* Hero */
  .rt-hero { position: relative; padding: 46px 0 34px; }
  .rt-panel { position: relative; overflow: hidden; border: 1px solid var(--rt-border); border-radius: var(--rt-radius-xl); background: linear-gradient(145deg,color-mix(in srgb,var(--rt-card) 92%,transparent),color-mix(in srgb,var(--rt-card-2) 90%,transparent)); box-shadow: 0 28px 80px var(--rt-shadow), inset 0 1px 0 rgba(255,255,255,.06); }
  .rt-panel::before { content: ""; position: absolute; inset: -2px; background: radial-gradient(circle at 18% 10%,color-mix(in srgb,var(--rt-accent) 22%,transparent),transparent 34%),radial-gradient(circle at 86% 18%,rgba(80,120,255,.12),transparent 32%); pointer-events: none; }
  .rt-panel > * { position: relative; z-index: 1; }
  .rt-hero-main { padding: 34px; min-height: auto; display: flex; flex-direction: column; justify-content: space-between; }
  .rt-hero-shell { display: grid; grid-template-columns: minmax(0,1fr) minmax(360px,.9fr); gap: 24px; align-items: stretch; }
  .rt-hero-copy { display: flex; flex-direction: column; justify-content: center; }
  .rt-kicker { display: inline-flex; align-items: center; gap: 8px; width: max-content; padding: 9px 14px; border-radius: 999px; border: 1px solid color-mix(in srgb,var(--rt-accent) 46%,var(--rt-border)); background: color-mix(in srgb,var(--rt-accent) 10%,transparent); color: var(--rt-accent); font-size: 13px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; margin-bottom: 10px; }
  .rt-hero h1 { font-size: clamp(42px,5.6vw,96px); line-height: .96; margin: 24px 0 18px; letter-spacing: -.06em; color: var(--rt-text); }
  .rt-hero h1 span { background: linear-gradient(135deg,#eef6ff,#08b84f 45%,#05b84f); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .rt-lead { max-width: 100%; color: var(--rt-muted); font-size: clamp(16px,1.1vw,19px); line-height: 1.9; font-weight: 700; margin: 0 0 0; }
  .rt-bullets { display: grid; gap: 8px; margin: 24px 0 0; padding: 0; list-style: none; }
  .rt-bullets li { display: flex; align-items: flex-start; gap: 10px; color: var(--rt-muted); font-weight: 700; line-height: 1.65; font-size: 15px; }
  .rt-bullets li .chk { color: var(--rt-accent); font-size: 15px; flex: 0 0 auto; margin-top: 2px; }
  .rt-hero-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 34px; }
  .rt-trust { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 12px; margin-top: 34px; }
  .rt-mini { padding: 18px; border: 1px solid var(--rt-border); border-radius: 22px; background: color-mix(in srgb,var(--rt-soft) 66%,transparent); }
  .rt-mini strong { display: block; font-size: 26px; color: var(--rt-accent); line-height: 1; }
  .rt-mini span { display: block; color: var(--rt-muted); font-weight: 800; margin-top: 8px; font-size: 13px; }

  /* Hero Art */
  .rt-hero-art { position: relative; overflow: hidden; min-height: 420px; border-radius: 30px; border: 1px solid color-mix(in srgb,var(--rt-accent) 20%,var(--rt-border)); background: radial-gradient(circle at 16% 12%,rgba(124,255,178,.16),transparent 22%), radial-gradient(circle at 84% 18%,rgba(78,183,255,.12),transparent 24%), radial-gradient(circle at 70% 82%,rgba(124,255,178,.08),transparent 24%), linear-gradient(145deg,rgba(10,11,16,.96),rgba(19,21,30,.94)); box-shadow: inset 0 1px 0 rgba(255,255,255,.05), 0 26px 72px rgba(0,0,0,.38); isolation: isolate; }
  .rt-hero-art::before { content: ""; position: absolute; inset: 0; background: radial-gradient(circle at 70% 50%,rgba(124,255,178,.08),transparent 28%),linear-gradient(120deg,transparent 45%,rgba(255,255,255,.03) 52%,transparent 58%); pointer-events: none; }
  .rt-hero-art::after { content: ""; position: absolute; inset: 0; background: radial-gradient(circle at 76% 56%,rgba(124,255,178,.12),transparent 34%),radial-gradient(circle at 28% 26%,rgba(255,255,255,.05),transparent 18%); pointer-events: none; filter: blur(2px); }
  .rt-showcase-stars { position: absolute; inset: 0; pointer-events: none; opacity: .9; background-image: radial-gradient(circle at 20% 20%,rgba(124,255,178,.95) 0 1.5px,transparent 2px),radial-gradient(circle at 72% 28%,rgba(124,255,178,.88) 0 1.8px,transparent 2.6px),radial-gradient(circle at 64% 72%,rgba(124,255,178,.84) 0 1.6px,transparent 2.2px),radial-gradient(circle at 88% 48%,rgba(124,255,178,.88) 0 1.8px,transparent 2.6px),radial-gradient(circle at 54% 14%,rgba(124,255,178,.7) 0 1.2px,transparent 2px),radial-gradient(circle at 38% 84%,rgba(124,255,178,.72) 0 1.2px,transparent 2px),radial-gradient(circle at 82% 88%,rgba(124,255,178,.72) 0 1.2px,transparent 2px); }
  .rt-art-orbit { position: absolute; border: 1px solid rgba(124,255,178,.20); border-radius: 999px; pointer-events: none; }
  .rt-art-orbit.one { width: 310px; height: 310px; right: 26px; top: 60px; }
  .rt-art-orbit.two { width: 240px; height: 240px; right: 60px; top: 95px; opacity: .7; }
  .rt-art-orbit.three { width: 410px; height: 410px; right: -40px; bottom: -70px; opacity: .3; }
  .rt-art-phone { position: relative; z-index: 2; width: min(84%,320px); aspect-ratio: 0.62; border-radius: 34px; padding: 14px; background: linear-gradient(160deg,#15181f,#06080f 70%); border: 1px solid rgba(124,255,178,.28); box-shadow: 0 34px 74px rgba(0,0,0,.45),0 0 0 1px rgba(255,255,255,.03) inset; transform: rotate(13deg); margin: 86px 70px 70px auto; }
  .rt-art-phone::before { content: ""; position: absolute; inset: 10px; border-radius: 28px; border: 1px solid rgba(255,255,255,.04); pointer-events: none; }
  .rt-art-phone::after { content: ""; position: absolute; top: 24px; left: 50%; transform: translateX(-50%); width: 86px; height: 16px; border-radius: 999px; background: #0a0d13; box-shadow: 0 0 0 1px rgba(255,255,255,.03) inset; }
  .rt-phone-screen { position: relative; height: 100%; border-radius: 24px; background: linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,0)),radial-gradient(circle at 70% 0%,rgba(124,255,178,.12),transparent 26%),linear-gradient(180deg,rgba(5,8,14,.95),rgba(12,14,22,.96)); padding: 34px 18px 18px; overflow: hidden; }
  .rt-screen-title { font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #21b95c; opacity: .9; }
  .rt-screen-sub { margin-top: 6px; font-size: 13px; color: #08b84f; font-weight: 700; }
  .rt-chart-bars { height: 138px; display: flex; align-items: flex-end; gap: 10px; margin: 34px 8px 16px; }
  .rt-chart-bars span { flex: 1; border-radius: 10px 10px 4px 4px; background: linear-gradient(180deg,#05b84f,#008c38); box-shadow: 0 14px 22px rgba(124,255,178,.16); }
  .rt-chart-bars span:nth-child(1) { height: 44px; }
  .rt-chart-bars span:nth-child(2) { height: 72px; }
  .rt-chart-bars span:nth-child(3) { height: 96px; }
  .rt-chart-bars span:nth-child(4) { height: 126px; }
  .rt-chart-line { position: absolute; left: 26px; right: 26px; top: 120px; height: 90px; pointer-events: none; }
  .rt-chart-line svg { width: 100%; height: 100%; overflow: visible; filter: drop-shadow(0 6px 16px rgba(124,255,178,.35)); }
  .rt-phone-pills { display: grid; gap: 8px; margin-top: 10px; }
  .rt-phone-pills span { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-radius: 14px; background: rgba(255,255,255,.04); border: 1px solid rgba(124,255,178,.12); font-size: 12px; color: #21b95c; font-weight: 800; }
  .rt-verified-pill { margin-top: 18px; display: inline-flex; align-items: center; gap: 10px; padding: 11px 14px; border-radius: 999px; border: 1px solid rgba(124,255,178,.26); background: rgba(124,255,178,.10); font-weight: 900; color: #08b84f; }
  .rt-float-icon { position: absolute; z-index: 3; width: 62px; height: 62px; border-radius: 50%; display: grid; place-items: center; background: linear-gradient(160deg,rgba(40,43,53,.98),rgba(10,12,17,.96)); border: 1px solid rgba(124,255,178,.24); box-shadow: 0 14px 34px rgba(0,0,0,.34); color: #08b84f; font-size: 24px; }
  .rt-float-icon.small { width: 56px; height: 56px; font-size: 20px; }
  .rt-float-icon.hero-a { right: 174px; top: 88px; }
  .rt-float-icon.hero-b { right: 48px; top: 108px; }
  .rt-float-icon.hero-c { right: 248px; top: 224px; }
  .rt-float-icon.hero-d { right: 22px; top: 264px; }
  .rt-float-icon.hero-e { right: 96px; bottom: 104px; }
  .rt-float-icon.hero-f { right: 202px; top: 42px; font-size: 14px; font-weight: 900; width: 52px; height: 52px; }

  /* Platforms */
  .rt-platforms { padding: 18px 0 34px; }
  .rt-section-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; margin: 0 0 18px; }
  .rt-section-head h2 { font-size: clamp(28px,3vw,48px); margin: 0; letter-spacing: -.04em; color: var(--rt-text); }
  .rt-section-head p { margin: 8px 0 0; color: var(--rt-muted); font-weight: 700; max-width: 760px; line-height: 1.7; }
  .rt-link { color: var(--rt-accent); font-weight: 700; display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
  .rt-platform-grid { display: grid; grid-template-columns: repeat(6,minmax(0,1fr)); gap: 12px; }
  .rt-platform { min-height: 106px; padding: 16px; border-radius: 24px; border: 1px solid var(--rt-border); background: linear-gradient(180deg,color-mix(in srgb,var(--rt-card) 90%,transparent),color-mix(in srgb,var(--rt-soft) 62%,transparent)); box-shadow: 0 18px 46px color-mix(in srgb,var(--rt-shadow) 42%,transparent); display: flex; flex-direction: column; justify-content: space-between; transition: .22s ease; opacity: 0; transform: translateY(16px); }
  .rt-platform.show { opacity: 1; transform: translateY(0); }
  .rt-platform:hover { transform: translateY(-5px); border-color: color-mix(in srgb,var(--rt-accent) 44%,var(--rt-border)); }
  .rt-platform .ico { font-size: 24px; margin-bottom: 8px; }
  .rt-platform strong { display: block; font-size: 15px; color: var(--rt-text); }
  .rt-platform span { font-size: 12px; color: var(--rt-muted); font-weight: 800; }

  /* Service Showcase */
  .rt-service-showcase { padding: 18px 0 42px; position: relative; }
  .rt-service-showcase .rt-section-head { margin-bottom: 20px; }
  .rt-service-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 18px; align-items: stretch; }
  .rt-service-grid.single { grid-template-columns: 1fr; }
  .rt-service-card { position: relative; overflow: hidden; border: 1px solid color-mix(in srgb,var(--rt-accent) 22%,var(--rt-border)); border-radius: 34px; background: linear-gradient(145deg,color-mix(in srgb,var(--rt-card) 94%,transparent),color-mix(in srgb,var(--rt-card-2) 92%,transparent)); box-shadow: 0 24px 72px color-mix(in srgb,var(--rt-shadow) 86%,transparent),inset 0 1px 0 rgba(255,255,255,.06); display: flex; flex-direction: column; justify-content: space-between; isolation: isolate; }
  .rt-service-card::before { content: ""; position: absolute; inset: -2px; background: radial-gradient(circle at 14% 10%,color-mix(in srgb,var(--rt-accent) 24%,transparent),transparent 35%),radial-gradient(circle at 92% 2%,rgba(255,255,255,.08),transparent 28%),linear-gradient(135deg,transparent 10%,rgba(255,255,255,.035),transparent 54%); pointer-events: none; z-index: -1; }
  .rt-service-card.apps { --svc-glow: #08b84f; }
  .rt-service-card.full { padding: 0; min-height: auto; }
  .rt-service-shell { display: grid; grid-template-columns: minmax(0,1.03fr) minmax(320px,.9fr); gap: 24px; align-items: stretch; padding: 30px; }
  .rt-service-copy { display: flex; flex-direction: column; justify-content: space-between; min-width: 0; }
  .rt-service-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 22px; }
  .rt-service-badge { width: 64px; height: 64px; border-radius: 22px; display: grid; place-items: center; font-size: 28px; background: linear-gradient(135deg,#21b95c,#08b84f 55%,#05b84f); color: #17130a; box-shadow: 0 18px 44px color-mix(in srgb,var(--rt-accent) 28%,transparent); }
  .rt-service-status { display: inline-flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: 999px; border: 1px solid color-mix(in srgb,var(--rt-accent) 40%,var(--rt-border)); background: color-mix(in srgb,var(--rt-accent) 11%,transparent); color: color-mix(in srgb,var(--rt-accent) 86%,#fff); font-size: 12px; font-weight: 900; letter-spacing: .04em; text-transform: uppercase; white-space: nowrap; }
  .rt-service-status .dot { width: 8px; height: 8px; border-radius: 999px; background: var(--rt-green); box-shadow: 0 0 0 7px rgba(51,232,137,.12); flex: 0 0 auto; }
  .rt-service-card h3 { font-size: clamp(34px,3.2vw,54px); line-height: 1.04; letter-spacing: -.045em; margin: 0 0 12px; color: var(--rt-text); }
  .rt-service-card h3 span { background: linear-gradient(135deg,#eef6ff,#08b84f 52%,#05b84f); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .rt-service-lead { margin: 0; color: var(--rt-muted); font-weight: 700; line-height: 1.8; font-size: 16px; }
  .rt-tag-row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 18px; }
  .rt-tag { display: inline-flex; align-items: center; gap: 8px; padding: 11px 14px; border-radius: 16px; border: 1px solid rgba(24,201,100,.14); background: rgba(255,255,255,.03); font-size: 14px; font-weight: 800; color: #08b84f; }
  .rt-service-points { display: grid; gap: 10px; margin: 24px 0; }
  .rt-service-point { display: grid; grid-template-columns: 42px 1fr; gap: 12px; align-items: start; padding: 14px; border: 1px solid var(--rt-border); border-radius: 20px; background: color-mix(in srgb,var(--rt-soft) 64%,transparent); transition: .22s ease; }
  .rt-service-point:hover { transform: translateY(-2px); border-color: color-mix(in srgb,var(--rt-accent) 48%,var(--rt-border)); }
  .rt-service-point .n { width: 42px; height: 42px; border-radius: 16px; display: grid; place-items: center; font-weight: 900; font-size: 14px; color: #17130a; background: linear-gradient(135deg,#21b95c,#08b84f 55%,#05b84f); }
  .rt-service-point b { display: block; font-size: 15px; color: var(--rt-text); margin-bottom: 3px; }
  .rt-service-point small { display: block; color: var(--rt-muted); font-weight: 700; line-height: 1.65; }
  .rt-service-metrics { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 10px; margin: 22px 0; }
  .rt-service-metrics div { border: 1px solid var(--rt-border); border-radius: 18px; background: color-mix(in srgb,var(--rt-card) 74%,transparent); padding: 14px; }
  .rt-service-metrics strong { display: block; color: color-mix(in srgb,var(--rt-accent) 86%,#fff); font-size: 21px; line-height: 1; }
  .rt-service-metrics span { display: block; color: var(--rt-muted); font-size: 12px; font-weight: 800; margin-top: 7px; line-height: 1.35; }
  .rt-service-actions { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 18px; }
  .rt-service-actions .rt-btn { flex: 1 1 190px; }
  .rt-service-note { margin-top: 14px; padding: 13px 14px; border-radius: 18px; border: 1px dashed color-mix(in srgb,var(--rt-accent) 36%,var(--rt-border)); color: var(--rt-muted); font-size: 13px; font-weight: 700; line-height: 1.65; background: color-mix(in srgb,var(--rt-accent) 7%,transparent); }

  /* Service Art (Apps style) */
  .rt-service-art.apps { border-color: rgba(124,255,178,.24); background: radial-gradient(circle at 18% 12%,rgba(124,255,178,.16),transparent 24%),radial-gradient(circle at 76% 18%,rgba(80,160,255,.12),transparent 25%),radial-gradient(circle at 58% 84%,rgba(51,232,137,.08),transparent 25%),linear-gradient(145deg,rgba(10,11,16,.96),rgba(18,20,28,.94)); min-height: 520px; border-radius: 30px; border: 1px solid rgba(124,255,178,.24); position: relative; overflow: hidden; }
  .rt-app-visual { position: relative; z-index: 2; width: min(100%,560px); height: min(92%,520px); min-height: 500px; margin: auto; display: grid; place-items: center; isolation: isolate; }
  .rt-app-visual::before { content: ""; position: absolute; width: 420px; height: 420px; border-radius: 50%; left: 50%; top: 50%; transform: translate(-50%,-50%); background: radial-gradient(circle,rgba(124,255,178,.13),transparent 66%); filter: blur(4px); pointer-events: none; z-index: -1; }
  .rt-app-ring { position: absolute; inset: 42px; border-radius: 50%; border: 1px solid rgba(124,255,178,.20); animation: rtOrbitSpin 24s linear infinite; opacity: .82; }
  .rt-app-ring.two { inset: 92px; animation-duration: 18s; animation-direction: reverse; opacity: .58; }
  .rt-app-phone { position: relative; width: min(62%,292px); aspect-ratio: .62; border-radius: 34px; padding: 14px; background: linear-gradient(155deg,#171a22,#06080e 72%); border: 1px solid rgba(24,201,100,.22); box-shadow: 0 42px 92px rgba(0,0,0,.62),0 0 0 1px rgba(255,255,255,.04) inset; transform: rotate(-8deg) translateY(10px); animation: rtAppPhoneFloat 7s ease-in-out infinite; }
  .rt-app-phone::after { content: ""; position: absolute; top: 25px; left: 50%; width: 82px; height: 15px; border-radius: 999px; transform: translateX(-50%); background: #090b11; }
  .rt-app-screen { height: 100%; border-radius: 25px; overflow: hidden; padding: 42px 18px 18px; background: radial-gradient(circle at 78% 0%,rgba(124,255,178,.14),transparent 30%),linear-gradient(180deg,rgba(7,10,16,.98),rgba(13,15,24,.96)); box-shadow: inset 0 0 0 1px rgba(124,255,178,.12); }
  .rt-app-screen-title { font-size: 12px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; color: #21b95c; }
  .rt-app-screen-sub { font-size: 13px; color: #08b84f; font-weight: 800; margin-top: 5px; }
  .rt-app-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin-top: 28px; }
  .rt-app-dot { aspect-ratio: 1; border-radius: 18px; display: grid; place-items: center; color: #15110a; font-size: 18px; font-weight: 900; background: linear-gradient(135deg,#21b95c,#08b84f 56%,#05b84f); box-shadow: 0 12px 24px rgba(124,255,178,.16),inset 0 1px 0 rgba(255,255,255,.35); }
  .rt-app-dot:nth-child(2) { background: linear-gradient(135deg,#9bd7ff,#4eb7ff); color: #061323; }
  .rt-app-dot:nth-child(3) { background: linear-gradient(135deg,#ffb7d5,#f06292); color: #210714; }
  .rt-app-dot:nth-child(4) { background: linear-gradient(135deg,#c7ffe4,#33e889); color: #071b10; }
  .rt-app-dot:nth-child(5) { background: linear-gradient(135deg,#ffffff,#e9edf5); color: #111827; }
  .rt-app-dot:nth-child(6) { background: linear-gradient(135deg,#08b84f,#05b84f); color: #17130a; }
  .rt-app-screen-card { margin-top: 22px; padding: 14px; border-radius: 18px; background: rgba(255,255,255,.045); border: 1px solid rgba(124,255,178,.13); }
  .rt-app-screen-card b { display: block; color: #08b84f; font-size: 15px; }
  .rt-app-screen-card span { display: block; color: #08b84f; font-weight: 800; font-size: 11px; margin-top: 4px; line-height: 1.45; }
  .rt-floating-app { position: absolute; z-index: 4; width: 76px; height: 76px; border-radius: 25px; display: grid; place-items: center; border: 1px solid rgba(255,255,255,.14); background: linear-gradient(145deg,rgba(255,255,255,.10),rgba(255,255,255,.026)); box-shadow: 0 22px 50px rgba(0,0,0,.36),inset 0 1px 0 rgba(255,255,255,.10); backdrop-filter: blur(16px); animation: rtFloatLuxury 6.4s ease-in-out infinite; font-size: 28px; }
  .rt-floating-app b { font-size: 20px; line-height: 1; font-weight: 900; }
  .rt-floating-app.fb { left: 50px; top: 90px; color: #4eb7ff; animation-delay: .1s; }
  .rt-floating-app.tk { right: 56px; top: 82px; color: #fff; animation-delay: .55s; }
  .rt-floating-app.ig { left: 20px; bottom: 132px; color: #ff78ad; animation-delay: .9s; }
  .rt-floating-app.yt { right: 34px; bottom: 138px; color: #ff6b6b; animation-delay: 1.25s; }
  .rt-floating-app.gm { left: 142px; top: 22px; color: #fff; animation-delay: .35s; }
  .rt-floating-app.tg { right: 148px; bottom: 24px; color: #86d7ff; animation-delay: 1.55s; }
  .rt-floating-app.sp { left: 156px; bottom: 28px; color: #39e58c; animation-delay: .75s; }
  .rt-app-benefit-card { position: absolute; z-index: 3; left: 34px; right: 34px; bottom: 18px; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; border-radius: 20px; border: 1px solid rgba(24,201,100,.16); background: linear-gradient(145deg,rgba(124,255,178,.12),rgba(255,255,255,.025)); box-shadow: 0 18px 46px rgba(0,0,0,.30); backdrop-filter: blur(16px); }
  .rt-app-benefit-card strong { display: block; color: #08b84f; font-size: 14px; }
  .rt-app-benefit-card span { display: block; color: #08b84f; font-size: 12px; font-weight: 800; margin-top: 2px; }
  .rt-app-benefit-card .star-ico { width: 42px; height: 42px; border-radius: 15px; display: grid; place-items: center; background: linear-gradient(135deg,#21b95c,#08b84f); color: #17130a; font-size: 20px; flex: 0 0 auto; }

  /* Features */
  .rt-feature-wrap { padding: 18px 0 34px; }
  .rt-feature-grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 16px; }
  .rt-feature { padding: 26px; border: 1px solid var(--rt-border); border-radius: 30px; background: linear-gradient(145deg,color-mix(in srgb,var(--rt-card) 88%,transparent),color-mix(in srgb,var(--rt-soft) 62%,transparent)); box-shadow: 0 20px 60px var(--rt-shadow); position: relative; overflow: hidden; }
  .rt-feature::after { content: ""; position: absolute; width: 180px; height: 180px; border-radius: 50%; right: -90px; top: -90px; background: color-mix(in srgb,var(--rt-accent) 14%,transparent); filter: blur(4px); }
  .rt-feature .ico { width: 54px; height: 54px; border-radius: 18px; display: grid; place-items: center; background: linear-gradient(135deg,#08b84f,#05b84f); color: #17130a; font-size: 24px; box-shadow: 0 16px 34px color-mix(in srgb,var(--rt-accent) 24%,transparent); }
  .rt-feature h3 { font-size: 24px; margin: 18px 0 8px; color: var(--rt-text); }
  .rt-feature p { margin: 0; color: var(--rt-muted); font-weight: 700; line-height: 1.75; }

  /* CTA */
  .rt-cta { padding: 18px 0 58px; }
  .rt-cta-box { padding: 42px; border-radius: 34px; border: 1px solid color-mix(in srgb,var(--rt-accent) 32%,var(--rt-border)); background: linear-gradient(135deg,color-mix(in srgb,var(--rt-accent) 18%,var(--rt-card)),color-mix(in srgb,var(--rt-card) 90%,transparent)); display: flex; align-items: center; justify-content: space-between; gap: 22px; box-shadow: 0 26px 80px var(--rt-shadow); }
  .rt-cta h2 { font-size: clamp(28px,3vw,48px); margin: 0 0 8px; color: var(--rt-text); }
  .rt-cta p { margin: 0; color: var(--rt-muted); font-weight: 700; line-height: 1.7; max-width: 820px; }

  /* Reveal */
  .reveal { opacity: 0; transform: translateY(18px); transition: opacity .65s ease, transform .65s ease; }
  .reveal.show { opacity: 1; transform: translateY(0); }

  @keyframes draw { to { stroke-dashoffset: 0; } }
  @keyframes floatIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes rtOrbitSpin { to { transform: rotate(360deg); } }
  @keyframes rtAppPhoneFloat { 0%,100% { transform: rotate(-8deg) translateY(10px); } 50% { transform: rotate(-5deg) translateY(-4px); } }
  @keyframes rtFloatLuxury { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }

  @media (max-width: 1200px) {
    .rt-hero-shell, .rt-service-shell { grid-template-columns: 1fr; }
    .rt-hero-art { min-height: 460px; }
    .rt-service-art.apps { min-height: 430px; }
  }
  @media (max-width: 1100px) {
    .rt-platform-grid { grid-template-columns: repeat(3,1fr); }
  }
  @media (max-width: 900px) {
    .rt-nav-inner { grid-template-columns: 1fr auto; grid-template-areas: "brand cta" "links links"; row-gap: 12px; padding: 12px clamp(12px,4vw,20px) !important; height: auto; }
    .rt-brand { grid-area: brand; }
    .rt-nav-links { grid-area: links; width: 100%; justify-content: center; overflow-x: auto; padding-bottom: 2px; justify-self: stretch; }
    .rt-btn-primary { grid-area: cta; justify-self: end; }
    .rt-home-main { padding-top: 112px; }
  }
  @media (max-width: 760px) {
    .rt-hero { padding-top: 18px; }
    .rt-hero-main { padding: 22px; }
    .rt-hero h1 { font-size: 44px; }
    .rt-trust { grid-template-columns: 1fr; }
    .rt-platform-grid { grid-template-columns: repeat(2,1fr); }
    .rt-feature-grid { grid-template-columns: 1fr; }
    .rt-section-head { display: block; }
    .rt-cta-box { display: block; padding: 28px; }
    .rt-hero-art, .rt-service-art.apps { min-height: 380px; border-radius: 24px; }
    .rt-art-phone { width: min(78%,260px); margin: 78px auto 38px; transform: rotate(9deg); }
    .rt-service-shell { padding: 22px; }
    .rt-service-card h3 { font-size: clamp(28px,8vw,40px) !important; }
    .rt-service-metrics { grid-template-columns: 1fr; }
    .rt-float-icon { width: 54px; height: 54px; font-size: 20px; }
    .rt-float-icon.hero-a { right: 56%; top: 46px; }
    .rt-float-icon.hero-b { right: 14%; top: 80px; }
    .rt-float-icon.hero-c { right: 62%; top: 178px; }
    .rt-float-icon.hero-d { right: 14%; top: 224px; }
    .rt-float-icon.hero-e { right: 20%; bottom: 78px; }
    .rt-float-icon.hero-f { right: 28%; top: 22px; }
    .rt-art-orbit.one { width: 260px; height: 260px; right: 50%; transform: translateX(50%); }
    .rt-art-orbit.two { width: 210px; height: 210px; right: 50%; transform: translateX(50%); }
    .rt-art-orbit.three { display: none; }
    .rt-floating-app { width: 56px; height: 56px; border-radius: 19px; font-size: 22px; }
    .rt-floating-app.fb { left: 30px; top: 70px; }
    .rt-floating-app.tk { right: 34px; top: 68px; }
    .rt-floating-app.ig { left: 16px; bottom: 112px; }
    .rt-floating-app.yt { right: 18px; bottom: 116px; }
    .rt-floating-app.gm { left: 116px; top: 20px; }
    .rt-floating-app.tg { right: 110px; bottom: 20px; }
    .rt-floating-app.sp { left: 112px; bottom: 22px; }
    .rt-app-benefit-card { left: 18px; right: 18px; bottom: 14px; }
  }
  @media (max-width: 560px) {
    .rt-nav-inner { grid-template-columns: 1fr !important; grid-template-areas: "brand" "cta" "links"; justify-items: center; }
    .rt-brand, .rt-btn-primary { justify-self: center; }
    .rt-nav-links { display: flex; }
    .rt-home-main { padding-top: 178px; }
    .rt-btn { width: 100%; }
    .rt-hero-actions { width: 100%; }
  }
  @media (max-width: 420px) {
    .rt-platform-grid { grid-template-columns: 1fr; }
    .rt-hero h1 { font-size: 38px; }
  }
`;

export default function HomePage() {
  useEffect(() => {
    document.body.classList.add('rt-home-clean-layout');
    return () => document.body.classList.remove('rt-home-clean-layout');
  }, []);

  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('show');
        io.unobserve(entry.target);
      });
    }, { threshold: .14 });
    document.querySelectorAll('.reveal,.rt-platform').forEach((el, i) => {
      el.style.transitionDelay = Math.min(i * 45, 360) + 'ms';
      io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* Landing Nav */}
      <nav className="rt-landing-nav" aria-label="RTAUTOBOT Landing Navigation">
        <div className="rt-nav-inner">
          <a className="rt-brand" href="/" aria-label="RTAUTOBOT Home">
            <span className="rt-brand-mark">⚡</span>
            <span>RTAUTOBOT <small>Bonustime Automation</small></span>
          </a>
          <div className="rt-nav-links" aria-label="Landing links">
            <a href="#home">หน้าหลัก</a>
            <a href="#bonustime-services">Bonustime</a>
            <a href="#packages">แพ็กเกจ</a>
            <a href="#features">จุดเด่น</a>
            <a href="/support">ช่วยเหลือ</a>
          </div>
          <a className="rt-btn rt-btn-primary" href="/bonustime">สั่งซื้อ Bonustime →</a>
        </div>
      </nav>

      <div className="rt-home-main">
        {/* Hero */}
        <section id="home" className="rt-hero">
          <div className="rt-wrap">
            <div style={{ display: 'grid' }}>
              <div className="rt-panel rt-hero-main reveal">
                <div className="rt-hero-shell">
                  <div className="rt-hero-copy">
                    <div className="rt-kicker">✦ RTAUTOBOT · BONUSTIME AUTOMATION</div>
                    <h1>ระบบเช่า <span>Bonustime</span><br />ครบ จบ พร้อมใช้งาน</h1>
                    <p className="rt-lead">RTAUTOBOT คือระบบบริการ Bonustime สำหรับผู้ประกอบการที่ต้องการเปิดใช้งานแพ็กเกจได้รวดเร็ว ดูแลง่าย ชำระด้วยเครดิตในบัญชีเดียว และติดตามสถานะบริการได้ในเว็บเดียวแบบมืออาชีพ</p>
                    <ul className="rt-bullets">
                      <li><span className="chk">✔</span><span>สั่งซื้อ ต่ออายุ และอัปเกรดแพ็กเกจ Bonustime ได้ในขั้นตอนที่ชัดเจน</span></li>
                      <li><span className="chk">✔</span><span>ชำระด้วยเครดิตในบัญชีเดียว เติมเงินง่าย ใช้งานต่อเนื่องได้ทันที</span></li>
                      <li><span className="chk">✔</span><span>ติดตามสถานะบริการและอายุใช้งานได้สะดวก เหมาะกับงานที่ต้องการความต่อเนื่อง</span></li>
                    </ul>
                    <div className="rt-hero-actions">
                      <a className="rt-btn rt-btn-primary" href="/bonustime">🛒 สั่งซื้อ Bonustime</a>
                      <a className="rt-btn rt-btn-ghost" href="/login">→ เข้าสู่ระบบ</a>
                    </div>
                    <div className="rt-trust">
                      <div className="rt-mini"><strong>BT</strong><span>บริการ Bonustime โดยตรง</span></div>
                      <div className="rt-mini"><strong>24/7</strong><span>พร้อมสั่งซื้อและต่ออายุ</span></div>
                      <div className="rt-mini"><strong>Pro</strong><span>จัดการง่ายแบบมืออาชีพ</span></div>
                    </div>
                  </div>
                  <div className="rt-hero-art" aria-hidden="true">
                    <div className="rt-showcase-stars"></div>
                    <span className="rt-art-orbit one"></span>
                    <span className="rt-art-orbit two"></span>
                    <span className="rt-art-orbit three"></span>
                    <span className="rt-float-icon hero-a">🎮</span>
                    <span className="rt-float-icon hero-b small">💎</span>
                    <span className="rt-float-icon hero-c small">💳</span>
                    <span className="rt-float-icon hero-d">🛡</span>
                    <span className="rt-float-icon hero-e">⏱</span>
                    <span className="rt-float-icon hero-f">BT</span>
                    <div className="rt-art-phone">
                      <div className="rt-phone-screen">
                        <div className="rt-screen-title">BONUSTIME CONTROL</div>
                        <div className="rt-screen-sub">Package Management</div>
                        <div className="rt-chart-bars"><span></span><span></span><span></span><span></span></div>
                        <div className="rt-chart-line">
                          <svg viewBox="0 0 280 100" preserveAspectRatio="none">
                            <path d="M4 78 C42 52 68 72 102 42 S170 18 210 34 S252 58 276 20" stroke="#08b84f" strokeWidth="6" fill="none" strokeLinecap="round" />
                          </svg>
                        </div>
                        <div className="rt-phone-pills">
                          <span><b>Package 1</b><em>Ready</em></span>
                          <span><b>Package 2</b><em>Upgrade</em></span>
                          <span><b>Shared Wallet</b><em>Active</em></span>
                        </div>
                        <div className="rt-verified-pill">✔ Bonustime Service</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Platforms */}
        <section id="packages" className="rt-platforms">
          <div className="rt-wrap">
            <div className="rt-section-head reveal">
              <div>
                <h2>บริการ Bonustime สำหรับธุรกิจของคุณ</h2>
                <p>เลือกแพ็กเกจให้เหมาะกับรูปแบบการใช้งาน ทั้งสล็อต บาคาร่า หวย การต่ออายุ และการดูแลบริการต่อเนื่องในที่เดียว</p>
              </div>
              <a className="rt-link" href="/bonustime">ไปหน้าสั่งซื้อ ↗</a>
            </div>
            <div className="rt-platform-grid">
              <div className="rt-platform"><div className="ico">🎲</div><strong>สล็อต</strong><span>แพ็กเกจ Bonustime สำหรับสายสล็อต</span></div>
              <div className="rt-platform"><div className="ico">♣</div><strong>บาคาร่า</strong><span>พร้อมใช้งานในแพ็กเกจหลัก</span></div>
              <div className="rt-platform"><div className="ico">🎟</div><strong>หวย</strong><span>อัปเกรดตามแพ็กเกจที่รองรับ</span></div>
              <div className="rt-platform"><div className="ico">🔄</div><strong>ต่ออายุ</strong><span>จัดการอายุใช้งานต่อเนื่อง</span></div>
              <div className="rt-platform"><div className="ico">💳</div><strong>เครดิตพร้อมใช้</strong><span>ชำระด้วยเครดิตในบัญชีเดียว</span></div>
              <div className="rt-platform"><div className="ico">⚡</div><strong>จัดการง่าย</strong><span>ระบบเรียบง่าย ใช้งานคล่อง</span></div>
            </div>
          </div>
        </section>

        {/* Service Showcase */}
        <section id="bonustime-services" className="rt-service-showcase">
          <div className="rt-wrap">
            <div className="rt-section-head reveal">
              <div>
                <h2>Bonustime — ระบบเช่าและจัดการแพ็กเกจแบบมืออาชีพ</h2>
                <p>ออกแบบให้ลูกค้าเลือกแพ็กเกจ ชำระด้วยเครดิตในบัญชี และติดตามสถานะได้ง่าย พร้อมประสบการณ์ใช้งานที่ชัดเจนตั้งแต่หน้าแรกจนถึงหน้าคำสั่งซื้อ</p>
              </div>
            </div>
            <div className="rt-service-grid single">
              <article className="rt-service-card apps full reveal">
                <div className="rt-service-shell">
                  <div className="rt-service-copy">
                    <div>
                      <div className="rt-service-top">
                        <div className="rt-service-badge">⚡</div>
                        <span className="rt-service-status"><span className="dot"></span> Bonustime Service</span>
                      </div>
                      <h3>เช่าแพ็กเกจ <span>Bonustime</span><br />จบในเว็บเดียว</h3>
                      <p className="rt-service-lead">RTAUTOBOT รวมขั้นตอนสำคัญของ Bonustime ไว้ในเว็บเดียว ตั้งแต่สั่งซื้อแพ็กเกจ ต่ออายุบริการ อัปเกรดฟีเจอร์ ไปจนถึงการชำระด้วยเครดิตในบัญชีอย่างต่อเนื่อง</p>
                      <div className="rt-tag-row">
                        <span className="rt-tag">✔ Bonustime</span>
                        <span className="rt-tag">🗄 บัญชีเดียว</span>
                        <span className="rt-tag">💳 เครดิตพร้อมใช้</span>
                        <span className="rt-tag">💻 จัดการอัตโนมัติ</span>
                      </div>
                      <div className="rt-service-points">
                        <div className="rt-service-point"><span className="n">01</span><div><b>สั่งซื้อแพ็กเกจ Bonustime</b><small>เลือกแพ็กเกจที่ต้องการ กดยืนยัน และเริ่มจัดการบริการได้จากหน้า Bonustime โดยตรง</small></div></div>
                        <div className="rt-service-point"><span className="n">02</span><div><b>ต่ออายุและอัปเกรดได้</b><small>รองรับการต่ออายุบริการและอัปเกรดฟีเจอร์ให้เหมาะกับการใช้งานของแต่ละธุรกิจ</small></div></div>
                        <div className="rt-service-point"><span className="n">03</span><div><b>ชำระด้วยเครดิตในบัญชีเดียว</b><small>ลูกค้าสามารถเติมเครดิตและนำไปใช้สั่งซื้อบริการได้ต่อเนื่อง ไม่ต้องจัดการหลายกระเป๋าให้ยุ่งยาก</small></div></div>
                      </div>
                    </div>
                    <div>
                      <div className="rt-service-metrics">
                        <div><strong>Line Flex</strong><span>Bonustime Package</span></div>
                        <div><strong>Auto</strong><span>ดูแลอายุบริการ</span></div>
                        <div><strong>Wallet</strong><span>เครดิตบัญชีเดียว</span></div>
                      </div>
                      <div className="rt-service-actions">
                        <a className="rt-btn rt-btn-primary" href="/bonustime">🛒 สั่งซื้อ Bonustime</a>
                        <a className="rt-btn rt-btn-ghost" href="/dashboard">⚡ ไปแดชบอร์ด</a>
                      </div>
                      <div className="rt-service-note">ระบบถูกออกแบบให้ลูกค้าเริ่มจากหน้า Bonustime โดยตรง เลือกแพ็กเกจได้ง่าย และชำระเครดิตได้อย่างมั่นใจ</div>
                    </div>
                  </div>
                  <div className="rt-service-art apps" aria-hidden="true">
                    <div className="rt-app-visual">
                      <span className="rt-app-ring"></span>
                      <span className="rt-app-ring two"></span>
                      <div className="rt-app-phone">
                        <div className="rt-app-screen">
                          <div className="rt-app-screen-title">RTAUTOBOT</div>
                          <div className="rt-app-screen-sub">Bonustime Package</div>
                          <div className="rt-app-grid">
                            <span className="rt-app-dot">🎲</span>
                            <span className="rt-app-dot">♣</span>
                            <span className="rt-app-dot">🎟</span>
                            <span className="rt-app-dot">🔄</span>
                            <span className="rt-app-dot">💳</span>
                            <span className="rt-app-dot">🛡</span>
                          </div>
                          <div className="rt-app-screen-card"><b>Package Active</b><span>จัดการสถานะและอายุใช้งานแบบต่อเนื่อง</span></div>
                        </div>
                      </div>
                      <span className="rt-floating-app fb">🎮</span>
                      <span className="rt-floating-app tk">⚡</span>
                      <span className="rt-floating-app ig">💎</span>
                      <span className="rt-floating-app yt">⏱</span>
                      <span className="rt-floating-app gm"><b>BT</b></span>
                      <span className="rt-floating-app tg">💳</span>
                      <span className="rt-floating-app sp">✔</span>
                      <div className="rt-app-benefit-card">
                        <div><strong>Bonustime Pro</strong><span>บริการชัดเจน ใช้งานง่าย พร้อมดูแลต่อเนื่อง</span></div>
                        <span className="star-ico">✦</span>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="rt-feature-wrap">
          <div className="rt-wrap">
            <div className="rt-section-head reveal">
              <div>
                <h2>บริการ Bonustime ที่จัดวางให้ใช้งานง่ายกว่าเดิม</h2>
                <p>ทุกส่วนของหน้าเว็บถูกจัดให้เหมาะกับการขายและดูแล Bonustime โดยเฉพาะ ลูกค้าเห็นบริการชัด ตัดสินใจง่าย และเริ่มใช้งานได้รวดเร็ว</p>
              </div>
            </div>
            <div className="rt-feature-grid">
              <article className="rt-feature reveal">
                <div className="ico">✂</div>
                <h3>Bonustime โดยเฉพาะ</h3>
                <p>ทุกปุ่มและทุกเส้นทางสำคัญพาลูกค้าไปยังบริการ Bonustime อย่างชัดเจน ลดความสับสนระหว่างการใช้งาน</p>
              </article>
              <article className="rt-feature reveal">
                <div className="ico">💾</div>
                <h3>เครดิตบัญชีเดียว</h3>
                <p>ลูกค้าเติมเครดิตครั้งเดียว แล้วนำไปใช้สั่งซื้อ ต่ออายุ และจัดการแพ็กเกจ Bonustime ได้ทันที</p>
              </article>
              <article className="rt-feature reveal">
                <div className="ico">⚙</div>
                <h3>พร้อมดูแลหลังบ้าน</h3>
                <p>ระบบหลังบ้านรองรับการตรวจสอบคำสั่งซื้อและดูแลบริการ เพื่อให้ทีมทำงานได้คล่องขึ้น</p>
              </article>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="rt-cta">
          <div className="rt-wrap">
            <div className="rt-cta-box reveal">
              <div>
                <h2>เริ่มใช้งาน Bonustime บน RTAUTOBOT</h2>
                <p>เลือกแพ็กเกจที่ต้องการ ชำระด้วยเครดิตในบัญชี และเริ่มจัดการบริการ Bonustime ได้ทันที</p>
              </div>
              <a className="rt-btn rt-btn-primary" href="/bonustime">ไปที่ Bonustime →</a>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
