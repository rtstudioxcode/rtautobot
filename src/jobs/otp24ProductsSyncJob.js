// src/jobs/otp24ProductsSyncJob.js
import { syncOtp24ProductsAndBalance } from '../services/otp24ProductsSync.js';
import { config } from '../config.js';

function isGlobalLogEnabled() {
  return config?.system?.globalLogEnabled === true;
}

function log(...args) {
  if (isGlobalLogEnabled()) console.log('[OTP24_PRODUCTS_SYNC]', ...args);
}

export async function tickOnce() {
  const startedAt = Date.now();
  const result = await syncOtp24ProductsAndBalance({ reason: 'queue' });
  log('done', JSON.stringify({
    ok: result?.ok,
    count: result?.products?.count,
    total: result?.products?.total,
    packTotal: result?.products?.packTotal,
    balanceOk: result?.balance?.ok,
    ms: Date.now() - startedAt,
  }));
  return result;
}
