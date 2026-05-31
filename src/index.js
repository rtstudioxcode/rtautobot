// src/index.js ตัวรันหลัก
import mongoose from "mongoose";
import express from "express";
import path from "path";
import fs from 'fs';
import { fileURLToPath } from "url";
import session from "express-session";
import MongoStore from "connect-mongo";
import { connectMongo } from "./db/mongo.js";
import { User } from "./models/User.js";
import { config, refreshConfigFromDB, startSecureConfigAutoReload } from "./config.js";
import expressLayouts from "express-ejs-layouts";
import authRoutes from "./routes/auth.js";
import adminBonustimeRoutes from "./routes/admin-bonustime.js";
import walletRoutes from "./routes/wallet.js";
import accountRouter from "./routes/account.js";
import resetPasswordRoutes from "./routes/reset-password.js";
import dashboardRouter from "./routes/dashboard.js";
import {
  attachUser,
  requireAuth,
  requireAdmin,
  requireGuest,
} from "./middleware/auth.js";
import compression from "compression";
import { topupRouter, topupPublicRouter } from "./routes/topup.js";
import cookieParser from 'cookie-parser';
import bonustimeRouter from "./routes/bonustime.js";

import { startQueueWorker } from './queue/queueWorker.js';
import { startJobScheduler } from './queue/jobQueue.js';

import sitemapRouter from "./routes/sitemap.js";
import robotsRoute from "./routes/robots.js";
import supportRouter from "./routes/support.js";

import { securityHardening } from "./middleware/securityHardening.js";
import { Settings } from './models/Settings.js';
import { sourceProtectionHeaders, blockSourceMapRequests, htmlSourceHardener, protectStaticJs, protectStaticCss, makeEvalLoader } from "./middleware/sourceProtection.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


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
    console.error(...args);
  },
};

/* ------------------------------------------------------------------ */
/* 1) เชื่อม Mongo จาก .env/config.js (จำเป็นต้องมีเพื่อเริ่มระบบครั้งแรก) */
/* ------------------------------------------------------------------ */
await connectMongo();

await refreshConfigFromDB();

process.env.TZ = String(config?.system?.tz || "Asia/Bangkok");

glog.log("🔐 secure_config loaded from DB");

startSecureConfigAutoReload({
  onReload: () => {
    glog.info("🔄 secure_config auto reloaded from DB");
  },
});

function getRuntimePort() {
  const n = Number(config?.port ?? 3000);
  return Number.isFinite(n) && n > 0 ? n : 3000;
}

function getSessionSecret() {
  const secret = String(config?.sessionSecret || "").trim();

  if (!secret || secret === "change-me") {
    throw new Error("SESSION secret is not configured in secure_config.sessionSecret");
  }

  return secret;
}

function getCookieSecret() {
  return String(
    config?.cookieSecret ||
    config?.sessionSecret ||
    "dev-secret"
  );
}

function getSessionCookieName() {
  return String(config?.session?.name || config?.session?.cookieName || config?.sessionCookieName || "rtsmm.sid").trim() || "rtsmm.sid";
}

