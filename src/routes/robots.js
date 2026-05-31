import { Router } from "express";
const router = Router();

router.get("/robots.txt", (_req, res) => {
  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Cache-Control", "no-cache");
  res.send(`User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /dashboard
Disallow: /account
Disallow: /wallet
Disallow: /topup
Disallow: /my/

Sitemap: https://rtautobot.com/sitemap.xml`.trim());
});

export default router;
