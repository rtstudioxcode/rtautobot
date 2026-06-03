'use client';

import { useState, useEffect, useCallback } from 'react';

const CSS = `
@keyframes auRise{from{opacity:0;transform:translateY(16px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes auFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}
@keyframes auFade{from{opacity:0}to{opacity:1}}
@keyframes auModalIn{from{opacity:0;transform:translateY(22px) scale(.975)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes auCardIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}

.admin-users.au-page{
  --au-page:#08090b;--au-card:#17181d;--au-card-2:color-mix(in srgb,#17181d 86%,#fff 4%);
  --au-soft:color-mix(in srgb,#17181d 72%,#fff 7%);--au-text:#eef6ff;--au-muted:#b8b0a3;
  --au-border:rgba(255,255,255,.12);--au-accent:#08b84f;--au-accent-2:#21b95c;
  --au-green:#31d982;--au-red:#ff5a6e;--au-blue:#42b8ff;--au-purple:#9a73ff;--au-shadow:rgba(0,0,0,.32);
  color:var(--au-text);display:grid;gap:18px;isolation:isolate;
}
.admin-users *{box-sizing:border-box}
.admin-users .au-hero{
  position:relative;overflow:hidden;border:1px solid var(--au-border);border-radius:28px;
  min-height:220px;padding:34px clamp(20px,3vw,44px);display:grid;grid-template-columns:minmax(0,1.25fr) minmax(360px,.75fr);gap:24px;align-items:end;
  background:radial-gradient(900px 320px at 12% -10%,color-mix(in srgb,var(--au-accent) 22%,transparent),transparent 62%),radial-gradient(620px 260px at 92% 8%,rgba(85,118,255,.16),transparent 58%),linear-gradient(135deg,color-mix(in srgb,var(--au-card) 92%,#000 8%),color-mix(in srgb,var(--au-card) 72%,#000 18%));
  box-shadow:0 24px 70px var(--au-shadow),inset 0 1px 0 rgba(255,255,255,.06);animation:auRise .48s ease both;
}
.admin-users .au-hero:after{content:"";position:absolute;inset:auto -12% -70% 48%;height:260px;transform:rotate(-15deg);background:linear-gradient(90deg,transparent,rgba(255,255,255,.07),transparent);pointer-events:none}
.admin-users .au-hero-orb{position:absolute;border-radius:50%;filter:blur(30px);opacity:.5;pointer-events:none;animation:auFloat 7s ease-in-out infinite}
.admin-users .au-hero-orb-a{width:220px;height:220px;left:42%;top:-80px;background:color-mix(in srgb,var(--au-accent) 28%,transparent)}
.admin-users .au-hero-orb-b{width:180px;height:180px;right:8%;bottom:-90px;background:rgba(88,102,255,.22);animation-delay:-2s}
.admin-users .au-kicker{width:max-content;max-width:100%;display:inline-flex;align-items:center;gap:8px;border:1px solid color-mix(in srgb,var(--au-accent) 55%,var(--au-border));border-radius:999px;padding:9px 14px;color:var(--au-accent-2);font-weight:900;font-size:12px;letter-spacing:.08em;text-transform:uppercase;background:color-mix(in srgb,var(--au-accent) 8%,transparent);box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}
.admin-users .au-hero h1{margin:18px 0 8px;font-size:clamp(34px,4.4vw,72px);line-height:.98;letter-spacing:-.055em;color:var(--au-text)}
.admin-users .au-hero p{margin:0;max-width:760px;color:color-mix(in srgb,var(--au-muted) 82%,var(--au-accent));font-size:clamp(15px,1.3vw,19px);line-height:1.7;font-weight:700}
.admin-users .au-hero-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;position:relative;z-index:1}
.admin-users .au-stat-card{min-height:112px;border:1px solid var(--au-border);border-radius:22px;padding:16px;background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.015));box-shadow:inset 0 1px 0 rgba(255,255,255,.06);display:grid;align-content:center;gap:4px;transition:.22s ease}
.admin-users .au-stat-card:hover{transform:translateY(-3px);border-color:color-mix(in srgb,var(--au-accent) 48%,var(--au-border))}
.admin-users .au-stat-icon{font-size:24px}
.admin-users .au-stat-label{color:var(--au-muted);font-size:12px;font-weight:900}
.admin-users .au-stat-card strong{font-size:clamp(24px,2vw,34px);color:var(--au-accent-2);line-height:1}
.admin-users .au-toolbar{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;padding:12px;border:1px solid var(--au-border);border-radius:24px;background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.018)),var(--au-card);box-shadow:0 18px 48px var(--au-shadow);animation:auRise .5s .04s ease both}
.admin-users .au-toolbar-left{display:flex;gap:10px;flex-wrap:wrap}
.admin-users .au-mini-stat{min-width:180px;border:1px solid var(--au-border);border-radius:18px;padding:12px 14px;background:var(--au-soft)}
.admin-users .au-mini-stat span{display:block;color:var(--au-muted);font-size:12px;font-weight:900}
.admin-users .au-mini-stat strong{display:block;margin-top:2px;color:var(--au-accent-2);font-size:20px}
.admin-users .au-searchbox{flex:1 1 420px;max-width:680px;height:54px;display:flex;align-items:center;gap:12px;padding:0 14px;border:1px solid var(--au-border);border-radius:18px;background:color-mix(in srgb,var(--au-card) 75%,#000 10%);box-shadow:inset 0 1px 0 rgba(255,255,255,.05);transition:.2s ease}
.admin-users .au-searchbox:focus-within{border-color:color-mix(in srgb,var(--au-accent) 70%,var(--au-border));box-shadow:0 0 0 4px color-mix(in srgb,var(--au-accent) 16%,transparent)}
.admin-users .au-search-icon{font-size:24px;color:var(--au-accent)}
.admin-users .au-searchbox input{width:100%;border:0;outline:0;background:transparent;color:var(--au-text);font-weight:800;font-size:14px;font-family:inherit}
.admin-users .au-searchbox input::placeholder{color:color-mix(in srgb,var(--au-muted) 72%,transparent)}
.admin-users .au-searchbox kbd{border:1px solid var(--au-border);border-radius:10px;padding:4px 8px;color:var(--au-muted);background:var(--au-soft);font-weight:900;font-size:11px}
.admin-users .au-users-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px;animation:auRise .52s .08s ease both}
.admin-users .au-user-card{position:relative;overflow:hidden;border:1px solid var(--au-border);border-radius:24px;padding:16px;min-height:178px;background:linear-gradient(145deg,color-mix(in srgb,var(--au-card) 96%,#fff 2%),color-mix(in srgb,var(--au-card) 78%,#000 12%));box-shadow:0 18px 44px var(--au-shadow),inset 0 1px 0 rgba(255,255,255,.06);display:grid;grid-template-columns:74px minmax(0,1fr);grid-template-rows:auto auto;gap:12px 14px;cursor:pointer;outline:0;border:1px solid var(--au-border);transition:transform .22s ease,border-color .22s ease,box-shadow .22s ease}
.admin-users .au-user-card:hover{transform:translateY(-4px);border-color:color-mix(in srgb,var(--au-accent) 58%,var(--au-border));box-shadow:0 24px 60px var(--au-shadow),0 0 0 4px color-mix(in srgb,var(--au-accent) 10%,transparent)}
.admin-users .au-card-glow{position:absolute;inset:auto -30% -70% 40%;height:150px;background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--au-accent) 22%,transparent),transparent);transform:rotate(-15deg);opacity:.75;pointer-events:none}
.admin-users .au-avatar-wrap{position:relative;z-index:1;width:74px;height:74px}
.admin-users .au-user-avatar{width:74px;height:74px;border-radius:22px;object-fit:cover;border:1px solid color-mix(in srgb,var(--au-accent) 32%,var(--au-border));background:var(--au-soft);box-shadow:0 12px 24px rgba(0,0,0,.22)}
.admin-users .au-presence{position:absolute;right:-3px;bottom:-3px;width:18px;height:18px;border-radius:50%;border:3px solid var(--au-card);background:var(--au-red);box-shadow:0 0 18px currentColor}
.admin-users .au-presence.ok{background:var(--au-green)}
.admin-users .au-presence.warn{background:#08b84f}
.admin-users .au-user-main{position:relative;z-index:1;min-width:0}
.admin-users .au-user-row{display:flex;align-items:center;justify-content:space-between;gap:10px}
.admin-users .au-user-row h2{margin:0;color:var(--au-text);font-size:19px;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.admin-users .au-user-email{margin:5px 0 10px;color:var(--au-muted);font-size:13px;word-break:break-all}
.admin-users .au-badge-line{display:flex;gap:6px;flex-wrap:wrap}
.admin-users .au-badge{display:inline-flex;align-items:center;min-height:26px;padding:4px 9px;border-radius:999px;border:1px solid var(--au-border);background:var(--au-soft);color:var(--au-muted);font-size:11px;font-weight:900;line-height:1}
.admin-users .au-badge.ok{color:#bdf9d8;background:color-mix(in srgb,var(--au-green) 18%,var(--au-card));border-color:color-mix(in srgb,var(--au-green) 34%,var(--au-border))}
.admin-users .au-badge.warn{color:#21b95c;background:color-mix(in srgb,#08b84f 16%,var(--au-card));border-color:color-mix(in srgb,#08b84f 36%,var(--au-border))}
.admin-users .au-badge.role{color:var(--au-accent-2);background:color-mix(in srgb,var(--au-accent) 12%,var(--au-card));border-color:color-mix(in srgb,var(--au-accent) 42%,var(--au-border))}
.admin-users .au-badge.role-admin{color:#ffd9f6;background:color-mix(in srgb,#ff4ecb 14%,var(--au-card));border-color:color-mix(in srgb,#ff4ecb 34%,var(--au-border))}
.admin-users .au-badge.level{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.admin-users .au-card-metrics{grid-column:1/-1;position:relative;z-index:1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.admin-users .au-card-metrics div{border:1px solid var(--au-border);border-radius:16px;padding:10px 12px;background:rgba(255,255,255,.035)}
.admin-users .au-card-metrics span{display:block;color:var(--au-muted);font-size:11px;font-weight:900}
.admin-users .au-card-metrics strong{display:block;margin-top:2px;color:var(--au-accent-2);font-size:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.admin-users .au-empty-state{display:grid;place-items:center;padding:28px 0}
.admin-users .au-empty-card{width:min(720px,100%);text-align:center;border:1px solid var(--au-border);border-radius:28px;padding:38px 24px;background:var(--au-card);box-shadow:0 20px 60px var(--au-shadow)}
.admin-users .au-empty-icon{font-size:40px}
.admin-users .au-empty-card h2{margin:10px 0 4px;color:var(--au-text)}
.admin-users .au-empty-card p{margin:0;color:var(--au-muted)}
.admin-users .au-pager{display:flex;align-items:center;justify-content:center;gap:10px;padding:16px 0;flex-wrap:wrap}
.admin-users .au-pager-info{color:var(--au-muted);font-size:13px;font-weight:700}
.admin-users .au-pager-btn{min-height:40px;padding:8px 16px;border:1px solid var(--au-border);border-radius:14px;background:var(--au-soft);color:var(--au-text);cursor:pointer;font-weight:800;font-family:inherit;font-size:13px;transition:.18s ease}
.admin-users .au-pager-btn:hover:not(:disabled){background:color-mix(in srgb,var(--au-accent) 12%,var(--au-soft));border-color:color-mix(in srgb,var(--au-accent) 48%,var(--au-border))}
.admin-users .au-pager-btn:disabled{opacity:.45;cursor:not-allowed}
/* Modal */
.admin-users .au-modal{position:fixed;inset:0;z-index:99990;display:none;place-items:center;padding:24px;isolation:isolate}
.admin-users .au-modal.open{display:grid}
.admin-users .au-modal-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.64);backdrop-filter:blur(12px);animation:auFade .18s ease both}
.admin-users .au-modal-shell{position:relative;z-index:1;width:min(980px,calc(100vw - 28px));max-height:min(820px,calc(100dvh - 28px));display:flex;flex-direction:column;overflow:hidden;border:1px solid color-mix(in srgb,var(--au-accent) 22%,var(--au-border));border-radius:28px;background:linear-gradient(180deg,color-mix(in srgb,var(--au-card) 96%,#fff 3%),color-mix(in srgb,var(--au-card) 90%,#000 8%));box-shadow:0 36px 120px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.08);animation:auModalIn .26s cubic-bezier(.2,.8,.2,1) both}
.admin-users .au-modal-topline{height:4px;background:linear-gradient(90deg,var(--au-accent-2),var(--au-green),var(--au-purple));opacity:.95}
.admin-users .au-modal-head{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:20px 22px;border-bottom:1px solid var(--au-border);background:radial-gradient(600px 220px at 0% 0%,color-mix(in srgb,var(--au-accent) 14%,transparent),transparent 62%)}
.admin-users .au-modal-user{display:flex;align-items:center;gap:14px;min-width:0}
.admin-users .au-modal-avatar{width:74px;height:74px;border-radius:22px;object-fit:cover;border:1px solid color-mix(in srgb,var(--au-accent) 40%,var(--au-border));background:var(--au-soft)}
.admin-users .au-modal-kicker{color:var(--au-accent-2);font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.12em}
.admin-users .au-modal-head h2{margin:2px 0;color:var(--au-text);font-size:28px;line-height:1;word-break:break-word}
.admin-users .au-modal-head p{margin:0;color:var(--au-muted);font-size:13px;word-break:break-all}
.admin-users .au-close-btn{width:46px;height:46px;border:1px solid var(--au-border);border-radius:16px;background:var(--au-soft);color:var(--au-text);font-size:26px;font-weight:900;cursor:pointer;transition:.18s ease}
.admin-users .au-close-btn:hover{transform:rotate(8deg) scale(1.04);border-color:color-mix(in srgb,var(--au-red) 44%,var(--au-border));color:#ffd7dc}
.admin-users .au-modal-body{padding:18px;overflow:auto;display:grid;grid-template-columns:minmax(320px,.82fr) minmax(360px,1.18fr);gap:14px}
.admin-users .au-edit-panel,.admin-users .au-insight-panel{border:1px solid var(--au-border);border-radius:22px;padding:16px;background:rgba(255,255,255,.035);box-shadow:inset 0 1px 0 rgba(255,255,255,.04)}
.admin-users .au-section-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px}
.admin-users .au-section-head h3{margin:0;font-size:18px;color:var(--au-text)}
.admin-users .au-save-note{font-size:12px;font-weight:900;color:var(--au-muted)}
.admin-users .au-save-note.ok{color:var(--au-green)}
.admin-users .au-save-note.err{color:var(--au-red)}
.admin-users .au-panel-chip{font-size:11px;font-weight:900;color:var(--au-muted);border:1px solid var(--au-border);border-radius:999px;padding:6px 9px;background:var(--au-soft)}
.admin-users .au-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.admin-users .au-field{display:grid;gap:7px}
.admin-users .au-field.full{grid-column:1/-1}
.admin-users .au-field span{color:var(--au-accent-2);font-size:12px;font-weight:900}
.admin-users .au-input{width:100%;height:48px;border:1px solid var(--au-border);border-radius:16px;background:color-mix(in srgb,var(--au-card) 76%,#000 10%);color:var(--au-text);outline:0;padding:0 14px;font-weight:800;font-family:inherit;font-size:14px;transition:.18s ease}
.admin-users .au-input:focus{border-color:color-mix(in srgb,var(--au-accent) 72%,var(--au-border));box-shadow:0 0 0 4px color-mix(in srgb,var(--au-accent) 15%,transparent)}
.admin-users .au-select{appearance:none}
.admin-users .au-switch-card{display:flex;align-items:center;justify-content:space-between;gap:14px;border:1px solid var(--au-border);border-radius:18px;padding:14px;background:var(--au-soft);grid-column:1/-1}
.admin-users .au-switch-copy small{display:block;margin-top:3px;color:var(--au-muted);font-size:12px}
.admin-users .au-switch-copy strong{color:var(--au-accent-2);font-size:13px}
.admin-users .au-switch{position:relative;display:inline-flex;width:58px;height:34px;flex:0 0 auto}
.admin-users .au-switch input{position:absolute;opacity:0;inset:0;cursor:pointer}
.admin-users .au-switch-track{position:absolute;inset:0;border-radius:999px;background:rgba(255,255,255,.1);border:1px solid var(--au-border);transition:.18s ease}
.admin-users .au-switch-thumb{position:absolute;width:26px;height:26px;left:3px;top:3px;border-radius:50%;background:#fff;transition:.18s ease;box-shadow:0 6px 16px rgba(0,0,0,.25)}
.admin-users .au-switch.checked .au-switch-track{background:linear-gradient(135deg,var(--au-green),#0b9460);border-color:transparent}
.admin-users .au-switch.checked .au-switch-thumb{transform:translateX(24px)}
.admin-users .au-modal-actions{display:flex;justify-content:flex-end;gap:10px;padding:16px 22px;border-top:1px solid var(--au-border)}
.admin-users .au-save-btn{min-height:44px;padding:10px 18px;border:0;border-radius:15px;background:linear-gradient(135deg,#21b95c,#05b84f);color:#17130a;font-weight:1000;cursor:pointer;font-family:inherit;font-size:14px}
.admin-users .au-cancel-btn{min-height:44px;padding:10px 18px;border:1px solid var(--au-border);border-radius:15px;background:var(--au-soft);color:var(--au-text);cursor:pointer;font-weight:800;font-family:inherit;font-size:14px}
.admin-users .au-info-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.admin-users .au-info-item{min-height:72px;border:1px solid var(--au-border);border-radius:18px;padding:12px;background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.018));display:grid;align-content:center;gap:4px}
.admin-users .au-info-item span{color:var(--au-muted);font-size:11px;font-weight:900}
.admin-users .au-info-item strong{color:var(--au-text);font-size:15px;word-break:break-word}
@media(max-width:920px){
  .admin-users .au-hero{grid-template-columns:1fr}
  .admin-users .au-hero-stats{grid-template-columns:repeat(3,minmax(0,1fr))}
  .admin-users .au-modal-body{grid-template-columns:1fr}
}
@media(max-width:640px){
  .admin-users .au-hero{padding:22px}
  .admin-users .au-hero-stats{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
  .admin-users .au-toolbar{flex-direction:column;align-items:stretch}
  .admin-users .au-searchbox{max-width:100%}
  .admin-users .au-form-grid{grid-template-columns:1fr}
  .admin-users .au-field.full{grid-column:auto}
  .admin-users .au-modal-body{grid-template-columns:1fr;max-height:none}
  .admin-users .au-modal-shell{max-height:calc(100dvh - 20px)}
}
`;

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [saveNote, setSaveNote] = useState('');
  const [editName, setEditName] = useState('');
  const [editBalance, setEditBalance] = useState('');
  const [editRole, setEditRole] = useState('user');
  const [editEmailVerified, setEditEmailVerified] = useState(false);

  const LIMIT = 20;

  useEffect(() => { loadUsers(); }, [page, search]);

  async function loadUsers() {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: LIMIT, search });
    const res = await fetch(`/api/admin/users?${params}`);
    const data = await res.json();
    setUsers(data.users || []);
    setTotal(data.total || 0);
    setLoading(false);
  }

  function openModal(u) {
    setSelected(u);
    setEditName(u.name || '');
    setEditBalance(String(Number(u.balance || 0).toFixed(2)));
    setEditRole(u.role || 'user');
    setEditEmailVerified(!!u.emailVerified);
    setSaveNote('');
  }

  function closeModal() { setSelected(null); }

  async function saveUser() {
    if (!selected) return;
    setSaveNote('กำลังบันทึก...');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateUser',
          userId: selected._id,
          name: editName,
          balance: Number(editBalance),
          role: editRole,
          emailVerified: editEmailVerified,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'บันทึกไม่สำเร็จ');
      setSaveNote('บันทึกสำเร็จ ✓');
      setTimeout(() => { closeModal(); loadUsers(); }, 600);
    } catch (err) {
      setSaveNote('❌ ' + (err?.message || 'บันทึกไม่สำเร็จ'));
    }
  }

  const totalUsers = total;
  const adminCount = users.filter(u => String(u.role || '').toLowerCase() === 'admin').length;
  const verifiedCount = users.filter(u => !!u.emailVerified).length;
  const totalBalance = users.reduce((s, u) => s + Number(u.balance || 0), 0);
  const totalSpentAll = users.reduce((s, u) => s + Number(u.totalSpent || 0), 0);
  const fmtMoney = (n) => Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 });
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="admin-users au-page">

        {/* Hero */}
        <section className="au-hero" aria-label="ภาพรวมผู้ใช้">
          <div className="au-hero-orb au-hero-orb-a" aria-hidden="true" />
          <div className="au-hero-orb au-hero-orb-b" aria-hidden="true" />
          <div className="au-hero-copy">
            <div className="au-kicker"><span>✦</span> User Control Center</div>
            <h1>Admin | ข้อมูลยูสเซอร์</h1>
            <p>จัดการข้อมูลสมาชิก ตรวจยอดเครดิต สถานะอีเมล ระดับผู้ใช้ และสิทธิ์การใช้งานได้ครบในหน้าจอเดียว</p>
          </div>
          <div className="au-hero-stats" aria-label="สรุปผู้ใช้">
            <article className="au-stat-card">
              <span className="au-stat-icon">👥</span>
              <span className="au-stat-label">ผู้ใช้ทั้งหมด</span>
              <strong>{totalUsers.toLocaleString('th-TH')}</strong>
            </article>
            <article className="au-stat-card">
              <span className="au-stat-icon">🛡️</span>
              <span className="au-stat-label">Admin</span>
              <strong>{adminCount.toLocaleString('th-TH')}</strong>
            </article>
            <article className="au-stat-card">
              <span className="au-stat-icon">✅</span>
              <span className="au-stat-label">ยืนยันอีเมล</span>
              <strong>{verifiedCount.toLocaleString('th-TH')}</strong>
            </article>
          </div>
        </section>

        {/* Toolbar */}
        <section className="au-toolbar" aria-label="เครื่องมือค้นหาและสรุป">
          <div className="au-toolbar-left">
            <div className="au-mini-stat">
              <span>ยอดเครดิตรวม</span>
              <strong>฿{fmtMoney(totalBalance)}</strong>
            </div>
            <div className="au-mini-stat">
              <span>ยอดใช้จ่ายรวม</span>
              <strong>฿{fmtMoney(totalSpentAll)}</strong>
            </div>
          </div>
          <label className="au-searchbox" htmlFor="userSearch">
            <span className="au-search-icon">⌕</span>
            <input
              id="userSearch"
              type="search"
              placeholder="ค้นหา username / ชื่อ / อีเมล / role / level"
              aria-label="ค้นหาผู้ใช้"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
            <kbd>/</kbd>
          </label>
        </section>

        {/* Grid / Empty */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#08b84f' }}>กำลังโหลด...</div>
        ) : users.length === 0 ? (
          <section className="au-empty-state">
            <div className="au-empty-card">
              <div className="au-empty-icon">{search ? '🔎' : '🧑‍💼'}</div>
              <h2>{search ? 'ไม่พบผู้ใช้ที่ค้นหา' : 'ยังไม่มีผู้ใช้ในระบบ'}</h2>
              <p>{search ? 'ลองเปลี่ยนคำค้นหา หรือกดล้างช่องค้นหาเพื่อดูรายการทั้งหมด' : 'เมื่อมีผู้ใช้ใหม่ ระบบจะแสดงรายการและข้อมูลสำคัญที่นี่ทันที'}</p>
            </div>
          </section>
        ) : (
          <>
            <section className="au-users-grid" role="list" aria-label="รายการผู้ใช้">
              {users.map((u) => {
                const role = String(u.role || 'user').toLowerCase();
                const balance = Number(u.balance || 0);
                const spent = Number(u.totalSpent || 0);
                return (
                  <article
                    key={String(u._id)}
                    className="au-user-card"
                    role="listitem"
                    tabIndex={0}
                    onClick={() => openModal(u)}
                    onKeyDown={e => e.key === 'Enter' && openModal(u)}
                    aria-label={`ดูข้อมูล ${u.username || 'ผู้ใช้'}`}
                  >
                    <div className="au-card-glow" aria-hidden="true" />
                    <div className="au-avatar-wrap">
                      <img className="au-user-avatar" src={u.avatarUrl || '/assets/logo/icon-logo.png'} alt={`avatar of ${u.username || 'user'}`} onError={e => { e.target.src = '/assets/logo/icon-logo.png'; }} />
                      <span className={`au-presence${u.emailVerified ? ' ok' : ' warn'}`} title={u.emailVerified ? 'ยืนยันอีเมลแล้ว' : 'ยังไม่ยืนยันอีเมล'} />
                    </div>
                    <div className="au-user-main">
                      <div className="au-user-row">
                        <h2>{u.username || '—'}</h2>
                        <span className={`au-badge role role-${role}`}>{role}</span>
                      </div>
                      <p className="au-user-email">{u.email || '-'}</p>
                      <div className="au-badge-line">
                        {u.emailVerified
                          ? <span className="au-badge ok">ยืนยันอีเมลแล้ว</span>
                          : <span className="au-badge warn">ยังไม่ยืนยันอีเมล</span>}
                        <span className="au-badge level">{u.levelName || `เลเวล ${u.level || 1}`}</span>
                      </div>
                    </div>
                    <div className="au-card-metrics">
                      <div><span>ยอดเงินคงเหลือ</span><strong className="balance">฿{balance.toLocaleString('th-TH', { maximumFractionDigits: 2 })}</strong></div>
                      <div><span>ยอดใช้จ่ายรวม</span><strong>฿{spent.toLocaleString('th-TH', { maximumFractionDigits: 2 })}</strong></div>
                    </div>
                  </article>
                );
              })}
            </section>

            {/* Pager */}
            <div className="au-pager">
              <button className="au-pager-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← ก่อนหน้า</button>
              <span className="au-pager-info">หน้า {page} / {totalPages}</span>
              <button className="au-pager-btn" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}>ถัดไป →</button>
            </div>
          </>
        )}

        {/* Modal */}
        <div className={`au-modal${selected ? ' open' : ''}`} aria-hidden={!selected} role="dialog" aria-modal="true">
          <div className="au-modal-backdrop" onClick={closeModal} />
          {selected && (
            <div className="au-modal-shell">
              <div className="au-modal-topline" />
              <header className="au-modal-head">
                <div className="au-modal-user">
                  <img className="au-modal-avatar" src={selected.avatarUrl || '/assets/logo/icon-logo.png'} alt="user avatar" onError={e => { e.target.src = '/assets/logo/icon-logo.png'; }} />
                  <div>
                    <div className="au-modal-kicker">User profile</div>
                    <h2>{selected.username || '—'}</h2>
                    <p>{selected.email || '—'}</p>
                  </div>
                </div>
                <button type="button" className="au-close-btn" onClick={closeModal} aria-label="ปิดหน้าต่าง">×</button>
              </header>

              <main className="au-modal-body">
                {/* Edit panel */}
                <section className="au-edit-panel" aria-label="แก้ไขข้อมูลหลัก">
                  <div className="au-section-head">
                    <h3>ข้อมูลหลัก</h3>
                    <span className={`au-save-note${saveNote.includes('สำเร็จ') ? ' ok' : saveNote.includes('❌') ? ' err' : ''}`}>{saveNote}</span>
                  </div>
                  <div className="au-form-grid">
                    <label className="au-field full">
                      <span>ชื่อ-นามสกุล</span>
                      <input className="au-input" type="text" placeholder="ชื่อ-นามสกุล" value={editName} onChange={e => setEditName(e.target.value)} />
                    </label>
                    <label className="au-field">
                      <span>Role</span>
                      <select className="au-input au-select" value={editRole} onChange={e => setEditRole(e.target.value)}>
                        <option value="user">user — สมาชิกทั่วไป</option>
                        <option value="admin">admin — ผู้ดูแลระบบ</option>
                      </select>
                    </label>
                    <label className="au-field">
                      <span>ยอดเงิน</span>
                      <input className="au-input" type="number" step="0.01" min="0" inputMode="decimal" placeholder="0.00" value={editBalance} onChange={e => setEditBalance(e.target.value)} />
                    </label>
                    <div className="au-switch-card">
                      <span className="au-switch-copy">
                        <strong>สถานะอีเมล</strong>
                        <small>เปิดเมื่อผู้ใช้ยืนยันอีเมลเรียบร้อยแล้ว</small>
                      </span>
                      <label className={`au-switch${editEmailVerified ? ' checked' : ''}`} title="toggle email verified">
                        <input type="checkbox" checked={editEmailVerified} onChange={e => setEditEmailVerified(e.target.checked)} />
                        <span className="au-switch-track" />
                        <span className="au-switch-thumb" />
                      </label>
                    </div>
                  </div>
                </section>

                {/* Info panel (read only) */}
                <section className="au-insight-panel" aria-label="ข้อมูลเชิงลึกผู้ใช้">
                  <div className="au-section-head">
                    <h3>ข้อมูลผู้ใช้</h3>
                    <span className="au-panel-chip">Read only</span>
                  </div>
                  <div className="au-info-grid">
                    {[
                      ['ระดับผู้ใช้', selected.levelName || `เลเวล ${selected.level || 1}`],
                      ['Serial Key', selected.serial_key || '—'],
                      ['ยอดใช้จ่ายรวม', `฿${Number(selected.totalSpent || 0).toLocaleString()}`],
                      ['แต้มสะสม', Number(selected.points || 0).toLocaleString()],
                      ['ยอดออเดอร์', `${Number(selected.totalOrders || 0).toLocaleString()} ออเดอร์`],
                      ['Affiliate %', selected.affiliateRate ? `${selected.affiliateRate}%` : '—'],
                      ['แนะนำแล้ว', selected.affiliateReferCount ? selected.affiliateReferCount : '—'],
                      ['รายได้แนะนำ', selected.affiliateEarned ? `฿${Number(selected.affiliateEarned).toLocaleString()}` : '—'],
                      ['สร้างเมื่อ', selected.createdAt ? new Date(selected.createdAt).toLocaleDateString('th-TH') : '—'],
                      ['อัปเดตล่าสุด', selected.updatedAt ? new Date(selected.updatedAt).toLocaleDateString('th-TH') : '—'],
                    ].map(([label, val]) => (
                      <div key={label} className="au-info-item"><span>{label}</span><strong>{val}</strong></div>
                    ))}
                  </div>
                </section>
              </main>

              <div className="au-modal-actions">
                <button type="button" className="au-cancel-btn" onClick={closeModal}>ยกเลิก</button>
                <button type="button" className="au-save-btn" onClick={saveUser}>บันทึก</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
