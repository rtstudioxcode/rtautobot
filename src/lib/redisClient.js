// src/lib/redisClient.js
// Redis client กลาง — ใช้ร่วมกันทั้งระบบ (แยกจาก BullMQ connection)
import IORedis from 'ioredis';
import { config } from '../config.js';

let _client = null;

export function getRedisClient() {
  if (_client) return _client;

  const url = process.env.REDIS_URL || config?.redis?.url || '';
  if (!url) throw new Error('REDIS_URL is missing');

  _client = new IORedis(url, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
    lazyConnect: false,
  });

  _client.on('error', (e) => {
    // ไม่ crash — log แล้วปล่อยให้ reconnect เอง
    console.error('[Redis] error:', e?.message || e);
  });

  return _client;
}
