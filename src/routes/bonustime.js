// src/routes/bonustime.js
import { Router } from "express";
import crypto from "crypto";
import { requireAuth } from "../middleware/auth.js";
import { User } from "../models/User.js";
import { BonustimeUser } from "../models/BonustimeUser.js";
import { BonustimeOrder } from "../models/BonustimeOrder.js";
import { recalcUserTotals } from "../services/spend.js";
import { checkAndSendBonustimeExpiryMails } from "../services/bonustimeExpiry.js";
import { config } from '../config.js';
import { buildAdditiveFields, bonustimeTenantLookup, publicTenantKey, bonustimeSharedServiceName } from '../services/bonustimeMultiTenant.js';

const router = Router();
router.use(requireAuth);

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

// ===== helper: วันที่แบบไทย =====
const DAY_MS = 24 * 60 * 60 * 1000;
const UPGRADE_LOTTO_PRICE = 1000;

const BT_PACKAGES = {
  normal: { // สล็อต + บาคาร่า
    days: 30,
    price: 2000,
    label: "แพ็กเกจ 1 : สล็อต + บาคาร่า",
  },
  lotto: { // สล็อต + บาคาร่า + หวย
    days: 30,
    price: 2500,
    label: "แพ็กเกจ 2 : สล็อต + บาคาร่า + หวย",
  },
};

function thaiDateString(d = new Date()) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear() + 543;
  return `${dd}/${mm}/${yyyy}`;
}

function parseThaiDate(str) {
  if (!str) return null;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(str).trim());
  if (!m) return null;
  let [, d, mo, y] = m;
  let year = Number(y);
  if (year > 2400) year -= 543; // แปลง พ.ศ. -> ค.ศ.
  return new Date(year, Number(mo) - 1, Number(d));
}

function formatThaiDate(d) {
  const day = String(d.getDate()).padStart(2, "0");
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear() + 543;
  return `${day}/${mo}/${year}`;
}

function calcExpiry(doc) {
  const start = parseThaiDate(doc.LICENSE_START_DATE);
  const duration = Number(doc.LICENSE_DURATION_DAYS) || 0;
  if (!start || !duration) return null;
  return new Date(start.getTime() + duration * DAY_MS);
}

// ===== ราคาแพ็กเกจ (ฝั่งเซิร์ฟเวอร์) =====
// สล็อต + บาคาร่า
const PLANS_NORMAL = [
  { days: 30, price: 1500, label: "1 เดือน", discount: "0%" },
  { days: 90, price: 4050, label: "3 เดือน", discount: "-10%" },
  { days: 180, price: 7200, label: "6 เดือน", discount: "-20%" },
  { days: 365, price: 12600, label: "12 เดือน", discount: "-30%" },
  { days: 730, price: 21600, label: "24 เดือน", discount: "-40%" },
];

// สล็อต + บาคาร่า + หวย
const PLANS_LOTTO = [
  { days: 30, price: 2000, label: "1 เดือน", discount: "0%" },
  { days: 90, price: 5400, label: "3 เดือน", discount: "-10%" },
  { days: 180, price: 9600, label: "6 เดือน", discount: "-20%" },
  { days: 365, price: 16800, label: "12 เดือน", discount: "-30%" },
  { days: 730, price: 28800, label: "24 เดือน", discount: "-40%" },
];

function findPlan(days, includeLotto) {
  const daysNum = Number(days) || 0;
  const list = includeLotto ? PLANS_LOTTO : PLANS_NORMAL;
  return list.find((p) => p.days === daysNum) || null;
}

function isAdminReq(req) {
  return String(req.session?.user?.role || req.user?.role || '').toLowerCase() === 'admin';
}

async function getCurrentUser(req, projection = '_id role serial_key balance referredBy') {
  const uid = req.user?._id || req.session?.user?._id;
  if (!uid) return null;
  return User.findById(uid).select(projection);
}

function sameSerial(a, b) {
  return String(a || '').trim() && String(a || '').trim() === String(b || '').trim();
}

async function assertOwnBonustimeDoc(req, doc) {
  if (!doc) return { ok:false, status:404, message:'ไม่พบข้อมูล Bonustime' };
  if (isAdminReq(req)) return { ok:true, user:null };

  const user = await getCurrentUser(req);
  if (!user?.serial_key) {
    return { ok:false, status:403, message:'กรุณาลงทะเบียน Serial Key ก่อนใช้งาน' };
  }
  if (!sameSerial(doc.serial_key, user.serial_key)) {
    return { ok:false, status:403, message:'คุณไม่มีสิทธิ์จัดการ Service นี้' };
  }
  return { ok:true, user };
}