function isDefaultAvatarUrl(url = "") {
  const s = String(url || "").trim();
  return !s || /(?:^|\/)static\/logo\/icon-logo\.png(?:[?#].*)?$/i.test(s);
}

function stripAssetQuery(url = "") {
  return String(url || "").replace(/[?#].*$/, "");
}

function buildAvatarSrc(url, ver) {
  const clean = stripAssetQuery(url || "/static/logo/icon-logo.png") || "/static/logo/icon-logo.png";

  // Default logo is a static immutable asset. Do NOT append Date.now()/avatarVer to it,
  // otherwise Cloudflare/browser see a new URL on every render and cache cannot HIT.
  if (isDefaultAvatarUrl(clean)) return clean;

  const v = Number(ver || 0);
  return v > 0 ? `${clean}?v=${v}` : clean;
}

/* ------------------------------------------------------------------ */
/* 4) Express App                                                      */
/* ------------------------------------------------------------------ */
const app = express();

// Helper for cache-safe avatar/logo URLs in all EJS views.
app.locals.buildAvatarSrc = buildAvatarSrc;

// ลด header fingerprint ของ Express
app.disable("x-powered-by");

// Railway / Cloudflare / Proxy
// ตั้งครั้งเดียวพอ ไม่ต้องตั้งซ้ำด้านล่าง
app.set("trust proxy", true);

// ===== Network traffic debug summary =====
// เปิดด้วย ENV: NET_DEBUG=1
const NET_DEBUG_ENABLED = process.env.NET_DEBUG === "1";

if (NET_DEBUG_ENABLED) {
  const netStats = new Map();

  function normalizeNetPath(req) {
    let p = req.path || req.originalUrl || req.url || "/";
    p = String(p).split("?")[0];

    p = p
      .replace(/\/[a-f0-9]{24}(?=\/|$)/gi, "/:id")
      .replace(/\/\d{4,}(?=\/|$)/g, "/:num");

    return `${req.method} ${p}`;
  }

  function addNetStat(key, statusCode, inBytes, outBytes, ms) {
    const row = netStats.get(key) || {
      count: 0,
      inBytes: 0,
      outBytes: 0,
      maxMs: 0,
      statuses: {},
    };

    row.count += 1;
    row.inBytes += Math.max(0, inBytes || 0);
    row.outBytes += Math.max(0, outBytes || 0);
    row.maxMs = Math.max(row.maxMs, ms || 0);
    row.statuses[statusCode] = (row.statuses[statusCode] || 0) + 1;

    netStats.set(key, row);
  }

  app.use((req, res, next) => {
    const started = Date.now();
    const key = normalizeNetPath(req);

    let inBytes = 0;
    let outBytes = 0;

    const contentLength = Number(req.headers["content-length"] || 0);
    if (Number.isFinite(contentLength) && contentLength > 0) {
      inBytes += contentLength;
    }

    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);

    res.write = function patchedWrite(chunk, encoding, cb) {
      if (chunk) {
        outBytes += Buffer.isBuffer(chunk)
          ? chunk.length
          : Buffer.byteLength(String(chunk), encoding);
      }
      return originalWrite(chunk, encoding, cb);
    };

    res.end = function patchedEnd(chunk, encoding, cb) {
      if (chunk) {
        outBytes += Buffer.isBuffer(chunk)
          ? chunk.length
          : Buffer.byteLength(String(chunk), encoding);
      }
      return originalEnd(chunk, encoding, cb);
    };

    res.on("finish", () => {
      const ms = Date.now() - started;
      addNetStat(key, res.statusCode, inBytes, outBytes, ms);
    });

    next();
  });

  setInterval(() => {
    const rows = [...netStats.entries()]
      .map(([key, v]) => ({
        key,
        count: v.count,
        inMB: Number((v.inBytes / 1024 / 1024).toFixed(3)),
        outMB: Number((v.outBytes / 1024 / 1024).toFixed(3)),
        totalMB: Number(((v.inBytes + v.outBytes) / 1024 / 1024).toFixed(3)),
        avgOutKB: Number(((v.outBytes / Math.max(1, v.count)) / 1024).toFixed(1)),
        maxMs: v.maxMs,
        statuses: v.statuses,
      }))
      .sort((a, b) => b.totalMB - a.totalMB)
      .slice(0, 25);

    if (rows.length) {
      // one-line JSON กัน Railway log สลับบรรทัดมั่ว
      console.log("[NET_DEBUG_TOP_25] " + JSON.stringify(rows));
    }

    netStats.clear();
  }, 60_000).unref();

  console.log("[NET_DEBUG] enabled precise response-byte mode");
}


// ===== Public asset cache policy =====
// Origin-side cache headers for every file served from src/public, plus uploads and Apps image/icon routes.
// This is a second protection layer after Cloudflare Cache Rules: if a request reaches Railway,
// browsers/CDN still get cacheable headers and will not re-download public assets on every refresh.
const PUBLIC_ASSET_CACHE_SECONDS = 30 * 24 * 60 * 60; // 30 days
const PUBLIC_ASSET_STALE_SECONDS = 7 * 24 * 60 * 60; // 7 days
const PUBLIC_ASSET_EXT_RE = /\.(?:css|m?js|cjs|json|webmanifest|txt|xml|png|jpe?g|webp|gif|svg|ico|avif|bmp|tiff?|woff2?|ttf|otf|eot|pdf|mp4|webm|mov|mp3|wav)(?:$|[?#])/i;
const PUBLIC_ASSET_PATH_RE = /^(?:\/static\/|\/assets\/|\/logo\/|\/og\/|\/fonts\/|\/cache\/|\/uploads\/)/i;

function isPublicAssetRequestPath(rawPath = "") {
  const pathname = String(rawPath || "").split("?")[0];
  if (!pathname) return false;
  return PUBLIC_ASSET_PATH_RE.test(pathname) || PUBLIC_ASSET_EXT_RE.test(pathname);
}

function setPublicAssetCacheHeaders(res, { seconds = PUBLIC_ASSET_CACHE_SECONDS, immutable = true } = {}) {
  const ttl = Math.max(60, Number(seconds) || PUBLIC_ASSET_CACHE_SECONDS);
  const stale = Math.max(60, PUBLIC_ASSET_STALE_SECONDS);
  const immutablePart = immutable ? ", immutable" : "";
  res.setHeader(
    "Cache-Control",
    `public, max-age=${ttl}, s-maxage=${ttl}, stale-while-revalidate=${stale}${immutablePart}`
  );
  res.removeHeader("Pragma");
  res.removeHeader("Expires");
  res.setHeader("X-Content-Type-Options", "nosniff");
}

function setStaticAssetHeaders(res, _filePath) {
  // ทุกไฟล์ที่ถูกเสิร์ฟจาก src/public หรือ /uploads ให้ cache ได้ทั้งหมด
  // Cloudflare/WAF ยังบล็อก source-map แยกต่างหากด้วย blockSourceMapRequests อยู่แล้ว
  setPublicAssetCacheHeaders(res);
}

const isClientSourceProtectionEnabled = () =>
  config?.security?.clientSourceProtectionEnabled !== false;

const isInlineScriptObfuscationEnabled = () =>
  isClientSourceProtectionEnabled() &&
  config?.security?.inlineScriptObfuscationEnabled !== false;

const isPublicJsObfuscationEnabled = () =>
  isClientSourceProtectionEnabled() &&
  config?.security?.publicJsObfuscationEnabled !== false;

const isServiceWorkerObfuscationEnabled = () =>
  isClientSourceProtectionEnabled() &&
  isPublicJsObfuscationEnabled() &&
  config?.security?.serviceWorkerObfuscationEnabled !== false;

const isInlineCssMinifyEnabled = () =>
  isClientSourceProtectionEnabled() &&
  config?.security?.inlineCssMinifyEnabled !== false;

const isPublicCssMinifyEnabled = () =>
  isClientSourceProtectionEnabled() &&
  config?.security?.publicCssMinifyEnabled !== false;

// ส่ง flag ไปให้ layout.ejs เพื่อซ่อน/แสดง protect-client.js ตาม secure_config
app.use((req, res, next) => {
  res.locals.clientSourceProtectionEnabled = isClientSourceProtectionEnabled();
  next();
});

// 🔒 Client source hardening: no source-map, no-store for HTML/JS, DevTools cache reduction
app.use(blockSourceMapRequests({
  enabled: isClientSourceProtectionEnabled,
}));
app.use(sourceProtectionHeaders({
  enabled: isClientSourceProtectionEnabled,
}));
app.use(htmlSourceHardener({
  enabled: isClientSourceProtectionEnabled,
  inlineScripts: isInlineScriptObfuscationEnabled,
  inlineStyles: isInlineCssMinifyEnabled,
}));

// กัน URL scanner ที่ยิง path ยาวผิดปกติ ลดงานก่อนเข้า middleware อื่น
app.use((req, res, next) => {
  const url = String(req.originalUrl || req.url || "");
  if (url.length > 2048) {
    return res.status(414).type("text/plain").send("URI Too Long");
  }
  next();
});

// Production security headers/path hardening. Keep same-origin guard off here
// because bank/TrueWallet webhooks must stay public and unauthenticated.
app.use(securityHardening({
  enabled: true,
  sameOriginGuard: false,
  csp: false,
}));

// ✅ จับเคส client/proxy ตัดสายระหว่างอ่าน body (กัน log แตก)
app.use((req, _res, next) => {
  req.on("aborted", () => {
    // glog.warn("[REQ ABORTED]", req.method, req.originalUrl);
  });
  next();
});

// View engine + Layouts
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(expressLayouts);
app.set("layout", "layout");

// Safe JSON for inline <script> blocks in EJS. Prevents </script> breakouts/XSS.
app.locals.safeJson = (value) => JSON.stringify(value ?? null)
  .replace(/</g, "\\u003c")
  .replace(/>/g, "\\u003e")
  .replace(/&/g, "\\u0026")
  .replace(/\u2028/g, "\\u2028")
  .replace(/\u2029/g, "\\u2029");

app.set("trust proxy", 1);

app.use(cookieParser(getCookieSecret()));
// Compress text responses before static/protected JS/CSS handlers to reduce public egress.
app.use(compression());
// Static & parsers
app.set("etag", "strong");

// 🧱 Public asset cache guard: applies to every cacheable public asset path/file extension.
// Route handlers may override this with no-store for errors/fallbacks or longer ETag-based cache.
app.use((req, res, next) => {
  if (/^(GET|HEAD)$/i.test(req.method) && isPublicAssetRequestPath(req.path || req.originalUrl || req.url)) {
    setPublicAssetCacheHeaders(res);
  }
  next();
});

app.use(
  "/uploads",
  express.static(path.join(process.cwd(), "uploads"), {
    maxAge: "30d",
    immutable: true,
    setHeaders: setStaticAssetHeaders,
  })
);
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(express.json({ limit: "1mb" }));

// 🔒 Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

// 🔥 ลด request จุกจิก
app.get('/favicon.ico', (_, res) => res.status(204).end());

// 🔐 Serve public JS through an encoded loader before express.static exposes the raw file.
app.use(protectStaticJs(path.join(__dirname, 'public'), {
  enabled: isPublicJsObfuscationEnabled,
}));
app.use('/static', protectStaticJs(path.join(__dirname, 'public'), {
  enabled: isPublicJsObfuscationEnabled,
}));
app.use(protectStaticCss(path.join(__dirname, 'public'), {
  enabled: isPublicCssMinifyEnabled,
}));
app.use('/static', protectStaticCss(path.join(__dirname, 'public'), {
  enabled: isPublicCssMinifyEnabled,
}));
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '30d',
  immutable: true,
  setHeaders: setStaticAssetHeaders,
}));
app.use('/static', express.static(path.join(__dirname, 'public'), {
  maxAge: '30d',
  immutable: true,
  setHeaders: setStaticAssetHeaders,
}));
app.use("/", sitemapRouter);
app.use(robotsRoute);

// Session — ใช้ secret จาก DB ก่อน
app.use(
  session({
    name: getSessionCookieName(),
    secret: getSessionSecret(),
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: config.mongoUri,
      // Cost guard: do not touch/update the session document on every request.
      // connect-mongo's default touch can create a huge amount of MongoDB ingress
      // on high-traffic pages even when the session data did not change.
      // 6 hours keeps login expiry fresh enough without writing on every page view.
      touchAfter: Number(config?.session?.touchAfterSeconds || 6 * 60 * 60),
      ttl: Math.ceil(Number(config?.session?.maxAgeMs || 7 * 24 * 3600 * 1000) / 1000),
      autoRemove: 'native',
    }),
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 3600 * 1000,
      secure: process.env.NODE_ENV === 'production',
    },
  })
);

