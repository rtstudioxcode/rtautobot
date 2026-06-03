'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ManualTopupModal from './ManualTopupModal.jsx';

const CSS = `
.rt-admin-v2{--line-green:#08b84f;--line-green2:#05b84f;--ink:#08090c;--panel:rgba(255,255,255,.055);--line:rgba(255,255,255,.09);--soft:#08b84f;max-width:2000px;margin:0 auto;padding:28px 18px 70px;color:var(--text,#21b95c)}
.admin-hero-v2{position:relative;display:grid;grid-template-columns:minmax(0,1.4fr) 420px;gap:26px;align-items:stretch;min-height:290px;padding:34px;border:1px solid color-mix(in srgb,#08b84f 28%,transparent);border-radius:34px;background:radial-gradient(650px 280px at 18% 0,rgba(24,201,100,.16),transparent 62%),radial-gradient(640px 300px at 100% 100%,rgba(93,90,255,.15),transparent 64%),linear-gradient(135deg,rgba(255,255,255,.075),rgba(255,255,255,.025));box-shadow:0 30px 86px rgba(0,0,0,.42);overflow:hidden}
.admin-hero-v2:before{content:"";position:absolute;inset:auto -80px -180px auto;width:420px;height:420px;border-radius:50%;background:radial-gradient(circle,rgba(24,201,100,.16),transparent 66%);filter:blur(2px);pointer-events:none}
.hero-copy,.hero-command-card{position:relative}
.adm-eyebrow{display:inline-flex;align-items:center;gap:8px;width:max-content;padding:9px 14px;border-radius:999px;border:1px solid rgba(124,255,178,.28);background:rgba(124,255,178,.12);color:#08b84f;font-weight:1000;text-transform:uppercase;font-size:12px;letter-spacing:.04em}
.adm-eyebrow.compact{padding:7px 12px;font-size:11px}
.hero-copy h1{margin:18px 0 12px;font-size:clamp(42px,5.2vw,72px);line-height:.96;letter-spacing:-.045em;color:#eef6ff}
.hero-copy p{max-width:780px;margin:0;color:#08b84f;font-weight:760;font-size:17px;line-height:1.75}
.hero-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}
.adm-btn-green,.adm-btn-glass{display:inline-flex;align-items:center;justify-content:center;gap:10px;border:0;border-radius:18px;padding:14px 19px;font-weight:1000;text-decoration:none;cursor:pointer;font-family:inherit;font-size:14px}
.adm-btn-green{color:#151007;background:linear-gradient(135deg,#21b95c,#05b84f);box-shadow:0 18px 42px rgba(6,199,85,.28)}
.adm-btn-glass{color:#08b84f;background:rgba(255,255,255,.055);border:1px solid rgba(24,201,100,.14)}
.hero-command-card{align-self:stretch;display:flex;flex-direction:column;justify-content:space-between;gap:18px;padding:24px;border-radius:28px;background:linear-gradient(145deg,rgba(0,0,0,.28),rgba(255,255,255,.05));border:1px solid rgba(255,255,255,.1);box-shadow:inset 0 1px 0 rgba(255,255,255,.06)}
.command-orb{width:74px;height:74px;border-radius:24px;display:grid;place-items:center;color:#171007;background:linear-gradient(135deg,#21b95c,#05b84f);font-weight:1000;font-size:30px;box-shadow:0 24px 48px rgba(6,199,85,.22)}
.hero-command-card b{display:block;font-size:22px;color:#eef6ff}
.hero-command-card small{display:block;color:#08b84f;font-weight:750;margin-top:5px}
.command-mini-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.command-mini-grid span{padding:14px 12px;border-radius:18px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08)}
.command-mini-grid strong{display:block;color:#48ed92;font-size:24px}
.command-mini-grid small{font-size:12px;margin:0;color:#08b84f}
.metric-strip{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-top:18px}
.metric-card{position:relative;min-height:154px;padding:22px;border:1px solid rgba(255,255,255,.09);border-radius:26px;background:linear-gradient(145deg,rgba(255,255,255,.07),rgba(255,255,255,.026));box-shadow:0 20px 54px rgba(0,0,0,.26);overflow:hidden}
.metric-card:after{content:"";position:absolute;right:-34px;top:-44px;width:150px;height:150px;border-radius:50%;background:radial-gradient(circle,rgba(124,255,178,.14),transparent 68%)}
.metric-card span{color:#08b84f;font-weight:900;font-size:14px}
.metric-card strong{display:block;margin:12px 0 8px;color:#43ed92;font-size:clamp(26px,2.5vw,34px);line-height:1;text-shadow:0 16px 35px rgba(67,237,146,.15)}
.metric-card small{color:#08b84f;font-weight:780;font-size:13px}
.metric-card.is-hot{border-color:rgba(124,255,178,.32);box-shadow:0 20px 54px rgba(0,0,0,.28),0 0 0 1px rgba(124,255,178,.08)}
.quick-panel-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:18px}
.adm-quick-panel{position:relative;min-height:210px;display:grid;grid-template-columns:auto 1fr auto;align-items:start;gap:18px;padding:24px;border:1px solid rgba(255,255,255,.09);border-radius:28px;background:linear-gradient(145deg,rgba(255,255,255,.07),rgba(255,255,255,.025));box-shadow:0 20px 58px rgba(0,0,0,.25);color:#eef6ff;text-decoration:none;transition:transform .18s ease,border-color .18s ease,background .18s ease;overflow:hidden}
.adm-quick-panel:before{content:"";position:absolute;inset:auto -60px -80px auto;width:190px;height:190px;border-radius:50%;background:radial-gradient(circle,rgba(124,255,178,.14),transparent 66%);opacity:.8}
.adm-quick-panel:hover{transform:translateY(-4px);border-color:rgba(124,255,178,.36);background:linear-gradient(145deg,rgba(255,255,255,.092),rgba(255,255,255,.03))}
.adm-quick-panel.primary{border-color:rgba(124,255,178,.32)}
.qp-icon{width:56px;height:56px;border-radius:19px;display:grid;place-items:center;background:linear-gradient(135deg,#21b95c,#05b84f);box-shadow:0 18px 36px rgba(6,199,85,.2);font-size:25px}
.adm-quick-panel small{color:#08b84f;font-weight:1000;text-transform:uppercase;font-size:11px;letter-spacing:.04em}
.adm-quick-panel h2{margin:10px 0 9px;font-size:23px;color:#eef6ff}
.adm-quick-panel p{margin:0;color:#08b84f;font-weight:760;line-height:1.65;font-size:14px}
.adm-quick-panel i{position:relative;font-style:normal;width:38px;height:38px;border-radius:14px;display:grid;place-items:center;color:#08b84f;background:rgba(255,255,255,.05);border:1px solid rgba(124,255,178,.16)}
.pending-board{margin-top:20px;padding:24px;border:1px solid rgba(255,255,255,.09);border-radius:30px;background:radial-gradient(700px 300px at 100% 100%,rgba(124,255,178,.14),transparent 62%),linear-gradient(145deg,rgba(255,255,255,.07),rgba(255,255,255,.025));box-shadow:0 22px 64px rgba(0,0,0,.28)}
.pending-board-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:20px}
.pending-board h2{margin:12px 0 7px;font-size:clamp(30px,3.2vw,46px);line-height:1.02;letter-spacing:-.03em;color:#eef6ff}
.pending-board p{margin:0;color:#08b84f;font-weight:760}
.pending-summary-chip{min-width:128px;padding:16px 18px;border-radius:22px;border:1px solid rgba(24,201,100,.14);background:rgba(124,255,178,.08);text-align:center}
.pending-summary-chip span{display:block;color:#08b84f;font-weight:900;font-size:12px}
.pending-summary-chip strong{display:block;color:#08b84f;font-size:30px;line-height:1.05;margin-top:5px}
.pending-list{display:grid;gap:12px}
.pending-item{display:grid;grid-template-columns:150px minmax(280px,1fr) 150px 140px 210px;gap:12px;align-items:center;padding:16px;border:1px solid rgba(255,255,255,.08);border-radius:24px;background:rgba(0,0,0,.18)}
.pi-date b,.pi-date small{display:block}
.pi-date b{color:#08b84f}
.pi-date small{color:#08b84f;font-weight:750;margin-top:4px;font-size:12px}
.pi-main{min-width:0}
.pi-id{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#21b95c;font-weight:1000;font-size:13px}
.pi-user{display:flex;align-items:center;gap:10px;margin-top:8px}
.pi-user img{border-radius:13px;background:rgba(255,255,255,.06)}
.pi-user b,.pi-user small{display:block;color:#eef6ff}
.pi-user small{color:#08b84f;font-weight:740;font-size:12px}
.pi-method span{display:inline-flex;padding:9px 12px;border-radius:999px;border:1px solid rgba(124,255,178,.25);background:rgba(124,255,178,.1);color:#08b84f;font-weight:1000;font-size:13px}
.pi-amount{text-align:right;color:#08b84f;font-weight:1000;font-size:18px}
.pi-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}
.mini-btn{border:0;border-radius:14px;padding:11px 13px;font-weight:1000;cursor:pointer;text-decoration:none;color:#16120b;background:linear-gradient(135deg,#21b95c,#05b84f);font-family:inherit;font-size:13px}
.mini-btn.danger{color:#fff;background:linear-gradient(135deg,#ff7777,#c92c2c)}
.mini-btn.success{background:linear-gradient(135deg,#8dffc0,#23ba6a)}
.empty-state-v2{min-height:290px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;border:1px dashed rgba(124,255,178,.28);border-radius:24px;background:rgba(0,0,0,.12);gap:10px;color:#08b84f}
.empty-icon{width:78px;height:78px;border-radius:26px;display:grid;place-items:center;background:rgba(72,237,146,.12);border:1px solid rgba(72,237,146,.2);color:#48ed92;font-size:34px}
.empty-state-v2 strong{color:#eef6ff;font-size:20px}
@media(max-width:1120px){
  .admin-hero-v2{grid-template-columns:1fr}
  .hero-command-card{min-height:220px}
  .metric-strip{grid-template-columns:repeat(2,minmax(0,1fr))}
  .quick-panel-grid{grid-template-columns:1fr}
  .pending-item{grid-template-columns:1fr 1fr}
  .pi-actions{justify-content:flex-start}
  .pi-amount{text-align:left}
  .pi-main{grid-column:span 2}
}
@media(max-width:640px){
  .rt-admin-v2{padding:18px 12px 48px}
  .admin-hero-v2{padding:24px;border-radius:28px}
  .hero-copy h1{font-size:40px}
  .hero-actions .adm-btn-green,.hero-actions .adm-btn-glass{width:100%}
  .metric-strip{grid-template-columns:1fr}
  .pending-board{padding:17px}
  .pending-board-head{flex-direction:column}
  .pending-summary-chip{width:100%}
  .pending-item{grid-template-columns:1fr}
  .pi-main{grid-column:auto}
  .pi-actions .mini-btn{flex:1}
  .command-mini-grid{grid-template-columns:1fr}
}
`;

