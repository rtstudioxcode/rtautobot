// routes/dashboard.js
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { LEVELS as LV } from '../services/loyalty.js';
import { recalcUserTotals } from '../services/spend.js';

const router = Router();
router.use(requireAuth);

function levelNameFromSnapshot(snap = {}) {
  const levelNum = Math.max(1, Number(snap.level || 1));
  const idx = levelNum - 1;
  return snap.levelInfo?.name || LV?.[idx]?.name || `เลเวล ${levelNum}`;
}

async function loadDashboardTotals(userId) {
  // fullRescan=false: หน้า Dashboard ต้องเร็วและห้ามสแกน/เขียนยอดย้อนหลังจนยอดถอยเอง
  // ยอดใหม่จะถูกเพิ่มผ่าน reconcile ตอนออเดอร์สำเร็จ/งานจบ และ recalc นี้ทำหน้าที่จัด level/points/order count ล่าสุด
  return recalcUserTotals(userId, { force: true, fullRescan: false, reason: 'dashboard_view' });
}

async function renderDashboard(req, res, next) {
  try {
    const me = res.locals?.me || req.user || req.session?.user;
    if (!me?._id) return res.redirect('/login');

    const totals = await loadDashboardTotals(me._id);
    const fresh = await User.findById(me._id)
      .select('name email avatarUrl avatarVer username balance totalSpent totalOrders level levelName')
      .lean();
    const viewMe = { ...(me || {}), ...(fresh || {}) };

    const stats = {
      totalSpent: Number(totals.totalSpent ?? fresh?.totalSpent ?? 0),
      totalOrders: Number(totals.totalOrders ?? fresh?.totalOrders ?? 0),
    };
    const userLevel = String(totals.level || fresh?.level || '1');

    return res.render('dashboard/index', {
      title: 'Dashboard',
      stats,
      userLevel,
      userLevelName: levelNameFromSnapshot(totals),
      me: viewMe,
    });
  } catch (err) {
    next(err);
  }
}

router.get('/', renderDashboard);
router.get('/dashboard', renderDashboard);

router.get('/api/me/dashboard', async (req, res) => {
  try {
    const me = res.locals?.me || req.user || req.session?.user;
    if (!me?._id) return res.status(401).json({ ok: false, error: 'unauthorized' });

    const totals = await loadDashboardTotals(me._id);
    return res.json({
      ok: true,
      data: {
        totalSpent: Number(totals.totalSpent || 0),
        totalOrders: Number(totals.totalOrders || 0),
        level: String(totals.level || '1'),
        levelName: levelNameFromSnapshot(totals),
        totalSpentRaw: Number(totals.totalSpentRaw || 0),
        redeemedSpent: Number(totals.redeemedSpent || 0),
        points: Number(totals.points || 0),
      },
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || 'internal error' });
  }
});

export default router;