function calcRemainDaysFromDoc(doc) {
  const exp = calcExpiry(doc);
  if (!exp) return null;
  const now = new Date();
  const diff = exp.getTime() - now.getTime();
  const days = Math.ceil(diff / DAY_MS);
  return days;
}

// ===== routes =====

// หน้าเช็ค serial key ก่อน
router.get("/bonustime", async (req, res) => {
  const user = await User.findById(req.session.user._id).lean();

  res.render("bonustime/index", {
    pageTitle: "Bonustime",
    serial_key: user?.serial_key || null,
  });
});

router.post("/bonustime/register", async (req, res) => {
  const key = "BT-" + crypto.randomBytes(6).toString("hex").toUpperCase();

  await User.findByIdAndUpdate(req.session.user._id, {
    serial_key: key,
  });

  res.redirect("/bonustime");
});

router.get("/bonustime/history", async (req, res) => {
  const user = await User.findById(req.session.user._id).lean();
  const mySerial = user?.serial_key;

  if (!mySerial) {
    return res.json({ ok: true, records: [] });
  }

  const myRecords = await BonustimeUser.find({
    serial_key: mySerial,
  })
    .lean()
    .sort({ serviceGroup: 1, serviceNo: 1, tenantId: 1 });

  return res.json({
    ok: true,
    records: myRecords,
  });
});

// โหลดจำนวนสินค้าที่ "ยังไม่มีเจ้าของ" ของแต่ละแพ็กเกจ
router.get("/bonustime/products", async (req, res) => {
  try {
    const baseFilter = { $or: [{ serial_key: null }, { serial_key: "" }] };

    const [normalCount, lottoCount] = await Promise.all([
      BonustimeUser.countDocuments({ ...baseFilter, LOTTO_ENABLED: false }),
      BonustimeUser.countDocuments({ ...baseFilter, LOTTO_ENABLED: true }),
    ]);

    return res.json({
      ok: true,
      packages: {
        normal: { count: normalCount, ...BT_PACKAGES.normal },
        lotto: { count: lottoCount, ...BT_PACKAGES.lotto },
      },
    });
  } catch (err) {
    // glog.error("GET /bonustime/products error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "ไม่สามารถโหลดข้อมูลสินค้า Bonustime ได้" });
  }
});

// เลือก tenant ที่ยังไม่มีเจ้าของตัวถัดไปของแพ็กเกจที่เลือก
router.get("/bonustime/next", async (req, res) => {
  try {
    const type = req.query.type === "lotto" ? "lotto" : "normal";
    const wantLotto = type === "lotto";

    const filter = {
      $or: [{ serial_key: null }, { serial_key: "" }],
      LOTTO_ENABLED: wantLotto,
    };

    // เดิม: sort แบบตัวอักษร ทำให้ "Server10" มาก่อน "Server7"
    // const item = await BonustimeUser.findOne(filter)
    //   .sort({ tenantId: 1, _id: 1 })
    //   .lean();

    // ใหม่: ใช้ collation แบบ numericOrdering ให้เลขหลังชื่อ server เรียงถูก
    const item = await BonustimeUser.findOne(filter)
      .collation({ locale: "en", numericOrdering: true })
      .sort({ tenantId: 1, _id: 1 })
      .lean();

    if (!item) {
      return res.json({
        ok: false,
        message: "แพ็กเกจนี้สินค้าหมดแล้ว",
      });
    }

    return res.json({
      ok: true,
      item: {
        _id: item._id,
        tenantId: item.tenantId,
      },
    });
  } catch (err) {
    // glog.error("GET /bonustime/next error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "ไม่สามารถดึงข้อมูล tenant ได้" });
  }
});

