// src/queue/jobQueue.js — RTAUTOBOT Bonustime scheduler
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { config } from "../config.js";

const REDIS_URL = process.env.REDIS_URL || config?.redis?.url || "";
if (!REDIS_URL) throw new Error("REDIS_URL is missing");

const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

const queue = new Queue("main-queue", {
  connection,
  defaultJobOptions: {
    removeOnComplete: { age: 60 * 60, count: 100 },
    removeOnFail: { age: 24 * 60 * 60, count: 300 },
  },
});

function safeCron(value, fallback) {
  const s = String(value || "").trim();
  return s || fallback;
}

function log(...args) {
  if (config?.system?.globalLogEnabled === true) console.log("[QUEUE]", ...args);
}

export async function startJobScheduler() {
  const tz = config?.system?.tz || "Asia/Bangkok";

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

  log("BONUSTIME JOB READY");
}

export { queue, connection };
