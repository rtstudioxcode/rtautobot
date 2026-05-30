// src/middleware/botBlocker.js
import crypto from "crypto";
import { config } from "../config.js";
import { BotBlockLog } from "../models/BotBlockLog.js";
import { lookupIpGeo, cleanIp } from "../lib/ipGeo.js";
import { BotBlockedIp } from "../models/BotBlockedIp.js";

// =====================================================
// 🔥 GLOBAL LOG CONTROL
// อ่านจาก secure_config.botBlock.logEnabled
// =====================================================
function isGlobalLogEnabled() {
  return config?.botBlock?.logEnabled === true;
}

function logWarn(...args) {
  if (!isGlobalLogEnabled()) return;
  console.warn(...args);
}

function logError(...args) {
  if (!isGlobalLogEnabled()) return;
  console.error(...args);
}

function safeDecodePath(path = "") {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

function normalizePath(path = "") {
  return String(path || "")
    .replace(/\\/g, "/")
    .replace(/\/{2,}/g, "/");
}

function getClientIp(req) {
  return cleanIp(
    req.headers["cf-connecting-ip"] ||
      req.headers["x-real-ip"] ||
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      req.ip ||
      "-"
  );
}

function cut(v, max = 1000) {
  if (v == null) return "";
  const s = String(v);
  return s.length > max ? s.slice(0, max) : s;
}

function makeFingerprint({ ip, method, path, rule, userAgent }) {
  return crypto
    .createHash("sha1")
    .update([ip, method, path, rule, userAgent].join("|"))
    .digest("hex");
}

function getBucketDate() {
  const windowMs = Math.max(
    60_000,
    Number(config?.botBlock?.aggWindowMs ?? 5 * 60 * 1000)
  );

  return new Date(Math.floor(Date.now() / windowMs) * windowMs);
}

const recentConsoleLog = new Map();

function shouldConsoleLog(key) {
  // ถ้าปิด log ไม่ต้องเสียเวลาทำ sampling
  if (!isGlobalLogEnabled()) return false;

  const ttl = Math.max(
    1_000,
    Number(config?.botBlock?.consoleSampleMs ?? 30_000)
  );

  const now = Date.now();
  const last = recentConsoleLog.get(key) || 0;

  if (now - last < ttl) return false;

  recentConsoleLog.set(key, now);

  if (recentConsoleLog.size > 5000) {
    for (const [k, t] of recentConsoleLog.entries()) {
      if (now - t > ttl * 3) recentConsoleLog.delete(k);
    }
  }

  return true;
}

const bannedIpCache = new Map();

/**
 * ใน secure_config ที่โทนี่ให้มา ยังไม่มี botBlock.enabled
 * ดังนั้น default = เปิดใช้งาน
 * ถ้าอนาคตอยากปิดทั้ง middleware ให้เพิ่ม:
 * "botBlock": { "enabled": false }
 */
function isBotBlockEnabled() {
  return config?.botBlock?.enabled !== false;
}

function isIpBanEnabled() {
  return config?.botBlock?.ipBanEnabled === true;
}

function getBanCacheMs() {
  return Math.max(
    30_000,
    Number(config?.botBlock?.ipBanCacheMs ?? 300_000)
  );
}

function getBanStatus() {
  return Number(config?.botBlock?.banStatus ?? 403);
}

function getBlockAction(options = {}) {
  return String(options.action || config?.botBlock?.action || "404");
}

function setIpCache(ip, blocked, doc = null) {
  bannedIpCache.set(ip, {
    blocked,
    doc,
    expiresAt: Date.now() + getBanCacheMs(),
  });

  if (bannedIpCache.size > 5000) {
    const now = Date.now();

    for (const [key, val] of bannedIpCache.entries()) {
      if (!val?.expiresAt || val.expiresAt < now) {
        bannedIpCache.delete(key);
      }
    }
  }
}

async function isIpPermanentlyBlocked(ip) {
  if (!isIpBanEnabled()) {
    return {
      blocked: false,
      doc: null,
    };
  }

  const cached = bannedIpCache.get(ip);

  if (cached && cached.expiresAt > Date.now()) {
    return {
      blocked: cached.blocked,
      doc: cached.doc,
    };
  }

  const doc = await BotBlockedIp.findOne({
    ip,
    status: "active",
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } },
    ],
  })
    .select("_id ip status reason rule expiresAt")
    .lean();

  const blocked = !!doc;
  setIpCache(ip, blocked, doc || null);

  return {
    blocked,
    doc: doc || null,
  };
}

