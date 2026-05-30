// src/routes/changes.js
import { Router } from 'express';
import crypto from 'node:crypto';
import { requireAuth } from '../middleware/auth.js';
import { ChangeLog } from '../models/ChangeLog.js';
import { config } from '../config.js';
// (อันอื่นยังไม่จำเป็นต้องใช้ในไฟล์นี้)
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import tz from 'dayjs/plugin/timezone.js';

dayjs.extend(utc); dayjs.extend(tz);

const r = Router();

// ───────── GLOBAL LOG ─────────
const isGlobalLogEnabled = () => {
  return config?.system?.globalLogEnabled === true;
};

const glog = {
  log: (...args) => {
    if (isGlobalLogEnabled()) console.log(...args);
  },
  info: (...args) => {
    if (isGlobalLogEnabled()) console.info(...args);
  },
  warn: (...args) => {
    if (isGlobalLogEnabled()) console.warn(...args);
  },
  error: (...args) => {
    if (isGlobalLogEnabled()) console.error(...args);
  },
};

/* ---------------- UI ---------------- */
r.get('/update', requireAuth, async (req, res) => {
  res.render('update', { title: 'อัปเดตบริการ' });
});

/* ---------------- helpers ---------------- */
function wantTrue(v) {
  const s = String(v ?? '').trim();
  return s === '1' || s.toLowerCase() === 'true' || s.toLowerCase() === 'yes';
}
function weakEtag(value) {
  return 'W/\"' + crypto.createHash('sha1').update(JSON.stringify(value || '')).digest('hex') + '\"';
}
function sendCachedJson(req, res, payload, seconds = 300) {
  const etag = weakEtag(payload);
  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', `private, max-age=${seconds}, stale-while-revalidate=${seconds * 2}`);
  res.setHeader('Vary', 'Cookie');
  if (String(req.headers['if-none-match'] || '').split(',').map(v => v.trim()).includes(etag)) {
    return res.status(304).end();
  }
  return res.json(payload);
}

/* ---------------- API: รายการอัปเดต ----------------
   params:
   - latest=1           : ดึงเฉพาะ “วันล่าสุด” (เทียบตาม timezone)
   - date=YYYY-MM-DD    : (ทางเลือก) ระบุวันเอง ถ้ากำหนด date จะไม่สนใจ latest
   - limit=…            : จำนวนสูงสุด (10..1000)
   - includeBootstrap=1 : ให้รวม diff:"state" (snapshot แรก) ด้วย
   - target=service|category (ตัวกรอง)
   - diff=new|open|close|removed|updated|state (ตัวกรอง)
------------------------------------------------------ */
r.get('/api/changes', requireAuth, async (req, res) => {
  try {
    const tzName = req.app?.locals?.timezone || 'Asia/Bangkok';
    const limit = Math.min(1000, Math.max(10, Number(req.query.limit || 500)));
    const includeBootstrap = wantTrue(req.query.includeBootstrap);
    const latest = wantTrue(req.query.latest);
    const target = (req.query.target || '').trim();
    const diff = (req.query.diff || '').trim();

    // base filter: โดยดีฟอลต์ "ไม่เอา" state/bootstrap
    const baseFilter = includeBootstrap ? {} : { diff: { $ne: 'state' }, isBootstrap: { $ne: true } };

    // ตัวกรองเสริม
    if (target === 'service' || target === 'category') baseFilter.target = target;
    if (diff) baseFilter.diff = diff;

    // กรณีเลือกวันเอง
    const dateStr = (req.query.date || '').trim(); // YYYY-MM-DD
    if (dateStr) {
      const start = dayjs.tz(`${dateStr}T00:00:00`, tzName);
      const end   = start.add(1, 'day');
      const items = await ChangeLog
        .find({ ...baseFilter, ts: { $gte: start.toDate(), $lt: end.toDate() } })
        .sort({ ts: -1 })
        .limit(limit)
        .lean();

      return sendCachedJson(req, res, {
        ok: true,
        items,
        latestDay: dateStr,
      }, 300);
    }

    // โหมด “วันล่าสุด”
    if (latest) {
      // หาหัวแถวล่าสุดแบบปกติ (ไม่เอา state/bootstrap)
      let head = await ChangeLog.findOne(baseFilter).sort({ ts: -1 }).lean();
      let useBootstrapOnly = false;

      // ถ้ายังไม่มีเลย (มีแต่ state/bootstrap) → fallback
      if (!head) {
        head = await ChangeLog.findOne().sort({ ts: -1 }).lean(); // เอาอะไรก็ได้ล่าสุด
        if (!head) {
          return sendCachedJson(req, res, { ok: true, items: [], latestDay: null }, 300);
        }
        useBootstrapOnly = true;
      }

      const dayStr = dayjs(head.ts).tz(tzName).format('YYYY-MM-DD');
      const start = dayjs.tz(`${dayStr}T00:00:00`, tzName);
      const end   = start.add(1, 'day');

      // ถ้าใช้ bootstrap-only → ไม่กรอง diff/isBootstrap เลย เอาทั้งวัน
      // ถ้ามี diff จริงแล้ว → ใช้ baseFilter ตามเดิม
      const filterForDay = useBootstrapOnly
        ? { ts: { $gte: start.toDate(), $lt: end.toDate() } }
        : { ...baseFilter, ts: { $gte: start.toDate(), $lt: end.toDate() } };

      const items = await ChangeLog
        .find(filterForDay)
        .sort({ ts: -1 })
        .limit(limit)
        .lean();

      return sendCachedJson(req, res, {
        ok: true,
        items,
        latestDay: start.format('YYYY-MM-DD'),
      }, 300);
    }

    // โหมด page/cursor (ย้อนอดีต)
    const cursor = req.query.cursor ? new Date(req.query.cursor) : null;
    const q = { ...baseFilter };
    if (cursor && !isNaN(cursor)) q.ts = { $lt: cursor };

    const docs = await ChangeLog.find(q).sort({ ts: -1 }).limit(limit + 1).lean();
    const hasMore = docs.length > limit;
    const items = hasMore ? docs.slice(0, limit) : docs;
    const nextCursor = hasMore ? items[items.length - 1]?.ts : null;

    return sendCachedJson(req, res, { ok: true, items, nextCursor }, 300);
  } catch (err) {
    glog.error('GET /api/changes error:', err);
    return res.status(500).json({ ok: false, error: err.message || 'internal_error' });
  }
});

export default r;
