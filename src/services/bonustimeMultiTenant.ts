// src/services/bonustimeMultiTenant.js
// Additive multi-tenant helpers for Bonustime.
// IMPORTANT: Never rename/remove legacy fields (tenantId, LINK, serial_key, etc.).
import { config } from '../config';

export function normalizeServiceGroup(lottoEnabled) {
  return lottoEnabled === true || lottoEnabled === 'true' || lottoEnabled === 1 || lottoEnabled === '1'
    ? 'pk2'
    : 'pk1';
}

export function serviceKeyFrom(group, no) {
  const g = group === 'pk2' ? 'pk2' : 'pk1';
  return `${g}server${Number(no) || 1}`;
}

export function parseServiceKey(value = '') {
  const m = /^\s*(pk[12])server(\d+)\s*$/i.exec(String(value || ''));
  if (!m) return null;
  return { group: m[1].toLowerCase(), no: Number(m[2]) || 0, key: `${m[1].toLowerCase()}server${Number(m[2]) || 0}` };
}

export function bonustimeWebhookBaseUrl() {
  const raw =
    config?.bonustime?.webhookBaseUrl
  return String(raw || '').replace(/\/+$/, '');
}

export function bonustimeSharedServiceName() {
  return String(
    config?.bonustime?.sharedServiceName
  ).trim();
}

export function makeWebhookUrl(serviceKey) {
  const key = String(serviceKey || '').trim();
  return `${bonustimeWebhookBaseUrl()}/webhook/${encodeURIComponent(key)}`;
}

export function makeWebhookPath(serviceKey) {
  const key = String(serviceKey || '').trim();
  return `/webhook/${encodeURIComponent(key)}`;
}

export async function getNextServiceIdentity(col, lottoEnabled) {
  const group = normalizeServiceGroup(lottoEnabled);
  const docs = await col.find({
    $or: [
      { serviceGroup: group },
      { serviceKey: { $regex: `^${group}server\\d+$`, $options: 'i' } },
      { tenantId: { $regex: `^${group}server\\d+$`, $options: 'i' } },
    ],
  }, { projection: { serviceKey: 1, tenantId: 1, serviceNo: 1 } }).toArray();

  let max = 0;
  for (const d of docs || []) {
    const candidates = [d.serviceKey, d.tenantId];
    for (const c of candidates) {
      const parsed = parseServiceKey(c);
      if (parsed && parsed.group === group && parsed.no > max) max = parsed.no;
    }
    const n = Number(d.serviceNo || 0);
    if (Number.isFinite(n) && n > max) max = n;
  }
  const serviceNo = max + 1;
  const serviceKey = serviceKeyFrom(group, serviceNo);
  return {
    serviceMode: 'multiTenant',
    serviceGroup: group,
    serviceNo,
    serviceKey,
    webhookPath: makeWebhookPath(serviceKey),
    webhookUrl: makeWebhookUrl(serviceKey),
    sharedServiceName: bonustimeSharedServiceName(),
  };
}

export function publicTenantKey(doc: any = {}) {
  return String(doc.serviceKey || doc.tenantId || '').trim();
}

export function bonustimeTenantLookup(key) {
  const k = String(key || '').trim();
  return {
    $or: [
      { serviceKey: k },
      { tenantId: k },
      { legacyTenantId: k },
    ],
  };
}

export function buildAdditiveFields(doc: any = {}, identity: any = null) {
  const existingKey = String(doc.serviceKey || '').trim();
  const parsedExisting = parseServiceKey(existingKey);
  const serviceKey = existingKey || identity?.serviceKey || '';
  const group = parsedExisting?.group || identity?.serviceGroup || normalizeServiceGroup(doc.LOTTO_ENABLED);
  const serviceNo = parsedExisting?.no || Number(doc.serviceNo || identity?.serviceNo || 0) || null;
  const key = serviceKey || (serviceNo ? serviceKeyFrom(group, serviceNo) : '');
  const webhookUrl = key ? makeWebhookUrl(key) : '';
  return {
    legacyTenantId: doc.legacyTenantId || doc.tenantId || '',
    serviceMode: 'multiTenant',
    serviceGroup: group,
    serviceNo,
    serviceKey: key,
    webhookPath: key ? makeWebhookPath(key) : '',
    webhookUrl,
    sharedServiceName: bonustimeSharedServiceName(),
  };
}
