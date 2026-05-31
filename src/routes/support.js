// src/routes/support.js
import { Router } from "express";

const router = Router();

router.get("/", (req, res) => {
  res.render("support", {
    layout: true,
    title: "ติดต่อทีมงาน | RTAUTOBOT",
    pageTitle: "ติดต่อทีมงาน | RTAUTOBOT",
    metaDescription:
      "ติดต่อทีมงาน RTAUTOBOT ผ่าน Line OA, Telegram สำรอง และติดตามข่าวสารอัปเดตผ่าน Telegram Channel",
    bodyClass: "page-support",
  });
});

export default router;
