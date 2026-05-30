// src/lib/ipGeo.js
// IpGeoCache ย้ายจาก MongoDB → Redis (ลด Egress)
import { config } from '../config.js';
import { getRedisClient } from './redisClient.js';

function isPrivateIp(ip = '') {
  const x = String(ip || '')
    .replace('::ffff:', '')
    .trim();

  if (!x || x === '-' || x === '::1' || x === '127.0.0.1') return true;

  return (
    /^10\./.test(x) ||
    /^192\.168\./.test(x) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(x) ||
    /^169\.254\./.test(x)
  );
}

export function cleanIp(ip = '') {
  return String(ip || '')
    .replace('::ffff:', '')
    .split(',')[0]
    .trim();
}

async function fetchWithTimeout(url, ms = 1200) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);

  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'RTSMM-TH-BotBlocker/1.1' },
    });

    if (!res.ok) throw new Error(`GeoIP HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchGeoFromProvider(realIp) {
  const url =
    `http://ip-api.com/json/${encodeURIComponent(realIp)}` +
    `?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query`;

  try {
    const timeoutMs = Number(config?.botBlock?.geoipTimeoutMs ?? 900);
    const data = await fetchWithTimeout(url, timeoutMs);

    if (data.status !== 'success') {
      return {
        status: 'fail',
        source: 'ip-api',
        error: data.message || 'geo_lookup_failed',
        fetchedAt: new Date().toISOString(),
      };
    }

    return {
      status: 'success',
      country: data.country || '',
      countryCode: data.countryCode || '',
      region: data.region || '',
      regionName: data.regionName || '',
      city: data.city || '',
      zip: data.zip || '',
      lat: Number(data.lat),
      lon: Number(data.lon),
      timezone: data.timezone || '',
      isp: data.isp || '',
      org: data.org || '',
      as: data.as || '',
      source: 'ip-api',
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      status: 'error',
      source: 'ip-api',
      error: err?.message || 'geo_lookup_error',
      fetchedAt: new Date().toISOString(),
    };
  }
}

function getCacheTtlSec() {
  const days = Number(config?.botBlock?.geoipCacheDays ?? 30);
  const safeDays = Number.isFinite(days) && days > 0 ? days : 30;
  return safeDays * 24 * 60 * 60;
}

function redisKey(ip) {
  return `ipgeo:${ip}`;
}

export async function lookupIpGeo(ip, options = {}) {
  const realIp = cleanIp(ip);
  const useCache = options.cache !== false;

  if (isPrivateIp(realIp)) {
    return { status: 'skip', source: 'local', error: 'private_or_local_ip', fetchedAt: new Date().toISOString() };
  }

  const geoipEnabled = config?.botBlock?.geoipEnabled !== false;
  if (!geoipEnabled) {
    return { status: 'skip', source: 'disabled', error: 'geoip_disabled', fetchedAt: new Date().toISOString() };
  }

  const redis = getRedisClient();
  const key = redisKey(realIp);

  // ── ดึงจาก Redis cache ก่อน ──
  if (useCache) {
    try {
      const raw = await redis.get(key);
      if (raw) {
        const geo = JSON.parse(raw);
        // ต่ออายุ TTL เงียบๆ (fire & forget)
        redis.expire(key, getCacheTtlSec()).catch(() => {});
        return { ...geo, cached: true };
      }
    } catch {
      // Redis error → fallthrough ไป fetch จริง
    }
  }

  // ── fetch จาก provider ──
  const geo = await fetchGeoFromProvider(realIp);

  // ── save ลง Redis ──
  try {
    await redis.set(key, JSON.stringify(geo), 'EX', getCacheTtlSec());
  } catch {
    // Redis error ไม่ crash ระบบ
  }

  return { ...geo, cached: false };
}