app.use(attachUser);

app.use((req, res, next) => {
  // defaults
  res.locals.flash = null;
  res.locals.resetAllowed = false;
  res.locals.resetEmail = null;
  res.locals.currentPath = req.originalUrl || req.path || '/';

  // ✅ เพิ่ม default ให้เมนูนี้
  res.locals.showMyOrdersNav = false;

  // flash one-shot from session
  if (req.session) {
    if (req.session.flash) {
      res.locals.flash = req.session.flash;
      req.session.flash = null;
    }
    const g = req.session.resetGrant;
    if (g && g.email && g.tokenId) {
      res.locals.resetAllowed = true;
      res.locals.resetEmail = g.email;
    }
  }
  next();
});

// Inject user to views
app.use(async (req, res, next) => {
  res.locals.me = res.locals.me || null;
  res.locals.balanceText = null;

  const sid = req.session?.user;
  const uid = req.user?._id || sid?._id || sid?.id;
  if (!uid) return next();

  try {
    const user = await User.findById(uid)
      .select(
        "username role balance currency avatarUrl avatar name level totalSpent updatedAt"
      )
      .lean(false);

    if (user) {
      if (typeof user.balance !== "number")
        user.balance = config.initialBalance ?? 0;
      if (!user.currency) user.currency = config.currency || "THB";
      if (user.isModified()) await user.save();

      const proto = (
        req.headers["x-forwarded-proto"] ||
        req.protocol ||
        "http"
      ).split(",")[0];
      const base = `${proto}://${req.get("host")}`;
      // base URL จาก request ปัจจุบัน

      // สร้าง URL รูป
      let raw = (user.avatarUrl ?? user.avatar ?? "").toString().trim();
      let avatarUrl;
      if (/^https?:\/\//i.test(raw)) {
        avatarUrl = raw;
      } else if (raw) {
        raw = "/" + raw.replace(/^\/+/, "");
        if (raw.startsWith("/static/") || raw.startsWith("/assets/") || raw.startsWith("/logo/")) {
          avatarUrl = `${base}${raw}`;
        } else {
          if (!raw.startsWith("/uploads/")) raw = "/uploads/" + raw.replace(/^\/+/, "");
          avatarUrl = `${base}${raw}`;
        }
      } else {
        // Keep default logo as a clean relative static URL so browser/CDN cache can reuse it.
        avatarUrl = `/static/logo/icon-logo.png`;
      }
      const avatarIsDefault = isDefaultAvatarUrl(avatarUrl);
      const avatarVer = avatarIsDefault ? 0 : (user.updatedAt ? user.updatedAt.getTime() : 1);

      res.locals.me = {
        ...(res.locals.me || {}),
        _id: user._id,
        username: user.username,
        role: user.role,
        balance: user.balance,
        currency: user.currency,
        name: user.name || null,
        level: user.level || "1",
        totalSpent: typeof user.totalSpent === "number" ? user.totalSpent : 0,
        avatarUrl,
        avatarVer,
        avatarIsDefault,
        avatarSrc: buildAvatarSrc(avatarUrl, avatarVer),
      };

      res.locals.balanceText = `${Number(user.balance || 0).toLocaleString(
        undefined,
        { maximumFractionDigits: 2 }
      )} ${user.currency || "THB"}`;
    }
  } catch (e) {
  }
  next();
});

