// src/db/mongo.js
import mongoose from 'mongoose';
import { config, resolveMongoDbName, resolveMongoUri } from '../config.js';

// ───────── GLOBAL LOG ─────────
const isGlobalLogEnabled = () => {
  return config?.system?.globalLogEnabled === true;
};

const glog = {
  log: (...args) => {
    if (isGlobalLogEnabled()) glog.log(...args);
  },
  info: (...args) => {
    if (isGlobalLogEnabled()) glog.info(...args);
  },
  warn: (...args) => {
    if (isGlobalLogEnabled()) glog.warn(...args);
  },
  error: (...args) => {
    if (isGlobalLogEnabled()) glog.error(...args);
  },
};

function pickEnvInt(names, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  for (const name of names) {
    const raw = process.env[name];
    if (raw === undefined || raw === null || String(raw).trim() === '') continue;
    const n = Number.parseInt(String(raw).trim(), 10);
    if (Number.isFinite(n)) return Math.min(max, Math.max(min, n));
  }
  return fallback;
}

function redact(uri = '') {
  return String(uri).replace(/:\/\/([^:@/]+):([^@/]+)@/, '://***:***@');
}

function normalizeMongoUriForRailwayProxy(uri = '') {
  // Public Railway TCP proxy + replicaSet often makes the driver discover
  // an internal host (mongodb.railway.internal) that is not reachable from local.
  // For public proxy connections, directConnection=true is safer.
  try {
    const u = new URL(uri);
    if (/\.proxy\.rlwy\.net$/i.test(u.hostname)) {
      u.searchParams.delete('replicaSet');
      u.searchParams.set('directConnection', 'true');
      return u.toString();
    }
  } catch {
    // Mongo URLs with uncommon characters can fail URL parsing; leave untouched.
  }
  return uri;
}

export async function connectMongo({
  // 0 = retry forever. This prevents Railway app service from crashing while
  // MongoDB is restarting/recovering its replica set.
  retries = pickEnvInt(['MONGO_CONNECT_RETRIES', 'MONGODB_CONNECT_RETRIES'], 0, { min: 0 }),
  baseDelayMs = pickEnvInt(['MONGO_CONNECT_BASE_DELAY_MS'], 2_000, { min: 250 }),
  maxDelayMs = pickEnvInt(['MONGO_CONNECT_MAX_DELAY_MS'], 15_000, { min: 1_000 }),
} = {}) {
  mongoose.set('strictQuery', true);

  const rawUri = resolveMongoUri();
  const uri = normalizeMongoUriForRailwayProxy(rawUri);
  const dbName = resolveMongoDbName();

  if (!uri) {
    throw new Error('Mongo URI not configured (MONGO_URI or MONGODB_URI)');
  }

  const serverSelectionTimeoutMS = pickEnvInt(
    ['MONGO_SERVER_SELECTION_TIMEOUT_MS', 'MONGODB_SERVER_SELECTION_TIMEOUT_MS'],
    20_000,
    { min: 5_000 }
  );

  const opts = {
    autoIndex: process.env.MONGO_AUTO_INDEX === 'false' ? false : true,
    maxPoolSize: pickEnvInt(['MONGO_MAX_POOL_SIZE'], 8, { min: 1 }),
    serverSelectionTimeoutMS,
    heartbeatFrequencyMS: pickEnvInt(['MONGO_HEARTBEAT_MS'], 10_000, { min: 2_000 }),
    ...(dbName ? { dbName } : {}),
  };

  glog.log(`🔌 Mongo connecting: ${redact(uri)}${dbName ? ` / DB: ${dbName}` : ''}`);

  let attempt = 0;
  while (true) {
    try {
      await mongoose.connect(uri, opts);
      glog.log(`✅ Mongo connected - RTSMM-TH${dbName ? ` / DB: ${dbName}` : ''}`);
      break;
    } catch (err) {
      attempt += 1;
      const retryForever = retries === 0;
      const isLast = !retryForever && attempt >= retries;
      const message = err?.message || String(err);

      glog.warn(
        `⚠️ Mongo connect failed (attempt ${attempt}${retryForever ? '/∞' : `/${retries}`}): ${message}`
      );

      if (isLast) {
        glog.error('❌ Mongo connection failed permanently. Check MONGO_URI/MONGODB_URI, Railway internal host, replica set, and Mongo service health.');
        throw err;
      }

      const wait = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, Math.min(attempt - 1, 6)));
      glog.warn(`⏳ Waiting ${wait}ms before retrying Mongo...`);
      await new Promise(r => setTimeout(r, wait));
    }
  }

  // บาง event เอาไว้ช่วย debug เวลาเน็ตสะดุด
  const conn = mongoose.connection;
  conn.on('disconnected', () => glog.warn('ℹ️ Mongo disconnected'));
  conn.on('reconnected', () => glog.log('ℹ️ Mongo reconnected'));
  conn.on('error', (e) => glog.error('❌ Mongo error:', e?.message || e));
}
