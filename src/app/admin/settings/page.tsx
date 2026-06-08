'use client';

import { useState, useEffect, useRef } from 'react';
import { notifyMsg, confirmAction } from '../../../lib/clientNotify';
import SvgIcon from '@/components/SvgIcon';

const CSS = `
.rt-admin-settings {
  --line-green: #05b84f;
  --line-green2: #08b84f;
  --green: #40e88a;
  --red: #ff6b76;
  --bg: #08090d;
  --card: #17181f;
  --card2: #202126;
  --line: rgba(255,255,255,.09);
  --line-green-border: rgba(6,199,85,.28);
  --text: #e8fff1;
  --muted: #9fb9ad;
  color: var(--text);
}
.rt-admin-settings .container {
  max-width: calc(100vw - 72px);
  margin: 0 auto;
  padding: 24px 16px 64px;
}
.rt-admin-settings .as-hero {
  display: grid;
  grid-template-columns: minmax(0,1.35fr) minmax(420px,.9fr);
  gap: 28px;
  align-items: center;
  border: 1px solid var(--line);
  border-radius: 30px;
  padding: 36px 42px;
  background:
    radial-gradient(circle at 15% 15%, rgba(5,184,79,.14), transparent 30%),
    radial-gradient(circle at 95% 25%, rgba(80,92,255,.2), transparent 34%),
    linear-gradient(135deg, rgba(255,255,255,.075), rgba(255,255,255,.025));
  box-shadow: 0 28px 90px rgba(0,0,0,.42);
  overflow: hidden;
}
.rt-admin-settings .as-kicker {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 999px;
  border: 1px solid rgba(5,184,79,.26);
  background: rgba(5,184,79,.09);
  color: #08b84f;
  text-transform: uppercase;
  font-weight: 900;
  font-size: 13px;
  letter-spacing: .02em;
}
.rt-admin-settings h1 {
  font-size: clamp(46px, 6vw, 82px);
  line-height: .92;
  margin: 18px 0 20px;
  letter-spacing: -.055em;
  color: #e8fff1;
  text-shadow: 0 10px 36px rgba(5,184,79,.13);
}
.rt-admin-settings .as-hero p {
  margin: 0;
  max-width: 850px;
  color: #b8d7c6;
  font-size: clamp(16px, 1.45vw, 21px);
  line-height: 1.75;
  font-weight: 800;
}
.rt-admin-settings .as-hero__stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0,1fr));
  gap: 14px;
}
.rt-admin-settings .as-stat {
  min-height: 96px;
  border: 1px solid var(--line);
  border-radius: 20px;
  padding: 20px 22px;
  background: linear-gradient(135deg, rgba(255,255,255,.08), rgba(255,255,255,.025));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.05);
}
.rt-admin-settings .as-stat span {
  display: block;
  color: #9fb9ad;
  font-size: 13px;
  font-weight: 900;
}
.rt-admin-settings .as-stat strong {
  display: block;
  margin-top: 8px;
  color: #08b84f;
  font-size: clamp(28px, 3vw, 38px);
  line-height: 1;
  font-weight: 1000;
}
.rt-admin-settings .tabpane { display: block; }
.rt-admin-settings .admin-card {
  border: 1px solid var(--line);
  border-radius: 28px;
  padding: 28px 30px;
  background: linear-gradient(135deg, rgba(255,255,255,.06), rgba(255,255,255,.025));
  box-shadow: 0 24px 80px rgba(0,0,0,.38);
}
.rt-admin-settings .admin-card__header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 24px;
  padding-bottom: 22px;
  border-bottom: 1px solid rgba(255,255,255,.075);
}
.rt-admin-settings .admin-card__header h2 {
  font-size: clamp(25px, 3vw, 38px);
  margin: 0 0 10px;
  letter-spacing: -.035em;
  color: #e8fff1;
}
.rt-admin-settings .muted {
  color: #a8c8b8;
  font-weight: 800;
  line-height: 1.65;
}
.rt-admin-settings .admin-card__badge {
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: 999px;
  padding: 12px 18px;
  font-size: 13px;
  font-weight: 1000;
  border: 1px solid var(--line-green-border);
  color: #08b84f;
  background: rgba(5,184,79,.10);
  box-shadow: 0 10px 32px rgba(5,184,79,.10);
}
.rt-admin-settings .admin-card__badge--ok::before {
  content: '•';
  color: #21b95c;
}
.rt-admin-settings .admin-card__badge--readonly {
  border-color: rgba(255,107,118,.28);
  background: rgba(255,107,118,.08);
  color: #ffb9bf;
}
.rt-admin-settings .fieldset {
  border: 1px solid rgba(255,255,255,.075);
  border-radius: 24px;
  padding: 22px 22px 26px;
  background: rgba(0,0,0,.12);
}
.rt-admin-settings .fieldset__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 18px;
}
.rt-admin-settings .fieldset__header h3 {
  margin: 0;
  color: #08b84f;
  font-size: 20px;
}
.rt-admin-settings .grid { display: grid; }
.rt-admin-settings .cards { grid-template-columns: repeat(4, minmax(0,1fr)); }
.rt-admin-settings .gap-md { gap: 18px; }
.rt-admin-settings .cols-2 { grid-template-columns: repeat(2, minmax(0,1fr)); }
.rt-admin-settings .mt    { margin-top: 16px; }
.rt-admin-settings .mt-xs { margin-top: 12px; }
.rt-admin-settings .mt-sm { margin-top: 16px; }
.rt-admin-settings .mt-xl { margin-top: 26px; }
.rt-admin-settings .bank-card {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,.085);
  border-radius: 24px;
  padding: 20px;
  background:
    radial-gradient(circle at 80% 0%, rgba(5,184,79,.10), transparent 32%),
    linear-gradient(135deg, rgba(255,255,255,.06), rgba(255,255,255,.025));
  box-shadow: 0 18px 50px rgba(0,0,0,.26);
}
.rt-admin-settings .bank-card__header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 20px;
}
.rt-admin-settings .bank-name {
  font-size: 18px;
  font-weight: 1000;
  color: #e8fff1;
}
.rt-admin-settings .bank-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  color: #9fb9ad;
  font-weight: 900;
  font-size: 12px;
}
.rt-admin-settings .bank-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #05b84f;
  flex-shrink: 0;
}
.rt-admin-settings .bank-card__actions {
  display: flex;
  gap: 9px;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  flex-shrink: 0;
}
.rt-admin-settings .bank-pill,
.rt-admin-settings .bank-save-btn,
.rt-admin-settings .bank-delete-btn {
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.1);
  padding: 9px 12px;
  font-weight: 1000;
  font-size: 12px;
}
.rt-admin-settings .bank-pill--on {
  border-color: rgba(64,232,138,.36);
  background: rgba(64,232,138,.12);
  color: #62ff9f;
  box-shadow: 0 0 28px rgba(64,232,138,.12);
}
.rt-admin-settings .bank-pill--off {
  border-color: rgba(255,107,118,.34);
  background: rgba(255,107,118,.1);
  color: #ffb4bb;
}
.rt-admin-settings .bank-save-btn,
.rt-admin-settings .bank-delete-btn {
  cursor: pointer;
  font-family: inherit;
}
.rt-admin-settings .bank-save-btn {
  background: rgba(64,232,138,.12);
  border-color: rgba(64,232,138,.36);
  color: #62ff9f;
}
.rt-admin-settings .bank-save-btn:disabled {
  opacity: .62;
  cursor: not-allowed;
}
.rt-admin-settings .bank-delete-btn {
  background: rgba(255,107,118,.1);
  border-color: rgba(255,107,118,.34);
  color: #ffb4bb;
}
.rt-admin-settings .form-group { display: grid; gap: 8px; }
.rt-admin-settings .form-group label {
  color: #9fb9ad;
  font-weight: 1000;
  font-size: 13px;
}
.rt-admin-settings input[type='text'],
.rt-admin-settings input:not([type]),
.rt-admin-settings select {
  width: 100%;
  min-height: 46px;
  border: 1px solid rgba(5,184,79,.13);
  border-radius: 15px;
  padding: 12px 15px;
  background: rgba(4,5,8,.72);
  color: #e8fff1;
  font-weight: 850;
  outline: none;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.03);
  font-family: inherit;
}
.rt-admin-settings input:focus,
.rt-admin-settings select:focus {
  border-color: rgba(6,199,85,.55);
  box-shadow: 0 0 0 4px rgba(5,184,79,.07);
}
.rt-admin-settings input[readonly] {
  opacity: .6;
  cursor: not-allowed;
}
.rt-admin-settings .toggles {
  display: grid;
  gap: 10px;
  margin-top: 16px;
}
.rt-admin-settings .checkbox {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 34px;
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 999px;
  padding: 7px 12px;
  background: rgba(5,6,10,.45);
  color: #b8d7c6;
  font-weight: 1000;
  cursor: pointer;
  font-size: 14px;
}
.rt-admin-settings .checkbox input {
  appearance: none;
  -webkit-appearance: none;
  width: 36px;
  height: 22px;
  min-width: 36px;
  border-radius: 999px;
  background: #e7e7e7;
  position: relative;
  cursor: pointer;
  transition: .18s ease;
  box-shadow: inset 0 2px 6px rgba(0,0,0,.32);
  flex-shrink: 0;
}
.rt-admin-settings .checkbox input::before {
  content: '';
  position: absolute;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  left: 2px;
  top: 2px;
  background: #fff;
  transition: .18s ease;
  box-shadow: 0 2px 6px rgba(0,0,0,.35);
}
.rt-admin-settings .checkbox input:checked {
  background: linear-gradient(135deg, #37df68, #59f38b);
  box-shadow: 0 0 18px rgba(58,230,115,.35);
}
.rt-admin-settings .checkbox input:checked::before {
  transform: translateX(14px);
}
.rt-admin-settings .checkbox input:disabled {
  opacity: .5;
  cursor: not-allowed;
}
.rt-admin-settings .checkbox input.loading {
  outline: 2px solid rgba(6,199,85,.35);
}
.rt-admin-settings .checkbox input.toggle-error {
  outline: 2px solid rgba(255,107,118,.45);
}
.rt-admin-settings .add-wallet-fieldset {
  background: linear-gradient(135deg, rgba(255,255,255,.04), rgba(6,199,85,.035));
}
.rt-admin-settings .admin-card__footer {
  display: flex;
  flex-direction: column;
}
.rt-admin-settings .settings-save-btn {
  position: relative;
  width: 100%;
  min-height: 56px;
  border: 0;
  border-radius: 18px;
  cursor: pointer;
  color: #03150f;
  font-weight: 1000;
  font-size: 17px;
  overflow: hidden;
  background: linear-gradient(135deg, #21b95c, #00a843);
  box-shadow: 0 20px 50px rgba(5,184,79,.18);
  font-family: inherit;
}
.rt-admin-settings .settings-save-btn:disabled {
  opacity: .65;
  cursor: not-allowed;
}
.rt-admin-settings .settings-save-btn__glow {
  position: absolute;
  inset: -60% auto -60% 20%;
  width: 30%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.75), transparent);
  transform: skewX(-18deg);
  animation: rtShine 3.6s ease-in-out infinite;
}
.rt-admin-settings .settings-save-btn__label { position: relative; }
.rt-admin-settings .empty-wallet-state {
  display: grid;
  place-items: center;
  text-align: center;
  gap: 8px;
  min-height: 180px;
  border: 1px dashed rgba(5,184,79,.22);
  border-radius: 22px;
  color: #a8c8b8;
  background: rgba(6,199,85,.045);
  margin-bottom: 18px;
}
.rt-admin-settings .empty-wallet-state__icon { font-size: 36px; }
.rt-admin-settings .empty-wallet-state strong { color: #08b84f; font-size: 18px; }
.rt-admin-settings .empty-wallet-state p { margin: 0; color: #9fb9ad; font-weight: 800; }
.rt-admin-settings .as-msg {
  border-radius: 18px;
  padding: 14px 18px;
  font-weight: 900;
  font-size: 15px;
  margin-bottom: 16px;
  width: 100%;
}
.rt-admin-settings .as-msg.ok {
  border: 1px solid rgba(5,184,79,.3);
  background: rgba(5,184,79,.1);
  color: #62ff9f;
}
.rt-admin-settings .as-msg.err {
  border: 1px solid rgba(255,107,118,.3);
  background: rgba(255,107,118,.1);
  color: #ffb4bb;
}
@keyframes rtShine {
  0%, 55% { transform: translateX(-180%) skewX(-18deg); }
  100%     { transform: translateX(520%) skewX(-18deg); }
}
@media (max-width: 1280px) {
  .rt-admin-settings .cards { grid-template-columns: repeat(2, minmax(0,1fr)); }
  .rt-admin-settings .as-hero { grid-template-columns: 1fr; }
  .rt-admin-settings .as-hero__stats { grid-template-columns: repeat(4, minmax(0,1fr)); }
}
@media (max-width: 820px) {
  .rt-admin-settings .container { max-width: 100%; padding: 14px 10px 50px; }
  .rt-admin-settings .as-hero { padding: 24px 20px; border-radius: 24px; }
  .rt-admin-settings .as-hero__stats { grid-template-columns: repeat(2, minmax(0,1fr)); }
  .rt-admin-settings .cards, .rt-admin-settings .cols-2 { grid-template-columns: 1fr; }
  .rt-admin-settings .admin-card { padding: 20px 16px; border-radius: 22px; }
  .rt-admin-settings .admin-card__header,
  .rt-admin-settings .fieldset__header { flex-direction: column; }
  .rt-admin-settings h1 { font-size: 44px; }
  .rt-admin-settings .bank-card__header { flex-direction: column; }
  .rt-admin-settings .bank-card__actions { justify-content: flex-start; }
  .rt-admin-settings .admin-card__badge { white-space: normal; }
}
`;

