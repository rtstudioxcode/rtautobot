// src/jobs/dailyChangeSync.js
import axios from "axios";

import { config } from "../config.js";
import { ChangeLog } from "../models/ChangeLog.js";
import { syncServicesFromProvider } from "../lib/syncServices.js";
import { connectMongoIfNeeded } from "../config.js";
import { log, warn, errlog } from "../utils/logger.js";
import { getRedisClient } from "../lib/redisClient.js";
import { Settings } from "../models/Settings.js";

let _running = false;

function isTelegramSummaryEnabled() {
  return config?.jobs?.dailyChangeSyncTelegramSummary === true;
}

function getTelegramTimeoutMs() {
  const n = Number(config?.jobs?.dailyChangeSyncTelegramTimeoutMs ?? 10000);
  return Math.max(3000, Number.isFinite(n) ? n : 10000);
}

function getTelegramConfig() {
  const botToken = String(config?.telegram?.botToken || "").trim();
  const channelId = String(config?.telegram?.channelId || "").trim();

  return {
    botToken,
    channelId,
    apiBase: botToken ? `https://api.telegram.org/bot${botToken}` : null,
  };
}

function makeRunId() {
  return `dcs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function deleteRedisByPattern(pattern, { batchSize = 500 } = {}) {
  const redis = getRedisClient();
  let cursor = '0';
  let deleted = 0;

  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', batchSize);
    cursor = nextCursor;
    if (keys.length) {
      deleted += await redis.del(...keys);
    }
  } while (cursor !== '0');

  return deleted;
}

// เก็บเฉพาะ log รอบล่าสุด
async function clearPreviousLogs(runId) {
  const startedAt = Date.now();

  const res = await ChangeLog.deleteMany({});

  log("CHANGELOG_RESET", {
    runId,
    deletedCount: Number(res?.deletedCount || 0),
    durationMs: Date.now() - startedAt,
  });
}

// ส่ง Telegram เฉพาะมี change
async function sendTelegramDailySummary(runId, result) {
  if (!isTelegramSummaryEnabled()) return;

  const { apiBase, channelId } = getTelegramConfig();

  if (!apiBase || !channelId) {
    warn("TELEGRAM_CONFIG_MISSING");
    return;
  }

  if (!result?.logs || result.logs === 0) {
    log("TELEGRAM_SKIP_NO_CHANGE", { runId });
    return;
  }

  try {
    const text =
`📊 Daily Sync
Run: ${runId}

Total: ${result.count}
➕ Created: ${result.created}
✏️ Updated: ${result.updated}
➖ Removed: ${result.removed}
📝 Changes: ${result.logs}`;

    await axios.post(
      `${apiBase}/sendMessage`,
      {
        chat_id: channelId,
        text,
      },
      {
        timeout: getTelegramTimeoutMs(),
      }
    );

    log("TELEGRAM_SENT", { runId });
  } catch (e) {
    errlog("TELEGRAM_FAIL", e?.message || e);
  }
}

async function runDaily(trigger = "queue") {
  const runId = makeRunId();

  if (_running) {
    warn("RUN_SKIP_ALREADY_RUNNING", { runId });
    return;
  }

  _running = true;
  const startedAt = Date.now();

  try {
    log("RUN_START", { runId, trigger });

    await connectMongoIfNeeded();
    await clearPreviousLogs(runId);

    const syncResult = await syncServicesFromProvider({ runId });

    // ===============================
    // 🔑 UPDATE CACHE VERSION (สำคัญ)
    // ===============================
    try {
      await Settings.updateOne(
        { key: 'cache_version' },
        { value: Date.now() },
        { upsert: true }
      );

      log("CACHE_VERSION_UPDATED", { runId });

    } catch (e) {
      errlog("CACHE_VERSION_UPDATE_FAIL", e?.message || e);
    }

    // ===============================
    // 🧹 CLEAR SERVICE CACHE AFTER SYNC
    // ===============================
    // ServiceCache ย้ายจาก MongoDB ไป Redis แล้ว
    // ห้าม delete MongoDB cache ตรงนี้อีก เพื่อลด read/write/egress ของ DB
    try {
      const deleted = await deleteRedisByPattern('svcache:service-groups:*');

      log("SERVICE_CACHE_CLEARED_REDIS", {
        runId,
        deleted
      });

    } catch (e) {
      errlog("SERVICE_CACHE_CLEAR_REDIS_FAIL", e?.message || e);
    }

    log("SYNC_DONE", {
      runId,
      ok: syncResult?.ok,
      changes: syncResult?.logs,
    });

    await sendTelegramDailySummary(runId, syncResult);

    log("RUN_DONE", {
      runId,
      durationMs: Date.now() - startedAt,
    });

    return syncResult;
  } catch (e) {
    errlog("RUN_FAIL", {
      runId,
      error: e?.message || e,
    });

    return {
      ok: false,
      error: e?.message || String(e),
    };
  } finally {
    _running = false;
  }
}

// ใช้กับ queue เท่านั้น
export async function runDailyChangeSyncNow() {
  return runDaily("queue");
}