function touchBlockedIpAsync(ip) {
  if (!isIpBanEnabled()) return;

  setImmediate(() => {
    BotBlockedIp.updateOne(
      {
        ip,
        status: "active",
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: null },
          { expiresAt: { $gt: new Date() } },
        ],
      },
      {
        $inc: {
          totalBlockedHits: 1,
        },
        $set: {
          lastHitAt: new Date(),
        },
      }
    ).catch((err) => {
      logWarn("[BOT BLOCKED IP TOUCH FAILED]", err?.message || err);
    });
  });
}

async function autoBanIpIfNeeded(logDoc) {
  if (!isIpBanEnabled()) return;

  const threshold = Math.max(
    1,
    Number(config?.botBlock?.ipBanThreshold ?? 2)
  );

  const windowMs = Math.max(
    60_000,
    Number(config?.botBlock?.ipBanWindowMs ?? 86400000)
  );

  const since = new Date(Date.now() - windowMs);

  const agg = await BotBlockLog.aggregate([
    {
      $match: {
        ip: logDoc.ip,
        lastSeenAt: {
          $gte: since,
        },
      },
    },
    {
      $group: {
        _id: "$ip",
        totalHits: {
          $sum: "$count",
        },
      },
    },
  ]);

  const totalHits = Number(agg?.[0]?.totalHits || 0);

  if (totalHits < threshold) return;

  const banDays = Math.max(1, Number(config?.botBlock?.ipBanDays ?? 1));
  const expiresAt = new Date(Date.now() + banDays * 24 * 60 * 60 * 1000);

  const geo = await lookupIpGeo(logDoc.ip).catch(() => null);

  await BotBlockedIp.updateOne(
    {
      ip: logDoc.ip,
    },
    {
      $setOnInsert: {
        ip: logDoc.ip,
        bannedAt: new Date(),
      },
      $set: {
        status: "active",
        reason: "bot_scanner_threshold",
        rule: logDoc.rule || "",
        samplePath: logDoc.originalUrl || logDoc.path || "",
        sampleUserAgent: logDoc.userAgent || "",
        hitCountAtBan: totalHits,
        lastHitAt: new Date(),
        expiresAt,
        ...(geo ? { geo } : {}),
      },
    },
    {
      upsert: true,
    }
  );

  setIpCache(logDoc.ip, true, {
    ip: logDoc.ip,
    status: "active",
    reason: "bot_scanner_threshold",
    rule: logDoc.rule || "",
    expiresAt,
  });

  logWarn(
    `[🚫 IP BANNED] ${logDoc.ip} | hits=${totalHits} | days=${banDays} | rule=${logDoc.rule}`
  );
}