// สั่งซื้อแพ็กเกจ Bonustime
router.post("/bonustime/order", async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(401).json({ ok: false, message: "ไม่พบข้อมูลผู้ใช้" });
    }

    if (!user.serial_key) {
      return res.json({
        ok: false,
        message: "กรุณาลงทะเบียน Serial Key ก่อนสั่งซื้อ",
      });
    }

    const {
      bonustimeId,
      packageType,
      NAME,
      CHANNEL_ACCESS_TOKEN,
      CHANNEL_SECRET,
      LOGO,
      LOGIN_URL,
      SIGNUP_URL,
      LINE_ADMIN,
    } = req.body;

    const type = packageType === "lotto" ? "lotto" : "normal";
    const pack = BT_PACKAGES[type];
    if (!pack || !bonustimeId) {
      return res.json({ ok: false, message: "ข้อมูลคำสั่งซื้อไม่ถูกต้อง" });
    }

    const price = pack.price;

    // เช็กเงินในกระเป๋า
    if ((user.balance || 0) < price) {
      return res.json({
        ok: false,
        message: "ยอดเงินในกระเป๋าไม่เพียงพอสำหรับสั่งซื้อแพ็กเกจนี้",
      });
    }

    // ===========================
    // ใช้ server ที่ Modal แสดงจริง ๆ
    // ===========================
    const filter = {
      _id: bonustimeId,                            // ใช้เฉพาะตัวนี้
      $or: [{ serial_key: null }, { serial_key: "" }],
      LOTTO_ENABLED: type === "lotto",
    };

    const record = await BonustimeUser.findOne(filter);
    if (!record) {
      // กันเคสโดนซื้อไปก่อน / ไม่ตรงประเภท
      return res.json({
        ok: false,
        message: "รายการนี้ถูกซื้อไปแล้ว หรือไม่พร้อมใช้งาน",
      });
    }

    // ===========================
    // หัก balance ผู้ใช้
    // ===========================
    user.balance = (user.balance || 0) - price;
    await user.save();

    // ===========================
    // อัปเดตข้อมูลใน rtautobot
    // ===========================
    record.serial_key = user.serial_key;
    record.NAME = NAME || "";
    record.CHANNEL_ACCESS_TOKEN = CHANNEL_ACCESS_TOKEN || "";
    record.CHANNEL_SECRET = CHANNEL_SECRET || "";
    record.LOGO = LOGO || "";
    record.LOGIN_URL = LOGIN_URL || "";
    record.SIGNUP_URL = SIGNUP_URL || "";
    record.LINE_ADMIN = LINE_ADMIN || "";
    record.LICENSE_START_DATE = thaiDateString(new Date());
    record.LICENSE_DURATION_DAYS = pack.days;
    record.LICENSE_DISABLED = false;

    // Multi-tenant additive fields: keep legacy tenantId/LINK but add serviceKey/webhookUrl for single Railway service routing.
    const mt = buildAdditiveFields(record.toObject ? record.toObject() : record);
    for (const [k, v] of Object.entries(mt)) record[k] = v;
    if (!record.LINK && mt.webhookUrl) record.LINK = mt.webhookUrl;

    if (type === "lotto") {
      record.note = "แพ็กเกจ 2 (สล็อต+บาคาร่า+หวย)";
    } else {
      record.note = "แพ็กเกจ 1 (สล็อต+บาคาร่า)";
    }

    await record.save();

    //-------------------------------------------
    // 1) เพิ่มยอดใช้จ่าย Bonustime (ไม่ยุ่ง totalSpentRaw)
    //-------------------------------------------
    await User.updateOne(
        { _id: user._id },
        { $inc: { btSpent: price } }
    );

    //-------------------------------------------
    // 2) ค่าคอมแนะนำเพื่อน 500 บาท
    //-------------------------------------------
    let affiliateReward = 0;

    if (user.referredBy) {
        affiliateReward = 500;

        await User.updateOne(
            { _id: user.referredBy },
            {
            $inc: {
                "affiliate.earningsTHB": affiliateReward,
                "affiliate.withdrawableTHB": affiliateReward
            }
            }
        );
    }

    //-------------------------------------------
    // 3) บันทึกประวัติขาย BonustimeOrder
    //-------------------------------------------
    await BonustimeOrder.create({
        user: user._id,
        referrer: user.referredBy || null,
        serialKey: user.serial_key,
        legacyTenantId: record.legacyTenantId || record.tenantId || null,
        serviceMode: record.serviceMode || "multiTenant",
        serviceKey: record.serviceKey || null,
        webhookUrl: record.webhookUrl || record.LINK || null,
        type: "buy",
        packageType: type,
        days: pack.days,
        amountTHB: price,
        affiliateRewardTHB: affiliateReward
    });

    // อัปเดตเลเวล คะแนน และยอดใช้จ่ายทันที
    await recalcUserTotals(user._id, { force: true, fullRescan: false });

    return res.json({
      ok: true,
      plan: {
        type,
        label: pack.label,
        days: pack.days,
        price,
      },
      balance: user.balance,
      tenantId: record.tenantId || null, // เผื่ออยากโชว์ต่อ
    });
  } catch (err) {
    // glog.error("POST /bonustime/order error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "ไม่สามารถสั่งซื้อแพ็กเกจ Bonustime ได้" });
  }
});

