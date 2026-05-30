// routes/account.js
import mongoose from "mongoose";
import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";
import { requireAuth } from "../middleware/auth.js";
import { User } from "../models/User.js";

// OTP ใหม่
import { OtpToken } from "../models/OtpToken.js";
import { sendEmail } from "../lib/mailer.js";
import { config } from "../config.js";

import { Transaction } from "../models/Transaction.js";

/* ==== NEW: loyalty & spend services (ไม่แตะ Order.js) ==== */
import { LEVELS, getRateForLevelIndex } from "../services/loyalty.js";
import { recalcUserTotals } from "../services/spend.js";

import crypto from "crypto";

import { AffWithdraw } from "../models/AffWithdraw.js";
import { computeAffiliateTotals } from "../lib/affiliate.js";

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const BRAND_URL = "https://rtsmm-th.com";
const BRAND_LOGO = `${BRAND_URL}/static/assets/logo/logo-rtssm-th.png`;

const DEFAULT_AVATAR = "/static/logo/icon-logo.png";

/* ---------------- GLOBAL LOG ---------------- */
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

/* ---------------- helpers ---------------- */
function getAuthUserId(req) {
  return (
    req.user?._id || req.session?.user?._id || req.res?.locals?.me?._id || null
  );
}

function normalizeAvatarUrl(url) {
  const clean = String(url || "").trim();
  return clean || DEFAULT_AVATAR;
}

function isLocalAvatar(url) {
  return /^\/uploads\/avatars\/.+/i.test(String(url || ""));
}

function avatarFsPathFromUrl(url) {
  if (!isLocalAvatar(url)) return null;
  const rel = String(url).replace(/^\/+/, "");
  return path.join(process.cwd(), rel);
}

function safeUnlink(filePath) {
  try {
    if (!filePath) return;
    if (!fs.existsSync(filePath)) return;
    fs.unlinkSync(filePath);
  } catch (err) {
    glog.warn("[avatar] unlink failed:", err?.message || err);
  }
}