// Routes
app.get("/", (req, res) => {
  res.render("home/index", {
    pageTitle: "RTAUTOBOT | ระบบ Bonustime อัตโนมัติ",
    title: "RTAUTOBOT | ระบบ Bonustime อัตโนมัติ",
    pageDescription: "RTAUTOBOT ศูนย์สั่งซื้อและจัดการ Bonustime สำหรับสล็อต บาคาร่า และหวย พร้อมเครดิตกระเป๋าเดียวกับ RTAUTOBOT",
    pageKeywords: "RTAUTOBOT, Bonustime, ระบบโบนัสไทม์, บอทโบนัสไทม์, สล็อต, บาคาร่า, หวย",
  });
});

app.use("/support", supportRouter);
app.use(authRoutes);
app.use(resetPasswordRoutes);

// RTAUTOBOT admin: Bonustime only
app.use("/admin", requireAuth, requireAdmin, adminBonustimeRoutes);

// ✅ Public topup webhooks must be registered BEFORE any broad requireAuth middleware.
// Otherwise MacroDroid/Postman requests to /topup/kbank will be intercepted by
// requireAuth and return { ok:false, message:"Unauthenticated" } instead of
// reaching the bank webhook handler.
app.use("/topup", topupPublicRouter);
app.use("/api/topup", topupPublicRouter);

