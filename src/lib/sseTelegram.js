// src/lib/sseTelegram.js
import { config } from "../config.js";

const channels = new Map();

function isGlobalLogEnabled() {
  return config?.system?.globalLogEnabled === true;
}

function log(...args) {
  if (isGlobalLogEnabled()) {
    console.log("[SSE]", ...args);
  }
}

export function telegramSubscribe(jobId, res) {
  // 🔥 ปิด connection เก่าทันที กันเปิดหลาย tab
  if (channels.has(jobId)) {
    try {
      channels.get(jobId).res.end();
    } catch { }
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // 🔥 heartbeat กัน timeout proxy
  const interval = setInterval(() => {
    try {
      res.write(":\n\n");
    } catch {
      clearInterval(interval);
    }
  }, 15000);

  // 🔥 auto kill หลัง 5 นาที กัน memory leak
  const timeout = setTimeout(() => {
    log("AUTO CLOSE", jobId);

    try {
      res.end();
    } catch { }
  }, 5 * 60 * 1000);

  channels.set(jobId, { res, interval, timeout });

  res.write("event: connected\ndata: ok\n\n");

  res.on("close", () => {
    const ch = channels.get(jobId);

    if (ch) {
      clearInterval(ch.interval);
      clearTimeout(ch.timeout);
    }

    channels.delete(jobId);

    log("CLOSE", jobId);
  });

  log("SUBSCRIBE", jobId);
}

export function telegramPush(jobId, payload) {
  const ch = channels.get(jobId);
  if (!ch) return;

  try {
    ch.res.write(`data: ${JSON.stringify(payload)}\n\n`);
  } catch {
    log("PUSH FAIL", jobId);

    channels.delete(jobId);
  }
}