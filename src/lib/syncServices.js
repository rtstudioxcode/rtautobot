// lib/syncServices.js
import { getServices } from './iplusviewAdapter.js';
import { Category } from '../models/Category.js';
import { Subcategory } from '../models/Subcategory.js';
import { Service } from '../models/Service.js';
import { ProviderSettings } from '../models/ProviderSettings.js';
import { applyRulesToOneService, applyAllPricingRules } from './pricing.js';
import { ChangeLog } from '../models/ChangeLog.js';

const pick = (o, ks, d) => {
  for (const k of ks) {
    if (o?.[k] !== undefined) return o[k];
  }
  return d;
};

const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

const toBool = (v) => {
  if (v === true || v === 1) return true;
  if (v === false || v === 0) return false;
  const s = String(v ?? '').toLowerCase();
  if (['1', 'true', 'yes', 'on', 'open', 'opened', 'enabled', 'active'].includes(s)) return true;
  if (['0', 'false', 'no', 'off', 'close', 'closed', 'disabled', 'inactive'].includes(s)) return false;
  return undefined;
};

const PLATFORM_MAP = [
  {
    key: 'premium',
    name: 'บัญชีพรีเมียม | คีย์',
    match: [
      'canva pro',
      'chatgpt business',
      'youtube premium',
      'license key',
      'ดาวน์โหลด ไฟล์ลิขสิทธิ์',
      'shutterstock',
      'envato',
      'adobestock',
      'istockphoto',
      'motion array',
    ],
  },
  {
    key: 'thailand',
    name: 'ประเทศไทย',
    match: [
      '🇹🇭',
      ' ประเทศไทย',
      ' บัญชีไทย',
      'thailand services',
      'tiktok 🎯 thailand',
      'youtube ► thailand',
      'รวมบริการยูทูป ประเทศไทย',
      'instagram ► รวมบริการไอจี ประเทศไทย',
      'facebook ► รวมบริการไทย',
      'facebook ► ถูกใจเพจ | ผู้ติดตาม [ เพจ/โปรไฟล์ ] 💎 [ บัญชีไทย ]',
      'facebook ► ไลค์โพส reactions',
      'facebook ► แชร์โพส 🔗 บัญชีไทย',
      'facebook ► คอมเม้นท์ 💬 บัญชีไทย',
      'facebook 📝 รีวิวแฟนเพจ,แนะนำเพจ บัญชีไทย',
      'x.com | twitter services ► รวมบริการประเทศไทย',
      'shopee / lazada services ► บัญชีไทย',
      'ส่วนเสริม ไลฟ์สด shopee.co.th',
      'spotify ► thailand',
    ],
  },
  {
    key: 'traffic',
    name: 'เพิ่มคนเข้าเว็บ',
    match: [
      '➖➖➖➖➖➖➖➖➖🔻 𝐖𝐞𝐛𝐬𝐢𝐭𝐞 𝐓𝐫𝐚𝐟𝐟𝐢𝐜 + 𝐒𝐄𝐎 🔻➖➖➖➖➖➖➖➖➖',
      'เพิ่มทราฟฟิคเข้าเว็บไซต์',
      'website traffic',
      'mobile traffic',
      'premium traffic',
      'pop-under traffic',
      'worldwide',
      'exchange platforms (ptc)',
      'แหล่งอ้างอิง เลือกประเทศ',
      'choose geo',
      'website 💎 premium traffic packages',
      'website traffic 🇹🇭 ประเทศไทย',
      'backlinks & website seo',
      'seo package ranking',
      'social signals',
      'best google ranking',
      'search console',
      ' seo',
    ],
  },

  { key: 'tiktok', name: 'TikTok', match: ['➖➖➖➖➖➖➖➖➖🔻 𝐓𝐢𝐤𝐓𝐨𝐤 🔻➖➖➖➖➖➖➖➖➖', 'tiktok'] },
  { key: 'facebook', name: 'Facebook', match: ['➖➖➖➖➖➖➖➖➖🔻 รวมบริการ 𝐅𝐚𝐜𝐞𝐛𝐨𝐨𝐤 🔻➖➖➖➖➖➖➖➖➖', 'facebook'] },
  { key: 'instagram', name: 'Instagram', match: ['➖➖➖➖➖➖➖➖➖🔻 𝐈𝐧𝐬𝐭𝐚𝐠𝐫𝐚𝐦 / 𝐓𝐡𝐫𝐞𝐚𝐝𝐬 🔻➖➖➖➖➖➖➖➖➖', 'instagram'] },
  { key: 'youtube', name: 'YouTube', match: ['➖➖➖➖➖🔻𝐘𝐨𝐮𝐭𝐮𝐛𝐞🔻➖➖➖➖➖', 'youtube', 'yt '] },
  { key: 'threads', name: 'Threads', match: ['threads'] },
  { key: 'twitter', name: 'X (Twitter)', match: ['➖➖➖➖➖➖➖➖➖🔻 𝐗.𝐜𝐨𝐦 | 𝐓𝐰𝐢𝐭𝐭𝐞𝐫 🔻➖➖➖➖➖➖➖➖➖', 'x (twitter)', 'twitter', 'tw '] },
  { key: 'line', name: 'Line Official', match: ['➖➖➖➖➖➖➖➖➖🔻 𝐋𝐢𝐧𝐞 𝐎𝐟𝐟𝐢𝐜𝐢𝐚𝐥 🔻➖➖➖➖➖➖➖➖➖', 'Line Official Account ', 'Line OpenChat', 'Line Voom '] },
  { key: 'telegram', name: 'Telegram', match: ['➖➖➖➖➖➖➖➖➖🔻 𝐓𝐞𝐥𝐞𝐠𝐫𝐚𝐦 🔻➖➖➖➖➖➖➖➖➖', 'telegram'] },
  { key: 'discord', name: 'Discord', match: ['➖➖➖➖➖➖➖➖➖🔻 𝐃𝐢𝐬𝐜𝐨𝐫𝐝 🔻➖➖➖➖➖➖➖➖➖', 'discord'] },
  { key: 'twitch', name: 'Twitch', match: ['➖➖➖➖➖➖➖➖➖🔻 𝐓𝐰𝐢𝐭𝐜𝐡 🔻➖➖➖➖➖➖➖➖➖', 'twitch'] },
  { key: 'spotify', name: 'Spotify', match: ['➖➖➖➖➖➖➖➖➖🔻 𝐒𝐩𝐨𝐭𝐢𝐟𝐲 🔻➖➖➖➖➖➖➖➖➖', 'spotify'] },
  { key: 'kick', name: 'Kick', match: ['➖➖➖➖➖➖➖➖➖🔻 𝐊𝐢𝐜𝐤.𝐜𝐨𝐦 🔻➖➖➖➖➖➖➖➖➖', 'Kick.com'] },
  { key: 'shopee', name: 'ไลฟ์สด Shopee', match: ['➖➖➖➖➖➖➖➖➖🔻 𝐒𝐡𝐨𝐩𝐞𝐞 🔻➖➖➖➖➖➖➖➖➖', 'shopee', 'shp '] },
  { key: 'other', name: 'อื่นๆ', match: [] },
];

