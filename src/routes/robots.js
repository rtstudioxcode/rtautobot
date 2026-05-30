import { Router } from "express";
const router = Router();

router.get("/robots.txt", (req, res) => {
  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Cache-Control", "no-cache");

  const txt = `
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /dashboard
Disallow: /account
Disallow: /wallet
Disallow: /topup
Disallow: /orders/history
Disallow: /my/

Sitemap: https://rtsmm-th.com/sitemap.xml
`.trim();

  return res.send(txt);
});

export default router;
