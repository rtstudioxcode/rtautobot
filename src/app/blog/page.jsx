'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';

const POSTS = [
  {
    slug: 'bonustime-intro',
    title: 'RTAUTOBOT Bonustime คืออะไร?',
    excerpt: 'รู้จักระบบ Bonustime LINE Bot อัตโนมัติ พร้อมวิธีเริ่มต้นใช้งานและฟีเจอร์ที่ทำให้ระบบโบนัสไทม์ของคุณทำงานได้ 24 ชั่วโมง',
    author: 'RTAUTOBOT',
    dateText: '1 ม.ค. 2567',
    thumbnail: null,
  },
  {
    slug: 'how-to-setup',
    title: 'วิธีตั้งค่า LINE Bot สำหรับ Bonustime',
    excerpt: 'ขั้นตอนการเชื่อมต่อ LINE Channel Access Token และตั้งค่าระบบแจกโบนัส พร้อมคู่มือทีละขั้นตอนสำหรับมือใหม่',
    author: 'RTAUTOBOT',
    dateText: '10 ม.ค. 2567',
    thumbnail: null,
  },
  {
    slug: 'truewallet-topup',
    title: 'เติมเงินผ่าน TrueWallet',
    excerpt: 'วิธีเติมเงินด้วย TrueWallet อย่างรวดเร็วและปลอดภัย พร้อมขั้นตอนการยืนยันการเติมเงินอัตโนมัติ',
    author: 'RTAUTOBOT',
    dateText: '20 ม.ค. 2567',
    thumbnail: null,
  },
  {
    slug: 'affiliate-guide',
    title: 'แนะนำเพื่อนรับค่าคอมมิชชัน',
    excerpt: 'วิธีใช้ลิงก์แนะนำเพื่อนเพื่อรับค่าคอมมิชชันทุกครั้งที่เพื่อนสั่งซื้อ พร้อมวิธีดูรายรับจากระบบ Affiliate',
    author: 'RTAUTOBOT',
    dateText: '1 ก.พ. 2567',
    thumbnail: null,
  },
  {
    slug: 'lotto-package',
    title: 'แพ็กเกจ Lotto คืออะไร?',
    excerpt: 'ความแตกต่างระหว่างแพ็กเกจ Normal และ Lotto พร้อมราคาและเงื่อนไขการใช้งานแต่ละประเภทอย่างละเอียด',
    author: 'RTAUTOBOT',
    dateText: '10 ก.พ. 2567',
    thumbnail: null,
  },
  {
    slug: 'extend-plan',
    title: 'ต่ออายุแพ็กเกจ Bonustime',
    excerpt: 'วิธีต่ออายุและประหยัดค่าใช้จ่ายด้วยแผนรายปี พร้อมเปรียบเทียบราคาระหว่างแพ็กเกจรายเดือนและรายปี',
    author: 'RTAUTOBOT',
    dateText: '20 ก.พ. 2567',
    thumbnail: null,
  },
];