function detectPlatformAndType(service) {
  const name = service?.name || '';
  const desc = service?.description || service?.details || '';
  const raw = `${name} ${desc}`.toLowerCase();

  let platform = PLATFORM_MAP.find((p) =>
    p.match.some((m) => raw.includes(m.toLowerCase()))
  );
  if (!platform) platform = PLATFORM_MAP.find((p) => p.key === 'other');

  let typeName = 'อื่นๆ';
  if (raw.includes('follow')) typeName = 'Followers';
  else if (raw.includes('subscr')) typeName = 'Subscribers';
  else if (raw.includes('like')) typeName = 'Likes';
  else if (raw.includes('view')) typeName = 'Views';
  else if (raw.includes('comment')) typeName = 'Comments';
  else if (raw.includes('share')) typeName = 'Shares';
  else if (raw.includes('member')) typeName = 'Members';
  else if (raw.includes('traffic')) typeName = 'Website Traffic';
  else if (raw.includes('vote')) typeName = 'Votes';

  return {
    platform,
    type: {
      key: typeName.toLowerCase().replace(/\s+/g, '-'),
      name: typeName,
    },
  };
}

function inferStatus({ raw, mapped, prev }) {
  const maybe =
    toBool(raw?.status) ??
    toBool(raw?.state) ??
    toBool(raw?.enabled) ??
    toBool(raw?.is_active) ??
    toBool(raw?.available);

  if (maybe !== undefined) return maybe ? 'open' : 'close';
  if (Number.isFinite(mapped?.rate) && mapped.rate <= 0) return 'close';
  if (prev && (prev.disabled || prev.hidden)) return 'close';
  return 'open';
}

