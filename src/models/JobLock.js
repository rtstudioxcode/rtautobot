// src/models/JobLock.js
// JobLock ย้ายจาก MongoDB → Redis SET NX (atomic, built-in TTL, ลด Egress)
import os from 'os';
import { getRedisClient } from '../lib/redisClient.js';

function defaultOwner() {
  return `${os.hostname()}:${process.pid}`;
}

function redisKey(key) {
  return `joblock:${key}`;
}

/**
 * จองล็อก — atomic SET NX EX
 * return object ถ้าได้ล็อก, null ถ้าไม่ได้
 */
export async function acquireLock(key, ttlMs = 60_000, owner = defaultOwner()) {
  const redis = getRedisClient();
  const rKey = redisKey(key);
  const ttlSec = Math.max(1, Math.ceil(ttlMs / 1000));

  // SET key value NX EX ttl — atomic, ถ้าได้จะ return 'OK'
  const result = await redis.set(rKey, owner, 'NX', 'EX', ttlSec);

  if (result !== 'OK') return null; // มีคนอื่น lock อยู่

  return { key, owner, lockedAt: new Date(), expiresAt: new Date(Date.now() + ttlMs) };
}

/**
 * ต่ออายุล็อก — เฉพาะเจ้าของเดิมเท่านั้น
 */
export async function prolongLock(key, ttlMs = 60_000, owner = defaultOwner()) {
  const redis = getRedisClient();
  const rKey = redisKey(key);
  const ttlSec = Math.max(1, Math.ceil(ttlMs / 1000));

  // ตรวจว่าเรายังเป็นเจ้าของอยู่ก่อน
  const current = await redis.get(rKey);
  if (current !== owner) return false;

  await redis.expire(rKey, ttlSec);
  return true;
}

/**
 * ปลดล็อก — เฉพาะเจ้าของเดิมเท่านั้น (Lua script กัน race condition)
 */
export async function releaseLock(key, owner = defaultOwner()) {
  const redis = getRedisClient();
  const rKey = redisKey(key);

  // Lua: ลบเฉพาะถ้า owner ตรง
  const script = `
    if redis.call("GET", KEYS[1]) == ARGV[1] then
      return redis.call("DEL", KEYS[1])
    else
      return 0
    end
  `;
  await redis.eval(script, 1, rKey, owner);
}

// ── Mongoose model stub (backward compat กรณีมีโค้ดอื่น import JobLock model) ──
export const JobLock = {
  // ไม่ใช้แล้ว — เหลือไว้กัน import error
};