async function saveLightweightBlockAsync(logDoc) {
  if (!isIpBanEnabled()) return;

  const threshold = Math.max(1, Number(config?.botBlock?.ipBanThreshold ?? 2));
  const banDays = Math.max(1, Number(config?.botBlock?.ipBanDays ?? 1));
  const expiresAt = new Date(Date.now() + banDays * 24 * 60 * 60 * 1000);

  // Cost guard: when detailed bot logs are disabled, avoid writing/aggregating
  // bot_block_logs for every scanner hit. Keep only a tiny per-IP counter in
  // bot_blocked_ips and activate the ban once the configured threshold is hit.
  const res = await BotBlockedIp.findOneAndUpdate(
    { ip: logDoc.ip },
    {
      $setOnInsert: {
        ip: logDoc.ip,
        bannedAt: new Date(),
        status: 'watching',
      },
      $inc: { totalBlockedHits: 1 },
      $set: {
        rule: logDoc.rule || '',
        samplePath: logDoc.originalUrl || logDoc.path || '',
        sampleUserAgent: logDoc.userAgent || '',
        lastHitAt: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).select('ip status totalBlockedHits expiresAt rule').lean();

  const hits = Number(res?.totalBlockedHits || 0);
  if (hits >= threshold && res?.status !== 'active') {
    await BotBlockedIp.updateOne(
      { ip: logDoc.ip },
      {
        $set: {
          status: 'active',
          reason: 'bot_scanner_threshold_lightweight',
          hitCountAtBan: hits,
          expiresAt,
          lastHitAt: new Date(),
        },
      }
    );
    setIpCache(logDoc.ip, true, {
      ip: logDoc.ip,
      status: 'active',
      reason: 'bot_scanner_threshold_lightweight',
      rule: logDoc.rule || '',
      expiresAt,
    });
  }
}

async function saveBlockLogAsync(logDoc) {
  const now = new Date();
  const bucketAt = getBucketDate();

  const fingerprint = makeFingerprint({
    ip: logDoc.ip,
    method: logDoc.method,
    path: logDoc.originalUrl || logDoc.path,
    rule: logDoc.rule,
    userAgent: logDoc.userAgent,
  });

  const filter = {
    fingerprint,
    createdAt: bucketAt,
  };

  const insertOnly = {
    fingerprint,
    createdAt: bucketAt,
    firstSeenAt: now,

    ip: logDoc.ip,
    method: logDoc.method,
    userAgent: logDoc.userAgent,
    referer: logDoc.referer,
    host: logDoc.host,
    protocol: logDoc.protocol,
    rule: logDoc.rule,
    action: logDoc.action,
  };

  const alwaysUpdate = {
    lastSeenAt: now,

    originalUrl: logDoc.originalUrl,
    path: logDoc.path,
    decodedPath: logDoc.decodedPath,
    query: logDoc.query,

    cfRay: logDoc.cfRay,
    country: logDoc.country,
  };

  const update = {
    $setOnInsert: insertOnly,
    $set: alwaysUpdate,
    $inc: {
      count: 1,
    },
  };

  const saved = await BotBlockLog.findOneAndUpdate(filter, update, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
  }).lean();

  const geoipEnabled = config?.botBlock?.geoipEnabled !== false;

  if (saved?._id && geoipEnabled && (!saved.geo || !saved.geo.status)) {
    try {
      const geo = await lookupIpGeo(logDoc.ip);

      await BotBlockLog.updateOne(
        {
          _id: saved._id,
        },
        {
          $set: {
            geo,
            country: geo.countryCode || logDoc.country || "",
          },
        }
      );
    } catch (err) {
      logWarn("[BOT GEOIP FAILED]", err?.message || err);
    }
  }

  await autoBanIpIfNeeded(logDoc);
}

const BOT_SCANNER_RULES = [
  // =====================================================
  // WordPress / CMS scanner
  // =====================================================
  { name: "wordpress_wp_path", rx: /\/wp-/i },
  { name: "wordpress_xmlrpc", rx: /\/xmlrpc\.php$/i },
  { name: "wordpress_login", rx: /\/wp-login\.php$/i },
  { name: "wordpress_admin", rx: /\/wp-admin/i },

  // WordPress WLW Manifest scanner
  { name: "wp_wlwmanifest_root", rx: /^\/wp-includes\/wlwmanifest\.xml$/i },
  { name: "wp_wlwmanifest_any_prefix", rx: /^\/[^?#]*\/wp-includes\/wlwmanifest\.xml$/i },
  { name: "wp_wlwmanifest_common_paths", rx: /^\/(web|wordpress|website|news|2018|2019|shop|wp1|test|media|wp2|site|cms|sito)\/wp-includes\/wlwmanifest\.xml$/i },

  // =====================================================
  // PHP probe
  // =====================================================
  { name: "phpinfo", rx: /\/phpinfo\.php$/i },
  { name: "info_php", rx: /\/info\.php$/i },
  { name: "php_php", rx: /\/php\.php$/i },
  { name: "test_php", rx: /\/test\.php$/i },
  { name: "debug_php", rx: /\/debug\.php$/i },
  { name: "status_php", rx: /\/status\.php$/i },
  { name: "probe_php", rx: /\/probe\.php$/i },
  { name: "i_php", rx: /\/i\.php$/i },
  { name: "php_test", rx: /\/php-test\.php$/i },
  { name: "phpversion", rx: /\/phpversion\.php$/i },
  { name: "phtest", rx: /\/phtest\.php$/i },
  { name: "admin_phpinfo", rx: /\/admin\/phpinfo\.php$/i },
  { name: "test_phpinfo", rx: /\/test\/phpinfo\.php$/i },
  { name: "backup_phpinfo", rx: /\/\.backup\/phpinfo\.php$/i },
  { name: "backup_phpinfo_plain", rx: /\/_backup\/phpinfo\.php$/i },
  { name: "inc_phpinfo", rx: /\/_inc\/phpinfo\.php$/i },

  // =====================================================
  // Env files / secret files
  // =====================================================
  { name: "env_root", rx: /\/\.env$/i },
  { name: "env_any_suffix", rx: /\/\.env\.[a-z0-9_.-]+$/i },
  { name: "env_common", rx: /\/\.env\.(aws|dev|development|dist|example|local|local\.php|prod|production|staging|test|testing)$/i },
  { name: "env_in_folder", rx: /\/(backend|\.backup|backup|\.docker|docker|api|app|server|src|config|shop|srv|stage|staging|stg|test|user|web|website|var\/www|var\/www\/html|v[0-9]+)\/\.env$/i },
  { name: "environment_file", rx: /\/\.environment$/i },
  { name: "env_plain_route", rx: /^\/env$/i },
  { name: "passwd_probe", rx: /\/\.passwd-s3fs$/i },

  // =====================================================
  // AWS / Azure / Cloud / payment secrets
  // =====================================================
  { name: "aws_config", rx: /\/\.aws\/config$/i },
  { name: "aws_credentials", rx: /\/\.aws\/credentials$/i },
  { name: "azure_config", rx: /\/\.azure\/config$/i },
  { name: "boto_config", rx: /\/\.boto$/i },
  { name: "s3cfg", rx: /\/\.s3cfg$/i },
  { name: "stripe_files", rx: /\/\.stripe(?:\/|$)/i },
  { name: "stripe_root_files", rx: /\/stripe(?:[-_.]?(?:credentials|keys|config))?\.(?:json|env|ya?ml|js)$/i },
  { name: "stripe_webhook_payload", rx: /\/webhooks\/incoming\/stripe\.json$/i },
  { name: "gcloud_config", rx: /\/\.config\/gcloud/i },

  // =====================================================
  // Docker / container scanner
  // =====================================================
  { name: "docker_config", rx: /\/\.docker\/config\.json$/i },
  { name: "docker_secrets", rx: /\/\.docker\/secrets\.json$/i },
  { name: "docker_env", rx: /\/\.docker\/\.env$/i },
  { name: "dockerenv", rx: /\/\.dockerenv$/i },
  { name: "dockerignore", rx: /\/\.dockerignore$/i },
  { name: "dockerfile", rx: /\/Dockerfile$/i },
  { name: "docker_compose", rx: /\/(?:var\/task\/)?docker-compose\.ya?ml$/i },
  { name: "docker_socket", rx: /\/var\/run\/docker\.sock$/i },
  { name: "container_json", rx: /\/2375\/containers\/json$/i },

  // =====================================================
  // Git / repo leak
  // =====================================================
  { name: "git_leak", rx: /\/\.git(?:\/|$)/i },
  { name: "git_sensitive_files", rx: /\/\.git\/(config|config\.bak|config\.old|config~|description|fetch_head|head|index|packed-refs|orig_head|commit_editmsg)$/i },
  { name: "git_hooks", rx: /\/\.git\/hooks(?:\/(post-commit|pre-commit))?$/i },
  { name: "git_info", rx: /\/\.git\/info(?:\/exclude)?$/i },
  { name: "git_logs", rx: /\/\.git\/logs(?:\/head|\/refs\/heads\/(main|master))?$/i },
  { name: "git_objects", rx: /\/\.git\/objects(?:\/info|\/pack)?$/i },
  { name: "git_refs", rx: /\/\.git\/refs\/(heads\/(main|master)|remotes\/origin\/head)$/i },
  { name: "git_credentials", rx: /\/\.(git-askpass\.sh|git-credentials|git-secret|gitattributes|gitignore|gitmodules)$/i },

  // GitHub / GitLab CI leaks
  { name: "github_files", rx: /\/\.github(?:\/|$)/i },
  { name: "github_sensitive", rx: /\/\.github\/(codeowners|dependabot\.yml|funding\.yml|issue_template|pull_request_template\.md|stale\.yml)$/i },
  { name: "github_workflows", rx: /\/\.github\/workflows(?:\/(ci|main)\.yml)?$/i },
  { name: "gitlab_files", rx: /\/\.gitlab(?:\/|$)/i },
  { name: "gitlab_templates", rx: /\/\.gitlab\/(issue_templates|merge_request_templates)$/i },
  { name: "gitlab_ci", rx: /\/\.gitlab-ci(?:\.yml)?$/i },

  // SVN / HG
  { name: "svn_leak", rx: /\/\.svn(?:\/|$)/i },
  { name: "svn_entries", rx: /\/\.svn\/entries$/i },
  { name: "hg_leak", rx: /\/\.hg(?:\/|$)/i },

  // =====================================================
  // Next.js / Vercel scanner
  // หมายเหตุ: โปรเจกต์ Express/EJS ไม่ควรมี .next ให้ public เข้าถึง
  // =====================================================
  { name: "next_root", rx: /\/\.next(?:\/|$)/i },
  { name: "next_manifests", rx: /\/\.next\/(build-manifest|prerender-manifest|routes-manifest|react-loadable-manifest)\.json$/i },
  { name: "next_build_id", rx: /\/\.next\/build_id$/i },
  { name: "next_server", rx: /\/\.next\/server(?:\/|$)/i },
  { name: "next_server_manifests", rx: /\/\.next\/server\/(app-paths-manifest|middleware-manifest|next-font-manifest|pages-manifest|server-reference-manifest|interception-route-manifest)\.json$/i },
  { name: "next_server_app", rx: /\/\.next\/server\/app(?:\/|$)/i },
  { name: "next_server_pages", rx: /\/\.next\/server\/pages(?:\/|$)/i },
  { name: "next_server_edge", rx: /\/\.next\/server\/edge-(chunks|runtime-webpack\.js|runtime\.js)/i },
  { name: "next_static", rx: /\/\.next\/static(?:\/|$)/i },
  { name: "next_static_chunks", rx: /\/\.next\/static\/chunks(?:\/|$)/i },
  { name: "next_static_css", rx: /\/\.next\/static\/css(?:\/|$)/i },
  { name: "next_static_build_id", rx: /\/\.next\/static\/build_id$/i },
  { name: "next_data", rx: /\/\.next\/data(?:\/|$)/i },
  { name: "next_data_build_id", rx: /\/\.next\/data\/build_id(?:\/|\[|$)/i },
  { name: "next_dev_probe", rx: /\/\.next\/(cache|debug|env|image|inspector|logs|development|flight|flight-router-state)(?:\/|$)/i },
  { name: "nextjs_internal", rx: /\/__nextjs_(action|error-overlay|launch-editor|original-stack-frame|stack-frame)(?:\/|$)/i },
  { name: "nextjs_action_plain", rx: /\/__nextjs_action(?:\/|$)/i },

  // Vercel output scanner
  { name: "vercel_output", rx: /\/\.vercel\/output(?:\/|$)/i },
  { name: "vercel_output_config", rx: /\/\.vercel\/output\/config\.json$/i },
  { name: "vercel_output_functions", rx: /\/\.vercel\/output\/functions(?:\/|$)/i },
  { name: "vercel_output_static", rx: /\/\.vercel\/output\/static(?:\/|$)/i },

  // =====================================================
  // CI / config / IaC scanner
  // =====================================================
  { name: "circleci_config", rx: /\/\.circleci\/config\.yml$/i },
  { name: "cache_probe", rx: /\/\.cache(?:\/|$)/i },
  { name: "firebase_config", rx: /\/\.firebaserc$/i },
  { name: "kube_config", rx: /\/\.kube\/config$/i },
  { name: "terraform_lock", rx: /\/\.terraform\.lock\.hcl$/i },
  { name: "terraform_state", rx: /\/(?:\.terraform\.tfstate|terraform\.tfstate(?:\.backup)?|terraform\.tfvars)$/i },
  { name: "terraform_credentials", rx: /\/\.terraform\/credentials\.tfrc\.json$/i },
  { name: "terraform_tfvars_json", rx: /\/terraform\/terraform\.tfvars\.json$/i },

  // =====================================================
  // .well-known probes ที่มักใช้เช็ค config/secret ของระบบอื่น
  // =====================================================
  { name: "well_known_acme", rx: /\/\.well-known\/acme-challenge(?:\/|$)/i },
  { name: "well_known_jwks", rx: /\/\.well-known\/jwks\.json$/i },
  { name: "well_known_stripe", rx: /\/\.well-known\/stripe(?:\.txt|\/)?$/i },

  // =====================================================
  // Common config leaks
  // =====================================================
  { name: "config_json", rx: /\/config\.json$/i },
  { name: "config_env_json", rx: /\/config\/(?:dev|development|prod|production|staging|test)\.json$/i },
  { name: "config_php", rx: /\/config\.php$/i },
  { name: "config_yml", rx: /\/config\.ya?ml$/i },
  { name: "database_yml", rx: /\/database\.yml$/i },
  { name: "settings_py", rx: /\/settings\.py$/i },
  { name: "local_config", rx: /\/(local|app|application|database|settings|secrets|credentials)\.(json|ya?ml|php|py|ini|conf)$/i },
  { name: "wp_mail_smtp_ini", rx: /\/wp_mail_smtp\.ini$/i },
  { name: "config_backup_files", rx: /\/(config|settings)\.php\.(?:bak|old|save|swp|tmp|backup)$/i },
  { name: "application_properties", rx: /\/application(?:[-_.](?:dev|development|prod|production|staging|test))?\.properties$/i },
  { name: "dotnet_appsettings", rx: /\/(?:appsettings(?:\.[a-z0-9_-]+)?|local\.settings)\.json$/i },
  { name: "web_config", rx: /\/web\.config$/i },
  { name: "python_settings", rx: /\/(?:local_settings|settings\/(?:dev|development|prod|production|staging|test))\.py$/i },
  { name: "node_source_config_leak", rx: /\/(?:src|web|staging)\/(?:app|env|constants?|FileUpload)\.(?:js|ts)$/i },
  { name: "node_source_config_folder_leak", rx: /\/(?:src|web|staging)\/config\/(?:common|constants?|config|environment|stripe)\.(?:js|ts|json)$/i },
  { name: "staging_root_config_js", rx: /\/staging\/config\.js$/i },
  { name: "service_account_files", rx: /\/(?:serviceAccountKey|service-account|firebase-adminsdk|credentials|secrets)\.json$/i },
  { name: "package_manager_secret_files", rx: /\/(?:\.npmrc|\.yarnrc(?:\.yml)?|\.pypirc|composer\.json)$/i },
  { name: "ci_pipeline_files", rx: /\/(?:Jenkinsfile|bitbucket-pipelines\.yml)$/i },
  { name: "frontend_build_config", rx: /\/(?:next|nuxt|vite)\.config\.(?:js|mjs|ts)$/i },
  { name: "deploy_config_files", rx: /\/(?:amplify|serverless)\.ya?ml$|\/serverless\.json$|\/netlify\.toml$|\/vercel\.json$|\/template\.ya?ml$/i },
  { name: "var_task_deploy_artifacts", rx: /\/var\/task\/(?:amplify\.ya?ml|netlify\.toml|package\.json|vercel\.json|serverless\.(?:json|ya?ml)|(?:next|nuxt)\.config\.(?:js|mjs|ts))$/i },
  { name: "var_task_function_source", rx: /\/var\/task\/amplify\/backend\/function\/[^/]+\/src\/index\.js$/i },

  // =====================================================
  // Backup / dump
  // =====================================================
  { name: "sql_dump", rx: /\/.*\.(sql|sqlite|db)$/i },
  { name: "backup_archive", rx: /\/.*backup.*\.(zip|tar|gz|tgz|rar|7z|sql)$/i },
  { name: "dump_archive", rx: /\/.*dump.*\.(zip|tar|gz|tgz|rar|7z|sql)$/i },
  { name: "website_archive", rx: /\/.*website.*\.(zip|tar|gz|tgz|rar|7z)$/i },
  { name: "website_backup_zip", rx: /\/website-backup\.zip$/i },
  { name: "weird_backup_zip", rx: /\/weird-backup\.zip$/i },
  { name: "backup_folder", rx: /\/(\.backup|backup|backups|bak)(?:\/|$)/i },

  // =====================================================
  // Laravel / Symfony / Rails / PHPUnit scanner
  // =====================================================
  { name: "storage_logs", rx: /\/storage\/logs/i },
  { name: "var_log", rx: /\/var\/log/i },
  { name: "common_log_files", rx: /\/(?:logs|log)\/(?:error|application|app|debug|access)\.log$/i },
  { name: "phpunit_vendor", rx: /\/vendor\/phpunit/i },
  { name: "laravel_debugbar", rx: /\/_debugbar(?:\/|$)/i },
  { name: "rails_master_key", rx: /\/config\/master\.key$/i },
  { name: "symfony_profiler", rx: /\/symfony\/_profiler\/phpinfo$/i },
  { name: "cgi_system_probe", rx: /\/(?:software\/[^?#]*|webmin\/package-updates\/update|sysinfo)\.cgi$/i },

  // =====================================================
  // Generic bot route probes from scanner logs
  // จับเฉพาะ path probe แปลก/มี wildcard literal ไม่บล็อก API จริงแบบ /v1/order
  // =====================================================
  { name: "literal_wildcard_route_probe", rx: /^\/(?:shop\/\[category\]|teams|threads|trpc|user|v[0-9]+|waku|webhook(?:-test|-waiting)?|workspaces)\/\*$/i },
  { name: "webhook_probe", rx: /^\/webhook(?:\/|$)/i },
  { name: "signup_probe", rx: /^\/signup$/i },
  { name: "test_route_probe", rx: /^\/test$/i },

  // =====================================================
  // Generic hidden sensitive dotfile scanner
  // กัน path แนว //.<anything> หลัง normalize แล้วจะกลายเป็น /.<anything>
  // =====================================================
  {
    name: "generic_hidden_sensitive_dotfile",
    rx: /\/\.(aws|azure|boto|cache|circleci|docker|dockerenv|dockerignore|env|environment|firebaserc|git|github|gitlab|gitignore|gitmodules|kube|next|passwd-s3fs|s3cfg|stripe|svn|terraform|vercel|npmrc|yarnrc|pypirc|gitconfig)(?:\/|\.|$)/i,
  },
];

export function botBlocker(options = {}) {
  const action = getBlockAction(options);

  return async function blockBotScanner(req, res, next) {
    if (!isBotBlockEnabled()) return next();

    const ip = getClientIp(req);

    // =====================================================
    // 🚫 STEP 1: ถ้า IP ถูกแบนถาวรแล้ว บล็อกทุกหน้า
    // =====================================================
    try {
      const banned = await isIpPermanentlyBlocked(ip);

      if (banned.blocked) {
        touchBlockedIpAsync(ip);

        if (action === "destroy") {
          return req.socket.destroy();
        }

        return res.status(getBanStatus()).type("text/plain").send("Forbidden");
      }
    } catch (err) {
      logWarn("[BOT IP BAN CHECK FAILED]", err?.message || err);
      // ถ้าเช็ค DB ไม่ได้ ให้ปล่อยต่อก่อน เพื่อไม่ให้เว็บหลักล่ม
    }

    // =====================================================
    // 🚫 STEP 2: เช็ค path อันตราย
    // เก็บทั้ง raw + decoded + normalized เพื่อจับเคส //path, encoded path,
    // และ path ที่ scanner พยายามหลบ regex ด้วย slash ซ้อน
    // =====================================================
    const rawPathBeforeNormalize = String(req.path || "");
    const originalUrlBeforeNormalize = String(req.originalUrl || rawPathBeforeNormalize);

    const rawPath = normalizePath(rawPathBeforeNormalize);
    const originalUrl = normalizePath(originalUrlBeforeNormalize || rawPath);
    const decodedPath = normalizePath(safeDecodePath(rawPathBeforeNormalize));
    const decodedOriginalUrl = normalizePath(safeDecodePath(originalUrlBeforeNormalize));

    const pathsToCheck = [
      rawPathBeforeNormalize,
      originalUrlBeforeNormalize,
      rawPath,
      originalUrl,
      decodedPath,
      decodedOriginalUrl,
    ].filter(Boolean);

    const matchedRule = BOT_SCANNER_RULES.find((rule) => {
      return pathsToCheck.some((pathValue) => {
        rule.rx.lastIndex = 0;
        return rule.rx.test(pathValue);
      });
    });

    if (!matchedRule) return next();

    const userAgent = cut(req.headers["user-agent"] || "-", 500);

    const responseStatus =
      action === "destroy"
        ? "destroy"
        : Number.isFinite(Number(action))
          ? Number(action)
          : 404;

    const logDoc = {
      ip: cut(ip, 120),
      method: cut(req.method, 20),

      path: cut(rawPath, 600),
      decodedPath: cut(decodedPath, 600),
      originalUrl: cut(originalUrl, 900),

      query: req.query || {},

      userAgent,
      referer: cut(req.headers.referer || req.headers.referrer || "", 500),
      host: cut(req.headers.host || "", 200),
      protocol: cut(req.headers["x-forwarded-proto"] || req.protocol || "", 30),

      cfRay: cut(req.headers["cf-ray"] || "", 120),
      country: cut(req.headers["cf-ipcountry"] || "", 20),

      rule: matchedRule.name,
      action: action === "destroy" ? "destroy" : String(responseStatus),
    };

    const consoleKey = `${ip}|${matchedRule.name}|${rawPath}`;

    if (shouldConsoleLog(consoleKey)) {
      logWarn(
        `[🚫 BOT BLOCK] ${ip} | ${req.method} ${originalUrl} | rule=${matchedRule.name}`
      );
    }

    setImmediate(() => {
      const task = isGlobalLogEnabled()
        ? saveBlockLogAsync(logDoc)
        : saveLightweightBlockAsync(logDoc);
      task.catch((err) => {
        logWarn("[BOT BLOCK SAVE FAILED]", err?.message || err);
      });
    });

    if (action === "destroy") {
      return req.socket.destroy();
    }

    return res.status(responseStatus).type("text/plain").send(
      responseStatus === 403 ? "Forbidden" : "Not Found"
    );
  };
}

export function clearIpCache(ip) {
  if (!ip) return;
  bannedIpCache.delete(String(ip).trim());
}