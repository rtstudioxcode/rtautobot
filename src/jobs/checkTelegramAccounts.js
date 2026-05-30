// src/jobs/checkTelegramAccounts.js
import { config } from "../config.js";
import { TgAccount } from "../models/TgAccount.js";

// ✅ ใช้ logger กลาง
import { log, warn, errlog } from "../utils/logger.js";

function getIntervalMs() {
  const n = Number(config?.jobs?.telegramCheckIntervalMs ?? 5000);
  return Math.max(5000, Number.isFinite(n) ? n : 5000);
}

function getBatchLimit() {
  const n = Number(config?.jobs?.telegramCheckBatchLimit ?? 200);
  return Math.max(50, Number.isFinite(n) ? n : 200);
}

let running = false;
let started = false;
let timer = null;

function toTs(v) {
  if (!v) return 0;
  if (v instanceof Date) return v.getTime();

  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
}

function isModified(res) {
  return Boolean(res?.modifiedCount || res?.nModified || res?.upsertedCount);
}

async function processAccount(row, nowTs) {
  const status = String(row.status || "").toUpperCase();
  const cooldownUntil = toTs(row.cooldownUntil);
  const lockUntil = toTs(row.lockUntil);

  let nextStatus = status;
  const patch = {};

  // =========================
  // 🔒 LOCKED (Priority สูงสุด)
  // =========================
  if (lockUntil && lockUntil > nowTs) {
    if (status !== "LOCKED") {
      nextStatus = "LOCKED";
      patch.status = "LOCKED";
      log("STATE -> LOCKED", row.phone);
    }
  } else if (lockUntil && lockUntil <= nowTs) {
    if (status === "LOCKED") {
      nextStatus = "READY";
      patch.status = "READY";
      patch.lockUntil = null;
      patch.lastError = null;
      patch.invitesToday = 0;

      log("LOCK EXPIRED → READY", row.phone);
    } else {
      patch.lockUntil = null;
    }
  }

  // =========================
  // ⏳ COOLDOWN
  // =========================
  if (nextStatus !== "LOCKED") {
    if (cooldownUntil && cooldownUntil > nowTs) {
      if (status !== "COOLDOWN") {
        nextStatus = "COOLDOWN";
        patch.status = "COOLDOWN";
        log("STATE -> COOLDOWN", row.phone);
      }
    } else if (cooldownUntil && cooldownUntil <= nowTs) {
      if (status === "COOLDOWN") {
        nextStatus = "READY";
        patch.status = "READY";
        patch.cooldownUntil = null;
        patch.lastError = null;
        patch.invitesToday = 0;

        log("COOLDOWN EXPIRED → READY", row.phone);
      } else {
        patch.cooldownUntil = null;
      }
    }
  }

  // =========================
  // 🟢 READY แต่ cooldown ยังไม่หมด
  // =========================
  if (status === "READY" && cooldownUntil && cooldownUntil > nowTs) {
    nextStatus = "COOLDOWN";
    patch.status = "COOLDOWN";
    log("FORCE READY → COOLDOWN", row.phone);
  }

  // =========================
  // 🚫 ไม่มีการเปลี่ยนแปลง
  // =========================
  if (!Object.keys(patch).length) return false;

  try {
    const res = await TgAccount.updateOne(
      { _id: row._id },
      { $set: patch }
    );

    if (isModified(res)) {
      log("UPDATED", {
        phone: row.phone,
        from: status,
        to: nextStatus,
      });

      return true;
    }

    return false;
  } catch (e) {
    errlog("UPDATE_FAIL", {
      phone: row.phone,
      error: e?.message || e,
    });

    return false;
  }
}

export async function tick() {
  if (running) {
    log("SKIP (previous tick running)");
    return;
  }

  running = true;

  const start = Date.now();

  try {
    const nowTs = Date.now();
    const batchLimit = getBatchLimit();

    const list = await TgAccount.find({
      $or: [
        { lockUntil: { $exists: true } },
        { cooldownUntil: { $exists: true } },
      ],
    })
      .select("_id phone status cooldownUntil lockUntil invitesToday lastError")
      .sort({ updatedAt: 1 })
      .limit(batchLimit)
      .lean();

    log("SCAN", {
      count: list.length,
      batchLimit,
    });

    if (!list.length) return;

    let changed = 0;

    for (const row of list) {
      const ok = await processAccount(row, nowTs);
      if (ok) changed++;
    }

    log("DONE", {
      total: list.length,
      changed,
      durationMs: Date.now() - start,
    });
  } catch (e) {
    errlog("TICK_ERROR", e?.message || e);
  } finally {
    running = false;
  }
}

export function startCheckTelegramAccounts() {
  if (started) {
    log("ALREADY_STARTED");
    return () => {};
  }

  started = true;

  const intervalMs = getIntervalMs();
  const batchLimit = getBatchLimit();

  log("START", {
    interval: intervalMs,
    batch: batchLimit,
  });

  tick().catch((e) => errlog("START_TICK_ERROR", e?.message || e));

  timer = setInterval(() => {
    tick().catch((e) => errlog("INTERVAL_ERROR", e?.message || e));
  }, intervalMs);

  return () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }

    running = false;
    started = false;

    log("STOPPED");
  };
}