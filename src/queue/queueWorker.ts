// src/queue/queueWorker.js — RTAUTOBOT Bonustime worker
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { config } from "../config";
import { runBonustimeExpiryOnce } from "../jobs/bonustimeExpiryJob";

const REDIS_URL = process.env.REDIS_URL || config?.redis?.url || "";
if (!REDIS_URL) throw new Error("REDIS_URL is missing");

const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

function getWorkerConcurrency() {
  const n = Number(config?.system?.workerConcurrency ?? 1);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function log(...args) {
  if (config?.system?.globalLogEnabled === true) console.log("[WORKER]", ...args);
}

function err(...args) {
  console.error("[WORKER]", ...args);
}

export function startQueueWorker() {
  log("START BONUSTIME WORKER");

  const worker = new Worker(
    "main-queue",
    async (job) => {
      const start = Date.now();
      try {
        if (job.name === "bonustime-expire") {
          await runBonustimeExpiryOnce();
        } else {
          log("SKIP_NON_BONUSTIME_JOB", job.name);
        }
        log("JOB_DONE", job.name, `${Date.now() - start}ms`);
      } catch (e: any) {
        err("JOB_FAIL", job.name, e?.message || e);
        throw e;
      }
    },
    { connection: connection as any, concurrency: getWorkerConcurrency(), lockDuration: 60000 }
  );

  worker.on("failed", (job, error) => err("FAILED", job?.name, error?.message || error));
  worker.on("completed", (job) => log("COMPLETED", job?.name));
  return worker;
}

export { connection };