// RTAUTOBOT keeps only account/credit/support and Bonustime-facing routes.
// SMM, OTP24, APPS, Telegram service and related endpoints are intentionally unmounted.

// walletRoutes does not have its own router.use(requireAuth), so guard only its real paths.
app.use(["/wallet", "/wallet/add"], requireAuth);
app.use(walletRoutes);

app.use("/topup", requireAuth, topupRouter);
app.use(accountRouter); // router.use(requireAuth) inside
app.use(dashboardRouter); // router.use(requireAuth) inside

// Admin routes are limited to Bonustime in this split.
// Guard only /admin/report/*, then mount the router. This prevents requireAdmin
// from leaking into all user/public routes registered after it.

app.use(bonustimeRouter);


// Healthcheck (optional)
app.get("/healthz", (_req, res) => res.json({ ok: true }));

app.get("/faq", (req, res) => {
  // ถ้า layout ของคุณมี navbar และคุณไม่อยากให้แสดงในหน้านี้
  // ส่ง flag ไปให้ layout เช็คซ่อน
  res.render("faq", {
    pageTitle: "คำถามที่พบบ่อย (FAQ)",
    hideNavbar: true, // ใช้ใน layout.ejs: <% if (!hideNavbar) { ...navbar... } %>
  });
});

app.get("/page/terms-of-use", (req, res) => {
  res.render("terms-of-use", {
    layout: true, // ✅ ใช้ layout.ejs
    title: "เงื่อนไขและข้อตกลง | RTAUTOBOT",
    pageTitle: "Terms of Use",
    bodyClass: "page-terms", // (ออปชัน) เอาไว้เผื่อสไตล์เฉพาะหน้านี้
  });
});