const CSS = `
  :root {
    --blog-page: #06080c;
    --blog-card: #141418;
    --blog-card-2: #181a20;
    --blog-text: #eef6ff;
    --blog-muted: #08b84f;
    --blog-border: rgba(255,255,255,.12);
    --blog-soft: rgba(255,255,255,.055);
    --blog-accent: #05b84f;
    --blog-accent-2: #08b84f;
    --blog-shadow: 0 28px 90px rgba(0,0,0,.42);
    --blog-glow: 0 26px 90px rgba(124,255,178,.16);
  }

  body:has(.blog-page) {
    background:
      radial-gradient(900px 420px at 8% 0%, color-mix(in srgb,#05b84f 18%,transparent), transparent 62%),
      radial-gradient(700px 380px at 94% 8%, rgba(56,189,248,.13), transparent 60%),
      linear-gradient(180deg, #06080c, #060707) !important;
  }

  .blog-page {
    position: relative;
    isolation: isolate;
    padding: 22px clamp(14px,2vw,34px) 0;
    overflow: hidden;
    color: var(--blog-text);
    min-height: 100vh;
  }

  .blog-page::before {
    content: "";
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: -1;
    opacity: .42;
    background-image:
      linear-gradient(color-mix(in srgb,var(--blog-border) 26%,transparent) 1px, transparent 1px),
      linear-gradient(90deg,color-mix(in srgb,var(--blog-border) 20%,transparent) 1px, transparent 1px);
    background-size: 72px 72px;
    mask-image: radial-gradient(circle at 50% 0%,#000 0 35%,transparent 72%);
  }

  .blog-shell { width: min(1880px,100%); margin: 0 auto; }

  /* Hero */
  .blog-hero {
    position: relative;
    overflow: hidden;
    border: 1px solid var(--blog-border);
    border-radius: 30px;
    background:
      linear-gradient(135deg,color-mix(in srgb,var(--blog-card) 92%,transparent),color-mix(in srgb,var(--blog-card-2) 88%,transparent)),
      radial-gradient(780px 360px at 84% 0%,color-mix(in srgb,var(--blog-accent) 21%,transparent),transparent 60%);
    box-shadow: var(--blog-shadow);
    padding: clamp(26px,4vw,70px);
    min-height: 330px;
    display: grid;
    grid-template-columns: minmax(0,1.05fr) minmax(320px,.95fr);
    gap: 36px;
    align-items: center;
    animation: blogFadeUp .7s ease both;
  }

  .blog-hero::before {
    content: "";
    position: absolute;
    inset: -1px;
    background: linear-gradient(110deg,transparent 0 44%,rgba(255,255,255,.10) 45% 48%,transparent 49% 100%);
    transform: translateX(-35%);
    animation: blogSheen 7s ease-in-out infinite;
    pointer-events: none;
  }

  .blog-hero::after {
    content: "";
    position: absolute;
    width: 340px;
    height: 340px;
    border-radius: 999px;
    background: radial-gradient(circle,color-mix(in srgb,var(--blog-accent) 24%,transparent),transparent 70%);
    right: -110px;
    bottom: -150px;
    filter: blur(6px);
    pointer-events: none;
  }

  .blog-kicker {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    padding: 9px 14px;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb,var(--blog-accent) 48%,var(--blog-border));
    background: color-mix(in srgb,var(--blog-accent) 11%,transparent);
    color: var(--blog-accent-2);
    font-weight: 900;
    font-size: 12px;
    letter-spacing: .08em;
    text-transform: uppercase;
    box-shadow: 0 12px 34px color-mix(in srgb,var(--blog-accent) 13%,transparent);
  }

  .blog-title {
    margin: 18px 0 16px;
    font-size: clamp(42px,6.4vw,96px);
    line-height: .92;
    letter-spacing: -.075em;
    font-weight: 900;
    text-wrap: balance;
    color: var(--blog-text);
  }

  .blog-title .shine {
    background: linear-gradient(135deg,var(--blog-text),var(--blog-accent-2) 52%,var(--blog-text));
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    background-size: 220% 100%;
    animation: blogTitleShine 5.5s ease-in-out infinite;
  }

  .blog-subtitle {
    max-width: 780px;
    color: var(--blog-muted);
    font-size: clamp(16px,1.2vw,21px);
    font-weight: 700;
    line-height: 1.85;
    margin: 0;
  }

  .blog-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 26px; }

  .blog-btn {
    height: 50px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 0 20px;
    border-radius: 17px;
    border: 1px solid var(--blog-border);
    font-weight: 900;
    font-family: inherit;
    font-size: 15px;
    transition: .22s ease;
    position: relative;
    overflow: hidden;
    cursor: pointer;
    text-decoration: none !important;
    color: var(--blog-text);
    background: transparent;
  }

  .blog-btn.primary {
    color: #151006;
    border-color: transparent;
    background: linear-gradient(135deg,#08b84f,#08b84f 55%,#05b84f);
    box-shadow: 0 18px 44px color-mix(in srgb,var(--blog-accent) 24%,transparent);
  }

  .blog-btn.ghost { background: var(--blog-soft); color: var(--blog-text); }
  .blog-btn:hover { transform: translateY(-2px); filter: saturate(1.06); }

  /* Metrics */
  .hero-metrics {
    display: grid;
    grid-template-columns: repeat(2,minmax(0,1fr));
    gap: 14px;
    position: relative;
    z-index: 1;
  }

  .metric-card {
    min-height: 126px;
    border-radius: 24px;
    border: 1px solid var(--blog-border);
    background: linear-gradient(180deg,var(--blog-soft),transparent);
    padding: 20px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    box-shadow: inset 0 1px 0 rgba(255,255,255,.08);
    animation: blogFloat 6s ease-in-out infinite;
  }

  .metric-card:nth-child(2){animation-delay:.7s}
  .metric-card:nth-child(3){animation-delay:1.2s}
  .metric-card:nth-child(4){animation-delay:1.8s}

  .metric-card .ico {
    width: 42px;
    height: 42px;
    border-radius: 16px;
    display: grid;
    place-items: center;
    background: linear-gradient(135deg,#08b84f,#05b84f);
    box-shadow: 0 14px 34px color-mix(in srgb,var(--blog-accent) 18%,transparent);
    font-size: 20px;
  }

  .metric-card strong {
    font-size: clamp(25px,2.5vw,38px);
    line-height: 1;
    color: var(--blog-accent-2);
    letter-spacing: -.04em;
    display: block;
    margin-top: 8px;
  }

  .metric-card small { color: var(--blog-muted); font-weight: 800; }

  /* Toolbar */
  .blog-toolbar {
    margin: 18px 0;
    display: grid;
    grid-template-columns: minmax(0,1fr) auto;
    gap: 14px;
    align-items: center;
    animation: blogFadeUp .8s ease .1s both;
  }

  .search-box {
    height: 58px;
    border-radius: 22px;
    border: 1px solid var(--blog-border);
    background: color-mix(in srgb,var(--blog-card) 78%,transparent);
    box-shadow: var(--blog-shadow);
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 18px;
    backdrop-filter: blur(14px);
    cursor: text;
  }

  .search-box .search-ico { color: var(--blog-accent); font-size: 18px; flex-shrink: 0; }

  .search-box input {
    width: 100%;
    height: 100%;
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--blog-text);
    font-weight: 800;
    font-family: inherit;
    font-size: 14px;
  }

  .search-box input::placeholder { color: color-mix(in srgb,var(--blog-muted) 60%,transparent); }

  .toolbar-pill {
    height: 58px;
    display: flex;
    align-items: center;
    gap: 10px;
    border-radius: 22px;
    border: 1px solid var(--blog-border);
    background: color-mix(in srgb,var(--blog-card) 78%,transparent);
    padding: 0 18px;
    box-shadow: var(--blog-shadow);
    font-weight: 900;
    color: var(--blog-muted);
    white-space: nowrap;
  }

  .toolbar-pill strong { color: var(--blog-accent-2); }

  /* Featured */
  .featured-wrap {
    display: grid;
    grid-template-columns: minmax(0,1.14fr) minmax(320px,.86fr);
    gap: 18px;
    margin-bottom: 18px;
    animation: blogFadeUp .8s ease .18s both;
  }

  .featured-card,
  .insight-card {
    border: 1px solid var(--blog-border);
    border-radius: 28px;
    background: linear-gradient(180deg,color-mix(in srgb,var(--blog-card) 88%,transparent),color-mix(in srgb,var(--blog-card-2) 86%,transparent));
    box-shadow: var(--blog-shadow);
    overflow: hidden;
    position: relative;
  }

  .featured-card {
    display: grid;
    grid-template-columns: minmax(280px,.9fr) minmax(0,1.1fr);
    min-height: 350px;
  }

  .featured-img {
    height: 100%;
    min-height: 350px;
    background: #111;
    position: relative;
    display: block;
  }

  .featured-img img { width: 100%; height: 100%; object-fit: cover; }

  .featured-img::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg,transparent,rgba(0,0,0,.34));
  }

  .featured-content {
    padding: 28px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 14px;
  }

  .post-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    width: max-content;
    padding: 8px 12px;
    border-radius: 999px;
    background: color-mix(in srgb,var(--blog-accent) 12%,transparent);
    border: 1px solid color-mix(in srgb,var(--blog-accent) 42%,var(--blog-border));
    color: var(--blog-accent-2);
    font-weight: 900;
    font-size: 12px;
  }

  .featured-title {
    font-size: clamp(25px,2.5vw,42px);
    line-height: 1.15;
    font-weight: 900;
    letter-spacing: -.04em;
    margin: 0;
  }

  .featured-title a { color: inherit; text-decoration: none; }
  .featured-title a:hover { color: var(--blog-accent-2); }

  .featured-excerpt { color: var(--blog-muted); font-weight: 700; line-height: 1.75; margin: 0; }

  .featured-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    color: var(--blog-muted);
    font-weight: 800;
    font-size: 13px;
  }

  .insight-card { padding: 24px; }
  .insight-title { font-size: 22px; font-weight: 900; margin-bottom: 16px; color: var(--blog-text); }
  .insight-list { display: grid; gap: 12px; }

  .insight-item {
    display: grid;
    grid-template-columns: 44px 1fr;
    gap: 12px;
    align-items: center;
    padding: 14px;
    border-radius: 18px;
    background: var(--blog-soft);
    border: 1px solid color-mix(in srgb,var(--blog-border) 70%,transparent);
  }

  .insight-item .mini {
    width: 44px;
    height: 44px;
    border-radius: 16px;
    display: grid;
    place-items: center;
    background: linear-gradient(135deg,color-mix(in srgb,var(--blog-accent) 24%,transparent),var(--blog-soft));
    font-size: 22px;
  }

  .insight-item strong { display: block; color: var(--blog-text); }
  .insight-item span { display: block; color: var(--blog-muted); font-weight: 700; font-size: 13px; }

  /* Section head */
  .section-head {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 16px;
    margin: 28px 0 16px;
  }

  .section-head h2 { font-size: clamp(26px,3vw,46px); font-weight: 900; letter-spacing: -.055em; margin: 0; color: var(--blog-text); }
  .section-head p { margin: 8px 0 0; color: var(--blog-muted); font-weight: 700; }

  .section-line {
    width: 120px;
    height: 5px;
    border-radius: 999px;
    background: linear-gradient(90deg,var(--blog-accent-2),transparent);
    flex-shrink: 0;
  }

  /* Blog grid */
  .blog-grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 18px; }

  .post-card {
    position: relative;
    overflow: hidden;
    border-radius: 26px;
    border: 1px solid var(--blog-border);
    background: linear-gradient(180deg,color-mix(in srgb,var(--blog-card) 88%,transparent),color-mix(in srgb,var(--blog-card-2) 86%,transparent));
    box-shadow: var(--blog-shadow);
    min-height: 100%;
    display: flex;
    flex-direction: column;
    transition: transform .24s ease,border-color .24s ease,box-shadow .24s ease;
    animation: blogFadeUp .7s ease both;
  }

  .post-card:nth-child(2n){animation-delay:.05s}
  .post-card:nth-child(3n){animation-delay:.1s}

  .post-card::before {
    content: "";
    position: absolute;
    inset: 0;
    background: radial-gradient(500px 170px at 10% 0%,color-mix(in srgb,var(--blog-accent) 12%,transparent),transparent 68%);
    opacity: 0;
    transition: .24s ease;
    pointer-events: none;
  }

  .post-card:hover { transform: translateY(-6px); border-color: color-mix(in srgb,var(--blog-accent) 48%,var(--blog-border)); box-shadow: var(--blog-glow); }
  .post-card:hover::before { opacity: 1; }

  .post-thumb-link { position: relative; display: block; overflow: hidden; background: #111; }

  .post-thumb { width: 100%; aspect-ratio: 16/9; object-fit: cover; transition: transform .55s ease; }
  .post-card:hover .post-thumb { transform: scale(1.055); }

  .post-thumb-placeholder {
    aspect-ratio: 16/9;
    display: grid;
    place-items: center;
    background: linear-gradient(135deg,color-mix(in srgb,var(--blog-accent) 22%,transparent),rgba(56,189,248,.12));
    font-size: 42px;
  }

  .post-body { position: relative; z-index: 1; padding: 20px; display: flex; flex-direction: column; gap: 12px; flex: 1; }

  .post-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; color: var(--blog-muted); font-size: 13px; font-weight: 800; }

  .post-title { font-size: clamp(18px,1.32vw,24px); line-height: 1.35; font-weight: 900; letter-spacing: -.03em; margin: 0; color: var(--blog-text); }
  .post-title a { color: inherit; text-decoration: none; }
  .post-title a:hover { color: var(--blog-accent-2); }

  .post-excerpt { color: var(--blog-muted); font-weight: 700; line-height: 1.75; margin: 0; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }

  .read-more { margin-top: auto; }
  .read-more .blog-btn { height: 44px; border-radius: 15px; padding: 0 15px; font-size: 14px; }

  /* Empty */
  .empty-state { grid-column: 1/-1; border: 1px dashed color-mix(in srgb,var(--blog-accent) 45%,var(--blog-border)); border-radius: 28px; background: var(--blog-soft); padding: 42px; text-align: center; }
  .empty-state .ico { font-size: 42px; margin-bottom: 12px; }
  .empty-state h3 { font-size: 26px; font-weight: 900; color: var(--blog-text); }
  .empty-state p { color: var(--blog-muted); font-weight: 700; margin: 0; }

  /* CTA */
  .blog-cta {
    margin: 36px 0 0;
    position: relative;
    overflow: hidden;
    border-radius: 30px;
    border: 1px solid color-mix(in srgb,var(--blog-accent) 36%,var(--blog-border));
    background: linear-gradient(135deg,#08b84f,#08b84f 55%,#05b84f);
    color: #161006;
    box-shadow: var(--blog-glow);
    padding: clamp(26px,4vw,54px);
    display: grid;
    grid-template-columns: minmax(0,1fr) auto;
    gap: 22px;
    align-items: center;
  }

  .blog-cta::after {
    content: "";
    position: absolute;
    inset: -1px;
    background: linear-gradient(110deg,transparent 0 42%,rgba(255,255,255,.34) 45%,transparent 52%);
    transform: translateX(-55%);
    animation: blogSheen 6s ease-in-out infinite;
    pointer-events: none;
  }

  .blog-cta h3 { font-size: clamp(28px,3.6vw,56px); font-weight: 900; letter-spacing: -.06em; margin: 0 0 8px; color: #161006; }
  .blog-cta p { font-weight: 800; margin: 0; opacity: .82; color: #161006; }
  .blog-cta-actions { display: flex; gap: 10px; position: relative; z-index: 1; }
  .blog-cta .blog-btn { background: rgba(0,0,0,.12); border-color: rgba(0,0,0,.15); color: #161006; height: 50px; }
  .blog-cta .blog-btn.primary { background: #111; color: #fff; box-shadow: none; }

  /* Footer */
  .blog-footer {
    margin-top: 0;
    padding: 52px 0;
    background: color-mix(in srgb,var(--blog-page) 92%,#000);
    border-top: 1px solid var(--blog-border);
  }

  .blog-footer a { color: var(--blog-muted); font-weight: 700; text-decoration: none; }
  .blog-footer a:hover { color: var(--blog-accent-2); }
  .blog-footer h6 { color: var(--blog-text); font-weight: 900; font-size: 14px; margin: 0 0 12px; }
  .blog-footer p { color: var(--blog-muted); font-weight: 700; line-height: 1.8; margin: 0; }
  .blog-footer img { max-width: 210px; height: auto; filter: drop-shadow(0 14px 34px rgba(0,0,0,.18)); margin-bottom: 12px; }

  .blog-footer ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; font-size: 14px; }

  .footer-grid {
    display: grid;
    grid-template-columns: 1.4fr .65fr .75fr .85fr;
    gap: 32px;
    align-items: start;
    padding: 0 clamp(14px,2vw,34px);
  }

  /* Keyframes */
  @keyframes blogFadeUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
  @keyframes blogSheen { 0%,60%{transform:translateX(-58%)} 100%{transform:translateX(58%)} }
  @keyframes blogTitleShine { 0%,100%{background-position:0 50%} 50%{background-position:100% 50%} }
  @keyframes blogFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }

  /* Responsive */
  @media (max-width:1180px) {
    .blog-hero,.featured-wrap{grid-template-columns:1fr}
    .hero-metrics{grid-template-columns:repeat(4,minmax(0,1fr))}
    .featured-card{grid-template-columns:1fr}
    .featured-img{min-height:260px}
    .blog-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
    .blog-cta{grid-template-columns:1fr}
    .blog-cta-actions{flex-wrap:wrap}
    .footer-grid{grid-template-columns:1fr 1fr}
  }

  @media (max-width:760px) {
    .blog-page{padding:12px}
    .blog-hero{border-radius:24px;padding:24px;min-height:auto}
    .blog-title{font-size:clamp(39px,14vw,62px)}
    .hero-metrics{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    .metric-card{min-height:106px;padding:14px}
    .metric-card strong{font-size:24px}
    .blog-toolbar{grid-template-columns:1fr}
    .toolbar-pill{justify-content:center}
    .featured-content,.insight-card,.post-body{padding:16px}
    .featured-card,.insight-card,.post-card,.blog-cta{border-radius:22px}
    .blog-grid{grid-template-columns:1fr}
    .section-head{align-items:flex-start;flex-direction:column}
    .blog-cta-actions{display:grid;grid-template-columns:1fr;width:100%}
    .blog-btn{width:100%}
    .blog-footer{text-align:center}
    .blog-footer img{margin-inline:auto}
    .footer-grid{grid-template-columns:1fr 1fr}
  }

  @media (max-width:420px) {
    .hero-metrics{grid-template-columns:1fr}
    .blog-title{letter-spacing:-.055em}
    .search-box,.toolbar-pill{height:52px;border-radius:18px}
    .blog-hero{padding:20px}
    .blog-cta{padding:22px}
    .footer-grid{grid-template-columns:1fr}
  }
`;

