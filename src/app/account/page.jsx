'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

const CSS = `
  .account-container {
    --acc-page: #090a0d;
    --acc-card: #17181d;
    --acc-card-2: color-mix(in srgb,#17181d 78%,#0b0c10);
    --acc-soft: color-mix(in srgb,#17181d 86%,transparent);
    --acc-soft-2: color-mix(in srgb,#17181d 70%,#090a0d);
    --acc-text: #eef6ff;
    --acc-muted: #08b84f;
    --acc-border: color-mix(in srgb,rgba(255,255,255,.14) 78%,transparent);
    --acc-accent: #08b84f;
    --acc-accent-2: #08b84f;
    --acc-green: #21d07a;
    --acc-red: #ff5d6c;
    --acc-blue: #4da3ff;
    --acc-purple: #8d6bff;
    --acc-shadow: rgba(0,0,0,.34);
    --acc-radius: 28px;
    position: relative;
    isolation: isolate;
    max-width: 1500px;
    margin: 0 auto;
    padding: clamp(14px,2vw,28px);
    color: var(--acc-text);
  }

  .account-container::before,
  .account-container::after {
    content: "";
    position: absolute;
    z-index: -1;
    pointer-events: none;
    filter: blur(1px);
  }
  .account-container::before {
    width: min(620px,60vw); height: min(620px,60vw);
    top: -120px; right: -120px;
    background: radial-gradient(circle,color-mix(in srgb,var(--acc-accent) 30%,transparent),transparent 66%);
    opacity: .5;
    animation: accGlowFloat 9s ease-in-out infinite alternate;
  }
  .account-container::after {
    width: min(520px,52vw); height: min(520px,52vw);
    left: -180px; bottom: 12%;
    background: radial-gradient(circle,color-mix(in srgb,var(--acc-purple) 20%,transparent),transparent 68%);
    opacity: .42;
    animation: accGlowFloat 11s ease-in-out infinite alternate-reverse;
  }

  @keyframes accGlowFloat {
    from { transform: translate3d(0,0,0) scale(.98) }
    to   { transform: translate3d(28px,18px,0) scale(1.06) }
  }
  @keyframes accRise {
    from { opacity: 0; transform: translateY(16px) scale(.985) }
    to   { opacity: 1; transform: translateY(0) scale(1) }
  }
  @keyframes accShine {
    0%    { transform: translateX(-140%) skewX(-18deg) }
    42%,100% { transform: translateX(160%) skewX(-18deg) }
  }
  @keyframes accPulse {
    0%,100% { box-shadow: 0 0 0 0 color-mix(in srgb,var(--acc-accent) 26%,transparent) }
    50%     { box-shadow: 0 0 0 8px transparent }
  }

  .account-container * { box-sizing: border-box; }

  .account-container .page-title {
    margin: 0 0 18px;
    font-size: clamp(34px,5vw,72px);
    line-height: .96;
    letter-spacing: -.055em;
    font-weight: 950;
    color: var(--acc-text);
    text-wrap: balance;
    animation: accRise .55s ease both;
  }
  .account-container .page-title::after {
    content: "จัดการโปรไฟล์ ความปลอดภัย ระดับบัญชี และรายได้แนะนำเพื่อนในหน้าเดียว";
    display: block;
    max-width: 760px;
    margin-top: 14px;
    font-size: clamp(14px,1.25vw,18px);
    line-height: 1.65;
    letter-spacing: 0;
    font-weight: 800;
    color: color-mix(in srgb,var(--acc-muted) 92%,var(--acc-text));
  }

  .acc-wrap {
    display: grid;
    grid-template-columns: minmax(270px,340px) minmax(0,1fr);
    gap: 18px;
    align-items: start;
  }
  .acc-side, .acc-main { min-width: 0; animation: accRise .65s ease both; }
  .acc-side { animation-delay: .05s; }
  .acc-main { animation-delay: .12s; }

  .account-container .prof-card,
  .account-container .card,
  .account-container .tabs,
  .account-container .affw-modal {
    position: relative;
    overflow: hidden;
    background:
      linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.018)),
      var(--acc-soft);
    border: 1px solid var(--acc-border);
    border-radius: var(--acc-radius);
    box-shadow: 0 24px 64px var(--acc-shadow), inset 0 1px 0 rgba(255,255,255,.06);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
  }
  .account-container .prof-card::before,
  .account-container .card::before,
  .account-container .tabs::before {
    content: "";
    position: absolute;
    inset: 0 0 auto 0;
    height: 1px;
    background: linear-gradient(90deg,transparent,var(--acc-accent-2),transparent);
    opacity: .42;
  }
  .account-container .prof-card { padding: 20px; }
  .account-container .card { padding: 22px; margin-bottom: 16px; }

  .acc-prof-avatar {
    width: 132px; height: 132px;
    margin: 4px auto 14px;
    padding: 4px;
    border-radius: 34px;
    background: linear-gradient(135deg,var(--acc-accent-2),#05b84f 55%,color-mix(in srgb,var(--acc-purple) 45%,var(--acc-card)));
    box-shadow: 0 18px 38px color-mix(in srgb,var(--acc-accent) 24%,transparent);
  }
  .acc-prof-avatar img {
    width: 100%; height: 100%;
    object-fit: cover;
    border-radius: 30px;
    display: block;
    background: var(--acc-soft-2);
    border: 1px solid rgba(255,255,255,.2);
  }
  .acc-avatar-init {
    width: 100%; height: 100%;
    border-radius: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--acc-soft-2);
    font-size: 44px;
    font-weight: 800;
    color: var(--acc-accent);
  }
  .prof-name {
    margin-top: 14px;
    text-align: center;
    font-size: 24px;
    font-weight: 650;
    letter-spacing: -.03em;
    color: var(--acc-text);
  }
  .prof-mail {
    margin: 8px auto 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    flex-wrap: wrap;
    color: var(--acc-muted);
    font-weight: 550;
    font-size: 13px;
  }

  .account-container .kv {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 0;
    border-top: 1px solid color-mix(in srgb,var(--acc-border) 72%,transparent);
    color: var(--acc-muted);
    font-weight: 600;
    font-size: 13px;
  }
  .account-container .kv>div:last-child {
    color: var(--acc-text);
    text-align: right;
  }

  .account-container .muted { color: var(--acc-muted) !important; }
  .account-container .sm, .account-container .small { font-size: 12px; }

  .account-container .badge,
  .account-container .badge2,
  .account-container .pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    max-width: 100%;
    padding: 7px 10px;
    border-radius: 999px;
    border: 1px solid var(--acc-border);
    background: var(--acc-soft-2);
    color: var(--acc-text);
    font-weight: 600;
    font-size: 12px;
    line-height: 1.1;
    white-space: nowrap;
  }
  .account-container .badge.ok,
  .account-container .badge2.ok { color: #dcfff0; background: linear-gradient(135deg,rgba(21,196,112,.2),rgba(21,196,112,.08)); border-color: rgba(33,208,122,.35); }
  .account-container .badge.warn,
  .account-container .pill.lvl { color: #191308; background: linear-gradient(135deg,#08b84f,#05b84f); border-color: rgba(124,255,178,.7); }
  .account-container .badge.danger { color: #fff0f2; background: linear-gradient(135deg,rgba(255,93,108,.24),rgba(255,93,108,.08)); border-color: rgba(255,93,108,.38); }
  .account-container .badge.balance { color: #17130a; background: linear-gradient(135deg,#08b84f,#05b84f); border-color: rgba(124,255,178,.82); }

  .account-container .tabs {
    display: grid;
    grid-template-columns: repeat(3,minmax(0,1fr));
    gap: 8px;
    padding: 8px;
    margin-bottom: 16px;
    border-radius: 24px;
  }
  .account-container .tab {
    position: relative;
    min-height: 52px;
    border: 0;
    border-radius: 17px;
    padding: 10px 14px;
    cursor: pointer;
    background: transparent;
    color: var(--acc-muted);
    font-weight: 650;
    font-family: inherit;
    font-size: 14px;
    letter-spacing: -.01em;
    transition: transform .2s ease, background .2s ease, color .2s ease, box-shadow .2s ease;
  }
  .account-container .tab::after,
  .account-container .tab.active::after { display: none !important; content: none !important; }
  .account-container .tab:hover { transform: translateY(-1px); color: var(--acc-text); background: color-mix(in srgb,var(--acc-soft-2) 74%,transparent); }
  .account-container .tab.active {
    color: #17130a;
    background: linear-gradient(135deg,#08b84f,#08b84f 55%,#008c38);
    box-shadow: 0 16px 34px color-mix(in srgb,var(--acc-accent) 24%,transparent), inset 0 1px 0 rgba(255,255,255,.55);
  }

  .account-container .tabpane { display: none; }
  .account-container .tabpane.show { display: block; animation: accRise .38s ease both; }

  .account-container .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
  }
  .account-container .card-header .title {
    font-size: 20px;
    font-weight: 950;
    letter-spacing: -.025em;
    color: var(--acc-text);
  }

  .account-container .form-grid {
    display: grid;
    grid-template-columns: repeat(2,minmax(0,1fr));
    gap: 16px;
  }
  .account-container .form-grid>.full-col { grid-column: 1/-1; }

  .account-container label {
    display: block;
    color: var(--acc-text);
    font-weight: 600;
    font-size: 14px;
  }
  .account-container .acc-input,
  .account-container .static-input {
    width: 100%;
    min-height: 50px;
    margin-top: 8px;
    border-radius: 16px;
    border: 1px solid var(--acc-border);
    background: color-mix(in srgb,var(--acc-page) 72%,var(--acc-card));
    color: var(--acc-text);
    padding: 12px 14px;
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    outline: none;
    transition: border-color .18s ease, box-shadow .18s ease, background .18s ease;
  }
  .account-container .acc-input:focus {
    border-color: color-mix(in srgb,var(--acc-accent) 70%,var(--acc-border));
    box-shadow: 0 0 0 4px color-mix(in srgb,var(--acc-accent) 18%,transparent);
  }
  .account-container .acc-input:disabled { opacity: .75; cursor: not-allowed; }
  .account-container .static-input {
    display: flex;
    align-items: center;
    color: var(--acc-muted);
  }
  .account-container .email-row {
    display: flex;
    gap: 10px;
    align-items: flex-end;
  }
  .account-container .email-row .acc-input { flex: 1; margin-top: 8px; }

  .account-container .card-actions { padding-top: 16px; text-align: right; }

  .account-container .btn,
  .account-container .btn-line,
  .account-container .btn-lux,
  .account-container .btn-success {
    position: relative;
    overflow: hidden;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 44px;
    padding: 10px 16px;
    border-radius: 15px;
    border: 1px solid var(--acc-border);
    background: var(--acc-soft-2);
    color: var(--acc-text);
    cursor: pointer;
    font-weight: 650;
    font-family: inherit;
    font-size: 14px;
    text-decoration: none;
    transition: transform .18s ease, box-shadow .18s ease, filter .18s ease, opacity .18s ease;
  }
  .account-container .btn:hover,
  .account-container .btn-line:hover,
  .account-container .btn-lux:hover { transform: translateY(-1px); box-shadow: 0 16px 30px var(--acc-shadow); }
  .account-container .btn:disabled,
  .account-container .btn[disabled],
  .account-container .btn-lux:disabled { opacity: .55; cursor: not-allowed; transform: none; }
  .account-container .btn-lux,
  .account-container .btn-success {
    color: #17130a;
    border: 0;
    background: linear-gradient(135deg,#21b95c,#08b84f 55%,#05b84f);
    box-shadow: 0 14px 32px color-mix(in srgb,var(--acc-accent) 22%,transparent);
  }
  .account-container .btn-lux::after,
  .account-container .btn-success::after {
    content: "";
    position: absolute;
    inset: -40% auto -40% -38%;
    width: 34%;
    background: linear-gradient(90deg,transparent,rgba(255,255,255,.48),transparent);
    animation: accShine 3.8s ease-in-out infinite;
  }
  .account-container .btn-line {
    width: 100%;
    max-width: 190px;
    min-height: 40px;
    background: transparent;
  }

  .account-container .pw-field { position: relative; }
  .account-container .pw-field .acc-input { padding-right: 54px; }
  .account-container .pw-toggle {
    position: absolute;
    right: 8px; top: 50%;
    transform: translateY(-50%);
    width: 38px; height: 38px;
    margin-top: 4px;
    border-radius: 12px;
    border: 1px solid var(--acc-border);
    background: var(--acc-soft);
    color: var(--acc-muted);
    display: grid;
    place-items: center;
    cursor: pointer;
    font-size: 16px;
  }

  .account-container .score-wrap {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  .account-container .bignum {
    font-size: clamp(26px,3vw,44px);
    line-height: 1;
    font-weight: 650;
    letter-spacing: -.045em;
    color: var(--acc-text);
    margin-bottom: 8px;
  }
  .account-container .subcap { color: var(--acc-muted); font-weight: 600; font-size: 13px; }

  .account-container .prog {
    height: 14px;
    border-radius: 999px;
    overflow: hidden;
    background: color-mix(in srgb,var(--acc-page) 80%,var(--acc-card));
    border: 1px solid var(--acc-border);
    margin-bottom: 8px;
  }
  .account-container .prog .fill {
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg,var(--acc-accent),#22c77a,var(--acc-blue));
    box-shadow: 0 0 22px color-mix(in srgb,var(--acc-accent) 28%,transparent);
    transition: width .8s cubic-bezier(.2,.8,.2,1);
  }

  .account-container #levelsTrack {
    display: grid;
    grid-template-columns: repeat(2,minmax(0,1fr));
    gap: 14px;
    min-height: 120px;
  }
  .account-container .level-card,
  .account-container .summary-kpi,
  .account-container .affw-option {
    border: 1px solid var(--acc-border);
    border-radius: 22px;
    background: linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.015)), var(--acc-soft-2);
    padding: 16px;
    box-shadow: inset 0 1px 0 rgba(255,255,255,.045);
  }
  .account-container .level-card { text-align: center; }
  .account-container .level-card .level-name { font-size: 20px; font-weight: 800; color: var(--acc-accent); margin: 6px 0 4px; }
  .account-container .level-card .level-sub { font-size: 12px; color: var(--acc-muted); }
  .account-container .level-card.current { border-color: color-mix(in srgb,var(--acc-accent) 60%,var(--acc-border)); box-shadow: 0 0 0 2px color-mix(in srgb,var(--acc-accent) 14%,transparent); }

  .account-container .level-nav {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 14px;
  }

  .account-container .aff-header { align-items: flex-start; }
  .account-container .aff-progress { min-width: min(360px,46%); }
  .account-container .aff-progress .bar {
    height: 10px;
    border-radius: 999px;
    background: var(--acc-soft-2);
    border: 1px solid var(--acc-border);
    overflow: hidden;
    margin-bottom: 4px;
  }
  .account-container .aff-progress .fill {
    height: 100%;
    background: linear-gradient(90deg,var(--acc-accent),var(--acc-green));
  }

  .account-container .card-stack {
    display: grid;
    grid-template-columns: repeat(3,minmax(0,1fr));
    gap: 14px;
  }
  .account-container .summary-kpi {
    min-height: 132px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .account-container .rt-title { color: var(--acc-muted); font-weight: 600; font-size: 13px; margin-bottom: 6px; }
  .account-container .kpi-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-top: 12px;
  }

  .account-container code {
    display: inline-flex;
    max-width: 100%;
    padding: 3px 7px;
    border-radius: 9px;
    color: var(--acc-accent-2);
    background: color-mix(in srgb,var(--acc-page) 78%,transparent);
    border: 1px solid var(--acc-border);
    word-break: break-all;
    font-size: 12px;
  }

  .account-container .static-input.link-box {
    font-size: 13px;
    word-break: break-all;
    color: var(--acc-accent-2);
  }

  .account-container .flash-msg {
    padding: 12px 16px;
    border-radius: 16px;
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 16px;
    animation: accRise .3s ease both;
  }
  .account-container .flash-msg.success { background: rgba(8,184,79,.12); border: 1px solid rgba(8,184,79,.3); color: #38e986; }
  .account-container .flash-msg.error   { background: rgba(255,93,108,.12); border: 1px solid rgba(255,93,108,.3); color: #ffb6bf; }

  /* Responsive */
  @media (max-width: 1100px) {
    .acc-wrap { grid-template-columns: 1fr; }
    .acc-side { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .account-container .prof-card { margin-top: 0 !important; }
    .account-container .card-stack { grid-template-columns: 1fr; }
  }
  @media (max-width: 780px) {
    .account-container { padding: 12px; }
    .account-container .page-title { font-size: 42px; }
    .acc-side { grid-template-columns: 1fr; }
    .account-container .tabs { grid-template-columns: 1fr; }
    .account-container .tab { min-height: 46px; }
    .account-container .form-grid,
    .account-container .score-wrap,
    .account-container #levelsTrack { grid-template-columns: 1fr; }
    .account-container .email-row,
    .account-container .kpi-actions { flex-direction: column; align-items: stretch; }
    .account-container .card, .account-container .prof-card { border-radius: 22px; padding: 16px; }
  }
  @media (max-width: 520px) {
    .account-container .page-title { font-size: 34px; }
    .acc-prof-avatar { width: 112px; height: 112px; border-radius: 28px; }
    .acc-prof-avatar img { border-radius: 24px; }
    .account-container .card-header,
    .account-container .aff-header { flex-direction: column; align-items: flex-start; }
    .account-container .aff-progress { min-width: 100%; }
  }
  @media (prefers-reduced-motion: reduce) {
    .account-container::before, .account-container::after,
    .account-container .btn-lux::after,
    .account-container .btn-success::after { animation: none !important; }
    .account-container * { scroll-behavior: auto !important; transition: none !important; }
  }
`;

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('profile');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [affiliateData, setAffiliateData] = useState(null);
  const [showPw, setShowPw] = useState({ cur: false, new: false, con: false });
  const fileRef = useRef(null);

  useEffect(() => { loadProfile(); }, []);

  async function loadProfile() {
    const [meRes, profRes] = await Promise.all([fetch('/api/auth/me'), fetch('/api/account/profile')]);
    if (!meRes.ok) { router.push('/login'); return; }
    const [meData, profData] = await Promise.all([meRes.json(), profRes.ok ? profRes.json() : Promise.resolve(null)]);
    if (profData?.ok && profData.user) setUser(profData.user);
    else if (meData?.user) setUser(meData.user);
    setLoading(false);
  }

  useEffect(() => {
    if (tab === 'affiliate' && !affiliateData) loadAffiliate();
  }, [tab]);

  async function loadAffiliate() {
    const res = await fetch('/api/account/affiliate');
    const data = await res.json();
    if (data.ok) setAffiliateData(data.summary || data);
  }

  async function saveProfile(e) {
    e.preventDefault(); setBusy(true); setMsg(null);
    const form = new FormData(e.target);
    const res = await fetch('/api/account/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.get('name'), email: form.get('email') }),
    });
    const data = await res.json();
    setBusy(false);
    if (!data.ok) { setMsg({ type: 'error', text: data.error || data.message || 'บันทึกไม่สำเร็จ' }); return; }
    setMsg({ type: 'success', text: 'บันทึกสำเร็จ' });
    setUser((u) => ({ ...u, name: data.user?.name ?? u.name, email: data.user?.email ?? u.email }));
  }

  async function changePassword(e) {
    e.preventDefault(); setBusy(true); setMsg(null);
    const form = new FormData(e.target);
    if (form.get('newPassword') !== form.get('confirmPassword')) {
      setMsg({ type: 'error', text: 'รหัสผ่านใหม่ไม่ตรงกัน' }); setBusy(false); return;
    }
    const res = await fetch('/api/account/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: form.get('currentPassword'), newPassword: form.get('newPassword') }),
    });
    const data = await res.json();
    setBusy(false);
    setMsg(data.ok ? { type: 'success', text: 'เปลี่ยนรหัสผ่านสำเร็จ' } : { type: 'error', text: data.message || 'ไม่สำเร็จ' });
    if (data.ok) e.target.reset();
  }

  async function uploadAvatar(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setMsg(null);
    const form = new FormData();
    form.append('avatar', file);
    const res = await fetch('/api/account/avatar', { method: 'POST', body: form });
    const data = await res.json();
    setBusy(false);
    if (!data.ok) { setMsg({ type: 'error', text: data.message || 'อัปโหลดไม่สำเร็จ' }); return; }
    setMsg({ type: 'success', text: 'เปลี่ยนรูปสำเร็จ' });
    setUser((u) => ({ ...u, avatarUrl: data.avatarUrl }));
  }

  async function createAffiliateLink() {
    setBusy(true);
    const res = await fetch('/api/account/affiliate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create-link' }) });
    const data = await res.json();
    setBusy(false);
    if (data.ok) { setUser((u) => ({ ...u, affiliateKey: data.key || u.affiliateKey })); loadAffiliate(); }
    else setMsg({ type: 'error', text: data.error || 'สร้างลิงก์ไม่สำเร็จ' });
  }

  if (loading) return <div style={{ padding: '80px', textAlign: 'center', color: '#666' }}>กำลังโหลด...</div>;

  const affUrl = user?.affiliateKey ? `${typeof window !== 'undefined' ? window.location.origin : 'https://rtautobot.com'}/aff?aff=${user.affiliateKey}` : '';
  const points = Number(user?.points || 0);
  const totalSpent = Number(user?.totalSpent || 0);
  const toNextLevel = Number(user?.toNextLevel || 0);
  const pct = toNextLevel > 0 ? Math.min(100, Math.round((totalSpent / (totalSpent + toNextLevel)) * 100)) : (user?.nextLevelName ? 0 : 100);
  const hasAvatar = user?.avatarUrl && !user.avatarUrl.includes('icon-logo');

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <section className="account-container">
        <h1 className="page-title">ตั้งค่าข้อมูลส่วนตัว</h1>

        <div className="acc-wrap">
          {/* ── LEFT: Summary ── */}
          <aside className="acc-side">
            <div className="prof-card">
              <div className="acc-prof-avatar">
                {hasAvatar ? (
                  <img src={user.avatarUrl} alt="avatar" onError={(e) => { e.target.style.display = 'none'; }} />
                ) : (
                  <div className="acc-avatar-init">{(user?.username || 'U')[0].toUpperCase()}</div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                <button type="button" className="btn-line" onClick={() => fileRef.current?.click()}>
                  เปลี่ยนรูปโปรไฟล์
                </button>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={uploadAvatar} style={{ display: 'none' }} />
              </div>

              <div className="prof-name">{user?.name || user?.username}</div>
              <div className="prof-mail">
                {user?.email || '-'}
                {user?.email && (
                  user?.emailVerified
                    ? <span className="badge ok">ยืนยันแล้ว</span>
                    : <span className="badge warn">ยังไม่ยืนยัน</span>
                )}
              </div>

              <div className="kv">
                <div>ระดับบัญชี</div>
                <div><span className="badge warn">{user?.levelName || `เลเวล ${user?.level || 1}`}</span></div>
              </div>
              {user?.serial_key && (
                <div className="kv">
                  <div>Serial Key</div>
                  <div><span className="badge ok">{user.serial_key}</span></div>
                </div>
              )}
              <div className="kv">
                <div>ยอดคงเหลือ</div>
                <div><span className="badge balance">฿{Number(user?.balance || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span></div>
              </div>

              <div className="muted sm" style={{ marginTop: '8px' }}>ไฟล์ที่รองรับ: png, jpg, jpeg, webp, gif (สูงสุด 10MB)</div>
            </div>

            <div className="prof-card" style={{ marginTop: '14px' }}>
              <div className="kv">
                <div>ยืนยันตัวตน KYC</div>
                <div><span className="badge danger">ยังไม่เปิดใช้งาน</span></div>
              </div>
              <div className="kv">
                <div>ช่วยเหลือ</div>
                <div><a className="badge ok" href="https://line.me/R/ti/p/@507vkplq" target="_blank" rel="noopener">LINE Official</a></div>
              </div>
            </div>
          </aside>

          {/* ── RIGHT: Tabs ── */}
          <div className="acc-main">
            {msg && (
              <div className={`flash-msg ${msg.type}`}>{msg.text}</div>
            )}

            <div className="tabs">
              {[
                { key: 'profile', label: 'การตั้งค่าทั่วไป' },
                { key: 'levels', label: 'ข้อมูลระดับบัญชี' },
                { key: 'affiliate', label: 'แนะนำเพื่อน' },
              ].map(({ key, label }) => (
                <button key={key} className={`tab${tab === key ? ' active' : ''}`}
                  onClick={() => { setTab(key); setMsg(null); }}>
                  {label}
                </button>
              ))}
            </div>

            {/* ── Tab: General (profile + password) ── */}
            <div className={`tabpane${tab === 'profile' ? ' show' : ''}`}>
              {/* Profile form */}
              <form className="card" onSubmit={saveProfile}>
                <div className="card-header">
                  <div className="title">ข้อมูลส่วนตัว</div>
                </div>
                <div className="form-grid">
                  <label>ชื่อ - นามสกุล
                    <input className="acc-input" name="name" type="text" defaultValue={user?.name || ''} placeholder="ระบุชื่อ-นามสกุล" disabled={!!user?.name} />
                    {user?.name && <small className="muted sm">ตั้งแล้ว หากต้องการเปลี่ยนให้ติดต่อผู้ดูแล</small>}
                  </label>
                  <label>Username
                    <div className="static-input">{user?.username || '-'}</div>
                  </label>
                  <label className="full-col">Email Address
                    <div className="email-row">
                      <input className="acc-input" name="email" type="email" defaultValue={user?.email || ''} placeholder="name@example.com" disabled={!!user?.email} />
                      {user?.email && (
                        user?.emailVerified
                          ? <span className="badge2 ok" style={{ whiteSpace: 'nowrap' }}>ยืนยันแล้ว</span>
                          : <span className="badge2 warn" style={{ whiteSpace: 'nowrap' }}>ยังไม่ยืนยัน</span>
                      )}
                    </div>
                  </label>
                  <label>Timezone
                    <div className="static-input">(GMT+7:00) Asia/Bangkok (Thailand Time)</div>
                  </label>
                  <label>สกุลเงิน
                    <div className="static-input">{user?.currency || 'THB'}</div>
                  </label>
                </div>
                <div className="card-actions">
                  <button className="btn-lux" type="submit" disabled={busy}>บันทึกข้อมูล</button>
                </div>
              </form>

              {/* Password form */}
              <form className="card" onSubmit={changePassword}>
                <div className="card-header">
                  <div className="title">เปลี่ยนรหัสผ่าน</div>
                </div>
                <div className="form-grid">
                  {[
                    { name: 'currentPassword', label: 'รหัสผ่านเดิม', key: 'cur' },
                    { name: 'newPassword', label: 'รหัสผ่านใหม่', key: 'new', minLength: 6 },
                    { name: 'confirmPassword', label: 'ยืนยันรหัสผ่านใหม่', key: 'con', minLength: 6 },
                  ].map(({ name, label, key, minLength }) => (
                    <label key={name}>{label}
                      <div className="pw-field">
                        <input className="acc-input" name={name} type={showPw[key] ? 'text' : 'password'} minLength={minLength} required />
                        <button type="button" className="pw-toggle"
                          onClick={() => setShowPw((p) => ({ ...p, [key]: !p[key] }))}>
                          {showPw[key] ? '🙈' : '👁'}
                        </button>
                      </div>
                    </label>
                  ))}
                </div>
                <div className="card-actions">
                  <button className="btn-lux" type="submit" disabled={busy}>เปลี่ยนรหัสผ่าน</button>
                </div>
              </form>
            </div>

            {/* ── Tab: Points & Levels ── */}
            <div className={`tabpane${tab === 'levels' ? ' show' : ''}`}>
              {/* Points card */}
              <div className="card">
                <div className="card-header">
                  <div className="title">คะแนนสะสม (Points)</div>
                  <span className="pill lvl">{user?.levelName || `เลเวล ${user?.level || 1}`}</span>
                </div>
                <div className="form-grid">
                  <div className="score-wrap full-col">
                    <div>
                      <div className="bignum">{points.toLocaleString(undefined, { maximumFractionDigits: 2 })} คะแนน</div>
                      <div className="muted" style={{ color: '#31d810' }}>ใช้จ่ายครบ ฿50 | ได้รับ 0.5 Point</div>
                    </div>
                    <div>
                      <div className="kv" style={{ marginBottom: '8px' }}>
                        <div>เรทแลกเป็นเงิน</div>
                        <div><span className="badge balance">฿{Number(user?.pointRateTHB || 0).toLocaleString()} / 1 แต้ม</span></div>
                      </div>
                      <div className="kv">
                        <div>มูลค่าแลกได้</div>
                        <div><span className="badge balance">≈ ฿{Number(user?.pointValueTHB || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
                      </div>
                      <div className="kv" style={{ color: '#05b84f' }}>
                        <div>⚠️ คำเตือน: เมื่อแลกแต้มเป็นเงินระดับบัญชีของคุณจะลดลงตามไปด้วย</div>
                      </div>
                      <div className="card-actions" style={{ textAlign: 'right', padding: '12px 0 0' }}>
                        <button
                          className={`btn${points >= 100 ? ' btn-lux' : ''}`}
                          disabled={points < 100 || busy}
                          title={points < 100 ? `ต้องมีอย่างน้อย 100 แต้ม (ขาดอีก ${Math.max(0, 100 - points)} แต้ม)` : ''}>
                          แลกแต้มเป็นเงิน (ขั้นต่ำ 100 แต้ม)
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Total Spent card */}
              <div className="card">
                <div className="card-header">
                  <div className="title">ยอดใช้จ่ายสะสม</div>
                  <span className="pill lvl">{user?.levelName || `เลเวล ${user?.level || 1}`}</span>
                </div>
                <div className="form-grid">
                  <div className="score-wrap full-col">
                    <div>
                      <div className="bignum">฿{totalSpent.toFixed(2)}</div>
                      <div className="subcap">ใช้จ่ายไปแล้ว</div>
                      <div className="muted">ยอดทั้งหมด: ฿{Number(user?.totalSpentRaw || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                      <div className="muted">· แลกเครดิตไปแล้ว: ฿{Number(user?.redeemedSpent || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                      <div className="muted">· ใช้แต้มไปแล้ว: {Number(user?.pointsRedeemed || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} Point</div>
                    </div>
                    <div>
                      <div className="prog">
                        <div className="fill" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="subcap" style={{ marginTop: '6px' }}>
                        เป้าหมายเลเวลถัดไป: ฿{(totalSpent + toNextLevel).toLocaleString()} ({pct}%)
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Level info card */}
              <div className="card">
                <div className="card-header">
                  <div className="title">ข้อมูลระดับบัญชี</div>
                </div>
                <div id="levelsTrack">
                  <div className={`level-card current`}>
                    <div className="subcap">ระดับปัจจุบัน</div>
                    <div className="level-name">{user?.levelName || `เลเวล ${user?.level || 1}`}</div>
                    <div className="level-sub">ยอดสะสม ฿{totalSpent.toLocaleString()}</div>
                  </div>
                  {user?.nextLevelName && (
                    <div className="level-card">
                      <div className="subcap">ระดับถัดไป</div>
                      <div className="level-name" style={{ color: 'var(--acc-text)' }}>{user.nextLevelName}</div>
                      <div className="level-sub">ใช้จ่ายอีก ฿{toNextLevel.toLocaleString()}</div>
                    </div>
                  )}
                </div>
                <div className="level-nav">
                  <button className="btn" disabled>‹</button>
                  <button className="btn btn-lux" disabled>›</button>
                </div>
              </div>
            </div>

            {/* ── Tab: Affiliate ── */}
            <div className={`tabpane${tab === 'affiliate' ? ' show' : ''}`}>
              {/* Info card */}
              <div className="card">
                <div className="card-header">
                  <div className="title">ระบบแนะนำเพื่อน (Affiliate {affiliateData?.ratePct ?? 5}%)</div>
                </div>
                <div className="form-grid">
                  <div className="muted full-col">
                    <ul style={{ margin: '0 0 0 18px', padding: 0 }}>
                      <li>คุณจะได้รับ <strong style={{ color: 'var(--acc-text)' }}>{affiliateData?.ratePct ?? 5}%</strong> ของยอดออเดอร์ทุกคำสั่งซื้อของเพื่อนที่สมัครผ่านลิงก์ของคุณ</li>
                      <li>ระบบคิดให้อัตโนมัติทุกครั้งที่คำสั่งซื้อของเพื่อนอยู่ในสถานะนับยอด</li>
                      <li>ลิงก์แนะนำจะถูกสร้างเมื่อคุณกดปุ่ม "สร้างลิงก์แนะนำ" เท่านั้น และเป็นคีย์เฉพาะตัว</li>
                      <li>ตัวอย่างรูปแบบลิงก์: <code>https://rtautobot.com/aff?=รหัสแนะนำเพื่อนของคุณ</code></li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Summary KPIs */}
              <div className="card" style={{ marginTop: '14px' }}>
                <div className="card-header aff-header">
                  <div className="title">สรุปรายได้จากการแนะนำ</div>
                  <div className="aff-progress">
                    <div className="bar">
                      <div className="fill" style={{ width: affiliateData ? `${Math.min(100, ((affiliateData.referredCount || 0) / 10) * 100)}%` : '0%' }} />
                    </div>
                    <div className="muted sm">{affiliateData?.referredCount || 0} คนที่คุณแนะนำ</div>
                  </div>
                  <span className="pill">
                    <span>{affiliateData?.referredCount ?? 0}</span> คนที่คุณแนะนำ
                  </span>
                </div>
                <div className="card-stack">
                  <div className="summary-kpi">
                    <div className="rt-title">จำนวนออเดอร์ทั้งหมด</div>
                    <div className="bignum">{(affiliateData?.orders || 0).toLocaleString()}</div>
                  </div>
                  <div className="summary-kpi">
                    <div className="rt-title">ยอดใช้จ่ายรวมของเพื่อน</div>
                    <div className="bignum">฿{Number(affiliateData?.spentTHB || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  </div>
                  <div className="summary-kpi">
                    <div className="rt-title">รายได้การแนะนำเพื่อนของคุณ ({affiliateData?.ratePct ?? 5}%)</div>
                    <div className="bignum" style={{ color: '#31d810' }}>
                      {Number(affiliateData?.withdrawableTHB || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                    <div className="kpi-actions">
                      <div className="muted small">ยอดที่ถอนได้ตอนนี้: ฿{Number(affiliateData?.withdrawableTHB || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                      <button className="btn-success" disabled={Number(affiliateData?.withdrawableTHB || 0) <= 0}>
                        ถอนรายได้
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Affiliate link */}
              <div className="card" style={{ marginTop: '14px' }}>
                <div className="card-header">
                  <div className="title">ลิงก์แนะนำเพื่อน</div>
                </div>
                <div className="form-grid">
                  {affUrl ? (
                    <div className="full-col">
                      <label>ลิงก์ของคุณ
                        <div className="static-input link-box">{affUrl}</div>
                      </label>
                      <div className="card-actions" style={{ textAlign: 'right', padding: '0', marginTop: '12px' }}>
                        <button className="btn" onClick={() => navigator.clipboard.writeText(affUrl)}>คัดลอกลิงก์</button>
                      </div>
                    </div>
                  ) : (
                    <div className="full-col">
                      <button className="btn-lux" onClick={createAffiliateLink} disabled={busy}>+ สร้างลิงก์แนะนำ</button>
                      <small className="muted">ลิงก์จะถูกสร้างเพียงครั้งเดียว และใช้งานได้ตลอด</small>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