function isDefaultAvatarUrl(url = "") {
  const s = String(url || "").trim();
  return !s || /(?:^|\/)static\/logo\/icon-logo\.png(?:[?#].*)?$/i.test(s);
}

function stripAssetQuery(url = "") {
  return String(url || "").replace(/[?#].*$/, "");
}

function withAvatarVersion(url, ver) {
  const cleanUrl = normalizeAvatarUrl(stripAssetQuery(url));
  // Default logo is immutable static asset. Never append avatarVer/Date.now() to it.
  if (isDefaultAvatarUrl(cleanUrl)) return cleanUrl;
  const v = Number(ver || 0);
  return v > 0 ? `${cleanUrl}?v=${v}` : cleanUrl;
}

async function syncAvatarToSession(req, res, userDoc) {
  if (req.session?.user) {
    req.session.user.avatarUrl = userDoc.avatarUrl;
    req.session.user.avatarVer = Number(userDoc.avatarVer || 0);
    req.session.user.name = userDoc.name;
    req.session.user.email = userDoc.email;
    req.session.user.emailVerified = !!userDoc.emailVerified;
  }

  if (res?.locals) {
    res.locals.me = {
      ...(res.locals.me || {}),
      avatarUrl: userDoc.avatarUrl,
      avatarVer: Number(userDoc.avatarVer || 0),
      avatarSrc: withAvatarVersion(userDoc.avatarUrl, userDoc.avatarVer),
      name: userDoc.name,
      email: userDoc.email,
      emailVerified: !!userDoc.emailVerified,
    };
  }
}

/* ---------------- helpers Affiliate ---------------- */
const genAffKey = () => [...crypto.randomUUID().replace(/-/g, '')].sort(() => 0.5 - Math.random()).slice(0, 12).join('');

// รหัส 6 หลัก + เทมเพลตอีเมล
const genCode = () => String(Math.floor(100000 + Math.random() * 900000));
export const emailTemplate = (code) => `
<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    html,body{margin:0!important;padding:0!important;background:#f4f6f8!important}
    img{border:0;outline:none;text-decoration:none;display:block;line-height:0}
    table,td{border-collapse:collapse!important}
    .container{width:560px;max-width:100%}

    /* แถบหัวแนวยาว โลโก้ชิดบนล่าง */
    .head{background:#0b0f1a;padding:3px 16px;text-align:center;line-height:0;mso-line-height-rule:exactly}
    .brand-logo{height:128px;width:auto;max-width:100%;margin:0 auto}

    @media(max-width:600px){
      .container{width:100%!important}
      .head{padding:0px 12px!important}
      .brand-logo{height:98px!important}
      .px{padding-left:16px!important;padding-right:16px!important}
    }

    .code{font-size:28px;font-weight:800;letter-spacing:8px;text-align:center;background:#f3f4f6;border-radius:10px;padding:14px 0;color:#111827}
  </style>
</head>
<body>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:16px 0;font-family:system-ui,-apple-system,Segoe UI,Roboto,'Helvetica Neue',Arial;">
    <tr>
      <td align="center">
        <table role="presentation" class="container" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e6e8eb;">
          <tr>
            <td class="head">
              <a href="${BRAND_URL}" target="_blank" style="text-decoration:none">
                <img src="${BRAND_LOGO}" alt="RTSMM-TH" class="brand-logo">
              </a>
            </td>
          </tr>

          <tr>
            <td class="px" style="padding:20px 24px 8px;color:#111827;">
              <h2 style="margin:0 0 4px;font-size:20px">ยืนยันอีเมลของคุณ</h2>
              <p style="margin:0;color:#6b7280">นี่คือรหัส OTP ของคุณ (ใช้ได้ภายใน ${Math.floor(
  (config.otp.ttlSec || 300) / 60
)} นาที)</p>
            </td>
          </tr>

          <tr>
            <td style="padding:10px 24px 24px">
              <div class="code">${code}</div>
            </td>
          </tr>

          <tr>
            <td style="padding:0 24px 20px;color:#6b7280;font-size:12px;">
              หากคุณไม่ได้ร้องขอรหัสนี้ สามารถละเว้นอีเมลได้อย่างปลอดภัย
            </td>
          </tr>

          <tr>
            <td style="background:#f9fafb;color:#9ca3af;padding:12px 20px;text-align:center;font-size:12px;">
              © RTSMM-TH
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

/* ---------------- router ---------------- */
const router = Router();
router.use(requireAuth);

/* ---------------- upload avatar ---------------- */
const uploadDir = path.join(process.cwd(), "uploads", "avatars");
fs.mkdirSync(uploadDir, { recursive: true });

function extFromMime(mime = '') {
  const m = String(mime || '').toLowerCase();
  if (m.includes('jpeg') || m.includes('jpg')) return '.jpg';
  if (m.includes('png')) return '.png';
  if (m.includes('webp')) return '.webp';
  if (m.includes('gif')) return '.gif';
  return '.bin';
}

function detectImageKind(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 && buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a) return 'png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length >= 12 && buf.slice(0,4).toString('ascii') === 'RIFF' && buf.slice(8,12).toString('ascii') === 'WEBP') return 'webp';
  if (buf.length >= 6) {
    const sig = buf.slice(0,6).toString('ascii');
    if (sig === 'GIF87a' || sig === 'GIF89a') return 'gif';
  }
  return null;
}

async function validateUploadedAvatar(req, _res, next) {
  try {
    if (!req.file?.path) return next();
    const kind = detectImageKind(req.file.path);
    if (!kind) {
      safeUnlink(req.file.path);
      return next(new Error('Invalid image content'));
    }

    const safeExt = kind === 'jpg' ? '.jpg' : `.${kind}`;
    if (!req.file.filename.toLowerCase().endsWith(safeExt)) {
      const nextName = req.file.filename.replace(/\.[^.]+$/, '') + safeExt;
      const nextPath = path.join(uploadDir, nextName);
      fs.renameSync(req.file.path, nextPath);
      req.file.filename = nextName;
      req.file.path = nextPath;
    }
    return next();
  } catch (err) {
    if (req.file?.path) safeUnlink(req.file.path);
    return next(err);
  }
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = extFromMime(file.mimetype);
    const uid = String(getAuthUserId(req) || `anon-${Date.now()}`);
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    cb(null, `${uid}-${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /image\/(png|jpe?g|webp|gif)/i.test(file.mimetype);
    cb(ok ? null : new Error("Invalid image type"), ok);
  },
});

function uploadAvatarMiddleware(req, res, next) {
  upload.single("avatar")(req, res, (err) => {
    if (!err) return validateUploadedAvatar(req, res, next);

    if (req.file?.path) safeUnlink(req.file.path);

    const message =
      err?.code === "LIMIT_FILE_SIZE"
        ? "ไฟล์ใหญ่เกินไป (สูงสุด 10MB)"
        : err?.message === "Invalid image type" || err?.message === "Invalid image content"
          ? "รองรับเฉพาะไฟล์รูปภาพจริง PNG, JPG, JPEG, WEBP, GIF"
          : "อัปโหลดรูปไม่สำเร็จ";

    if (
      String(req.headers["x-requested-with"] || "").toLowerCase() === "xmlhttprequest" ||
      String(req.headers.accept || "").includes("application/json")
    ) {
      return res.status(400).json({ ok: false, error: message });
    }

    return res.status(400).send(message);
  });
}

/* ---------------- GET /account ---------------- */
router.get("/account", async (req, res, next) => {
  try {
    const uid = getAuthUserId(req);
    if (!uid) return res.redirect("/login");

    let me = await User.findById(uid).lean();
    if (!me) return res.redirect("/login");

    const [snap, affTotals] = await Promise.all([
      recalcUserTotals(me._id, { force: true }),
      computeAffiliateTotals(me._id).catch((e) => {
        glog.error("Affiliate calc failed:", e);
        return null;
      }),
    ]);

    const {
      totalSpent,
      totalSpentRaw,
      redeemedSpent,
      level,
      levelInfo,
      points,
      pointRateTHB,
      pointValueTHB,
    } = snap || {};

    const levelNum = Math.max(1, Number(level || me.level || 1));
    const levelName =
      levelInfo?.name || LEVELS[levelNum - 1]?.name || `เลเวล ${levelNum}`;

    const viewUser = {
      ...me,
      level: String(levelNum),
      levelName,
      totalSpent:
        typeof totalSpent === "number"
          ? Number(totalSpent)
          : round2(Number(me.totalSpent || 0)),
      points: Number(points ?? me.points ?? 0),
      pointRateTHB: Number(pointRateTHB ?? me.pointRateTHB ?? 0),
      pointValueTHB: Number(pointValueTHB ?? me.pointValueTHB ?? 0),

      avatarUrl: normalizeAvatarUrl(me.avatarUrl),
      avatarVer: Number(me.avatarVer || 0),
      avatarSrc: withAvatarVersion(me.avatarUrl, me.avatarVer),
      emailVerified: !!me.emailVerified,
    };

    const affRatePct =
      affTotals?.ratePct ??
      me?.affiliate?.rateLockedPct ??
      me?.affiliate?.ratePct ??
      5;

    res.render("account/index", {
      title: "ตั้งค่าข้อมูลส่วนตัว",
      userDoc: viewUser,
      agg: {
        totalSpent: viewUser.totalSpent,
        totalSpentRaw:
          typeof totalSpentRaw === "number"
            ? Number(totalSpentRaw)
            : round2(Number(me.totalSpentRaw || 0)),
        redeemedSpent: Number(redeemedSpent ?? me.redeemedSpent ?? 0),
        points: viewUser.points,
        pointRateTHB: viewUser.pointRateTHB,
        pointValueTHB: viewUser.pointValueTHB,
        pointsRedeemed: Number(me.pointsRedeemed || 0),
      },
      affiliateSummary: {
        ratePct: affTotals?.ratePct ?? affRatePct ?? 5,
        referredCount: affTotals?.referredCount ?? 0,
        orders: affTotals?.orders ?? 0,
        spentTHB: affTotals?.spentTHB ?? 0,
        earningsTHB: affTotals?.earningsTHB ?? 0,
        paidTHB: affTotals?.paidTHB ?? 0,
        withdrawableTHB: affTotals?.withdrawableTHB ?? 0,
      },
      affRatePct,
      levels: LEVELS,
      bodyClass: "page-account",
    });
  } catch (e) {
    next(e);
  }
});

/* ---------------- shared avatar/profile save ---------------- */
async function handleProfileSave(req, res, { redirectOnSuccess = false } = {}) {
  const uid = getAuthUserId(req);
  if (!uid) {
    if (redirectOnSuccess) return res.status(401).send("Unauthorized");
    return res.status(401).json({ ok: false, error: "⛔️คุณไม่ได้รับอนุญาต" });
  }

  const u = await User.findById(uid);
  if (!u) {
    if (req.file?.path) safeUnlink(req.file.path);
    if (redirectOnSuccess) return res.status(404).send("User not found");
    return res.status(404).json({
      ok: false,
      error: "⛔️ไม่พบข้อมูลผู้ใช้ เครือข่ายมีปัญหาโปรดลองอีกครั้งภายหลัง",
    });
  }

  const oldAvatarUrl = normalizeAvatarUrl(u.avatarUrl);

  const fullName = String(req.body?.name || "").trim();
  const emailInput = String(req.body?.email || "").trim().toLowerCase();

  let changed = false;

  if (!u.name && fullName) {
    u.name = fullName;
    changed = true;
  }

  if (!u.email && emailInput) {
    u.email = emailInput;
    u.emailVerified = false;
    changed = true;
  }

  if (req.file) {
    const nextAvatarUrl = `/uploads/avatars/${req.file.filename}`;

    u.avatarUrl = nextAvatarUrl;
    u.avatarVer = Number(u.avatarVer || 0) + 1;
    changed = true;
  } else if (!u.avatarUrl) {
    u.avatarUrl = DEFAULT_AVATAR;
    u.avatarVer = Number(u.avatarVer || 0) + 1;
    changed = true;
  }

  if (changed) {
    await u.save();
  }

  try {
    await recalcUserTotals(u._id, { force: true, reason: "profile_update" });
  } catch { }

  await syncAvatarToSession(req, res, u);

  if (req.file && isLocalAvatar(oldAvatarUrl) && oldAvatarUrl !== u.avatarUrl) {
    safeUnlink(avatarFsPathFromUrl(oldAvatarUrl));
  }

  const payload = {
    ok: true,
    user: {
      name: u.name,
      avatarUrl: withAvatarVersion(u.avatarUrl, u.avatarVer),
      avatarRaw: normalizeAvatarUrl(u.avatarUrl),
      avatarVer: Number(u.avatarVer || 0),
      email: u.email,
      emailVerified: !!u.emailVerified,
      level: u.level,
      totalSpent: u.totalSpent,
      totalOrders: u.totalOrders ?? 0,
    },
  };

  if (redirectOnSuccess) {
    return res.redirect("/account");
  }

  return res.json(payload);
}

/* ---------------- POST /account/profile ---------------- */
router.post("/account/profile", uploadAvatarMiddleware, async (req, res) => {
  try {
    return await handleProfileSave(req, res, { redirectOnSuccess: false });
  } catch (e) {
    glog.error("POST /account/profile", e);
    if (req.file?.path) safeUnlink(req.file.path);
    return res.status(500).json({ ok: false, error: "update failed" });
  }
});

/* ---------------- POST /account/avatar ---------------- */
router.post("/account/avatar", uploadAvatarMiddleware, async (req, res) => {
  try {
    if (!req.file) return res.redirect("/account");
    return await handleProfileSave(req, res, { redirectOnSuccess: true });
  } catch (e) {
    glog.error("POST /account/avatar", e);
    if (req.file?.path) safeUnlink(req.file.path);
    return res.status(500).send("Upload failed");
  }
});

/* ---------------- POST /account/password ---------------- */
router.post("/account/password", async (req, res) => {
  try {
    const uid = getAuthUserId(req);
    if (!uid)
      return res
        .status(401)
        .json({ ok: false, error: "⛔️คุณไม่ได้รับอนุญาต" });

    const { currentPassword, newPassword } = req.body;

    const u = await User.findById(uid);
    if (!u)
      return res.status(404).json({
        ok: false,
        error: "⛔️ไม่พบข้อมูลผู้ใช้ เครือข่ายมีปัญหาโปรลองอีกครั้งภายหลัง",
      });

    if (!newPassword || String(newPassword).length < 8) {
      return res.status(400).json({
        ok: false,
        error: "⚠️รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัว a-z 0-9 !@#$",
      });
    }

    const ok = await bcrypt.compare(
      String(currentPassword || ""),
      u.passwordHash
    );
    if (!ok)
      return res
        .status(400)
        .json({ ok: false, error: "⛔️รหัสผ่านเดิมไม่ถูกต้อง" });

    const same = await bcrypt.compare(String(newPassword), u.passwordHash);
    if (same)
      return res.status(400).json({
        ok: false,
        error: "⚠️รหัสผ่านใหม่ซ้ำกับรหัสเดิม โปรดระบุรหัสผ่านใหม่อีกครั้ง",
      });

    await u.setPassword(String(newPassword || ""));
    await u.save();

    return res.status(200).json({ ok: true });
  } catch (e) {
    glog.error("POST /account/password", e);
    res.status(500).json({
      ok: false,
      error:
        "⛔️เปลี่ยนรหัสผ่านไม่สำเร็จ เครือข่ายมีปัญหาโปรดลองอีกครั้งภายหลัง!",
    });
  }
});

/* ---------------- POST /account/email/request-otp ---------------- */
router.post("/account/email/request-otp", async (req, res) => {
  try {
    const uid = getAuthUserId(req);
    if (!uid)
      return res
        .status(401)
        .json({ ok: false, error: "⛔️คุณไม่ได้รับอนุญาต" });

    const u = await User.findById(uid);
    if (!u?.email)
      return res
        .status(400)
        .json({ ok: false, error: "⛔️ยังไม่มีอีเมลนี้ในบัญชี" });

    const email = String(u.email).toLowerCase();

    // cooldown
    const last = await OtpToken.findOne({
      email,
      purpose: "email-verify",
      usedAt: null,
    }).sort({ createdAt: -1 });
    const now = Date.now();
    if (
      last?.lastSentAt &&
      now - last.lastSentAt.getTime() < config.otp.resendCooldownSec * 1000
    ) {
      const wait = Math.ceil(
        (config.otp.resendCooldownSec * 1000 -
          (now - last.lastSentAt.getTime())) /
        1000
      );
      return res
        .status(429)
        .json({ ok: false, error: `⏳โปรดรอ ${wait}s ก่อนขอรหัสใหม่` });
    }

    const code = genCode();
    const codeHash = await bcrypt.hash(code, 10);

    const doc = new OtpToken({
      email,
      purpose: "email-verify",
      codeHash,
      expiresAt: new Date(Date.now() + config.otp.ttlSec * 1000),
      attempts: 0,
      maxAttempts: config.otp.maxAttempts,
      lastSentAt: new Date(),
    });
    await doc.save();

    await sendEmail({
      to: email,
      subject: "รหัสยืนยันอีเมล (OTP)",
      html: emailTemplate(code),
      // attachments: [{ filename:'logo-smm-th.png', path:'/static/assets/logo/logo-rtsmm-th.png', cid:'brandlogo' }]
    });

    res.json({ ok: true, ttl: config.otp.ttlSec });
  } catch (e) {
    glog.error("request-otp", e);
    res.status(500).json({ ok: false, error: "⛔️ส่งรหัสไม่สำเร็จ" });
  }
});

/* ---------------- POST /account/email/verify ---------------- */
router.post("/account/email/verify", async (req, res) => {
  try {
    const uid = getAuthUserId(req);
    if (!uid)
      return res
        .status(401)
        .json({ ok: false, error: "⛔️คุณไม่ได้รับอนุญาต" });

    const { code } = req.body;
    const u = await User.findById(uid);
    if (!u?.email)
      return res
        .status(400)
        .json({ ok: false, error: "⛔️ยังไม่มีอีเมลในบัญชี" });

    const email = String(u.email).toLowerCase();
    const doc = await OtpToken.findOne({
      email,
      purpose: "email-verify",
      usedAt: null,
    }).sort({ createdAt: -1 });
    if (!doc)
      return res
        .status(400)
        .json({ ok: false, error: "⛔️รหัสหมดอายุหรือไม่ถูกต้อง" });

    if (doc.expiresAt.getTime() < Date.now()) {
      return res.status(400).json({ ok: false, error: "⛔️รหัสหมดอายุ" });
    }
    if (doc.attempts >= doc.maxAttempts) {
      return res
        .status(400)
        .json({ ok: false, error: "⛔️เกินจำนวนครั้งที่กำหนด" });
    }

    const ok = await bcrypt.compare(String(code || "").trim(), doc.codeHash);
    if (!ok) {
      doc.attempts += 1;
      await doc.save();
      return res.status(400).json({ ok: false, error: "⛔️รหัสไม่ถูกต้อง" });
    }

    // สำเร็จ → ปิด token และอัปเดต user
    doc.usedAt = new Date();
    await doc.save();

    u.emailVerified = true;
    await u.save();

    res.json({ ok: true });
  } catch (e) {
    glog.error("verify-otp", e);
    res.status(500).json({ ok: false, error: "⛔️ยืนยันไม่สำเร็จ" });
  }
});

// ====== NEW: แลกแต้มเป็น balance ======
router.post("/account/points/redeem", async (req, res) => {
  try {
    const uid = getAuthUserId(req);
    if (!uid) return res.status(401).json({ ok: false, error: "⛔️คุณไม่ได้รับอนุญาต" });

    // คำนวณปัจจุบัน
    const snap = await recalcUserTotals(uid, { force: true, fullRescan: false });
    if (!snap?.ok) return res.status(500).json({ ok: false, error: "คำนวณยอดไม่สำเร็จ" });

    const u = await User.findById(uid);
    if (!u) return res.status(404).json({ ok: false, error: "⛔️ไม่พบผู้ใช้" });

    const pointsNow = Number(snap.points ?? u.points ?? 0);
    if (!Number.isFinite(pointsNow) || pointsNow < 100) {
      return res.status(400).json({ ok: false, error: "ต้องมีอย่างน้อย 100 แต้มจึงจะแลกได้" });
    }

    // แลกทั้งจำนวน (step 0.5)
    const redeemPoints = Math.floor(pointsNow * 2) / 2;

    // เรท ณ ตอนแลก
    const levelIdx = Number(snap?.levelInfo?.index ?? u.levelIndex ?? 0);
    const rate = Number(snap?.pointRateTHB) || getRateForLevelIndex(levelIdx);
    const addTHB = round2(redeemPoints * rate);

    // ✅ อัปเดต: เติมกระเป๋า + สะสม pointsRedeemed/redeemedSpent เท่านั้น
    // ห้าม reset totalSpentRaw/totalSpent เพราะ totalSpentRaw คือ ledger ยอดใช้บริการสะสมจริง
    // ถ้า reset จะทำให้ Dashboard / Account ยอดติดลบหรือหายได้
    await User.updateOne(
      { _id: uid },
      {
        $inc: {
          balance: addTHB,
          pointsRedeemed: redeemPoints,
          redeemedSpent: addTHB
        }
      }
    );

    // ✅ คำนวณใหม่หลังแลก โดยยอดใช้จ่ายจะไม่ติดลบ และ ledger ไม่ถูกล้าง
    const after = await recalcUserTotals(uid, { force: true });
    const freshU = await User.findById(uid).select('balance pointsRedeemed').lean();

    return res.json({
      ok: true,
      redeemed: redeemPoints,
      addedBalance: addTHB,
      rate,
      remainPoints: after.points ?? 0,
      balance: Number(freshU?.balance ?? 0),
      totalSpent: after.totalSpent,
      level: after.level,
      levelInfo: after.levelInfo,
      pointRateTHB: after.pointRateTHB,
      pointValueTHB: after.pointValueTHB,
      pointsRedeemed: Number(freshU?.pointsRedeemed || 0),
    });
  } catch (e) {
    glog.error("redeem points", e);
    res.status(500).json({ ok: false, error: "แลกแต้มไม่สำเร็จ" });
  }
});

// routes/affiliate.js
router.post('/account/affiliate/create-link', async (req, res) => {
  try {
    const uid = getAuthUserId(req);
    if (!uid) return res.status(401).json({ ok: false });

    const u = await User.findById(uid);
    if (!u) return res.status(404).json({ ok: false });

    if (!u.affiliateKey) {
      // 1) สร้างคีย์
      let key;
      for (let i = 0; i < 5; i++) {
        key = genAffKey();
        const exist = await User.exists({ affiliateKey: key });
        if (!exist) break;
        key = null;
      }
      if (!key) return res.status(500).json({ ok: false, error: 'สร้างคีย์ไม่สำเร็จ' });

      // 2) ล็อกเรต ณ ตอนนี้ (ถ้ายังไม่เคยล็อก)
      const now = new Date();
      const currentPct = (u.affiliate?.ratePct ?? 5);
      u.affiliateKey = key;

      if (!u.affiliate) u.affiliate = {};
      if (!u.affiliate.linkCreatedAt) u.affiliate.linkCreatedAt = now;
      if (typeof u.affiliate.rateLockedPct !== 'number')
        u.affiliate.rateLockedPct = currentPct;

      await u.save();
    }

    const link = `https://rtsmm-th.com/aff?=${u.affiliateKey}`;
    return res.json({
      ok: true,
      key: u.affiliateKey,
      link,
      rate: (u.affiliate?.rateLockedPct ?? u.affiliate?.ratePct ?? 5)
    });
  } catch (e) {
    return res.status(500).json({ ok: false });
  }
});

// สรุปสถิติ + รายชื่อ
router.get('/account/affiliate/stats', async (req, res) => {
  try {
    const uid = getAuthUserId(req);
    if (!uid) return res.status(401).json({ ok: false });

    // รวมยอดจากออเดอร์ (SMM + OTP) ตาม logic เดิม
    const totals = await computeAffiliateTotals(uid);

    // ✅ ดึงข้อมูลเพื่อนที่เราชวนมา จาก users
    const friends = await User.find({ referredBy: uid })
      .select('btSpent totalOrders')
      .lean();

    // ✅ ยอดใช้จ่าย Bonustime ของเพื่อนทั้งหมด (btSpent)
    const btSpentFriends = friends.reduce(
      (sum, u) => sum + (Number(u.btSpent) || 0),
      0
    );

    // ✅ จำนวนออเดอร์ทั้งหมดของเพื่อน (ใช้ totalOrders จาก user โดยตรง)
    const ordersFriends = friends.reduce(
      (sum, u) => sum + (Number(u.totalOrders) || 0),
      0
    );

    // ✅ ใช้ totals.spentTHB (SMM+OTP) + btSpent ของเพื่อน เฉพาะตอนแสดงผล
    const displaySpentTHB = Number(
      ((totals.spentTHB || 0) + btSpentFriends).toFixed(2)
    );

    res.json({
      ok: true,
      summary: {
        ratePct: totals.ratePct,
        referredCount: totals.referredCount,
        // ⬇️ ใช้ ordersFriends แทน totals.orders เพื่อให้ตรงกับหน้าเพื่อน
        orders: ordersFriends,
        spentTHB: displaySpentTHB,
        earningsTHB: totals.earningsTHB,
        paidTHB: totals.paidTHB,
        withdrawableTHB: totals.withdrawableTHB,
      },
      tier: totals.tier,
    });
  } catch (e) {
    glog.error('GET /account/affiliate/stats error:', e);
    res.status(500).json({ ok: false });
  }
});

/**
 * POST /account/affiliate/withdraw
 * body: { type: 'balance' | 'cash' }
 * - คำนวณจาก computeAffiliateTotals(uid) แบบสด
 * - กันถอนซ้ำด้วยการอัปเดต paidTHB และรีเซ็ต earnings ให้เป็น 0
 * - บันทึก AffWithdraw และ Transaction
 * - ถ้า type=balance เติมเข้ากระเป๋า
 */
router.post('/account/affiliate/withdraw', requireAuth, async (req, res) => {
  const uid = req.user?._id;
  if (!uid) return res.status(401).json({ ok: false });

  const kind = (req.body?.type === 'cash') ? 'cash' : 'balance';

  let session;
  try {
    // 1) คำนวณยอดถอนได้แบบสด
    const totals = await computeAffiliateTotals(uid);
    const amount = +Number(totals?.withdrawableTHB || 0).toFixed(2);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ ok: false, error: 'ยังไม่มียอดที่ถอนได้' });
    }

    // 2) ทำเป็นธุรกรรม
    session = await mongoose.startSession();
    session.startTransaction();

    // โหลดผู้ใช้ใน session นี้
    const u = await User.findById(uid).session(session);
    if (!u) {
      await session.abortTransaction(); session.endSession();
      return res.status(404).json({ ok: false });
    }

    // เตรียมโครงสร้าง affiliate ถ้ายังไม่มี
    if (!u.affiliate) u.affiliate = {};

    // 3) อัปเดตกระเป๋า (ถ้าเลือก balance)
    if (kind === 'balance') {
      u.balance = +((u.balance || 0) + amount).toFixed(2);
    }

    // 4) กันถอนซ้ำ: ทำให้จ่ายแล้ว
    // - เพิ่ม paidTHB
    // - รีเซ็ต earningsTHB → 0 ตามสเปกใหม่ของคุณ
    u.affiliate.paidTHB = +((u.affiliate.paidTHB || 0) + amount).toFixed(2);
    u.affiliate.lastCalcAt = new Date();
    await u.save({ session });

    // 5) บันทึก AffWithdraw
    const aw = await AffWithdraw.create([{
      userId: u._id,
      username: u.username,
      amount,
      kind,              // 'balance' | 'cash'
      status: 'success', // ถ้าคุณมีเงื่อนไขล้มเหลวก็เปลี่ยนได้
    }], { session });

    // 6) บันทึก Transaction (ออปชัน)
    try {
      await Transaction.create([{
        userId: u._id,
        type: 'affiliate_withdraw',
        amount,
        currency: 'THB',
        direction: 'in', // เครดิตเข้า (แม้ cash จะไม่เข้า balance แต่เป็น inflow ทางบัญชีแนะนำ)
        note: 'Affiliate earnings withdraw',
        meta: {
          ratePct: totals?.ratePct,
          referredCount: totals?.referredCount,
          kind,                    // เก็บชนิดไว้ด้วย
          affWithdrawId: aw?.[0]?._id,
        },
      }], { session });
    } catch {
      // เงียบได้ ไม่ critical
    }

    await session.commitTransaction();
    session.endSession();

    return res.json({
      ok: true,
      addedBalance: kind === 'balance' ? amount : 0,
      newBalance: kind === 'balance' ? u.balance : undefined,
    });
  } catch (e) {
    try {
      if (session) {
        await session.abortTransaction();
        session.endSession();
      }
    } catch { }

    // พยายามบันทึก fail record (นอกธุรกรรม)
    try {
      const u = req.user;
      if (u) {
        const totals = await computeAffiliateTotals(u._id).catch(() => ({}));
        const amount = +Number(totals?.withdrawableTHB || 0).toFixed(2);
        if (amount > 0) {
          await AffWithdraw.create({
            userId: u._id,
            username: u.username,
            amount,
            kind,
            status: 'fail',
          });
        }
      }
    } catch { }

    return res.status(500).json({ ok: false, error: 'ถอนเงินไม่สำเร็จ' });
  }
});

/**
 * GET /account/affiliate/withdraws?page=&perPage=
 * - สำหรับหน้า UI “รายการการถอนรายได้แนะนำเพื่อน”
 */
router.get('/account/affiliate/withdraws', requireAuth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(req.query.perPage, 10) || 10));
    const q = { userId: req.user._id };

    const total = await AffWithdraw.countDocuments(q);
    const items = await AffWithdraw.find(q).sort({ createdAt: -1 })
      .skip((page - 1) * perPage).limit(perPage).lean();

    return res.json({ ok: true, total, perPage, items });
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'FETCH_WITHDRAWS_FAILED' });
  }
});

export default router;
