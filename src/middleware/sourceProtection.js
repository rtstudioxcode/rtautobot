// src/middleware/sourceProtection.js
// Browser-source hardening for production.
// Important: browser HTML/JS can never be made truly secret because the browser must receive it.
// This layer makes casual copying harder by disabling source maps/cache, minifying rendered HTML,
// encoding inline EJS scripts, and serving public JS through a small runtime loader.

import fs from "fs";
import path from "path";


function optionEnabled(value) {
  try {
    return (typeof value === "function" ? value() : value) !== false;
  } catch {
    return true;
  }
}

function isHtmlRequest(req) {
  const accept = String(req.headers.accept || "");
  const p = String(req.path || "");
  return accept.includes("text/html") || (!p.includes(".") && !p.startsWith("/api/"));
}

function isClientJsPath(pathname) {
  return /\.(?:m?js|cjs)$/i.test(String(pathname || ""));
}

function noStore(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, private, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
}

function cacheProtectedAsset(res) {
  // ลด Network/Egress: public JS/CSS ที่ผ่าน source protection ก็ยังเป็น static asset
  // ให้ cache ได้ยาวเหมือนไฟล์ใน src/public อื่น ๆ โดยใช้ Cloudflare/browser cache ช่วยรับโหลดแทน origin
  res.setHeader("Cache-Control", "public, max-age=2592000, s-maxage=2592000, stale-while-revalidate=604800, immutable");
  res.removeHeader("Pragma");
  res.removeHeader("Expires");
  res.removeHeader("Surrogate-Control");
}

function hardeningHeaders(res) {
  res.removeHeader("SourceMap");
  res.removeHeader("X-SourceMap");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Robots-Tag", "noarchive, nosnippet, noimageindex");
  res.setHeader("X-Download-Options", "noopen");
}

function encodeBase64Utf8(code) {
  return Buffer.from(String(code || ""), "utf8").toString("base64");
}

function splitEvery(value, size = 2400) {
  const s = String(value || "");
  const out = [];
  for (let i = 0; i < s.length; i += size) out.push(s.slice(i, i + size));
  return out;
}