// === บันทึกการแก้ไขข้อมูล (อัปเดต rtautobot.users ของ tenantId นั้น) ===
router.post("/bonustime/:id/update", async (req, res) => {
  try {
    const { id } = req.params;

    const doc = await BonustimeUser.findById(id);
    if (!doc) {
      return res.status(404).json({ ok: false, message: "ไม่พบข้อมูล Bonustime" });
    }

    const own = await assertOwnBonustimeDoc(req, doc);
    if (!own.ok) return res.status(own.status || 403).json({ ok:false, message: own.message });

    // whitelist fields ที่อนุญาตให้แก้
    const payload = req.body || {};
    const fields = [
      "NAME",
      "CHANNEL_ACCESS_TOKEN",
      "CHANNEL_SECRET",
      "LOGO",
      "LOGIN_URL",
      "SIGNUP_URL",
      "LINE_ADMIN",
    ];

    for (const f of fields) {
      if (payload[f] !== undefined) {
        doc[f] = payload[f];
      }
    }

    await doc.save(); // ✅ save ตรง BonustimeUser = อัปเดต rtautobot.users ของ tenant นั้นโดยตรงแล้ว

    return res.json({ ok: true });
  } catch (err) {
    // glog.error("POST /bonustime/:id/update error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "เกิดข้อผิดพลาดระหว่างอัปเดตข้อมูล" });
  }
});

// === อัปเกรดเพิ่มหวย (LOTTO_ENABLED = true) ===
router.post("/bonustime/:id/upgrade-lotto", async (req, res) => {
  try {
    const { id } = req.params;

    const [doc, user] = await Promise.all([
      BonustimeUser.findById(id),
      User.findById(req.session.user._id),
    ]);

    if (!doc) {
      return res.status(404).json({ ok: false, message: "ไม่พบข้อมูล Bonustime" });
    }
    if (!user) {
      return res.status(404).json({ ok: false, message: "ไม่พบผู้ใช้" });
    }

    const own = await assertOwnBonustimeDoc(req, doc);
    if (!own.ok) return res.status(own.status || 403).json({ ok:false, message: own.message });

    if (doc.LOTTO_ENABLED) {
      return res.json({ ok: false, message: "แพ็กเกจนี้เปิดใช้งานหวยอยู่แล้ว" });
    }

    const price = UPGRADE_LOTTO_PRICE; // fixed 1000
    const balance = Number(user.balance || 0);

    if (balance < price) {
      return res.json({
        ok: false,
        message: "ยอดเงินคงเหลือไม่เพียงพอสำหรับอัปเกรด",
      });
    }

    // หักเงินใน RTAUTOBOT
    user.balance = balance - price;

    // อัปเดต LOTTO_ENABLED ใน rtautobot.users (BonustimeUser)
    doc.LOTTO_ENABLED = true;

    await Promise.all([user.save(), doc.save()]);

    //-------------------------------------------
    // เพิ่มยอดใช้จ่าย Bonustime (เฉพาะอัปเกรด)
    //-------------------------------------------
    await User.updateOne(
        { _id: user._id },
        { $inc: { btSpent: price } }
    );

    //-------------------------------------------
    // ค่าคอมแนะนำเพื่อน 250 บาทตอนอัปเกรด
    //-------------------------------------------
    let affiliateReward = 0;
    if (user.referredBy) {
        affiliateReward = 250;
        await User.updateOne(
            { _id: user.referredBy },
            {
            $inc: {
                "affiliate.earningsTHB": affiliateReward,
                "affiliate.withdrawableTHB": affiliateReward
            }
            }
        );
    }

    //-------------------------------------------
    // บันทึก BonustimeOrder
    //-------------------------------------------
    await BonustimeOrder.create({
        user: user._id,
        referrer: user.referredBy || null,
        serialKey: user.serial_key,
        legacyTenantId: doc.legacyTenantId || doc.tenantId || null,
        serviceMode: doc.serviceMode || "multiTenant",
        serviceKey: doc.serviceKey || null,
        webhookUrl: doc.webhookUrl || doc.LINK || null,
        type: "upgrade",
        packageType: "lotto",
        days: 0,
        amountTHB: price,
        affiliateRewardTHB: affiliateReward
    });

    // อัปเดตเลเวล คะแนน และยอดใช้จ่ายทันที
    await recalcUserTotals(user._id, { force: true, fullRescan: false });

    return res.json({
      ok: true,
      balance: user.balance,
    });
  } catch (err) {
    // glog.error("POST /bonustime/:id/upgrade-lotto error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "ไม่สามารถอัปเกรดแพ็กเกจได้" });
  }
});