async function upsertCategory(platform) {
  const slug = platform.key;
  return Category.findOneAndUpdate(
    { slug },
    { $set: { name: platform.name, slug } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function upsertSubcategory(categoryId, type) {
  const slug = type.key;
  return Subcategory.findOneAndUpdate(
    { category: categoryId, slug },
    { $set: { category: categoryId, name: type.name, slug } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

function toIdString(v) {
  return v ? String(v) : '';
}

function normalizeServiceForCompare(doc = {}) {
  return {
    providerServiceId: String(doc.providerServiceId || ''),
    category: toIdString(doc.category),
    subcategory: toIdString(doc.subcategory),
    name: String(doc.name || ''),
    description: String(doc.description || ''),
    currency: String(doc.currency || 'THB'),
    rate: Number(doc.rate || 0),
    min: Number(doc.min || 0),
    max: Number(doc.max || 0),
    step: Number(doc.step || 1),
    type: String(doc.type || 'default'),
    dripfeed: !!doc.dripfeed,
    refill: !!doc.refill,
    cancel: !!doc.cancel,
    average_delivery: String(doc.average_delivery || ''),
    disabled: !!doc.disabled,
    hidden: !!doc.hidden,
  };
}

function diffService(prevNorm, nextNorm) {
  const changedFields = [];
  const keys = Object.keys(nextNorm);

  for (const key of keys) {
    if (prevNorm?.[key] !== nextNorm?.[key]) {
      changedFields.push(key);
    }
  }

  return changedFields;
}

async function lockProviderSync() {
  const ps = (await ProviderSettings.findOne()) || new ProviderSettings();

  if (ps.syncInProgress) {
    return null;
  }

  ps.syncInProgress = true;
  ps.syncStartedAt = new Date();
  await ps.save();

  return ps;
}

async function unlockProviderSync(meta = {}) {
  const ps = (await ProviderSettings.findOne()) || new ProviderSettings();
  ps.syncInProgress = false;
  ps.syncStartedAt = null;
  if (meta.lastSyncAt) ps.lastSyncAt = meta.lastSyncAt;
  if (meta.lastSyncResult) ps.lastSyncResult = meta.lastSyncResult;
  await ps.save();
}

export async function syncServicesFromProvider({ runId } = {}) {
  runId = runId || `sync_${Date.now()}`;

  const locked = await lockProviderSync();
  if (!locked) {
    return { ok: false, message: 'sync is running, try again later' };
  }

  const startedAt = Date.now();

  try {
    const rawList = await getServices();

    if (!Array.isArray(rawList)) {
      throw new Error('Provider returned non-array for services');
    }

    if (rawList.length === 0) {
      throw new Error('Provider returned EMPTY services (abort sync)');
    }

    const prevList = await Service.find({}, {
      providerServiceId: 1,
      category: 1,
      subcategory: 1,
      name: 1,
      description: 1,
      currency: 1,
      rate: 1,
      min: 1,
      max: 1,
      step: 1,
      type: 1,
      dripfeed: 1,
      refill: 1,
      cancel: 1,
      average_delivery: 1,
      disabled: 1,
      hidden: 1,
    }).lean();

    const prevMap = new Map(prevList.map(d => [String(d.providerServiceId), d]));
    const apiIds = new Set();

    const platformCache = new Map();
    const typeCache = new Map();

    const ops = [];
    const touchedIds = [];
    const changeLogs = [];

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const s of rawList) {
      const providerId = String(
        pick(s, ['id', 'service_id', 'sid', 'service'], '')
      ).trim();

      if (!providerId) {
        skipped++;
        continue;
      }

      apiIds.add(providerId);

      const { platform, type } = detectPlatformAndType(s);

      let plat = platformCache.get(platform.name);
      if (!plat) {
        plat = await upsertCategory(platform);
        platformCache.set(platform.name, plat);
      }

      const typeKey = `${plat._id}::${type.name}`;
      let sub = typeCache.get(typeKey);
      if (!sub) {
        sub = await upsertSubcategory(plat._id, type);
        typeCache.set(typeKey, sub);
      }

      const mapped = {
        providerServiceId: providerId,
        category: plat._id,
        subcategory: sub._id,
        name: pick(s, ['name','title','service_name'], `Service #${providerId}`),
        description: pick(s, ['description','desc','details'], ''),
        currency: pick(s, ['currency'], 'THB'),
        rate: toNum(pick(s, ['rate','price'], 0)),
        min: toNum(pick(s, ['min'], 0)),
        max: toNum(pick(s, ['max'], 0)),
        step: toNum(pick(s, ['step'], 1)),
        type: pick(s, ['type'], 'default'),
        dripfeed: !!pick(s, ['dripfeed'], false),
        refill: !!pick(s, ['refill'], false),
        cancel: !!pick(s, ['cancel'], false),
        average_delivery: pick(s, ['average_delivery'], ''),
        details: s
      };

      const prev = prevMap.get(providerId) || null;
      const status = inferStatus({ raw: s, mapped, prev });

      const nextDoc = {
        ...mapped,
        disabled: status === 'close',
        hidden: status === 'close',
      };

      const prevNorm = prev ? normalizeServiceForCompare(prev) : null;
      const nextNorm = normalizeServiceForCompare(nextDoc);
      const changedFields = diffService(prevNorm || {}, nextNorm);

      // 🔥 SMART LOG (เฉพาะ change จริง)
      if (!prev) {
        changeLogs.push({
          runId,
          ts: new Date(),
          target: 'service',
          diff: 'new',
          providerServiceId: providerId,
          serviceName: nextDoc.name,
          changedFields: Object.keys(nextNorm)
        });
      } else if (changedFields.length > 0) {
        changeLogs.push({
          runId,
          ts: new Date(),
          target: 'service',
          diff: 'updated',
          providerServiceId: providerId,
          serviceName: nextDoc.name,
          changedFields
        });
      }

      ops.push({
        updateOne: {
          filter: { providerServiceId: providerId },
          update: { $set: nextDoc },
          upsert: true,
        }
      });

      touchedIds.push(providerId);
    }

    const bulkRes = await Service.bulkWrite(ops, { ordered: false });

    created = bulkRes.upsertedCount || 0;
    updated = bulkRes.modifiedCount || 0;

    // 🔥 DELETE DIFF
    const staleDocs = prevList.filter(d => !apiIds.has(String(d.providerServiceId)));

    if (staleDocs.length) {
      await Service.deleteMany({
        providerServiceId: { $in: staleDocs.map(d => String(d.providerServiceId)) }
      });

      for (const prev of staleDocs) {
        changeLogs.push({
          runId,
          ts: new Date(),
          target: 'service',
          diff: 'removed',
          providerServiceId: String(prev.providerServiceId),
          serviceName: prev.name || `Service #${prev.providerServiceId}`,
          changedFields: ['removed']
        });
      }
    }

    // 🔥 SUMMARY LOG (โคตรสำคัญ)
    changeLogs.push({
      runId,
      ts: new Date(),
      target: 'summary',
      diff: 'summary',
      total: apiIds.size,
      created,
      updated,
      removed: staleDocs.length,
      skipped,
      changes: changeLogs.length
    });

    if (changeLogs.length) {
      await ChangeLog.insertMany(changeLogs, { ordered: false });
    }

    // 🔥 APPLY RULES (ฉลาด)
    if (apiIds.size <= 500) {
      const ids = (
        await Service.find(
          { providerServiceId: { $in: touchedIds } },
          { _id: 1 }
        ).lean()
      ).map(d => d._id);

      for (const id of ids) {
        await applyRulesToOneService(id);
      }
    } else {
      await applyAllPricingRules();
    }

    const result = {
      ok: true,
      count: apiIds.size,
      created,
      updated,
      removed: staleDocs.length,
      skipped,
      logs: changeLogs.length,
      durationMs: Date.now() - startedAt,
    };

    await unlockProviderSync({
      lastSyncAt: new Date(),
      lastSyncResult: result,
    });

    return result;

  } catch (err) {
    await unlockProviderSync({
      lastSyncAt: new Date(),
      lastSyncResult: {
        ok: false,
        error: err.message
      }
    });

    return { ok: false, error: err.message };
  }
}