function fmtMoney(v) {
  return Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(v) {
  return new Date(v || Date.now()).toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}
function labelMethod(m) {
  const key = String(m || '').toLowerCase();
  if (key === 'truewallet' || key === 'tw') return 'TrueMoney Wallet';
  if (key === 'qr') return 'PromptPay QR';
  if (key === 'kbank') return 'กสิกรไทย';
  if (key === 'scb') return 'ไทยพาณิชย์';
  if (key === 'manual') return 'เติมมือ';
  if (key === 'admin') return 'Admin';
  return key || 'ไม่ระบุ';
}

export default function AdminDashboardClient({ stats, pendingList }) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [prefill, setPrefill] = useState(null);

  const pendingCount = Number(stats?.pendingCount || 0);
  // Prefer the real active paid service count from the server.
  // This keeps the UI from accidentally showing legacy/simple `active` counts
  // that include permanent services or already-expired licenses.
  const activeServiceCount = Number(
    stats?.activeNonPermanentServiceCount ??
    stats?.activeServiceCountReal ??
    stats?.activeServiceCount ??
    0
  );
  const walletCount = Number(stats?.walletCount || 0);
  const bonustimeOrders = Number(stats?.bonustimeOrderCount || 0);
  const topupCount = Number(stats?.topupCount || 0);

  function openManual(tx) {
    setPrefill(tx ? {
      txId: tx.transactionId || tx._id || '',
      username: tx.username || '',
      amount: Number(tx.amount || 0),
      method: String(tx.method || 'admin').toLowerCase(),
    } : null);
    setModalOpen(true);
  }

  async function rejectTx(id) {
    if (!id || !confirm('ยืนยันปฏิเสธรายการนี้?')) return;
    try {
      const r = await fetch(`/admin/topup/${encodeURIComponent(id)}/reject`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j?.error || 'ปฏิเสธไม่สำเร็จ');
      window.dispatchEvent(new CustomEvent('rt:notify', { detail: { type: 'success', title: 'ปฏิเสธรายการสำเร็จ', text: 'รายการเติมเครดิตถูกปฏิเสธแล้ว' } }));
      router.refresh();
    } catch (err) {
      window.dispatchEvent(new CustomEvent('rt:notify', { detail: { type: 'error', title: 'ทำรายการไม่สำเร็จ', text: err?.message || 'ปฏิเสธไม่สำเร็จ' } }));
    }
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="rt-admin-v2">

        {/* Hero */}
        <section className="admin-hero-v2" aria-label="ภาพรวมผู้ดูแลระบบ">
          <div className="hero-copy">
            <span className="adm-eyebrow"><i>✦</i> RTAUTOBOT CONTROL</span>
            <h1>ศูนย์จัดการ Bonustime</h1>
            <p>ดูแลแพ็กเกจ บัญชีรับเงิน รายการเติมเครดิต และงานตรวจสอบจากหน้าเดียว พร้อมเข้าสู่แผงควบคุมบริการได้ทันที</p>
            <div className="hero-actions">
              <a className="adm-btn-green" href="/admin/bonustime"><span>⚡</span> เปิด Bonustime Panel</a>
              <button className="adm-btn-glass" type="button" onClick={() => openManual(null)}><span>＋</span> เติมเงินด้วยตนเอง</button>
            </div>
          </div>
          <div className="hero-command-card" aria-label="สถานะระบบ">
            <div className="command-orb">R</div>
            <div>
              <b>Bonustime Automation</b>
              <small>พร้อมจัดการบริการและเครดิตลูกค้า</small>
            </div>
            <div className="command-mini-grid">
              <span><strong>{bonustimeOrders.toLocaleString()}</strong><small>ขายไปแล้ว</small></span>
              <span><strong>{activeServiceCount.toLocaleString()}</strong><small>ทำงานอยู่</small></span>
              <span><strong>{walletCount.toLocaleString()}</strong><small>บัญชีรับเงิน</small></span>
            </div>
          </div>
        </section>

        {/* Metric strip */}
        <section className="metric-strip" aria-label="ตัวเลขสำคัญ">
          <article className="metric-card revenue">
            <span>รายได้ Bonustime</span>
            <strong>฿{fmtMoney(stats?.bonustimeRevenue)}</strong>
            <small>{bonustimeOrders.toLocaleString()} รายการที่ขายแล้ว</small>
          </article>
          <article className="metric-card topup">
            <span>ยอดเติมเครดิต</span>
            <strong>฿{fmtMoney(stats?.topupSum)}</strong>
            <small>{topupCount.toLocaleString()} รายการสำเร็จ</small>
          </article>
          <article className={`metric-card pending${pendingCount ? ' is-hot' : ''}`}>
            <span>รายการเติมเงินรอตรวจสอบ</span>
            <strong>฿{fmtMoney(stats?.pendingTotal)}</strong>
            <small>{pendingCount.toLocaleString()} รายการ</small>
          </article>
          <article className="metric-card wallet">
            <span>บัญชีรับเงิน</span>
            <strong>{walletCount.toLocaleString()}</strong>
            <small>ช่องทางที่เปิดในเว็บนี้</small>
          </article>
        </section>

        {/* Quick panel grid */}
        <section className="quick-panel-grid" aria-label="เมนูลัดหลังบ้าน">
          <a className="adm-quick-panel primary" href="/admin/bonustime">
            <span className="qp-icon">⚡</span>
            <div>
              <small>Service Control</small>
              <h2>Bonustime Panel</h2>
              <p>จัดการบริการ Serial Key Webhook License และสถานะลูกค้า</p>
            </div>
            <i>→</i>
          </a>
          <a className="adm-quick-panel" href="/admin/settings">
            <span className="qp-icon">🏦</span>
            <div>
              <small>Payment Settings</small>
              <h2>ตั้งค่าบัญชีรับเงิน</h2>
              <p>เปิดปิดบัญชีเติมเครดิตและตั้งค่า Auto Topup ของเว็บนี้</p>
            </div>
            <i>→</i>
          </a>
          <a className="adm-quick-panel" href="/admin/topup">
            <span className="qp-icon">💳</span>
            <div>
              <small>Topup Report</small>
              <h2>ประวัติการเติมเงิน</h2>
              <p>ตรวจสอบยอดเติมเครดิตและจัดการรายการย้อนหลัง</p>
            </div>
            <i>→</i>
          </a>
        </section>

        {/* Pending board */}
        <section className="pending-board" aria-label="รายการเติมเงินรอดำเนินการ">
          <div className="pending-board-head">
            <div>
              <span className="adm-eyebrow compact"><i>◆</i> Pending Topup</span>
              <h2>รายการเติมเงินที่รอดำเนินการ</h2>
              <p>เติมเครดิตให้ผู้ใช้หรือปฏิเสธรายการได้ทันที โดยไม่ต้องออกจากหน้าแอดมิน</p>
            </div>
            <div className="pending-summary-chip">
              <span>รอตรวจสอบ</span>
              <strong>{pendingCount.toLocaleString()}</strong>
            </div>
          </div>

          {pendingList?.length ? (
            <div className="pending-list">
              {pendingList.map((tx) => {
                const dateStr = fmtDate(tx.createdAt);
                const dateParts = dateStr.split(' ');
                const datePart = dateParts[0] || dateStr;
                const timePart = dateParts.slice(1).join(' ');
                return (
                  <article key={tx._id || tx.transactionId} className="pending-item">
                    <div className="pi-date">
                      <b>{datePart}</b>
                      <small>{timePart}</small>
                    </div>
                    <div className="pi-main">
                      <div className="pi-id">{tx.transactionId || tx._id || '—'}</div>
                      <div className="pi-user">
                        <img src={`${tx.userId?.avatarUrl || '/static/assets/logo/icon-logo.png'}`} alt="" width={34} height={34} loading="lazy" />
                        <span>
                          <b>{tx.userId?.username || tx.username || '-'}</b>
                          {tx.userId?.email && <small>{tx.userId.email}</small>}
                        </span>
                      </div>
                    </div>
                    <div className="pi-method"><span>{labelMethod(tx.method)}</span></div>
                    <div className="pi-amount">฿{fmtMoney(tx.amount)}</div>
                    <div className="pi-actions">
                      <button className="mini-btn success" type="button" onClick={() => openManual(tx)}>เติมให้ผู้ใช้</button>
                      <button className="mini-btn danger" type="button" onClick={() => rejectTx(tx._id || tx.transactionId)}>ปฏิเสธ</button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-state-v2">
              <div className="empty-icon">✓</div>
              <strong>ไม่มีรายการที่ต้องตรวจสอบ</strong>
              <span>เมื่อมีรายการเติมเครดิตรอดำเนินการ ระบบจะแสดงที่ส่วนนี้ทันที</span>
            </div>
          )}
        </section>
      </div>

      <ManualTopupModal open={modalOpen} onClose={() => setModalOpen(false)} prefill={prefill} onDone={() => router.refresh()} />
    </>
  );
}