function isJsonLikeScript(attrs) {
  const m = String(attrs || "").match(/\btype\s*=\s*(["']?)([^"'\s>]+)\1/i);
  const type = String(m?.[2] || "").trim().toLowerCase();
  return Boolean(
    type &&
    !/^(?:text\/javascript|application\/javascript|module)$/i.test(type) &&
    /(?:json|ld\+json|importmap|speculationrules|template|x-template)/i.test(type)
  );
}

function containsStaticImportOrExport(code) {
  // Keep module files that use real ESM syntax untouched. eval cannot run import/export syntax.
  return /(^|[\n;])\s*(?:import\s+(?:[\s\S]*?\s+from\s+)?["']|export\s+)/m.test(String(code || ""));
}

function compactJsLoose(code) {
  // Conservative compaction only. Avoid aggressive parsing because many EJS scripts contain
  // template literals, URLs, Thai text, and inline SVG strings.
  return String(code || "")
    .replace(/\/\*\s*#\s*sourceMappingURL=[\s\S]*?\*\//gi, "")
    .replace(/\/\/\s*#\s*sourceMappingURL=.*$/gim, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

export function makeEvalLoader(code, label = "rtsmm") {
  const compact = compactJsLoose(code);
  const chunks = splitEvery(encodeBase64Utf8(compact));
  const chunkLiteral = JSON.stringify(chunks);
  // External JS/SW loader. Keep eval here because Service Worker has no document.
  return `(()=>{try{const _p=${chunkLiteral};const _b=_p.join("");const _s=new TextDecoder().decode(Uint8Array.from(atob(_b),c=>c.charCodeAt(0)));(0,eval)(_s)}catch(_e){setTimeout(()=>{throw _e})}})();`;
}

export function makeInlineScriptLoader(code, options = {}) {
  const compact = compactJsLoose(code);
  const chunks = splitEvery(encodeBase64Utf8(compact));
  const chunkLiteral = JSON.stringify(chunks);
  const isModule = options.module === true;
  // Inline page scripts can depend on top-level variables/functions from earlier scripts.
  // Injecting a real script element is safer than eval for EJS pages such as orders/OTP24.
  const typeLine = isModule ? `n.type="module";` : "";
  return `(()=>{try{const p=${chunkLiteral};const b=p.join("");const s=new TextDecoder().decode(Uint8Array.from(atob(b),c=>c.charCodeAt(0)));const d=document;const cur=d.currentScript;const n=d.createElement("script");${typeLine}n.text=s;(cur&&cur.parentNode?cur.parentNode:d.head||d.documentElement).insertBefore(n,cur?cur.nextSibling:null)}catch(e){setTimeout(()=>{throw e})}})();`;
}

export function minifyCssLoose(css) {
  let out = String(css || "");
  const keep = [];
  out = out.replace(/url\(\s*(["'])([\s\S]*?)\1\s*\)/gi, (m) => {
    const id = keep.push(m) - 1;
    return `%%RTSMM_CSS_KEEP_${id}%%`;
  });
  out = out
    .replace(/\/\*\s*#\s*sourceMappingURL=[\s\S]*?\*\//gi, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/@charset\s+(["']).*?\1\s*;/gi, "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s*([{}:;,>~+])\s*/g, "$1")
    .replace(/;}/g, "}")
    .replace(/\s*!important/g, "!important")
    .trim();
  out = out.replace(/%%RTSMM_CSS_KEEP_(\d+)%%/g, (_, i) => keep[Number(i)] || "");
  return out;
}

function protectInlineStyles(html, options = {}) {
  if (typeof html !== "string" || !html.includes("<style")) return html;
  if (options.enabled === false) return html;
  return html.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (full, attrs = "", css = "") => {
    const c = String(css || "");
    if (!c.trim()) return full;
    return `<style${attrs}>${minifyCssLoose(c)}</style>`;
  });
}

function protectInlineScripts(html, options = {}) {
  if (typeof html !== "string" || !html.includes("<script")) return html;
  const enabled = options.enabled !== false;
  if (!enabled) return html;

  return html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (full, attrs = "", code = "") => {
    const a = String(attrs || "");
    const c = String(code || "");

    // External script tags are handled by protectStaticJs where possible.
    if (/\bsrc\s*=/i.test(a)) return full;
    if (!c.trim()) return full;
    if (isJsonLikeScript(a)) return full;

    const isModule = /\btype\s*=\s*(["']?)module\1/i.test(a);
    if (isModule && containsStaticImportOrExport(c)) {
      return `<script${a}>${compactJsLoose(c)}</script>`;
    }

    // Loader is classic; decoded payload is inserted as a real classic/module script.
    const safeAttrs = a.replace(/\s*type\s*=\s*(["']?)module\1/ig, "");
    const loader = makeInlineScriptLoader(c, { module: isModule });
    return `<script${safeAttrs}>${loader}</script>`;
  });
}

export function minifyHtmlOutput(html, options = {}) {
  if (typeof html !== "string" || !html) return html;

  html = protectInlineScripts(html, {
    enabled: options.inlineScripts !== false,
  });

  html = protectInlineStyles(html, {
    enabled: options.inlineStyles !== false,
  });

  const keep = [];
  const stash = (m) => {
    const id = keep.push(m) - 1;
    return `%%RTSMM_KEEP_${id}%%`;
  };

  let out = html
    .replace(/<(script|pre|textarea)\b[\s\S]*?<\/\1>/gi, stash)
    .replace(/<!--(?!\[if|<!|>)[\s\S]*?-->/g, "")
    .replace(/>\s+</g, "><")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  out = out.replace(/%%RTSMM_KEEP_(\d+)%%/g, (_, i) => keep[Number(i)] || "");
  return out;
}

export function sourceProtectionHeaders(options = {}) {
  return function sourceProtectionHeadersMiddleware(req, res, next) {
    if (!optionEnabled(options.enabled)) return next();

    const pathname = String(req.path || "");
    const sourceLike = isHtmlRequest(req) || /\.map$/i.test(pathname);

    // HTML / source-map ยัง no-store; JS/CSS static จะกำหนด cache ใน protectStaticJs/Css แทน
    if (sourceLike) noStore(res);
    hardeningHeaders(res);

    next();
  };
}

export function blockSourceMapRequests(options = {}) {
  return function blockSourceMapRequestsMiddleware(req, res, next) {
    if (!optionEnabled(options.enabled)) return next();

    if (/\.map(?:\?|$)/i.test(String(req.originalUrl || req.url || ""))) {
      noStore(res);
      return res.status(404).type("text/plain").send("Not Found");
    }
    next();
  };
}

export function htmlSourceHardener(options = {}) {
  return function htmlSourceHardenerMiddleware(req, res, next) {
    if (!optionEnabled(options.enabled)) return next();

    const originalSend = res.send.bind(res);

    res.send = function patchedSend(body) {
      try {
        const contentType = String(res.getHeader("Content-Type") || "");
        const looksHtml = contentType.includes("text/html") || (typeof body === "string" && /^\s*<!doctype html|^\s*<html[\s>]/i.test(body));

        if (looksHtml && typeof body === "string") {
          noStore(res);
          hardeningHeaders(res);
          body = minifyHtmlOutput(body, {
            inlineScripts: optionEnabled(options.inlineScripts),
            inlineStyles: optionEnabled(options.inlineStyles),
          });
          res.setHeader("Content-Length", Buffer.byteLength(body));
        }
      } catch {}

      return originalSend(body);
    };

    next();
  };
}

export function protectStaticJs(rootDir, options = {}) {
  const root = path.resolve(rootDir);
  const exclude = options.exclude || [];

  return function protectStaticJsMiddleware(req, res, next) {
    if (!optionEnabled(options.enabled)) return next();
    if (!/^(GET|HEAD)$/i.test(req.method)) return next();

    const reqPath = String(req.path || "");
    if (!/\.(?:m?js|cjs)$/i.test(reqPath)) return next();

    let decoded = "";
    try {
      decoded = decodeURIComponent(reqPath.split("?")[0]);
    } catch {
      decoded = reqPath.split("?")[0];
    }

    if (exclude.some((rx) => rx.test(decoded))) return next();

    // Normalize and check - add additional null byte check
    if (decoded.includes('\0') || decoded.includes('..')) {
      return res.status(403).end();
    }

    const filePath = path.resolve(root, "." + decoded);
    if (!filePath.startsWith(root + path.sep)) return res.status(403).end();
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return next();

    try {
      const raw = fs.readFileSync(filePath, "utf8");
      let output = "";
      if (containsStaticImportOrExport(raw)) {
        output = compactJsLoose(raw);
      } else {
        output = makeEvalLoader(raw, decoded);
      }

      cacheProtectedAsset(res);
      hardeningHeaders(res);
      res.setHeader("Content-Type", "application/javascript; charset=utf-8");
      res.setHeader("Content-Length", Buffer.byteLength(output));
      if (req.method.toUpperCase() === "HEAD") return res.end();
      return res.send(output);
    } catch {
      return next();
    }
  };
}


export function protectStaticCss(rootDir, options = {}) {
  const root = path.resolve(rootDir);

  return function protectStaticCssMiddleware(req, res, next) {
    if (!optionEnabled(options.enabled)) return next();
    if (!/^(GET|HEAD)$/i.test(req.method)) return next();

    const reqPath = String(req.path || "");
    if (!/\.css$/i.test(reqPath.split("?")[0])) return next();

    let decoded = "";
    try {
      decoded = decodeURIComponent(reqPath.split("?")[0]);
    } catch {
      decoded = reqPath.split("?")[0];
    }

    // Normalize and check - add additional null byte check
    if (decoded.includes('\0') || decoded.includes('..')) {
      return res.status(403).end();
    }

    const filePath = path.resolve(root, "." + decoded);
    if (!filePath.startsWith(root + path.sep)) return res.status(403).end();
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return next();

    try {
      const raw = fs.readFileSync(filePath, "utf8");
      const output = minifyCssLoose(raw);
      cacheProtectedAsset(res);
      hardeningHeaders(res);
      res.setHeader("Content-Type", "text/css; charset=utf-8");
      res.setHeader("Content-Length", Buffer.byteLength(output));
      if (req.method.toUpperCase() === "HEAD") return res.end();
      return res.send(output);
    } catch {
      return next();
    }
  };
}