// === ต่ออายุการใช้งาน + หัก balance user ===
router.post("/bonustime/:id/extend", async (req, res) => {
  try {
    const { id } = req.params;
    const { days, includeLotto } = req.body || {};

    const includeLottoBool =
      includeLotto === true ||
      includeLotto === "true" ||
      includeLotto === "1";

    const plan = findPlan(days, includeLottoBool);
    if (!plan) {
      return res
        .status(400)
        .json({ ok: false, message: "แพ็กเกจไม่ถูกต้อง" });
    }

    const [doc, user] = await Promise.all([
      BonustimeUser.findById(id),
      User.findById(req.session.user._id),
    ]);

    if (!doc) {
      return res.status(404).json({ ok: false, message: "ไม่พบข้อมูล Bonustime" });
    }
    if (!user) {
      return res.status(404).json({ ok: false, message: "ไม่พบผู้ใช้" });
    }

    const own = await assertOwnBonustimeDoc(req, doc);
    if (!own.ok) return res.status(own.status || 403).json({ ok:false, message: own.message });

    const price = Number(plan.price) || 0;
    const currentBalance = Number(user.balance || 0);

    if (currentBalance < price) {
      return res
        .status(400)
        .json({ ok: false, message: "ยอดเงินคงเหลือไม่เพียงพอ" });
    }

    // ---- 1) หัก balance ของ user (RTAUTOBOT) ----
    user.balance = currentBalance - price;
    await user.save();

    // ---- 2) ต่ออายุ license ใน rtautobot.users ----
    const now = new Date();

    // ถ้าไม่มีวันเริ่มต้นเลย ให้ตั้งต้นใหม่จากวันนี้
    if (!doc.LICENSE_START_DATE || !doc.LICENSE_DURATION_DAYS) {
      doc.LICENSE_START_DATE = formatThaiDate(now);
      doc.LICENSE_DURATION_DAYS = Number(plan.days);
      doc.LICENSE_DISABLED = false;
    } else {
      const start = parseThaiDate(doc.LICENSE_START_DATE) || now;
      const currentExpire = calcExpiry(doc) || now;

      // ถ้าหมดอายุแล้วให้เริ่มต่อจากวันนี้, ถ้ายังไม่หมดต่อจากวันหมดเดิม
      const base =
        currentExpire.getTime() > now.getTime() ? currentExpire : now;
      const newExpire = new Date(base.getTime() + Number(plan.days) * DAY_MS);

      const newDurationDays = Math.ceil(
        (newExpire.getTime() - start.getTime()) / DAY_MS
      );

      doc.LICENSE_DURATION_DAYS = newDurationDays;
      doc.LICENSE_DISABLED = false;
    }

    await doc.save();

    //-------------------------------------------
    // 1) อัปเดตยอดใช้จ่าย
    //-------------------------------------------
    await User.updateOne(
        { _id: user._id },
        { $inc: { btSpent: price } }
    );

    //-------------------------------------------
    // 2) คอมมิชชั่นแนะนำเพื่อน 200 บาท
    //-------------------------------------------
    let affiliateReward = 0;
    if (user.referredBy) {
        affiliateReward = 200;
        await User.updateOne(
            { _id: user.referredBy },
            {
            $inc: {
                "affiliate.earningsTHB": affiliateReward,
                "affiliate.withdrawableTHB": affiliateReward
            }
            }
        );
    }

    //-------------------------------------------
    // 3) บันทึก BonustimeOrder
    //-------------------------------------------
    await BonustimeOrder.create({
        user: user._id,
        referrer: user.referredBy || null,
        serialKey: user.serial_key,
        legacyTenantId: doc.legacyTenantId || doc.tenantId || null,
        serviceMode: doc.serviceMode || "multiTenant",
        serviceKey: doc.serviceKey || null,
        webhookUrl: doc.webhookUrl || doc.LINK || null,
        type: "renew",
        packageType: includeLottoBool ? "lotto" : "normal",
        days: plan.days,
        amountTHB: price,
        affiliateRewardTHB: affiliateReward
    });

    // อัปเดตเลเวล คะแนน และยอดใช้จ่ายทันที
    await recalcUserTotals(user._id, { force: true, fullRescan: false });

    return res.json({
      ok: true,
      balance: user.balance,
      plan: {
        days: plan.days,
        price: plan.price,
        label: plan.label,
        discount: plan.discount,
      },
    });
  } catch (err) {
    // glog.error("POST /bonustime/:id/extend error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "เกิดข้อผิดพลาดระหว่างต่ออายุ" });
  }
});