const BANKS_LIST = [
  { code: 'bbl',  label: 'ธนาคารกรุงเทพ' },
  { code: 'kbank',label: 'ธนาคารกสิกรไทย' },
  { code: 'ktb',  label: 'ธนาคารกรุงไทย' },
  { code: 'bay',  label: 'ธนาคารกรุงศรีอยุธยา' },
  { code: 'scb',  label: 'ธนาคารไทยพาณิชย์' },
  { code: 'ttb',  label: 'ธนาคารทหารไทยธนชาต (TTB)' },
  { code: 'gsb',  label: 'ธนาคารออมสิน' },
  { code: 'baac', label: 'ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร' },
  { code: 'kkp',  label: 'ธนาคารเกียรตินาคินภัทร' },
  { code: 'tw',   label: 'TrueMoney Wallet' },
  { code: 'qr',   label: 'PromptPay QR' },
];

const labelMap = {};
BANKS_LIST.forEach((b) => { labelMap[b.code] = b.label; });

const typeLabel = (type) =>
  String(type || 'DEPOSIT').toUpperCase() === 'WITHDRAW' ? 'บัญชีถอน' : 'บัญชีฝาก';

const EMPTY_NEW = {
  accountName: '', type: 'DEPOSIT', accountCode: '',
  accountNumber: '', secret: '', isActive: true, isSMS: false, isAuto: true,
};