export default function BlogPage() {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return POSTS;
    const q = search.trim().toLowerCase();
    return POSTS.filter(p =>
      [p.title, p.excerpt, p.author, p.dateText].filter(Boolean).join(' ').toLowerCase().includes(q)
    );
  }, [search]);

  const featuredPost = filtered[0] || null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <main className="blog-page">
        <div className="blog-shell">

          {/* Hero */}
          <section className="blog-hero">
            <div className="hero-copy">
              <div className="blog-kicker">✨ RTAUTOBOT Growth Journal</div>
              <h1 className="blog-title">บทความ <span className="shine">การตลาดออนไลน์</span></h1>
              <p className="blog-subtitle">รวมเทคนิคเพิ่มยอดมองเห็น ปั้มไลค์ ปั้มผู้ติดตาม วางแผนคอนเทนต์ และเลือกบริการให้เหมาะกับแพลตฟอร์ม อ่านจบแล้วเอาไปใช้ต่อได้ทันที ไม่ต้องเปิดตำราเหมือนสอบปลายภาค</p>
              <div className="blog-actions">
                <Link className="blog-btn primary" href="/orders/new">🚀 เริ่มสั่งบริการ</Link>
                <Link className="blog-btn ghost" href="/services">📂 ดูบริการทั้งหมด</Link>
              </div>
            </div>
            <div className="hero-metrics" aria-label="Blog highlights">
              <div className="metric-card">
                <span className="ico">📈</span>
                <div><strong>Growth</strong><small>เทคนิคเพิ่มการมองเห็น</small></div>
              </div>
              <div className="metric-card">
                <span className="ico">⚡</span>
                <div><strong>Fast</strong><small>แนวทางใช้งานไว</small></div>
              </div>
              <div className="metric-card">
                <span className="ico">💎</span>
                <div><strong>Pro</strong><small>เลือกบริการแบบมืออาชีพ</small></div>
              </div>
              <div className="metric-card">
                <span className="ico">🧠</span>
                <div><strong>Tips</strong><small>อัปเดตไอเดียใหม่</small></div>
              </div>
            </div>
          </section>

          {/* Toolbar */}
          <section className="blog-toolbar" aria-label="เครื่องมือค้นหาบทความ">
            <label className="search-box" htmlFor="blogSearch">
              <span className="search-ico">🔍</span>
              <input
                id="blogSearch"
                type="search"
                placeholder="ค้นหาบทความ เช่น TikTok, เพิ่มผู้ติดตาม, SEO, ปั้มวิว..."
                autoComplete="off"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </label>
            <div className="toolbar-pill">
              📰 ทั้งหมด <strong>{filtered.length.toLocaleString('th-TH')}</strong> บทความ
            </div>
          </section>

          {/* Featured */}
          {featuredPost && (
            <section className="featured-wrap" aria-label="บทความแนะนำ">
              <article className="featured-card">
                <Link className="featured-img" href={`/blog/${featuredPost.slug}`}>
                  {featuredPost.thumbnail
                    ? <img src={featuredPost.thumbnail} alt={featuredPost.title} />
                    : <div className="post-thumb-placeholder">🚀</div>
                  }
                </Link>
                <div className="featured-content">
                  <span className="post-badge">⭐ Featured Article</span>
                  <h2 className="featured-title">
                    <Link href={`/blog/${featuredPost.slug}`}>{featuredPost.title}</Link>
                  </h2>
                  {featuredPost.excerpt && (
                    <p className="featured-excerpt">{featuredPost.excerpt}</p>
                  )}
                  <div className="featured-meta">
                    <span>📅 {featuredPost.dateText || 'อัปเดตล่าสุด'}</span>
                    <span>👤 {featuredPost.author || 'RTAUTOBOT'}</span>
                  </div>
                  <Link className="blog-btn primary" href={`/blog/${featuredPost.slug}`}>
                    อ่านบทความแนะนำ →
                  </Link>
                </div>
              </article>
              <aside className="insight-card">
                <div className="insight-title">ทำไมต้องอ่าน Blog นี้?</div>
                <div className="insight-list">
                  <div className="insight-item">
                    <span className="mini">🎯</span>
                    <div><strong>เลือกบริการตรงเป้าหมาย</strong><span>ลดการลองผิดลองถูกก่อนสั่งงานจริง</span></div>
                  </div>
                  <div className="insight-item">
                    <span className="mini">📊</span>
                    <div><strong>เข้าใจแพลตฟอร์มมากขึ้น</strong><span>เหมาะกับสายขายของ ครีเอเตอร์ และแบรนด์</span></div>
                  </div>
                  <div className="insight-item">
                    <span className="mini">🔥</span>
                    <div><strong>ต่อยอดยอดขายและเอนเกจเมนต์</strong><span>ไอเดียพร้อมใช้กับ TikTok, IG, YouTube, Facebook</span></div>
                  </div>
                  <div className="insight-item">
                    <span className="mini">🛡️</span>
                    <div><strong>ใช้งานอย่างปลอดภัยกว่าเดิม</strong><span>รู้เงื่อนไขก่อนเลือกบริการแต่ละประเภท</span></div>
                  </div>
                </div>
              </aside>
            </section>
          )}

          {/* Section head */}
          <section className="section-head">
            <div>
              <h2>บทความทั้งหมด</h2>
              <p>อัปเดตความรู้และไอเดียสำหรับเพิ่มการเติบโตบนโซเชียล</p>
            </div>
            <div className="section-line" aria-hidden="true" />
          </section>

          {/* Post grid */}
          <section className="blog-grid" id="blogGrid" aria-label="รายการบทความ">
            {filtered.length > 0 ? filtered.map(p => (
              <article key={p.slug} className="post-card">
                <Link className="post-thumb-link" href={`/blog/${p.slug}`}>
                  {p.thumbnail
                    ? <img className="post-thumb" src={p.thumbnail} alt={p.title} />
                    : <div className="post-thumb-placeholder">📝</div>
                  }
                </Link>
                <div className="post-body">
                  <div className="post-meta">
                    <span>📅 {p.dateText || 'อัปเดตล่าสุด'}</span>
                    <span>👤 {p.author || 'RTAUTOBOT'}</span>
                  </div>
                  <h3 className="post-title">
                    <Link href={`/blog/${p.slug}`}>{p.title}</Link>
                  </h3>
                  {p.excerpt && <p className="post-excerpt">{p.excerpt}</p>}
                  <div className="read-more">
                    <Link className="blog-btn ghost" href={`/blog/${p.slug}`}>อ่านต่อ →</Link>
                  </div>
                </div>
              </article>
            )) : (
              <div className="empty-state">
                <div className="ico">📝</div>
                <h3>ไม่พบบทความ</h3>
                <p>ลองค้นหาด้วยคำอื่น หรือดูบทความทั้งหมดได้เลย</p>
              </div>
            )}
          </section>

          {/* CTA */}
          <section className="blog-cta">
            <div>
              <h3>พร้อมเพิ่มยอดให้ Social แล้วหรือยัง?</h3>
              <p>เลือกบริการที่เหมาะกับเป้าหมายของคุณ แล้วเริ่มสร้างการมองเห็นได้ทันที</p>
            </div>
            <div className="blog-cta-actions">
              <Link className="blog-btn primary" href="/register">สมัครสมาชิกฟรี</Link>
              <Link className="blog-btn" href="/login">เข้าสู่ระบบ</Link>
            </div>
          </section>

        </div>
      </main>

      {/* Footer */}
      <footer className="blog-footer">
        <div className="blog-shell">
          <div className="footer-grid">
            <div>
              <img src="/assets/logo/logo-rtautobot.png" alt="RTAUTOBOT logo" />
              <p>RTAUTOBOT.COM ผู้ให้บริการ OTP24 ชั่วโมง บริการการตลาดออนไลน์และโซเชียลระดับสากล มาตรฐานมืออาชีพ ดูแลลูกค้าทั่วโลก</p>
            </div>
            <div>
              <h6>ผลิตภัณฑ์</h6>
              <ul>
                <li><Link href="/">หน้าแรก</Link></li>
                <li><Link href="/services">บริการทั้งหมด</Link></li>
                <li><Link href="/orders/new">บริการปั้มไลค์</Link></li>
                <li><Link href="/otp24">บริการ OTP24 ชั่วโมง</Link></li>
              </ul>
            </div>
            <div>
              <h6>FAQ</h6>
              <ul>
                <li><Link href="/faq">คำถามที่พบบ่อย</Link></li>
                <li><Link href="/blog">บทความ</Link></li>
                <li><Link href="/page/terms-of-use">เงื่อนไขและข้อตกลง</Link></li>
              </ul>
            </div>
            <div>
              <h6>ติดต่อเรา</h6>
              <ul>
                <li><a href="mailto:rtssm.th@gmail.com">📧 Email: rtssm.th@gmail.com</a></li>
                <li><a href="https://line.me/R/ti/p/@507vkplq">💬 Line: @rtssm-th</a></li>
                <li><a href="https://line.me/R/ti/p/@507vkplq">🐛 แจ้งปัญหาคำสั่งซื้อ</a></li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
