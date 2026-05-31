import { Router } from "express";
const router = Router();

router.get("/sitemap.xml", (_req, res) => {
  res.header("Content-Type", "application/xml");

  const base = "https://rtautobot.com";
  const urls = [
    { path: "", priority: "1.0", changefreq: "daily" },
    { path: "/bonustime", priority: "0.95", changefreq: "daily" },
    { path: "/faq", priority: "0.65", changefreq: "monthly" },
    { path: "/page/terms-of-use", priority: "0.35", changefreq: "monthly" },
  ];

  const now = new Date().toISOString();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url>\n    <loc>${base}${u.path}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`).join("\n")}\n</urlset>`;
  res.send(xml);
});

export default router;
