// src/jobs/jobQueue.js
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { config } from "../config.js";

/**
 * REDIS_URL ยังอ่านจาก ENV ได้
 * เพราะเป็น bootstrap infra config ที่โทนี่ต้องการเหลือไว้ใน .env
 */
const REDIS_URL = process.env.REDIS_URL || config?.redis?.url || "";

function isGlobalLogEnabled() {
  return config?.system?.globalLogEnabled === true;
}

function log(...args) {
  if (isGlobalLogEnabled()) {
    console.log("[QUEUE]", ...args);
  }
}

function safeEvery(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function safeCron(value, fallback) {
  const s = String(value || "").trim();
  return s || fallback;
}

async function resetRepeatableJobByName(name) {
  const jobs = await queue.getRepeatableJobs().catch(() => []);
  for (const job of jobs || []) {
    if (job?.name === name && job?.key) {
      await queue.removeRepeatableByKey(job.key).catch(() => null);
    }
  }
}

if (!REDIS_URL) {
  throw new Error("REDIS_URL is missing");
}

const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

const DEFAULT_JOB_CLEANUP = {
  removeOnComplete: {
    age: 60 * 60, // keep completed jobs for at most 1 hour
    count: 100,   // and never keep more than 100 completed jobs per job type
  },
  removeOnFail: {
    age: 24 * 60 * 60, // keep failed jobs for 1 day for debugging
    count: 300,
  },
};

const HOT_REPEAT_JOB_CLEANUP = {
  removeOnComplete: 20,
  removeOnFail: 50,
};

const queue = new Queue("main-queue", {
  connection,
  defaultJobOptions: DEFAULT_JOB_CLEANUP,
});

export async function startJobScheduler() {
  log("START SCHEDULER");

  /**
   * ❌ ห้าม obliterate
   * เพราะจะลบ repeatable job แล้วเสี่ยงเกิด job ซ้ำ/สถานะเพี้ยน
   */
  // await queue.obliterate({ force: true });

  const tz = config?.system?.tz || "Asia/Bangkok";

  await queue.add(
    "order-status",
    {},
    {
      jobId: "order-status",
      repeat: {
        every: safeEvery(config?.jobs?.orderStatusTickMs, 60_000),
      },
      ...HOT_REPEAT_JOB_CLEANUP,
    }
  );

  await queue.add(
    "otp24",
    {},
    {
      jobId: "otp24",
      repeat: {
        every: safeEvery(config?.jobs?.otp24SweeperIntervalMs, 3_000),
      },
      ...HOT_REPEAT_JOB_CLEANUP,
    }
  );

  await queue.add(
    "tg-account",
    {},
    {
      jobId: "tg-account",
      repeat: {
        every: safeEvery(config?.jobs?.telegramCheckIntervalMs, 5_000),
      },
      ...HOT_REPEAT_JOB_CLEANUP,
    }
  );


  await queue.add(
    "otp24-apps-refresh",
    {},
    {
      jobId: "otp24-apps-refresh",
      repeat: {
        every: safeEvery(config?.jobs?.otp24AppsRefreshIntervalMs, 15 * 60 * 1000),
        immediately: true,
      },
      attempts: 2,
      backoff: { type: "exponential", delay: 15_000 },
      removeOnComplete: 20,
      removeOnFail: 50,
    }
  );

  // บังคับยิงหนึ่งรอบตอน server/worker start ด้วย เพื่อไม่ต้องรอครบ 15 นาทีหลัง deploy/restart
  await queue.add(
    "otp24-apps-refresh",
    { reason: "startup" },
    {
      jobId: `otp24-apps-refresh-startup-${Date.now()}`,
      attempts: 2,
      backoff: { type: "exponential", delay: 15_000 },
      removeOnComplete: 20,
      removeOnFail: 50,
    }
  );

  await queue.add(
    "otp24-products-sync",
    {},
    {
      jobId: "otp24-products-sync",
      repeat: {
        every: safeEvery(config?.jobs?.otp24ProductsSyncIntervalMs, 12 * 60 * 60 * 1000),
        immediately: true,
      },
      attempts: 2,
      backoff: { type: "exponential", delay: 30_000 },
      removeOnComplete: 20,
      removeOnFail: 50,
    }
  );

  // ยิงหนึ่งรอบตอน start เพื่อ sync stock/service ใหม่หลัง deploy/restart
  await queue.add(
    "otp24-products-sync",
    { reason: "startup" },
    {
      jobId: `otp24-products-sync-startup-${Date.now()}`,
      attempts: 2,
      backoff: { type: "exponential", delay: 30_000 },
      removeOnComplete: 20,
      removeOnFail: 50,
    }
  );

  await queue.add(
    "daily-sync",
    {},
    {
      jobId: "daily-sync",
      repeat: {
        cron: safeCron(config?.jobs?.dailyChangeSyncCron, "0 7 * * *"),
        tz,
      },
      removeOnComplete: 5,
      removeOnFail: 20,
    }
  );

  await queue.add(
    "topup-reject",
    {},
    {
      jobId: "topup-reject",
      repeat: {
        cron: safeCron(config?.jobs?.topupRejectCron, "*/1 * * * *"),
        tz,
      },
      ...HOT_REPEAT_JOB_CLEANUP,
    }
  );

  await queue.add(
    "bonustime-expire",
    {},
    {
      jobId: "bonustime-expire",
      repeat: {
        cron: safeCron(config?.jobs?.bonustimeExpiryCron, "*/5 * * * *"),
        tz,
      },
      removeOnComplete: 20,
      removeOnFail: 50,
    }
  );

  log("ALL JOBS READY");
}

export { queue, connection };