export default function AdminSettingsPage() {
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [canWrite, setCanWrite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savingWalletId, setSavingWalletId] = useState(null);
  const [msg, setMsg] = useState(null);
  const [newWallet, setNewWallet] = useState({ ...EMPTY_NEW });
  const audioCtxRef = useRef(null);

  useEffect(() => { loadWallets(); }, []);

  async function loadWallets() {
    try {
      const res = await fetch('/api/admin/wallets');
      const data = await res.json();
      if (data.ok) {
        setWallets(data.wallets || []);
        setCanWrite(data.canWrite ?? true);
      }
    } catch {}
    setLoading(false);
  }

  function getAudioCtx() {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtxRef.current;
  }

  function playToggle(on) {
    try {
      const ctx = getAudioCtx();
      const [f1, f2] = on ? [720, 1120] : [620, 340];
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(f1, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(f2, ctx.currentTime + 0.06);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.12);
    } catch {}
  }

  function updateWallet(id, field, value) {
    setWallets((prev) => prev.map((w) => w._id === id ? { ...w, [field]: value } : w));
  }

  async function handleToggle(walletId, field, value) {
    updateWallet(walletId, field, value);
    playToggle(value);
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(8);
    } catch {}
    try {
      const res = await fetch('/api/admin/wallet/update-toggle', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: walletId, field, value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.message || `HTTP ${res.status}`);
      if (data.wallet) {
        setWallets((prev) => prev.map((w) =>
          w._id === walletId
            ? { ...w, isActive: data.wallet.isActive, isSMS: data.wallet.isSMS, isAuto: data.wallet.isAuto }
            : w
        ));
      }
    } catch {
      updateWallet(walletId, field, !value);
    }
  }

  async function handleSaveWallet(walletId) {
    const wallet = wallets.find((w) => w._id === walletId);
    if (!wallet || !canWrite) return;
    setSavingWalletId(walletId);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallets: [wallet], newWallet: null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.message || 'บันทึกบัญชีไม่สำเร็จ');
      if (data.wallets) setWallets(data.wallets);
      notifyMsg(setMsg, { type: 'ok', text: 'บันทึกบัญชีรับเงินสำเร็จ และหน้าเติมเงินอัปเดตแล้ว' });
    } catch (err: any) {
      notifyMsg(setMsg, { type: 'err', text: '' + (err.message || 'บันทึกบัญชีไม่สำเร็จ') });
      await loadWallets();
    } finally {
      setSavingWalletId(null);
    }
  }

  async function handleDelete(id) {
    if (!await confirmAction({ title: 'ลบบัญชีรับเงิน', message: 'ยืนยันลบบัญชีนี้หรือไม่?', detail: 'บัญชีนี้จะถูกนำออกจากรายการเติมเงิน', confirmText: 'ลบบัญชี', cancelText: 'ยกเลิก', variant: 'danger' })) return;
    setWallets((prev) => prev.filter((w) => w._id !== id));
    try {
      const res = await fetch(`/api/admin/wallets/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
    } catch {
      await loadWallets();
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallets,
          newWallet: newWallet.accountCode ? newWallet : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.message || 'บันทึกไม่สำเร็จ');
      if (data.wallets) setWallets(data.wallets);
      setNewWallet({ ...EMPTY_NEW });
      notifyMsg(setMsg, { type: 'ok', text: 'บันทึกข้อมูลสำเร็จ และหน้าเติมเงินอัปเดตแล้ว' });
    } catch (err: any) {
      notifyMsg(setMsg, { type: 'err', text: '' + (err.message || 'บันทึกไม่สำเร็จ') });
    } finally {
      setBusy(false);
    }
  }

  const walletTotal  = wallets.length;
  const walletActive = wallets.filter((w) => w.isActive).length;
  const walletAuto   = wallets.filter((w) => w.isAuto).length;

  return (
    <div className="rt-admin-settings">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <section className="page container admin-settings">

        {/* ── Hero ── */}
        <header className="as-hero">
          <div className="as-hero__copy">
            <span className="as-kicker"><SvgIcon name="spark" size={18} /> System Control Center</span>
            <h1>ตั้งค่าเว็บไซต์</h1>
            <p>จัดการบัญชีรับเงินของ สำหรับระบบเติมเครดิตอัตโนมัติ</p>
          </div>
          <div className="as-hero__stats" aria-label="ภาพรวมบัญชีรับเงิน">
            <div className="as-stat">
              <span>โหมดแก้ไข</span>
              <strong>{canWrite ? 'เปิดใช้งาน' : 'อ่านอย่างเดียว'}</strong>
            </div>
            <div className="as-stat">
              <span>บัญชีรับเงิน</span>
              <strong>{walletTotal}</strong>
            </div>
            <div className="as-stat">
              <span>กำลังใช้งาน</span>
              <strong>{walletActive}</strong>
            </div>
            <div className="as-stat">
              <span>Auto Topup</span>
              <strong>{walletAuto}</strong>
            </div>
          </div>
        </header>

        {/* ── Wallets ── */}
        <section id="tab-wallets" className="tabpane show">
          <form className="mt admin-card" onSubmit={handleSave}>

            <div className="admin-card__header">
              <div>
                <h2>ตั้งค่าบัญชีรับเงินของเว็บ</h2>
                <p className="muted">TrueWallet / KBank / SCB / PromptPay QR ฯลฯ ใช้สำหรับระบบเติมเงินอัตโนมัติของ</p>
              </div>
              <div className={`admin-card__badge ${canWrite ? 'admin-card__badge--ok' : 'admin-card__badge--readonly'}`}>
                {canWrite ? 'สามารถแก้ไขได้' : 'READONLY'}
              </div>
            </div>

            <div className="fieldset">
              <div className="fieldset__header">
                <h3>บัญชีที่มีอยู่ในระบบ</h3>
                <p className="muted">แก้ไขชื่อบัญชี เลขบัญชี Secret และสถานะการใช้งานได้จากตรงนี้</p>
              </div>

              {loading ? (
                <div className="empty-wallet-state"><SvgIcon name="hourglass" size={18} /> กำลังโหลด...</div>
              ) : wallets.length === 0 ? (
                <div className="empty-wallet-state">
                  <div className="empty-wallet-state__icon"><SvgIcon name="bank" size={18} /></div>
                  <strong>ยังไม่เพิ่มบัญชีรับเงิน</strong>
                  <p>เพิ่มบัญชีแรกจากฟอร์มด้านล่างเพื่อเริ่มใช้งานระบบเติมเครดิต</p>
                </div>
              ) : (
                <div className="grid cards gap-md">
                  {wallets.map((w) => {
                    const code = String(w.accountCode || '').toLowerCase();
                    const label = labelMap[code] || String(code || 'wallet').toUpperCase();
                    const accType = String(w.type || 'DEPOSIT').toUpperCase();
                    return (
                      <div key={w._id} className="bank-card">
                        <div className="bank-card__header">
                          <div className="bank-title">
                            <div className="bank-name">{label}</div>
                            <div className="bank-meta">
                              <span className="bank-code">{code.toUpperCase()}</span>
                              <span className="bank-dot" />
                              <span className="bank-type">{typeLabel(accType)}</span>
                            </div>
                          </div>
                          <div className="bank-card__actions">
                            <div className={`bank-pill ${w.isActive ? 'bank-pill--on' : 'bank-pill--off'}`}>
                              {w.isActive ? 'กำลังใช้งาน' : 'ปิดใช้งาน'}
                            </div>
                            {canWrite && (
                              <>
                                <button
                                  type="button"
                                  className="bank-save-btn"
                                  disabled={savingWalletId === w._id}
                                  onClick={() => handleSaveWallet(w._id)}
                                >
                                  {savingWalletId === w._id ? 'กำลังบันทึก...' : 'บันทึก'}
                                </button>
                                <button
                                  type="button"
                                  className="bank-delete-btn"
                                  onClick={() => handleDelete(w._id)}
                                >
                                  ลบบัญชี
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="form-group mt-sm">
                          <label>ชื่อบัญชี</label>
                          <input
                            type="text"
                            value={w.accountName || ''}
                            onChange={(e) => updateWallet(w._id, 'accountName', e.target.value)}
                            readOnly={!canWrite}
                          />
                        </div>

                        <div className="form-group mt-xs">
                          <label>เลขบัญชี / เบอร์</label>
                          <input
                            type="text"
                            value={w.accountNumber || ''}
                            onChange={(e) => updateWallet(w._id, 'accountNumber', e.target.value)}
                            readOnly={!canWrite}
                          />
                        </div>

                        <div className="toggles toggles-existing">
                          <label className="checkbox">
                            <input
                              type="checkbox"
                              checked={!!w.isActive}
                              disabled={!canWrite}
                              onChange={(e) => handleToggle(w._id, 'isActive', e.target.checked)}
                            />
                            <span>ใช้งาน</span>
                          </label>
                          <label className="checkbox">
                            <input
                              type="checkbox"
                              checked={!!w.isSMS}
                              disabled={!canWrite}
                              onChange={(e) => handleToggle(w._id, 'isSMS', e.target.checked)}
                            />
                            <span>อ่าน SMS</span>
                          </label>
                          <label className="checkbox">
                            <input
                              type="checkbox"
                              checked={!!w.isAuto}
                              disabled={!canWrite}
                              onChange={(e) => handleToggle(w._id, 'isAuto', e.target.checked)}
                            />
                            <span>Auto Topup</span>
                          </label>
                        </div>

                        <div className="form-group mt-sm">
                          <label>secret</label>
                          <input
                            type="text"
                            value={w.secret || ''}
                            onChange={(e) => updateWallet(w._id, 'secret', e.target.value)}
                            readOnly={!canWrite}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {canWrite && (
              <div className="fieldset mt-xl add-wallet-fieldset">
                <div className="fieldset__header">
                  <h3>เพิ่มบัญชีใหม่</h3>
                  <p className="muted">สร้างบัญชีธนาคารหรือ TrueMoney Wallet สำหรับรับเงินเติมเครดิตของ</p>
                </div>

                <div className="grid cols-2 gap-md">
                  <div className="form-group">
                    <label>ชื่อบัญชี</label>
                    <input
                      type="text"
                      value={newWallet.accountName}
                      onChange={(e) => setNewWallet((p) => ({ ...p, accountName: e.target.value }))}
                      placeholder="เช่น บัญชีเติมเงินหลัก"
                    />
                  </div>
                  <div className="form-group">
                    <label>ประเภทบัญชี</label>
                    <select
                      value={newWallet.type}
                      onChange={(e) => setNewWallet((p) => ({ ...p, type: e.target.value }))}
                    >
                      <option value="DEPOSIT">บัญชีฝาก</option>
                      <option value="WITHDRAW">บัญชีถอน</option>
                    </select>
                  </div>
                </div>

                <div className="grid cols-2 gap-md mt-sm">
                  <div className="form-group">
                    <label>บัญชีธนาคาร / Wallet</label>
                    <select
                      value={newWallet.accountCode}
                      onChange={(e) => setNewWallet((p) => ({ ...p, accountCode: e.target.value }))}
                    >
                      <option value="" disabled>เลือกธนาคารหรือ TrueMoney Wallet</option>
                      {BANKS_LIST.map((b) => (
                        <option key={b.code} value={b.code}>{b.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>เลขบัญชี / เบอร์</label>
                    <input
                      type="text"
                      value={newWallet.accountNumber}
                      onChange={(e) => setNewWallet((p) => ({ ...p, accountNumber: e.target.value }))}
                      placeholder="เลขบัญชีหรือเบอร์มือถือ"
                    />
                  </div>
                </div>

                <div className="form-group mt-sm">
                  <label>secret</label>
                  <input
                    type="text"
                    value={newWallet.secret}
                    onChange={(e) => setNewWallet((p) => ({ ...p, secret: e.target.value }))}
                    placeholder="โทเคน / secret key"
                  />
                </div>

                <div className="toggles toggles-new">
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={newWallet.isActive}
                      onChange={(e) => setNewWallet((p) => ({ ...p, isActive: e.target.checked }))}
                    />
                    <span>ใช้งาน</span>
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={newWallet.isSMS}
                      onChange={(e) => setNewWallet((p) => ({ ...p, isSMS: e.target.checked }))}
                    />
                    <span>อ่าน SMS</span>
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={newWallet.isAuto}
                      onChange={(e) => setNewWallet((p) => ({ ...p, isAuto: e.target.checked }))}
                    />
                    <span>Auto Topup</span>
                  </label>
                </div>
              </div>
            )}

            <div className="mt-xl admin-card__footer">
              <button
                type="submit"
                className="settings-save-btn"
                disabled={!canWrite || busy || !!savingWalletId}
              >
                <span className="settings-save-btn__glow" />
                <span className="settings-save-btn__label">
                  {busy ? <><SvgIcon name="hourglass" size={15} /> กำลังบันทึก...</> : 'บันทึกข้อมูล'}
                </span>
              </button>
            </div>

          </form>
        </section>

      </section>
    </div>
  );
}
