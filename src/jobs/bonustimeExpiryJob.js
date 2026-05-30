// src/jobs/bonustimeExpiryJob.js
import cron from "node-cron";
import { config } from "../config.js";
import { checkAndSendBonustimeExpiryMails } from "../services/bonustimeExpiry.js";
import { log, warn, errlog } from "../utils/logger.js";

let BUSY = false;
let started = false;
let task = null;

function getCronSpec() {
  const cronSpec = String(
    config?.jobs?.bonustimeExpiryCron || "0 0 * * *"
  ).trim();

  return cronSpec || "0 0 * * *";
}

function getTimezone() {
  return String(config?.system?.tz || "Asia/Bangkok").trim() || "Asia/Bangkok";
}

function makeRunId() {
  return `bt_exp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

async function runExpiryJob() {
  const runId = makeRunId();

  if (BUSY) {
    log("SKIP_BUSY", { runId });
    return;
  }

  BUSY = true;
  const startedAt = Date.now();

  try {
    log("RUN_START", {
      runId,
      at: new Date().toISOString(),
    });

    const result = await checkAndSendBonustimeExpiryMails({
      logPrefix: "[BonustimeExpiryJob]",
    });

    log("RUN_DONE", {
      runId,
      result,
      durationMs: Date.now() - startedAt,
    });
  } catch (err) {
    errlog("RUN_FAIL", {
      runId,
      error: err?.message || err,
    });
  } finally {
    BUSY = false;
  }
}

export function initBonustimeExpiryJob() {
  if (started) {
    log("ALREADY_STARTED");
    return () => {};
  }

  const cronSpec = getCronSpec();
  const timezone = getTimezone();

  if (!cron.validate(cronSpec)) {
    throw new Error(`Invalid Bonustime expiry cron: ${cronSpec}`);
  }

  started = true;

  log("JOB_STARTED", {
    cron: cronSpec,
    timezone,
  });

  task = cron.schedule(
    cronSpec,
    async () => {
      try {
        await runExpiryJob();
      } catch (e) {
        errlog("CRON_FAIL", e?.message || e);
      }
    },
    {
      timezone,
    }
  );

  return () => {
    if (task) {
      task.stop();
      task = null;
    }

    started = false;
    log("JOB_STOPPED");
  };
}

// 🔧 manual run ใช้กับ queue
export async function runBonustimeExpiryOnce() {
  return runExpiryJob();
}