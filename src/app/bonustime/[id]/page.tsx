'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { notifyMsg, copyTextWithNotify, confirmAction } from '../../../lib/clientNotify';

const DAY_MS = 86400000;

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

const EDIT_FIELDS = [
  { key: 'NAME', label: 'ชื่อร้าน / LINE Bot', placeholder: 'ชื่อร้านหรือบอทของคุณ' },
  { key: 'CHANNEL_ACCESS_TOKEN', label: 'Channel Access Token', placeholder: 'LINE Channel Access Token', secret: true },
  { key: 'CHANNEL_SECRET', label: 'Channel Secret', placeholder: 'LINE Channel Secret', secret: true },
  { key: 'LOGO', label: 'URL โลโก้', placeholder: 'https://example.com/logo.png' },
  { key: 'LOGIN_URL', label: 'URL เข้าสู่ระบบ', placeholder: 'https://...' },
  { key: 'SIGNUP_URL', label: 'URL ลงทะเบียน', placeholder: 'https://...' },
  { key: 'LINE_ADMIN', label: 'LINE Admin', placeholder: '@lineadmin หรือ userId' },
];

const CSS = `
.btd-page {
  --btd-page:#07080b;--btd-card:#17181d;--btd-card2:#111218;
  --btd-text:#eef6ff;--btd-muted:#08b84f;--btd-border:rgba(255,255,255,.12);
  --btd-accent:#08b84f;--btd-green:#38e986;--btd-red:#ff7089;--btd-blue:#56b7ff;
  --btd-shadow:rgba(0,0,0,.42);
  max-width:760px;margin:0 auto;padding:clamp(14px,2vw,28px);color:var(--btd-text);
}
.btd-page * { box-sizing: border-box; }
.btd-nav { display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px; }
.btd-back { display:inline-flex;align-items:center;gap:6px;color:rgba(238,246,255,.5);font-size:13px;font-weight:800;text-decoration:none;transition:color .18s ease; }
.btd-back:hover { color:var(--btd-accent); }
.btd-balance { font-size:13px;color:rgba(238,246,255,.5);font-weight:800; }
.btd-balance span { color:var(--btd-green);font-weight:950; }

.btd-card {
  position:relative;overflow:hidden;border-radius:24px;margin-bottom:14px;
  border:1px solid var(--btd-border);
  background:linear-gradient(145deg,color-mix(in srgb,var(--btd-card) 94%,transparent),color-mix(in srgb,var(--btd-card2) 96%,transparent));
  box-shadow:0 22px 60px var(--btd-shadow),inset 0 1px 0 rgba(255,255,255,.055);
  padding:20px;animation:btdRise .5s cubic-bezier(.2,.9,.2,1) both;
}
.btd-card:nth-child(2) { animation-delay:.06s; }
.btd-card:nth-child(3) { animation-delay:.12s; }
.btd-card:nth-child(4) { animation-delay:.18s; }

/* Service header card */
.btd-card-row { display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px; }
.btd-service-name { font-size:19px;font-weight:1000;color:var(--btd-text);letter-spacing:-.03em;margin:0 0 3px; }
.btd-service-key { font-size:11px;color:rgba(238,246,255,.4);font-family:monospace;word-break:break-all; }
.btd-badges { display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0; }
.btd-badge {
  display:inline-flex;align-items:center;padding:5px 10px;border-radius:999px;
  font-size:11px;font-weight:800;
}
.btd-badge.green { background:rgba(8,184,79,.14);color:var(--btd-green);border:1px solid rgba(8,184,79,.3); }
.btd-badge.red { background:rgba(255,95,115,.14);color:var(--btd-red);border:1px solid rgba(255,95,115,.28); }
.btd-badge.blue { background:rgba(86,183,255,.14);color:var(--btd-blue);border:1px solid rgba(86,183,255,.28); }
.btd-badge.gray { background:rgba(255,255,255,.07);color:rgba(238,246,255,.55);border:1px solid rgba(255,255,255,.10); }
.btd-tag { font-size:10px;color:rgba(238,246,255,.4);font-weight:800; }

.btd-info-grid { display:grid;grid-template-columns:repeat(2,1fr);gap:10px 24px; }
.btd-info-item {}
.btd-info-label { font-size:11px;color:rgba(238,246,255,.45);font-weight:800;margin:0 0 2px; }
.btd-info-value { font-size:13px;font-weight:900;color:var(--btd-text);word-break:break-all; }
.btd-info-value.green { color:var(--btd-green); }
.btd-info-value.red { color:var(--btd-red); }
.btd-info-value.blue { color:var(--btd-blue); }
.btd-webhook-copy {
  display:inline-flex;align-items:center;max-width:100%;min-height:28px;padding:3px 8px;
  border:1px dashed rgba(56,233,134,.50);border-radius:10px;background:rgba(8,184,79,.075);
  color:var(--btd-green);font:inherit;font-family:monospace;font-size:11px;font-weight:900;
  text-align:left;word-break:break-all;cursor:pointer;transition:.18s ease;
}
.btd-webhook-copy:hover { color:#7cffb2;border-color:rgba(124,255,178,.85);background:rgba(8,184,79,.13);transform:translateY(-1px); }
.btd-webhook-copy:active { transform:translateY(0); }
.btd-webhook-empty { color:rgba(238,246,255,.25);font-weight:800; }

/* Card head row */
.btd-card-head { display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px; }
.btd-card-title { font-size:16px;font-weight:950;color:var(--btd-text);margin:0; }

/* Flash message */
.btd-flash { padding:12px 14px;border-radius:14px;font-size:13px;font-weight:800;margin-bottom:14px;border:1px solid; }
.btd-flash.success { background:rgba(8,184,79,.12);border-color:rgba(8,184,79,.28);color:var(--btd-green); }
.btd-flash.error { background:rgba(255,95,115,.12);border-color:rgba(255,95,115,.28);color:var(--btd-red); }

/* Edit form */
.btd-edit-list { display:grid;gap:12px; }
.btd-field { display:grid;gap:7px; }
.btd-label { font-size:13px;font-weight:900;color:var(--btd-muted); }
.btd-input {
  width:100%;min-height:48px;border-radius:14px;padding:0 14px;
  border:1px solid rgba(124,255,178,.22);background:rgba(0,0,0,.28);
  color:var(--btd-text);font:inherit;font-weight:750;font-size:14px;outline:none;
  transition:border-color .18s ease;
}
.btd-input:focus { border-color:rgba(124,255,178,.52); }

/* View mode fields */
.btd-view-list { display:grid;gap:10px; }
.btd-view-row { display:flex;gap:12px;align-items:flex-start;font-size:13px; }
.btd-view-key { color:rgba(238,246,255,.45);font-weight:800;flex:0 0 170px;padding-top:1px; }
.btd-view-val { color:rgba(238,246,255,.85);font-weight:700;word-break:break-all;display:flex;align-items:center;gap:8px; }
.btd-view-dots { letter-spacing:4px;color:rgba(238,246,255,.45); }
.btd-secret-btn { font-size:11px;color:rgba(238,246,255,.4);background:none;border:0;cursor:pointer;padding:2px 6px;border-radius:8px;border:1px solid rgba(255,255,255,.08);transition:.18s ease; }
.btd-secret-btn:hover { color:var(--btd-accent);border-color:rgba(124,255,178,.28); }

/* Buttons */
.btd-btn {
  display:inline-flex;align-items:center;justify-content:center;gap:8px;
  border-radius:14px;font-size:13px;font-weight:900;font-family:inherit;cursor:pointer;
  border:1px solid var(--btd-border);transition:transform .2s ease,filter .2s ease,background .18s ease;
  padding:0 16px;min-height:42px;
}
.btd-btn:hover { transform:translateY(-1px);filter:saturate(1.05); }
.btd-btn:disabled { opacity:.5;cursor:not-allowed;transform:none;filter:none; }
.btd-btn.primary { background:linear-gradient(135deg,#08b84f,#05b84f);color:#17130a;border-color:transparent;box-shadow:0 14px 30px rgba(8,184,79,.2); }
.btd-btn.ghost { background:rgba(255,255,255,.055);color:var(--btd-text); }
.btd-btn.sm { font-size:12px;padding:0 12px;min-height:36px;border-radius:12px; }
.btd-btn.full { width:100%;margin-top:10px; }
.btd-btn.warn { background:rgba(251,191,36,.12);color:#fbbf24;border-color:rgba(251,191,36,.28); }
.btd-btn.danger { background:rgba(255,95,115,.12);color:var(--btd-red);border-color:rgba(255,95,115,.28); }
.btd-btn.lotto-done { background:rgba(8,184,79,.08);color:var(--btd-green);border-color:rgba(8,184,79,.24);cursor:default; }
.btd-btn.lotto-done:hover { transform:none;filter:none; }

.btd-action-row { display:flex;gap:10px;margin-bottom:14px; }

/* Railway info */
.btd-rw-row { display:flex;gap:12px;align-items:center;font-size:13px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.05); }
.btd-rw-row:last-child { border-bottom:0; }
.btd-rw-label { color:rgba(238,246,255,.45);font-weight:800;flex:0 0 100px; }
.btd-rw-val { color:rgba(238,246,255,.85);font-weight:750;word-break:break-all; }
.btd-rw-val.green { color:var(--btd-green); }
.btd-rw-val.red { color:var(--btd-red); }
.btd-rw-val.yellow { color:#fbbf24; }
.btd-rw-empty { color:rgba(238,246,255,.35);font-size:13px;font-weight:750; }

/* Extend modal */
.btd-modal-overlay {
  position:fixed;inset:0;z-index:9900;display:grid;place-items:center;padding:18px;
  background:
    radial-gradient(circle at 22% 18%,rgba(124,255,178,.20),transparent 30%),
    rgba(0,0,0,.74);
  backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
}
.btd-modal-bg { position:absolute;inset:0;cursor:pointer; }
.btd-modal-dialog {
  position:relative;width:min(540px,100%);max-height:min(640px,calc(100dvh - 36px));
  overflow:hidden;display:grid;grid-template-rows:auto minmax(0,1fr);border-radius:28px;
  border:1px solid rgba(124,255,178,.26);
  background:
    radial-gradient(circle at 18% 14%,rgba(124,255,178,.10),transparent 28%),
    linear-gradient(135deg,rgba(28,28,32,.98),rgba(14,14,18,.98));
  box-shadow:0 34px 90px rgba(0,0,0,.56),inset 0 0 0 1px rgba(255,255,255,.035);
  animation:btdModalIn .24s cubic-bezier(.2,.8,.2,1) both;
}
.btd-modal-head {
  display:flex;align-items:flex-start;justify-content:space-between;gap:14px;
  padding:20px 22px 16px;border-bottom:1px solid rgba(255,255,255,.09);
  background:linear-gradient(135deg,rgba(124,255,178,.08),rgba(255,255,255,.012));
}
.btd-modal-kicker { display:inline-flex;align-items:center;gap:8px;padding:6px 11px;border-radius:999px;border:1px solid rgba(124,255,178,.32);background:rgba(124,255,178,.07);color:#08b84f;font-size:10px;font-weight:950;letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px; }
.btd-modal-head h2 { margin:0;font-size:clamp(20px,4vw,28px);font-weight:1000;letter-spacing:-.04em;color:#eef6ff;line-height:1.05; }
.btd-modal-close { flex:0 0 44px;width:44px;height:44px;border-radius:14px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.04);color:#eef6ff;font-size:24px;line-height:1;cursor:pointer;transition:.18s ease; }
.btd-modal-close:hover { background:rgba(124,255,178,.10);border-color:rgba(124,255,178,.32); }
.btd-modal-body { overflow-y:auto;padding:18px 22px 22px;-webkit-overflow-scrolling:touch;display:grid;gap:10px; }
.btd-extend-hint { color:rgba(238,246,255,.5);font-size:12px;font-weight:800; }
.btd-plan-label {
  display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:16px;
  border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);cursor:pointer;
  transition:border-color .18s ease,background .18s ease;
}
.btd-plan-label.selected { border-color:rgba(124,255,178,.44);background:rgba(124,255,178,.08); }
.btd-plan-label:hover:not(.selected) { border-color:rgba(255,255,255,.14);background:rgba(255,255,255,.06); }
.btd-plan-label input[type="radio"] { accent-color:#08b84f; }
.btd-plan-name { flex:1;font-size:14px;font-weight:900;color:var(--btd-text); }
.btd-plan-discount { font-size:11px;color:var(--btd-green);font-weight:950; }
.btd-plan-price { font-size:14px;font-weight:950;color:var(--btd-green); }

@keyframes btdRise { from{opacity:0;transform:translateY(14px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)} }
@keyframes btdModalIn { from{opacity:0;transform:translateY(16px) scale(.965);filter:blur(6px)}to{opacity:1;transform:translateY(0) scale(1);filter:blur(0)} }
@media (max-width:480px) {
  .btd-info-grid { grid-template-columns:1fr; }
  .btd-view-key { flex:0 0 120px; }
}
`;

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