// === ส่งเมลแจ้งเตือน service ใกล้หมดอายุ ===
// เงื่อนไข: เหลือ 1–3 วัน และยังไม่เคยส่งเมลเตือน (expiryNotifySent != true)
router.post("/bonustime/check-expiry-mail", async (req, res) => {
  try {
    const result = await checkAndSendBonustimeExpiryMails({
      logPrefix: "[BonustimeExpiryRoute]",
    });
    return res.json({ ok: true, ...result });
  } catch (err) {
    glog.error("POST /bonustime/check-expiry-mail error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "ไม่สามารถเช็กและส่งเมลแจ้งเตือนได้" });
  }
});

// ===== ส่วนเชื่อมต่อ Railway API (ฉบับแก้ไข Path และการค้นหาด้วย Name) =====
const RAILWAY_API_URLS = [
    'https://backboard.railway.app/graphql/v2',
    // Railway เคยมี mirror/alias บางช่วง ใส่ fallback ไว้กัน endpoint หลักมีปัญหา
    'https://backbone.railway.app/graphql/v2',
];

function extractRailwayError(data, fallback = '') {
    const gql = Array.isArray(data?.errors)
        ? data.errors.map((e) => e?.message || JSON.stringify(e)).filter(Boolean).join(' | ')
        : '';
    return gql || data?.message || data?.error || fallback || 'Unknown Railway API error';
}

function shouldRetryWithProjectHeader(message = '') {
    const s = String(message || '').toLowerCase();
    return (
        s.includes('unauthorized') ||
        s.includes('not authorized') ||
        s.includes('invalid token') ||
        s.includes('forbidden') ||
        s.includes('project token') ||
        s.includes('401') ||
        s.includes('403')
    );
}

function railwayAuthHeader(token, mode) {
    // Account/Workspace token ใช้ Authorization: Bearer
    // Project token ใช้ Project-Access-Token
    if (mode === 'project') return { 'Project-Access-Token': token };
    return { Authorization: `Bearer ${token}` };
}

async function railwayQuery(query, variables = {}) {
    const token = String(config?.railway?.apiToken || '').trim();
    if (!token) {
        throw new Error('Railway API token ยังไม่ได้ตั้งค่าใน secure_config.railway.apiToken');
    }

    const preferred = String(config?.railway?.tokenType || '').trim().toLowerCase();
    const authModes = preferred === 'project'
        ? ['project', 'bearer']
        : preferred === 'bearer' || preferred === 'account' || preferred === 'workspace'
          ? ['bearer', 'project']
          : ['bearer', 'project'];

    const errors = [];

    for (const url of RAILWAY_API_URLS) {
        for (const mode of authModes) {
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...railwayAuthHeader(token, mode),
                    },
                    body: JSON.stringify({ query, variables }),
                });

                const text = await response.text();
                let data = null;
                try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }

                const msg = extractRailwayError(data, response.statusText);

                if (response.ok && !data?.errors) {
                    return data;
                }

                errors.push(`${mode}@${url}: HTTP ${response.status} ${msg}`);

                // ถ้าเป็น auth error ให้ลอง header อีกแบบ เพราะ Railway token แต่ละชนิดใช้ header ไม่เหมือนกัน
                if (shouldRetryWithProjectHeader(`${response.status} ${msg}`)) continue;
            } catch (error) {
                errors.push(`${mode}@${url}: ${error?.message || String(error)}`);
            }
        }
    }

    throw new Error(`ไม่สามารถเชื่อมต่อ Railway API ได้: ${errors.slice(-2).join(' || ')}`);
}

async function fetchRailwayServices() {
    const projectId = config?.railway?.projectId;
    if (!projectId) {
        throw new Error('Railway Project ID ยังไม่ได้ตั้งค่าใน secure_config.railway.projectId');
    }

    // Railway GraphQL schema no longer exposes ServiceInstance.variables.
    // Keep this query intentionally conservative so the Server report / Restart / Redeploy
    // buttons do not break when Railway changes optional fields.
    const queries = [
        `
        query GetProjectServices($projectId: String!) {
            project(id: $projectId) {
                services {
                    edges {
                        node {
                            id
                            name
                            serviceInstances {
                                edges { node { environmentId } }
                            }
                            deployments(first: 5) {
                                edges { node { id status } }
                            }
                        }
                    }
                }
            }
        }
        `,
        `
        query GetProjectServices($projectId: String!) {
            project(id: $projectId) {
                services {
                    edges {
                        node {
                            id
                            name
                            serviceInstances {
                                edges { node { environmentId } }
                            }
                        }
                    }
                }
            }
        }
        `,
    ];

    let lastError = null;
    for (const query of queries) {
        try {
            const result = await railwayQuery(query, { projectId });
            const services = result.data?.project?.services?.edges?.map((e) => e.node).filter(Boolean) || [];
            return services;
        } catch (err) {
            lastError = err;
        }
    }
    throw lastError || new Error('ไม่สามารถอ่านรายชื่อ Railway Services ได้');
}

function serviceTenantName(service = {}) {
    return String(service?.name || '').trim();
}

