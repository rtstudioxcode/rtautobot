// src/jobs/queueWorker.js
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { config } from "../config.js";

import { tickOnce as orderStatusTick } from "../jobs/orderStatusJob.js";
import { sweepOnce as otp24Sweep } from "../jobs/otp24ProcessingSweeper.js";
import { tick as tgAccountTick } from "../jobs/checkTelegramAccounts.js";
import { runDailyChangeSyncNow } from "../jobs/dailyChangeSync.js";
import { runTopupAutoRejectOnce } from "../jobs/topupAutoRejectJob.js";
import { runBonustimeExpiryOnce } from "../jobs/bonustimeExpiryJob.js";
import { tickOnce as otp24AppsRefreshTick } from "../jobs/otp24AppsOrderRefreshJob.js";
import { tickOnce as otp24ProductsSyncTick } from "../jobs/otp24ProductsSyncJob.js";

/**
 * REDIS_URL ยังอ่านจาก ENV ได้
 * เพราะเป็น bootstrap infra config ที่โทนี่ต้องการเหลือไว้ใน .env
 */
const REDIS_URL = process.env.REDIS_URL || config?.redis?.url || "";

function isGlobalLogEnabled() {
  return config?.system?.globalLogEnabled === true;
}

function getWorkerConcurrency() {
  const n = Number(config?.system?.workerConcurrency ?? 3);
  return Number.isFinite(n) && n > 0 ? n : 3;
}

function log(...args) {
  if (isGlobalLogEnabled()) {
    console.log("[WORKER]", ...args);
  }
}

function err(...args) {
  console.error("[WORKER]", ...args);
}

if (!REDIS_URL) {
  throw new Error("REDIS_URL is missing");
}

const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

export function startQueueWorker() {
  log("START WORKER");

  const worker = new Worker(
    "main-queue",
    async (job) => {
      const start = Date.now();

      log("JOB_START", job.name);

      try {
        switch (job.name) {
          case "order-status":
            await orderStatusTick();
            break;

          case "otp24":
            await otp24Sweep();
            break;

          case "tg-account":
            await tgAccountTick();
            break;

          case "otp24-apps-refresh":
            await otp24AppsRefreshTick();
            break;

          case "otp24-products-sync":
            await otp24ProductsSyncTick();
            break;

          case "daily-sync":
            await runDailyChangeSyncNow();
            break;

          case "topup-reject":
            await runTopupAutoRejectOnce();
            break;

          case "bonustime-expire":
            await runBonustimeExpiryOnce();
            break;

          default:
            log("UNKNOWN_JOB", job.name);
            break;
        }

        log("JOB_DONE", job.name, `${Date.now() - start}ms`);
      } catch (e) {
        err("JOB_FAIL", job.name, e?.message || e);
        throw e;
      }
    },
    {
      connection,
      concurrency: getWorkerConcurrency(),
      lockDuration: 60000,
    }
  );

  worker.on("failed", (job, error) => {
    err("FAILED", job?.name, error?.message || error);
  });

  worker.on("completed", (job) => {
    log("COMPLETED", job?.name);
  });

  return worker;
}

export { connection };