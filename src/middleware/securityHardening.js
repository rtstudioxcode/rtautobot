// src/middleware/securityHardening.js
function envFlag(name, defaultValue = true) {
  const value = String(process.env[name] ?? "").trim().toLowerCase();
  if (!value) return defaultValue;
  return !["0", "false", "off", "no"].includes(value);
}
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const proto = String(req.headers["x-forwarded-proto"] || req.protocol || "http").split(",")[0].trim();
  const host = req.headers.host;
  if (!host) return false;
  try { return origin === new URL(`${proto}://${host}`).origin; } catch { return false; }
}
function isSensitivePath(pathname = "") {
  return pathname === "/admin" || pathname.startsWith("/admin/") || pathname === "/dashboard" || pathname.startsWith("/dashboard/") || pathname.startsWith("/account") || pathname.startsWith("/wallet") || pathname.startsWith("/topup") || pathname.startsWith("/my/") || pathname.startsWith("/bonustime") || pathname.startsWith("/api/");
}
export function securityHardening(options = {}) {
  const opts = {
    enabled: options.enabled ?? envFlag("SECURITY_HARDENING_ENABLED", true),
    sameOriginGuard: options.sameOriginGuard ?? envFlag("SAME_ORIGIN_GUARD_ENABLED", true),
    csp: options.csp ?? envFlag("SECURITY_CSP_ENABLED", false),
    ...options,
  };
  return (req, res, next) => {
    if (!opts.enabled) return next();
    const pathname = String(req.path || "");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), interest-cohort=()");
    if (opts.csp) res.setHeader("Content-Security-Policy", "default-src 'self'; base-uri 'self'; frame-ancestors 'self'; object-src 'none'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https: wss:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; form-action 'self'; upgrade-insecure-requests");
    if (isSensitivePath(pathname)) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private, max-age=0");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.setHeader("Surrogate-Control", "no-store");
    }
    if (/(^|\/)(\.env|\.git|package-lock\.json|package\.json|pnpm-lock\.yaml|yarn\.lock|service_account\.json|docker-compose\.ya?ml|Dockerfile|\.npmrc|\.yarnrc|\.DS_Store)$/i.test(pathname) || /\.(ejs|map|ts|tsx|jsx|vue|svelte|bak|old|orig|sql|sqlite|db|dump|zip|tar|tgz|gz|7z|rar)$/i.test(pathname)) {
      return res.status(404).type("text/plain").send("Not Found");
    }
    if (opts.sameOriginGuard && !["GET", "HEAD", "OPTIONS"].includes(req.method) && !sameOrigin(req)) {
      return res.status(403).json({ ok: false, error: "bad_origin" });
    }
    return next();
  };
}
export { isSensitivePath };