async function assertOwnRailwayService(req, { tenantId, serviceId, environmentId, deploymentId } = {}) {
    const services = await fetchRailwayServices();
    const tenant = String(tenantId || '').trim();
    const sid = String(serviceId || '').trim();
    const eid = String(environmentId || '').trim();
    const did = String(deploymentId || '').trim();
    const sharedName = bonustimeSharedServiceName();

    // In multi-tenant mode all Bonustime tenants run on one Railway service.
    // tenantId from UI is serviceKey (pk1serverX/pk2serverX) or legacy tenantId.
    const service = services.find((node) => {
        const name = serviceTenantName(node);
        const envs = node.serviceInstances?.edges || [];
        const deps = node.deployments?.edges || [];

        if (sid && String(node.id) === sid) {
            if (!eid) return true;
            return envs.some((x) => String(x?.node?.environmentId || '') === eid);
        }
        if (did && deps.some((x) => String(x?.node?.id || '') === did)) return true;
        if (sharedName && name === sharedName) return true;
        if (!sharedName && tenant && name === tenant) return true;
        return false;
    });

    if (!service) return { ok:false, status:404, message:'ไม่พบ Service นี้ใน Railway' };

    const bt = tenant ? await BonustimeUser.findOne(bonustimeTenantLookup(tenant)).lean() : null;

    if (isAdminReq(req)) return { ok:true, service, bonustime: bt };

    const user = await getCurrentUser(req, '_id role serial_key');
    if (!user?.serial_key) return { ok:false, status:403, message:'กรุณาลงทะเบียน Serial Key ก่อนใช้งาน' };

    if (!bt || !sameSerial(bt.serial_key, user.serial_key)) {
        return { ok:false, status:403, message:'คุณไม่มีสิทธิ์จัดการ Railway Service นี้' };
    }
    return { ok:true, service, bonustime: bt };
}

function railwayServicePayload(service) {
    const envId = service.serviceInstances?.edges?.[0]?.node?.environmentId || null;
    const latest = service.deployments?.edges?.[0]?.node || null;
    return {
        ok: true,
        serviceId: service.id,
        environmentId: envId,
        deploymentId: latest?.id || null,
        status: latest?.status || 'UNKNOWN',
    };
}

// ค้นหาด้วยชื่อ Service/Tenant แต่ต้องเป็น Service ของผู้ใช้คนนั้นเท่านั้น
router.get('/railway/service-info/:tenantId', async (req, res) => {
    try {
        const tenantId = String(req.params.tenantId || '').trim();
        if (!tenantId) return res.status(400).json({ ok:false, message:'Missing tenantId' });

        const own = await assertOwnRailwayService(req, { tenantId });
        if (!own.ok) return res.status(own.status || 403).json({ ok:false, message: own.message });

        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Vary', 'Cookie');
        return res.json({ ...railwayServicePayload(own.service), tenantId: publicTenantKey(own.bonustime || { tenantId }) });
    } catch (err) {
        return res.status(500).json({ ok: false, error: err.message });
    }
});

// ดึง Logs เฉพาะ deployment ของ service ที่ผู้ใช้เป็นเจ้าของ
router.get('/railway/logs/deploy/:deploymentId', async (req, res) => {
    try {
        const deploymentId = String(req.params.deploymentId || '').trim();
        if (!deploymentId) return res.status(400).json({ ok:false, message:'Missing deploymentId' });

        const tenantId = String(req.query.tenantId || '').trim();
        const own = await assertOwnRailwayService(req, { deploymentId, tenantId });
        if (!own.ok) return res.status(own.status || 403).json({ ok:false, message: own.message });

        const query = `
            query GetDeploymentLogs($deploymentId: String!) {
                deploymentLogs(deploymentId: $deploymentId, limit: 100) {
                    message
                    timestamp
                }
            }
        `;

        const result = await railwayQuery(query, { deploymentId });
        res.setHeader('Cache-Control', 'no-store');
        const allLogs = result.data?.deploymentLogs || [];
        const key = publicTenantKey(own.bonustime || { tenantId });
        const legacyKey = String(own.bonustime?.legacyTenantId || own.bonustime?.tenantId || tenantId || '').trim();
        const acceptedKeys = [...new Set([key, legacyKey].filter(Boolean))];

        // สำคัญ: หลังรวม Bonustime เป็น Service เดียว ห้าม fallback ไปแสดง log ทั้ง deployment
        // เพราะจะทำให้ผู้ใช้ Server หนึ่งเห็น log ของ Server อื่นได้
        // BonustimeV2 ต้องยิง log พร้อม marker เช่น [tenant:pk1server9]
        const markerRxList = [
            /\[(?:tenant|serviceKey|service|server)\s*:\s*([^\]\s]+)\]/i,
            /(?:tenantId|serviceKey|service|server)\s*[:=]\s*['"]?([a-z0-9_-]+)['"]?/i,
        ];
        const logs = allLogs.filter((l) => {
            const msg = String(l?.message || '');
            for (const rx of markerRxList) {
                const m = msg.match(rx);
                if (m && acceptedKeys.includes(String(m[1] || '').trim())) return true;
            }
            return false;
        });

        return res.json({
            ok: true,
            logs,
            tenantId: key,
            filtered: true,
            hiddenOtherTenantLogs: allLogs.length - logs.length,
            message: logs.length ? '' : 'ยังไม่มี log ของ Server นี้ใน deployment ล่าสุด',
        });
    } catch (err) {
        return res.status(500).json({ ok: false, error: err.message });
    }
});

