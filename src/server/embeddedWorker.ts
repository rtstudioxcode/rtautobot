import { connectMongo } from "../db/mongo";
import { config, refreshConfigFromDB, startSecureConfigAutoReload } from "../config";

type WorkerLike = {
  close?: () => Promise<void>;
};

declare global {
  var __RTAUTOBOT_EMBEDDED_WORKER_STARTED__: boolean | undefined;
  var __RTAUTOBOT_EMBEDDED_WORKER_INSTANCE__: WorkerLike | undefined;
  var __RTAUTOBOT_EMBEDDED_WORKER_PROMISE__: Promise<void> | undefined;
}

function isDisabled() {
  const raw =
    process.env.RTAUTOBOT_DISABLE_EMBEDDED_WORKER ||
    process.env.DISABLE_EMBEDDED_WORKER ||
    "";
  return ["1", "true", "yes", "on"].includes(String(raw).trim().toLowerCase());
}

function isBuildPhase() {
  return (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.NEXT_PHASE === "phase-export" ||
    process.env.NEXT_BUILD === "1"
  );
}

function getRedisUrl() {
  return String(process.env.REDIS_URL || config?.redis?.url || "").trim();
}

async function bootEmbeddedWorker() {
  console.log("[BOOT] Starting embedded RTAUTOBOT worker...");

  await connectMongo();
  await refreshConfigFromDB();
  startSecureConfigAutoReload();

  if (!getRedisUrl()) {
    console.warn("[BOOT] REDIS_URL is missing — embedded worker/scheduler skipped.");
    return;
  }

  // Import queue modules only after config/env is ready. These modules create Redis
  // connections at import time, so lazy import keeps the web server safe when Redis
  // is intentionally disabled in local/dev environments.
  const [{ startJobScheduler }, { startQueueWorker }] = await Promise.all([
    import("../queue/jobQueue"),
    import("../queue/queueWorker"),
  ]);

  await startJobScheduler();
  globalThis.__RTAUTOBOT_EMBEDDED_WORKER_INSTANCE__ = startQueueWorker();

  console.log("[BOOT] Embedded RTAUTOBOT worker is ready.");
}

export function startEmbeddedWorker() {
  if (typeof window !== "undefined") return Promise.resolve();
  if (isBuildPhase()) return Promise.resolve();
  if (isDisabled()) {
    console.log("[BOOT] Embedded worker disabled by env.");
    return Promise.resolve();
  }

  if (globalThis.__RTAUTOBOT_EMBEDDED_WORKER_PROMISE__) {
    return globalThis.__RTAUTOBOT_EMBEDDED_WORKER_PROMISE__;
  }

  if (globalThis.__RTAUTOBOT_EMBEDDED_WORKER_STARTED__) {
    return Promise.resolve();
  }

  globalThis.__RTAUTOBOT_EMBEDDED_WORKER_STARTED__ = true;
  globalThis.__RTAUTOBOT_EMBEDDED_WORKER_PROMISE__ = bootEmbeddedWorker().catch((err) => {
    console.error("[BOOT] Embedded worker failed:", err?.message || err);
    // Do not crash the Next.js web server. A missing Redis/Mongo during boot should
    // keep the site reachable while logs show exactly what needs fixing.
  });

  return globalThis.__RTAUTOBOT_EMBEDDED_WORKER_PROMISE__;
}