export default function BonustimeDetailPage() {
  const router = useRouter();
  const { id } = useParams();

  const [user, setUser] = useState(null);
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [showExtend, setShowExtend] = useState(false);
  const [selectedDays, setSelectedDays] = useState(null);
  const [railwayInfo, setRailwayInfo] = useState(null);
  const [railwayLoading, setRailwayLoading] = useState(false);
  const [showSecret, setShowSecret] = useState({});

  useEffect(() => {
    if (id) loadPage();
  }, [id]);

  async function loadPage() {
    const [meRes, recRes] = await Promise.all([
      fetch('/api/auth/me'),
      fetch(`/api/bonustime/${id}`),
    ]);
    if (!meRes.ok) { router.push('/login'); return; }
    if (!recRes.ok) { router.push('/bonustime'); return; }
    const me = await meRes.json();
    const rec = await recRes.json();
    setUser(me.user);
    setRecord(rec.record);
    const init = {};
    EDIT_FIELDS.forEach(({ key }) => { init[key] = rec.record[key] || ''; });
    setEditData(init);
    setLoading(false);
  }

  async function loadRailwayInfo() {
    setRailwayLoading(true);
    setMsg(null);
    try {
      const key = record?.serviceKey || record?.tenantId;
      if (!key) { notifyMsg(setMsg, { type: 'error', text: 'ไม่พบ serviceKey / tenantId' }); return; }
      const res = await fetch(`/api/railway/service-info/${encodeURIComponent(key)}`);
      const data = await res.json();
      if (data.ok) setRailwayInfo(data);
      else notifyMsg(setMsg, { type: 'error', text: data.error || data.message || 'โหลดข้อมูล Railway ไม่สำเร็จ' });
    } catch { notifyMsg(setMsg, { type: 'error', text: 'โหลดข้อมูล Railway ไม่สำเร็จ' }); }
    setRailwayLoading(false);
  }

  async function handleSave() {
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/bonustime/${id}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editData),
    });
    const data = await res.json();
    setBusy(false);
    if (!data.ok) { notifyMsg(setMsg, { type: 'error', text: data.message || 'บันทึกไม่สำเร็จ' }); return; }
    notifyMsg(setMsg, { type: 'success', text: 'บันทึกสำเร็จ' });
    setEditMode(false);
    setRecord((r) => ({ ...r, ...editData }));
  }

  async function handleExtend() {
    if (!selectedDays) { notifyMsg(setMsg, { type: 'error', text: 'กรุณาเลือกระยะเวลา' }); return; }
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/bonustime/${id}/extend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days: selectedDays, includeLotto: !!record?.LOTTO_ENABLED }),
    });
    const data = await res.json();
    setBusy(false);
    if (!data.ok) { notifyMsg(setMsg, { type: 'error', text: data.message || 'ต่ออายุไม่สำเร็จ' }); return; }
    notifyMsg(setMsg, { type: 'success', text: `ต่ออายุสำเร็จ! เหลือเงิน ฿${Number(data.balance).toLocaleString()}` });
    setShowExtend(false); setSelectedDays(null);
    setUser((u) => ({ ...u, balance: data.balance }));
    loadPage();
  }

  async function handleUpgradeLotto() {
    if (!await confirmAction({ title: 'อัปเกรดแพ็กเกจ', message: 'ยืนยันการอัปเกรดเป็นแพ็กเกจรวมหวย?', detail: 'ราคา ฿1,000', confirmText: 'อัปเกรด', cancelText: 'ยกเลิก', variant: 'warning' })) return;
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/bonustime/${id}/upgrade-lotto`, { method: 'POST' });
    const data = await res.json();
    setBusy(false);
    if (!data.ok) { notifyMsg(setMsg, { type: 'error', text: data.message || 'อัปเกรดไม่สำเร็จ' }); return; }
    notifyMsg(setMsg, { type: 'success', text: `อัปเกรดสำเร็จ! เหลือเงิน ฿${Number(data.balance).toLocaleString()}` });
    setUser((u) => ({ ...u, balance: data.balance }));
    setRecord((r) => ({ ...r, LOTTO_ENABLED: true }));
  }

  async function copyWebhookLink(link) {
    const value = String(link || '').trim();
    if (!value) return;
    setMsg(null);
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const ta = document.createElement('textarea');
        ta.value = value;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      notifyMsg(setMsg, { type: 'success', text: 'คัดลอกลิงก์ Webhook แล้ว' });
    } catch {
      notifyMsg(setMsg, { type: 'error', text: 'คัดลอกลิงก์ไม่สำเร็จ กรุณาลองใหม่' });
    }
  }

  async function handleRestart() {
    if (!railwayInfo) return;
    if (!await confirmAction({ title: 'Restart Service', message: 'ยืนยัน Restart Service?', detail: 'ระบบจะสั่งรีสตาร์ท Service ของรายการนี้', confirmText: 'Restart', cancelText: 'ยกเลิก', variant: 'warning' })) return;
    setBusy(true); setMsg(null);
    const res = await fetch('/api/railway/restart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceId: railwayInfo.serviceId,
        environmentId: railwayInfo.environmentId,
        tenantId: record?.serviceKey || record?.tenantId,
        deploymentId: railwayInfo.deploymentId,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!data.ok) { notifyMsg(setMsg, { type: 'error', text: data.error || 'Restart ไม่สำเร็จ' }); return; }
    notifyMsg(setMsg, { type: 'success', text: 'ส่งคำสั่ง Restart สำเร็จ' });
    setTimeout(loadRailwayInfo, 5000);
  }

  if (loading) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="btd-page" style={{ textAlign: 'center', paddingTop: 60, color: 'rgba(238,246,255,.4)' }}>กำลังโหลด...</div>
      </>
    );
  }
  if (!record) return null;

  const isPermanent = Boolean(record.LICENSE_DISABLED);
  const expiry = isPermanent ? null : calcExpiry(record);
  const isExpired = expiry ? expiry.getTime() < Date.now() : false;
  const plans = record.LOTTO_ENABLED ? PLANS_LOTTO : PLANS_NORMAL;

  const statusLabel = isPermanent ? 'ถาวร' : isExpired ? 'หมดอายุ' : 'ใช้งานอยู่';
  const statusCls = isPermanent ? 'blue' : isExpired ? 'red' : 'green';

  const rwStatusCls =
    railwayInfo?.status === 'ACTIVE' ? 'green' :
    railwayInfo?.status === 'ERROR' ? 'red' : 'yellow';

  const webhookLink = getWebhookLink(record);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="btd-page">
        {/* Nav */}
        <div className="btd-nav">
          <Link href="/bonustime" className="btd-back">← กลับ Bonustime</Link>
          {user && (
            <span className="btd-balance">
              ยอดเงิน: <span>฿{Number(user.balance || 0).toLocaleString()}</span>
            </span>
          )}
        </div>

        {/* Service Header Card */}
        <div className="btd-card">
          <div className="btd-card-row">
            <div>
              <h1 className="btd-service-name">{record.NAME || '(ไม่มีชื่อ)'}</h1>
              <div className="btd-service-key">{record.serviceKey || record.tenantId}</div>
            </div>
            <div className="btd-badges">
              <span className={`btd-badge ${statusCls}`}>{statusLabel}</span>
              <span className="btd-tag">{record.LOTTO_ENABLED ? '🎰 รวมหวย' : '🎮 สล็อต+บาคาร่า'}</span>
            </div>
          </div>
          <div className="btd-info-grid">
            <div className="btd-info-item">
              <p className="btd-info-label">วันเริ่มใช้งาน</p>
              <p className="btd-info-value">{record.LICENSE_START_DATE || '—'}</p>
            </div>
            <div className="btd-info-item">
              <p className="btd-info-label">ระยะเวลาทั้งหมด</p>
              <p className="btd-info-value">{record.LICENSE_DURATION_DAYS || 0} วัน</p>
            </div>
            <div className="btd-info-item">
              <p className="btd-info-label">วันหมดอายุ</p>
              <p className={`btd-info-value ${isPermanent ? 'blue' : expiry && !isExpired ? 'green' : expiry ? 'red' : ''}`}>
                {isPermanent ? 'ถาวร' : expiry ? expiry.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
              </p>
            </div>
            <div className="btd-info-item">
              <p className="btd-info-label">Webhook URL</p>
              {webhookLink ? (
                <button
                  type="button"
                  className="btd-webhook-copy"
                  title="กดเพื่อคัดลอกลิงก์ Webhook"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    copyWebhookLink(webhookLink);
                  }}
                >
                  {webhookLink}
                </button>
              ) : (
                <p className="btd-info-value btd-webhook-empty">—</p>
              )}
            </div>
          </div>
        </div>

        {/* Config Card */}
        <div className="btd-card">
          <div className="btd-card-head">
            <h2 className="btd-card-title">ตั้งค่า LINE Bot</h2>
            <button className="btd-btn ghost sm" onClick={() => { setEditMode(!editMode); setMsg(null); }}>
              {editMode ? 'ยกเลิก' : '✎ แก้ไข'}
            </button>
          </div>

          {editMode ? (
            <div className="btd-edit-list">
              {EDIT_FIELDS.map(({ key, label, placeholder }) => (
                <label key={key} className="btd-field">
                  <span className="btd-label">{label}</span>
                  <input
                    className="btd-input"
                    placeholder={placeholder}
                    value={editData[key] || ''}
                    onChange={(e) => setEditData((d) => ({ ...d, [key]: e.target.value }))}
                  />
                </label>
              ))}
              <button className="btd-btn primary full" onClick={handleSave} disabled={busy}>
                {busy ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
              </button>
            </div>
          ) : (
            <div className="btd-view-list">
              {EDIT_FIELDS.map(({ key, label, secret }) => (
                <div key={key} className="btd-view-row">
                  <span className="btd-view-key">{label}</span>
                  <div className="btd-view-val">
                    {record[key] ? (
                      secret && !showSecret[key] ? (
                        <>
                          <span className="btd-view-dots">••••••••</span>
                          <button className="btd-secret-btn" onClick={() => setShowSecret((s) => ({ ...s, [key]: true }))}>แสดง</button>
                        </>
                      ) : (
                        <>
                          <span style={{ wordBreak: 'break-all' }}>{record[key]}</span>
                          {secret && (
                            <button className="btd-secret-btn" onClick={() => setShowSecret((s) => ({ ...s, [key]: false }))}>ซ่อน</button>
                          )}
                        </>
                      )
                    ) : (
                      <span style={{ color: 'rgba(238,246,255,.25)' }}>—</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="btd-action-row">
          {!isPermanent && (
            <button className="btd-btn ghost" style={{ flex: 1, minHeight: 48 }} onClick={() => { setShowExtend(true); setMsg(null); }}>
              🔄 ต่ออายุ
            </button>
          )}
          {!record.LOTTO_ENABLED ? (
            <button className="btd-btn warn" style={{ flex: 1, minHeight: 48 }} onClick={handleUpgradeLotto} disabled={busy}>
              ⬆ อัปเกรด + หวย (฿1,000)
            </button>
          ) : (
            <div className="btd-btn lotto-done" style={{ flex: 1, minHeight: 48 }}>✓ เปิดใช้หวยแล้ว</div>
          )}
        </div>

        {/* Railway Section */}
        <div className="btd-card">
          <div className="btd-card-head">
            <h2 className="btd-card-title">Server Status</h2>
            <button className="btd-btn ghost sm" onClick={loadRailwayInfo} disabled={railwayLoading}>
              {railwayLoading ? 'กำลังโหลด...' : railwayInfo ? '↻ รีเฟรช' : 'โหลดข้อมูล'}
            </button>
          </div>

          {railwayInfo ? (
            <>
              <div className="btd-rw-row">
                <span className="btd-rw-label">Status</span>
                <span className={`btd-rw-val ${rwStatusCls}`}>{railwayInfo.status}</span>
              </div>
              {/* <div className="btd-rw-row">
                <span className="btd-rw-label">Service ID</span>
                <code style={{ fontSize: 11, color: 'rgba(238,246,255,.55)', wordBreak: 'break-all' }}>{railwayInfo.serviceId}</code>
              </div>
              <div className="btd-rw-row">
                <span className="btd-rw-label">Deploy ID</span>
                <code style={{ fontSize: 11, color: 'rgba(238,246,255,.55)', wordBreak: 'break-all' }}>{railwayInfo.deploymentId || '—'}</code>
              </div> */}
              <button className="btd-btn danger full" style={{ marginTop: 12 }} onClick={handleRestart} disabled={busy}>
                🔄 Restart Service
              </button>
            </>
          ) : (
            <p className="btd-rw-empty">กดปุ่ม "โหลดข้อมูล" เพื่อดูสถานะ Server Status</p>
          )}
        </div>

        {/* Extend Modal */}
        {showExtend && (
          <div className="btd-modal-overlay">
            <div className="btd-modal-bg" onClick={() => setShowExtend(false)} />
            <div className="btd-modal-dialog">
              <div className="btd-modal-head">
                <div>
                  <div className="btd-modal-kicker"><span>✦</span> BONUSTIME</div>
                  <h2>ต่ออายุ Bonustime</h2>
                </div>
                <button className="btd-modal-close" onClick={() => setShowExtend(false)}>×</button>
              </div>
              <div className="btd-modal-body">
                <p className="btd-extend-hint">เลือกระยะเวลาต่ออายุ</p>
                {plans.map((plan) => (
                  <label key={plan.days} className={`btd-plan-label${selectedDays === plan.days ? ' selected' : ''}`}>
                    <input type="radio" name="days" value={plan.days} checked={selectedDays === plan.days}
                      onChange={() => setSelectedDays(plan.days)} />
                    <span className="btd-plan-name">{plan.label}</span>
                    {plan.discount !== '0%' && <span className="btd-plan-discount">{plan.discount}</span>}
                    <span className="btd-plan-price">฿{plan.price.toLocaleString()}</span>
                  </label>
                ))}
                <button className="btd-btn primary full" onClick={handleExtend} disabled={busy || !selectedDays}>
                  {busy ? 'กำลังต่ออายุ...' : 'ยืนยันต่ออายุ'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