async function railwayMutationFirstSuccess(candidates = []) {
    const errors = [];
    for (const item of candidates) {
        try {
            const result = await railwayQuery(item.query, item.variables || {});
            return { label: item.label, result };
        } catch (err) {
            errors.push(`${item.label}: ${err?.message || String(err)}`);
        }
    }
    throw new Error(errors.join(' || '));
}

function latestDeploymentIdFromService(service = {}) {
    const edges = service?.deployments?.edges || [];
    return edges[0]?.node?.id || null;
}

// Restart: restart current deployment only. This is NOT a rebuild/redeploy.
// Railway docs separate deployment restart from redeploy. Restart should use deploymentRestart.
router.post('/railway/restart', async (req, res) => {
    try {
        const { serviceId, environmentId, tenantId, deploymentId } = req.body || {};
        if (!serviceId || !environmentId) {
            return res.status(400).json({ ok: false, message: 'ข้อมูลไม่ครบถ้วน (Missing Service ID / Environment ID)' });
        }

        const own = await assertOwnRailwayService(req, { serviceId, environmentId, tenantId, deploymentId });
        if (!own.ok) return res.status(own.status || 403).json({ ok:false, message: own.message });

        const did = String(deploymentId || latestDeploymentIdFromService(own.service) || '').trim();
        if (!did) {
            return res.status(400).json({ ok:false, message:'ไม่พบ Deployment ID สำหรับ Restart' });
        }

        const { label, result } = await railwayMutationFirstSuccess([
            {
                label: 'deploymentRestart(id)',
                query: `
                    mutation RestartDeployment($deploymentId: String!) {
                        deploymentRestart(id: $deploymentId)
                    }
                `,
                variables: { deploymentId: did },
            },
            {
                label: 'deploymentRestart(deploymentId)',
                query: `
                    mutation RestartDeployment($deploymentId: String!) {
                        deploymentRestart(deploymentId: $deploymentId)
                    }
                `,
                variables: { deploymentId: did },
            },
        ]);

        return res.json({
            ok: true,
            action: 'restart',
            mutation: label,
            deploymentId: did,
            data: result.data || result,
        });
    } catch (err) {
        return res.status(500).json({ ok: false, error: err.message });
    }
});

// Redeploy: rebuild/redeploy service. Admin panel uses this endpoint; user /bonustime does not.
router.post('/railway/redeploy', async (req, res) => {
    try {
        if (!isAdminReq(req)) {
            return res.status(403).json({ ok:false, message:'เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถสั่ง ReDeploy ได้' });
        }

        const { serviceId, environmentId, tenantId, deploymentId } = req.body || {};
        if (!serviceId || !environmentId) {
            return res.status(400).json({ ok: false, message: 'ข้อมูล ID ไม่ครบถ้วน' });
        }

        const own = await assertOwnRailwayService(req, { serviceId, environmentId, tenantId, deploymentId });
        if (!own.ok) return res.status(own.status || 403).json({ ok:false, message: own.message });

        const did = String(deploymentId || latestDeploymentIdFromService(own.service) || '').trim();

        const { label, result } = await railwayMutationFirstSuccess([
            {
                label: 'serviceInstanceRedeploy',
                query: `
                    mutation ServiceInstanceRedeploy($serviceId: String!, $environmentId: String!) {
                        serviceInstanceRedeploy(serviceId: $serviceId, environmentId: $environmentId)
                    }
                `,
                variables: { serviceId, environmentId },
            },
            ...(did ? [{
                label: 'deploymentRedeploy(id)',
                query: `
                    mutation RedeployDeployment($deploymentId: String!) {
                        deploymentRedeploy(id: $deploymentId)
                    }
                `,
                variables: { deploymentId: did },
            }, {
                label: 'deploymentRedeploy(deploymentId)',
                query: `
                    mutation RedeployDeployment($deploymentId: String!) {
                        deploymentRedeploy(deploymentId: $deploymentId)
                    }
                `,
                variables: { deploymentId: did },
            }] : []),
        ]);

        return res.json({
            ok: true,
            action: 'redeploy',
            mutation: label,
            deploymentId: did || null,
            data: result.data || result,
        });
    } catch (err) {
        return res.status(500).json({ ok: false, error: err.message });
    }
});

export default router;
