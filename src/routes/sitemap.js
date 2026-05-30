import { Router } from "express";
const router = Router();

router.get("/sitemap.xml", (req, res) => {
  res.header("Content-Type", "application/xml");

  const base = "https://rtsmm-th.com";
  const urls = [
    { path: "", priority: "1.0", changefreq: "daily" },
    { path: "/orders/new", priority: "0.95", changefreq: "daily" },
    { path: "/otp24", priority: "0.95", changefreq: "daily" },
    { path: "/apps", priority: "0.95", changefreq: "daily" },
    { path: "/telegram", priority: "0.85", changefreq: "weekly" },
    { path: "/2fa", priority: "0.80", changefreq: "weekly" },
    { path: "/mails", priority: "0.70", changefreq: "weekly" },
    { path: "/blog", priority: "0.70", changefreq: "weekly" },
    { path: "/faq", priority: "0.65", changefreq: "monthly" },
    { path: "/page/terms-of-use", priority: "0.35", changefreq: "monthly" },
  ];

  const now = new Date().toISOString();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${base}${u.path}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;

  res.send(xml);
});

export default router;