process.on("unhandledRejection", (err) => {
  glog.error("[unhandledRejection]", err);
});
process.on("uncaughtException", (err) => {
  glog.error("[uncaughtException]", err);
});

// ✅ กลืน error "request aborted" จาก raw-body ไม่ให้เป็น error แดง
app.use((err, req, res, next) => {
  const msg = String(err?.message || "");
  if (msg.includes("request aborted") || err?.type === "request.aborted") {
    return; // เงียบไปเลย (เกิดจาก client/proxy ตัดสาย)
  }

  // ถ้าเป็นพวก JSON parse error
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ ok: false, error: "Invalid JSON body" });
  }

  return next(err);
});

// 404 (optional)
app.use((req, res) => res.status(404).send("Not found"));

(async () => {
  try {
    const r = await User.updateMany(
      {
        $or: [
          { balance: { $exists: false } },
          { currency: { $exists: false } },
        ],
      },
      {
        $set: {
          balance: config.initialBalance ?? 0,
          currency: config.currency || "THB",
        },
      }
    );
    if (r.modifiedCount) {
      glog.log(`✅ Migrated balances for ${r.modifiedCount} user(s).`);
    }
  } catch (e) {
    glog.error("❌ Balance migration failed:", e?.message || e);
  }
})();

(async () => {
  try {
    const r = await User.updateMany(
      {
        $or: [
          { points: { $exists: false } },
          { pointsAccrued: { $exists: false } },
          { pointsRedeemed: { $exists: false } },
        ],
      },
      { $set: { points: 0, pointsAccrued: 0, pointsRedeemed: 0 } }
    );
    if (r.modifiedCount) {
      glog.log(`✅ Initialized points for ${r.modifiedCount} user(s).`);
    }
  } catch (e) {
    glog.error("❌ Points init failed:", e?.message || e);
  }
})();

startQueueWorker();
await startJobScheduler();

/* ------------------------------------------------------------------ */
/* 5) ใช้ PORT จาก DB ก่อน ถ้าไม่มีค่อย fallback env/config           */
/* ------------------------------------------------------------------ */
const PORT = getRuntimePort();
const HOST = "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`🚀 RTAUTOBOT Server Online`);

  glog.info("[RTAUTOBOT] Bonustime runtime online");
});